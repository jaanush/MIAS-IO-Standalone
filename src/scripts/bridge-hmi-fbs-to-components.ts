/**
 * Bridge imported codesys_fb_definition rows (FB_Hmi*) into the wiring system
 * by creating matching HardwareComponent + ComponentSignal templates.
 *
 * Idempotent — re-running adds only what is missing.
 *
 * For each codesys_fb_definition with name LIKE 'FB_Hmi%':
 *   1. Find or create a global (project_id=NULL) HardwareComponent with
 *      function_block = fb name. Sets codesys_fb_definition.componentId.
 *   2. For each codesys_fb_parameter, create a ComponentSignal slot
 *      (skips if a slot with the same tag_suffix already exists on that
 *      component). channel_offset = next free per component.
 *
 * Skip-and-log rules (no guessing — quality over speed):
 *   - direction not in {VAR_INPUT, VAR_OUTPUT}: skip (VAR_IN_OUT, VAR are
 *     internal model state, not boundary slots).
 *   - dataType is a struct/array (T_*, ARRAY) or STRING: skip.
 *   - dataType is not in plc_data_type_catalog (cannot resolve): skip.
 *
 * Mapping:
 *   BOOL              → DI (input) / DO (output)
 *   numeric IEC types → AI (input) / AO (output)
 *
 * Usage: npx tsx src/scripts/bridge-hmi-fbs-to-components.ts
 *        npx tsx src/scripts/bridge-hmi-fbs-to-components.ts --pattern 'FB_Hmi%'
 */
import { PrismaClient, IoType } from '../../prisma/generated/prisma/client/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const NUMERIC_IEC = new Set([
  'BYTE', 'WORD', 'DWORD', 'LWORD',
  'SINT', 'INT', 'DINT', 'LINT',
  'USINT', 'UINT', 'UDINT', 'ULINT',
  'REAL', 'LREAL',
]);

function humanize(fbName: string): string {
  return fbName
    .replace(/^FB_/, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\bHmi\b/gi, 'HMI')
    .replace(/\s+/g, ' ')
    .trim();
}

type SkipReason =
  | 'direction-not-boundary'
  | 'data-type-struct-or-array'
  | 'data-type-string'
  | 'data-type-unknown'
  | 'slot-already-exists';

interface SkipEntry {
  fb: string;
  param: string;
  direction: string;
  dataType: string;
  reason: SkipReason;
}

