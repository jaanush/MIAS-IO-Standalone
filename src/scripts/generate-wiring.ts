/**
 * Generate CODESYS FB wiring code from FbWiringTemplate definitions.
 *
 * For each ComponentInstance in a project, looks up FbWiringTemplates
 * for its HardwareComponent and generates the ST call code.
 *
 * Usage: npx tsx src/scripts/generate-wiring.ts --project-id 2
 *
 * Outputs:
 *   exports/wiring/GVL_<name>.gvl     — FB instance declarations
 *   exports/wiring/<name>_body.st     — FB call wiring code
 */
import { PrismaClient, WiringSourceType } from '../../prisma/generated/prisma/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const args = process.argv.slice(2);
  const projectIdIdx = args.indexOf('--project-id');
  const projectId = projectIdIdx !== -1 ? parseInt(args[projectIdIdx + 1], 10) : NaN;

  if (isNaN(projectId)) {
    console.error('Usage: npx tsx src/scripts/generate-wiring.ts --project-id <id>');
    process.exit(1);
  }

  // Load all component instances with their templates and signals
  const instances = await prisma.componentInstance.findMany({
    where: { projectId },
    include: {
      component: {
        include: {
          wiringRecipes: {
            include: { params: { orderBy: { sortOrder: 'asc' } } },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
      signals: {
        include: {
          componentSignal: true,
          signals: {
            include: { ioCard: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Group output by target GVL
  const gvlDeclarations = new Map<string, string[]>(); // GVL name → declaration lines
  const gvlBodies = new Map<string, string[]>();        // GVL name → body lines

  let totalCalls = 0;

  for (const inst of instances) {
    const templates = inst.component.wiringRecipes;
    if (templates.length === 0) continue;

    for (const tmpl of templates) {
      const instanceName = resolvePattern(tmpl.instanceNamePattern, inst);
      const qualifiedName = `${tmpl.targetGvl}.${instanceName}`;

      // Generate declaration line
      const declLine = `${instanceName}: ${tmpl.fbName};`;
      const declList = gvlDeclarations.get(tmpl.targetGvl) ?? [];
      declList.push(declLine);
      gvlDeclarations.set(tmpl.targetGvl, declList);

      // Generate body (FB call with parameters)
      const paramStrs: string[] = [];
      for (const param of tmpl.params) {
        const value = resolveParam(param, inst);
        if (value === null) continue; // skip if signal not found

        const op = param.direction === 'OUTPUT' ? '=>' : ':=';
        paramStrs.push(`${param.parameterName}${op}${value}`);
      }

      if (paramStrs.length > 0) {
        const bodyLine = `${qualifiedName}(${paramStrs.join(',')});`;
        const bodyList = gvlBodies.get(tmpl.targetGvl) ?? [];
        bodyList.push(bodyLine);
        gvlBodies.set(tmpl.targetGvl, bodyList);
        totalCalls++;
      }
    }
  }

  // Write output files
  const outDir = join(process.cwd(), 'exports', 'wiring');
  mkdirSync(outDir, { recursive: true });

  for (const [gvl, lines] of gvlDeclarations) {
    const content = [
      `{attribute 'qualified_only'}`,
      `VAR_GLOBAL`,
      ...lines.map((l) => `\t${l}`),
      `END_VAR`,
    ].join('\n');
    const file = join(outDir, `${gvl}.gvl`);
    writeFileSync(file, content, 'utf-8');
    console.log(`  ${file} (${lines.length} declarations)`);
  }

  for (const [gvl, lines] of gvlBodies) {
    const content = lines.join('\n');
    const file = join(outDir, `${gvl}_body.st`);
    writeFileSync(file, content, 'utf-8');
    console.log(`  ${file} (${lines.length} calls)`);
  }

  console.log(`\nGenerated ${totalCalls} FB calls across ${gvlBodies.size} GVLs.`);
  await prisma.$disconnect();
}

/**
 * Resolve a name pattern like "{{instance.tag}}" to an actual string.
 */
function resolvePattern(pattern: string, instance: any): string {
  return pattern
    .replace(/\{\{instance\.tag\}\}/g, instance.tag?.replace(/[-:]/g, '_') ?? instance.name.replace(/\s+/g, '_'))
    .replace(/\{\{instance\.name\}\}/g, instance.name.replace(/\s+/g, '_'));
}

/**
 * Resolve a FbWiringParam to an ST expression string.
 */
function resolveParam(param: any, instance: any): string | null {
  switch (param.sourceType as WiringSourceType) {
    case 'SIGNAL':
    case 'SIGNAL_RAW':
    case 'SIGNAL_SENSOR_FAULT': {
      const signal = findSignalByChannel(instance, param.channelOffset);
      if (!signal) return null;
      const tag = signal.tag ?? signal.name;
      const gvl = resolveSignalGvl(signal);
      const suffix =
        param.sourceType === 'SIGNAL_RAW' ? '_RAW' :
        param.sourceType === 'SIGNAL_SENSOR_FAULT' ? '_SensorFaultAlarm' :
        '';
      return `${gvl}.${tag}${suffix}`;
    }

    case 'INSTANCE_FB': {
      // Reference to the instance's own device FB in its GVL
      const tag = instance.tag?.replace(/[-:]/g, '_') ?? instance.name.replace(/\s+/g, '_');
      // The GVL depends on the component's bus protocol
      const gvl = resolveInstanceGvl(instance);
      return `${gvl}.${tag}`;
    }

    case 'LITERAL':
      return param.literalValue ?? '';

    case 'EXPRESSION': {
      // Resolve template variables in the expression
      let expr = param.expression ?? '';
      const tag = instance.tag?.replace(/[-:]/g, '_') ?? instance.name.replace(/\s+/g, '_');
      expr = expr.replace(/\{\{instance\.tag\}\}/g, tag);
      expr = expr.replace(/\{\{instance\.name\}\}/g, instance.name.replace(/\s+/g, '_'));
      expr = expr.replace(/\{\{instance\.fbRef\}\}/g, `${resolveInstanceGvl(instance)}.${tag}`);
      return expr;
    }

    default:
      return null;
  }
}

/**
 * Find the Signal for a given channelOffset on this ComponentInstance.
 */
function findSignalByChannel(instance: any, channelOffset: number): any | null {
  for (const instSig of instance.signals) {
    if (instSig.componentSignal.channelOffset === channelOffset) {
      // Return the first (primary) signal
      return instSig.signals[0] ?? null;
    }
  }
  return null;
}

/**
 * Determine which GVL a signal belongs to based on origin.
 */
function resolveSignalGvl(signal: any): string {
  // IEC signals go in GVL_Physical, bus signals depend on protocol
  if (signal.origin === 'IEC' || signal.origin === 'INTERNAL') {
    return 'GVL_Physical';
  }
  // For bus signals, they're typically in GVL_CAN, GVL_Modbus, etc.
  // but the physical I/O variables are still in GVL_Physical
  return 'GVL_Physical';
}

/**
 * Determine which GVL a component instance's FB lives in.
 */
function resolveInstanceGvl(instance: any): string {
  const proto = instance.component?.busProtocol;
  if (proto === 'CANBUS' || proto === 'CANOPEN') return 'GVL_CAN';
  if (proto === 'MODBUS_RTU' || proto === 'MODBUS_TCP') return 'GVL_Modbus';
  return 'GVL_Internal';
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
