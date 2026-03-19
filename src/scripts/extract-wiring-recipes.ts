/**
 * Extract WiringRecipes from parsed CODESYS import data.
 *
 * Analyzes the connections in a parsed .fbsproj import and creates
 * WiringRecipe + WiringRecipeParam records that can drive code generation.
 *
 * For each FB type that has connections, it:
 * 1. Identifies the wiring pattern (which params connect to what)
 * 2. Determines if it's component-scoped (one per instance) or singleton
 * 3. Classifies each param as SIGNAL, INSTANCE_FB, LITERAL, or EXPRESSION
 *
 * Usage: npx tsx src/scripts/extract-wiring-recipes.ts --import-id 7 --project-id 2
 */
import { PrismaClient } from '../../prisma/generated/prisma/client/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const args = process.argv.slice(2);
  const importIdIdx = args.indexOf('--import-id');
  const projectIdIdx = args.indexOf('--project-id');
  const importId = importIdIdx !== -1 ? parseInt(args[importIdIdx + 1], 10) : NaN;
  const projectId = projectIdIdx !== -1 ? parseInt(args[projectIdIdx + 1], 10) : NaN;

  if (isNaN(importId) || isNaN(projectId)) {
    console.error('Usage: npx tsx src/scripts/extract-wiring-recipes.ts --import-id <id> --project-id <id>');
    process.exit(1);
  }

  // Load all FB instances with their connections, grouped by type
  const fbInstances = await prisma.codesysFbInstance.findMany({
    where: { importId },
    include: {
      connectionsAsInstance: {
        include: { variable: true },
      },
    },
  });

  // Group by FB type
  const byType = new Map<string, typeof fbInstances>();
  for (const fbi of fbInstances) {
    if (fbi.connectionsAsInstance.length === 0) continue;
    const list = byType.get(fbi.fbTypeName) ?? [];
    list.push(fbi);
    byType.set(fbi.fbTypeName, list);
  }

  // Load HardwareComponents to find componentId matches
  const components = await prisma.hardwareComponent.findMany({
    where: { OR: [{ projectId }, { projectId: null }] },
    select: { id: true, functionBlock: true },
  });
  const fbToComponentId = new Map<string, number>();
  for (const c of components) {
    if (c.functionBlock) fbToComponentId.set(c.functionBlock, c.id);
  }

  // Load ComponentInstances to help classify connections
  const compInstances = await prisma.componentInstance.findMany({
    where: { projectId },
    include: {
      signals: {
        include: {
          componentSignal: true,
          signals: true,
        },
      },
    },
  });

  let recipesCreated = 0;

  for (const [fbType, instances] of byType) {
    // Skip alarm/scaling FBs — already handled by generate-plc-exports.ts
    if (['FB_AlarmDigital', 'FB_AlarmAnalogue', 'FB_AnalogueIn',
         'FB_AnalogueIn_Deadband', 'FB_AnalogueIn_Deadband_rev2',
         'FB_AnalogueIn_DeadBand_rev3', 'FB_AnalogueOut',
         'FB_TankLevel'].includes(fbType)) {
      continue;
    }

    // Check if a recipe already exists for this FB type
    const existing = await prisma.wiringRecipe.findFirst({
      where: { projectId, fbName: fbType },
    });
    if (existing) {
      console.log(`  Skip ${fbType} — recipe already exists`);
      continue;
    }

    // Determine if this is component-scoped
    const componentId = findComponentId(fbType, fbToComponentId);

    // Analyze the wiring pattern across all instances
    const recipe = analyzePattern(fbType, instances, compInstances, componentId);
    if (!recipe) continue;

    console.log(`\n${fbType}:`);
    console.log(`  GVL: ${recipe.targetGvl}  |  instances: ${instances.length}  |  component-scoped: ${componentId != null}`);

    // Create recipe
    await prisma.wiringRecipe.create({
      data: {
        projectId,
        componentId,
        fbName: recipe.fbName,
        targetGvl: recipe.targetGvl,
        instanceNamePattern: recipe.instanceNamePattern,
        description: `Extracted from import #${importId} (${instances.length} instances)`,
        params: {
          create: recipe.params.map((p, idx) => ({
            parameterName: p.parameterName,
            direction: p.direction,
            sourceType: p.sourceType as any,
            channelOffset: p.channelOffset ?? null,
            signalTag: p.signalTag ?? null,
            literalValue: p.literalValue ?? null,
            expression: p.expression ?? null,
            sortOrder: idx,
          })),
        },
      },
    });

    for (const p of recipe.params) {
      const src = p.sourceType === 'LITERAL' ? p.literalValue
        : p.sourceType === 'EXPRESSION' ? p.expression
        : p.sourceType === 'SIGNAL' ? `signal[${p.signalTag ?? `ch${p.channelOffset}`}]`
        : p.sourceType === 'SIGNAL_RAW' ? `signal[${p.signalTag ?? `ch${p.channelOffset}`}]_RAW`
        : p.sourceType === 'SIGNAL_SENSOR_FAULT' ? `signal[${p.signalTag ?? `ch${p.channelOffset}`}]_SF`
        : p.sourceType;
      const op = p.direction === 'OUTPUT' ? '=>' : ':=';
      console.log(`    ${p.parameterName} ${op} ${src}`);
    }
    recipesCreated++;
  }

  console.log(`\nCreated ${recipesCreated} wiring recipes.`);
  await prisma.$disconnect();
}

