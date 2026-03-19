import type { PrismaClient } from '../../../prisma/generated/prisma/client/client';
import type { FbsprojParseResult, ParsedVariable, ParsedFbInstance, ParsedFbDefinition, ParsedConnection } from './types';

/** Suffixes to strip when resolving variable references in connections */
const VAR_SUFFIXES = ['_RAW', '_SensorFaultAlarm', '_m3', '_cm'];

/**
 * Strip analog auxiliary suffix from a qualified variable ref.
 * "GVL_Physical.Tag_RAW" → "GVL_Physical.Tag"
 */
function stripAuxSuffix(ref: string): string | null {
  for (const suffix of VAR_SUFFIXES) {
    if (ref.endsWith(suffix)) {
      return ref.slice(0, -suffix.length);
    }
  }
  return null;
}

/**
 * Store all parsed data in a single Prisma transaction.
 * Returns the created CodesysImport id.
 */
export async function storeParsedData(
  prisma: PrismaClient,
  projectId: number,
  result: FbsprojParseResult,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    // 1. Create import record
    const importRecord = await tx.codesysImport.create({
      data: {
        projectId,
        sourcePath: result.sourcePath,
      },
    });
    const importId = importRecord.id;

    // 2. Store FB definitions + parameters (deduplicate by name)
    const fbDefMap = new Map<string, number>(); // name -> db id
    const seenFbNames = new Set<string>();
    for (const fbDef of result.fbDefinitions) {
      if (seenFbNames.has(fbDef.name)) continue;
      seenFbNames.add(fbDef.name);

      // Deduplicate parameters by name within this FB
      const seenParams = new Set<string>();
      const uniqueParams = fbDef.parameters.filter((p) => {
        if (seenParams.has(p.name)) return false;
        seenParams.add(p.name);
        return true;
      });

      const created = await tx.codesysFbDefinition.create({
        data: {
          importId,
          name: fbDef.name,
          extendsName: fbDef.extendsName,
          sourceFile: fbDef.sourceFile,
          parameters: {
            create: uniqueParams.map((p) => ({
              name: p.name,
              direction: p.direction,
              dataType: p.dataType,
            })),
          },
        },
      });
      fbDefMap.set(fbDef.name, created.id);
    }

    // 3. Collect all variables and FB instances across GVLs
    const allVariables: ParsedVariable[] = [];
    const allFbInstances: ParsedFbInstance[] = [];
    for (const gvl of result.gvlResults) {
      allVariables.push(...gvl.variables);
      allFbInstances.push(...gvl.fbInstances);
    }

    // 4. Store variables (deduplicate by gvlName+name)
    const varMap = new Map<string, number>(); // "gvlName.name" -> db id
    for (const v of allVariables) {
      const key = `${v.gvlName}.${v.name}`;
      if (varMap.has(key)) continue;

      const created = await tx.codesysVariable.create({
        data: {
          importId,
          name: v.name,
          dataType: v.dataType,
          gvlName: v.gvlName,
          hwAddress: v.hwAddress,
          ioDirection: v.ioDirection,
          comment: v.comment,
        },
      });
      varMap.set(key, created.id);
    }

    // 5. Store FB instances (deduplicate by gvlName+name)
    const instanceMap = new Map<string, number>(); // "gvlName.name" -> db id
    for (const inst of allFbInstances) {
      const key = `${inst.gvlName}.${inst.name}`;
      if (instanceMap.has(key)) continue;

      const fbDefId = fbDefMap.get(inst.fbTypeName) ?? null;
      const created = await tx.codesysFbInstance.create({
        data: {
          importId,
          fbDefinitionId: fbDefId,
          name: inst.name,
          fbTypeName: inst.fbTypeName,
          gvlName: inst.gvlName,
          comment: inst.comment,
        },
      });
      instanceMap.set(key, created.id);
    }

    // 6. Store connections — resolve variable refs with suffix stripping
    let connectionCount = 0;
    for (const conn of result.connections) {
      const fbInstanceId = instanceMap.get(conn.fbInstanceRef);
      if (!fbInstanceId) continue; // Skip connections to unknown FB instances

      // Try exact match first, then strip analog suffixes
      let variableId = varMap.get(conn.variableRef) ?? null;
      if (!variableId) {
        const stripped = stripAuxSuffix(conn.variableRef);
        if (stripped) {
          variableId = varMap.get(stripped) ?? null;
        }
      }

      await tx.codesysFbConnection.create({
        data: {
          importId,
          fbInstanceId,
          variableId,
          parameterName: conn.parameterName,
          direction: conn.direction,
          rawExpression: conn.rawExpression,
          sourceFile: conn.sourceFile,
        },
      });
      connectionCount++;
    }

    // 7. Update counts on import record
    await tx.codesysImport.update({
      where: { id: importId },
      data: {
        gvlCount: result.gvlResults.length,
        fbCount: result.fbDefinitions.length,
        instanceCount: allFbInstances.length,
        variableCount: allVariables.length,
        connectionCount,
      },
    });

    return importId;
  }, { timeout: 120_000 });
}