async function main() {
  const args = process.argv.slice(2);
  const patternIdx = args.indexOf('--pattern');
  const pattern = patternIdx !== -1 ? args[patternIdx + 1] : 'FB_Hmi%';

  console.log(`Bridging codesys_fb_definition rows matching name LIKE '${pattern}' …`);

  // Build PLC data type catalog code → id lookup
  const plcTypes = await prisma.plcDataTypeCatalog.findMany({
    select: { id: true, code: true },
  });
  const plcTypeIdByCode = new Map(plcTypes.map((t) => [t.code.toUpperCase(), t.id]));

  // Pull every targeted FB definition with parameters
  const fbDefs = await prisma.codesysFbDefinition.findMany({
    where: { name: { startsWith: pattern.replace('%', '') } },
    include: {
      parameters: { orderBy: { id: 'asc' } },
    },
    orderBy: { name: 'asc' },
  });

  console.log(`Found ${fbDefs.length} FB definitions.`);

  const skips: SkipEntry[] = [];
  let createdComponents = 0;
  let linkedComponents = 0;
  let createdSignals = 0;

  for (const fbDef of fbDefs) {
    // 1. Find or create the matching global HardwareComponent
    let component = await prisma.hardwareComponent.findFirst({
      where: { functionBlock: fbDef.name, projectId: null },
      select: { id: true, name: true },
    });

    if (!component) {
      component = await prisma.hardwareComponent.create({
        data: {
          name: humanize(fbDef.name),
          functionBlock: fbDef.name,
          projectId: null,
          status: 'DRAFT',
          description: `Auto-bridged from codesys_fb_definition (${fbDef.sourceFile}).`,
        },
        select: { id: true, name: true },
      });
      createdComponents++;
      console.log(`  + Component created: ${component.name} (id=${component.id}, fb=${fbDef.name})`);
    }

    // 2. Link the FB definition to the component
    if (fbDef.componentId !== component.id) {
      await prisma.codesysFbDefinition.update({
        where: { id: fbDef.id },
        data: { componentId: component.id },
      });
      linkedComponents++;
    }

    // 3. Existing component_signals on this component (for idempotency)
    const existingSignals = await prisma.componentSignal.findMany({
      where: { componentId: component.id },
      select: { id: true, channelOffset: true, tagSuffix: true },
    });
    const existingTagSuffixes = new Set(existingSignals.map((s) => s.tagSuffix?.toLowerCase()).filter(Boolean));
    let nextOffset = existingSignals.length === 0 ? 0 : Math.max(...existingSignals.map((s) => s.channelOffset)) + 1;

    // 4. Bridge each parameter
    for (const p of fbDef.parameters) {
      const dataType = (p.dataType ?? '').trim().toUpperCase();
      const direction = (p.direction ?? '').trim().toUpperCase();

      // Skip rules
      if (direction !== 'VAR_INPUT' && direction !== 'VAR_OUTPUT') {
        skips.push({ fb: fbDef.name, param: p.name, direction: p.direction, dataType: p.dataType, reason: 'direction-not-boundary' });
        continue;
      }
      if (dataType.startsWith('T_') || dataType.includes('ARRAY')) {
        skips.push({ fb: fbDef.name, param: p.name, direction: p.direction, dataType: p.dataType, reason: 'data-type-struct-or-array' });
        continue;
      }
      if (dataType === 'STRING' || dataType === 'WSTRING' || dataType.startsWith('STRING(')) {
        skips.push({ fb: fbDef.name, param: p.name, direction: p.direction, dataType: p.dataType, reason: 'data-type-string' });
        continue;
      }
      const plcTypeId = plcTypeIdByCode.get(dataType);
      if (!plcTypeId) {
        skips.push({ fb: fbDef.name, param: p.name, direction: p.direction, dataType: p.dataType, reason: 'data-type-unknown' });
        continue;
      }

      // Idempotency: skip if a slot with this tag_suffix already exists
      if (existingTagSuffixes.has(p.name.toLowerCase())) {
        skips.push({ fb: fbDef.name, param: p.name, direction: p.direction, dataType: p.dataType, reason: 'slot-already-exists' });
        continue;
      }

      // Map IoType
      const isInput = direction === 'VAR_INPUT';
      const isBool = dataType === 'BOOL';
      const ioType: IoType = isBool
        ? (isInput ? 'DI' : 'DO')
        : (isInput ? 'AI' : 'AO');

      await prisma.componentSignal.create({
        data: {
          componentId: component.id,
          channelOffset: nextOffset,
          ioType,
          tagSuffix: p.name.slice(0, 50),
          description: `${direction} ${p.dataType}`.slice(0, 255),
          plcDataTypeId: plcTypeId,
          active: true,
        },
      });
      existingTagSuffixes.add(p.name.toLowerCase());
      nextOffset++;
      createdSignals++;
    }
  }

  // Summary
  console.log('');
  console.log('───────────────────────────────────────────────');
  console.log(`FB definitions scanned:        ${fbDefs.length}`);
  console.log(`Components created:            ${createdComponents}`);
  console.log(`FB→component links updated:    ${linkedComponents}`);
  console.log(`Component signals created:     ${createdSignals}`);
  console.log(`Parameters skipped (logged):   ${skips.length}`);
  console.log('───────────────────────────────────────────────');

  // Per-reason breakdown
  if (skips.length > 0) {
    const byReason: Record<SkipReason, SkipEntry[]> = {
      'direction-not-boundary': [],
      'data-type-struct-or-array': [],
      'data-type-string': [],
      'data-type-unknown': [],
      'slot-already-exists': [],
    };
    for (const s of skips) byReason[s.reason].push(s);

    console.log('');
    for (const reason of Object.keys(byReason) as SkipReason[]) {
      const list = byReason[reason];
      if (list.length === 0) continue;
      console.log(`Skips (${reason}) [${list.length}]:`);
      for (const s of list) {
        console.log(`  - ${s.fb}.${s.param} (${s.direction} ${s.dataType})`);
      }
      console.log('');
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