interface RecipePattern {
  fbName: string;
  targetGvl: string;
  instanceNamePattern: string;
  params: ParamPattern[];
}

interface ParamPattern {
  parameterName: string;
  direction: string;
  sourceType: string;
  channelOffset?: number;
  signalTag?: string;
  literalValue?: string;
  expression?: string;
}

/**
 * Find HardwareComponent.id matching an FB type name.
 */
function findComponentId(fbType: string, map: Map<string, number>): number | null {
  // Direct match
  if (map.has(fbType)) return map.get(fbType)!;
  // Try stripping _LW / _RevN suffixes
  const base = fbType.replace(/_LW$/, '').replace(/_Rev\d+/g, '').replace(/_rev\d+/g, '');
  if (map.has(base)) return map.get(base)!;
  // Try partial match
  for (const [fb, id] of map) {
    const fbBase = fb.replace(/_LW$/, '').replace(/_Rev\d+/g, '').replace(/_rev\d+/g, '');
    if (fbBase === base) return id;
  }
  return null;
}

/**
 * Analyze the wiring pattern for an FB type across its instances.
 */
function analyzePattern(
  fbType: string,
  instances: any[],
  compInstances: any[],
  componentId: number | null,
): RecipePattern | null {
  const first = instances[0];
  const targetGvl = first.gvlName;

  // Collect distinct parameter patterns
  // Use the first instance to establish the pattern, verify with others
  const paramMap = new Map<string, ParamPattern>();

  for (const inst of instances) {
    for (const conn of inst.connectionsAsInstance) {
      if (paramMap.has(conn.parameterName)) continue;
      const pattern = classifyParam(conn, inst, compInstances);
      if (pattern) paramMap.set(conn.parameterName, pattern);
    }
  }

  if (paramMap.size === 0) return null;

  // Determine instance name pattern
  let instanceNamePattern = 'fbHmi_{{instance.tag}}';
  if (first.name.startsWith('fbHmi_') || first.name.startsWith('fbHMI_')) {
    instanceNamePattern = `fbHmi_${fbType.replace(/^FB_Hmi/, '')}_{{instance.tag}}`;
  } else if (componentId != null) {
    instanceNamePattern = '{{instance.tag}}';
  } else {
    // Use actual name as template
    instanceNamePattern = first.name;
  }

  return {
    fbName: fbType,
    targetGvl,
    instanceNamePattern,
    params: Array.from(paramMap.values()),
  };
}

/**
 * Classify a single connection into a recipe param pattern.
 */
function classifyParam(conn: any, fbInst: any, compInstances: any[]): ParamPattern | null {
  const expr: string = conn.rawExpression;
  const direction: string = conn.direction;
  const paramName: string = conn.parameterName;

  // 1. Physical signal reference → SIGNAL with signalTag
  if (conn.variable?.gvlName === 'GVL_Physical') {
    const suffix = expr.endsWith('_RAW') ? 'SIGNAL_RAW'
      : expr.endsWith('_SensorFaultAlarm') ? 'SIGNAL_SENSOR_FAULT'
      : 'SIGNAL';
    // Build a tag pattern by replacing the instance-specific parts
    const signalTag = templatizeSignalRef(conn.variable.name, fbInst, compInstances);
    return { parameterName: paramName, direction, sourceType: suffix, signalTag };
  }

  // 2. CAN/bus FB reference → INSTANCE_FB or EXPRESSION
  if (expr.startsWith('GVL_CAN.') || expr.startsWith('GVL_BATT.') || expr.startsWith('GVL_Modbus.')) {
    const parts = expr.split('.');
    if (parts.length === 2) {
      // Simple ref: GVL_CAN.Tag → INSTANCE_FB
      return { parameterName: paramName, direction, sourceType: 'INSTANCE_FB' };
    }
    // Sub-property: GVL_BATT.Pack.MaxCellTemperature → EXPRESSION
    const subProp = parts.slice(2).join('.');
    return {
      parameterName: paramName, direction,
      sourceType: 'EXPRESSION',
      expression: `{{instance.fbRef}}.${subProp}`,
    };
  }

  // 3. Internal/settings/alarm references → EXPRESSION
  if (expr.includes('.')) {
    const templated = templatizeExpression(expr, fbInst, compInstances);
    return { parameterName: paramName, direction, sourceType: 'EXPRESSION', expression: templated };
  }

  // 4. Enum/constant → LITERAL
  return { parameterName: paramName, direction, sourceType: 'LITERAL', literalValue: expr };
}

/**
 * Replace instance-specific parts in a signal name with template vars.
 */
function templatizeSignalRef(varName: string, fbInst: any, compInstances: any[]): string {
  // Try to find which component instance this FB instance relates to
  for (const ci of compInstances) {
    if (!ci.tag) continue;
    const normalized = ci.tag.replace(/[-:]/g, '_');
    if (varName.includes(normalized)) {
      // Replace the instance-specific tag with a template var
      return varName.replace(normalized, '{{instance.tag}}');
    }
  }
  // Can't templatize — return as-is (literal signal tag)
  return varName;
}

/**
 * Replace instance-specific parts in an expression with template vars.
 */
function templatizeExpression(expr: string, fbInst: any, compInstances: any[]): string {
  let result = expr;
  for (const ci of compInstances) {
    if (!ci.tag) continue;
    const normalized = ci.tag.replace(/[-:]/g, '_');
    if (result.includes(normalized)) {
      result = result.replace(new RegExp(escapeRegex(normalized), 'g'), '{{instance.tag}}');
    }
  }
  return result;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
