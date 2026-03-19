/**
 * CLI: Parse a CODESYS .fbsproj project directory, extract all GVL variables,
 * FB definitions, FB instances, and their connections, store in the database,
 * and match to existing MIAS-IO project signals.
 *
 * Usage:
 *   npx tsx src/scripts/parse-fbsproj.ts ./import/Alveli-FSB.fbsproj --project-id 2
 */
import { resolve } from 'path';
import { stat } from 'fs/promises';
import { PrismaClient } from '../../prisma/generated/prisma/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { scanProject } from './fbsproj/scanner';
import { parseGvl } from './fbsproj/gvl-parser';
import { parseFbDefinition } from './fbsproj/fb-parser';
import { parseConnections } from './fbsproj/connection-parser';
import { storeParsedData } from './fbsproj/store';
import { matchSignals } from './fbsproj/matcher';
import type { FbsprojParseResult, GvlParseResult, ParsedFbDefinition, ParsedConnection } from './fbsproj/types';

async function main() {
  const args = process.argv.slice(2);
  const projectPath = args[0];
  const projectIdFlag = args.indexOf('--project-id');
  const projectId = projectIdFlag !== -1 ? parseInt(args[projectIdFlag + 1], 10) : NaN;

  if (!projectPath || isNaN(projectId)) {
    console.error('Usage: npx tsx src/scripts/parse-fbsproj.ts <path-to-fbsproj> --project-id <id>');
    process.exit(1);
  }

  const rootDir = resolve(projectPath);

  // Verify the path exists
  try {
    const s = await stat(rootDir);
    if (!s.isDirectory()) {
      console.error(`Error: ${rootDir} is not a directory`);
      process.exit(1);
    }
  } catch {
    console.error(`Error: ${rootDir} does not exist`);
    process.exit(1);
  }

  console.log(`Parsing .fbsproj project: ${rootDir}`);
  console.log(`Target MIAS-IO project ID: ${projectId}`);
  console.log('');

  // Phase 1: Scan
  console.log('Phase 1: Scanning files...');
  const files = await scanProject(rootDir);

  const gvlFiles = files.filter((f) => f.type === 'gvl');
  const fbFiles = files.filter((f) => f.type === 'fb');
  const prgFiles = files.filter((f) => f.type === 'prg');
  const actFiles = files.filter((f) => f.type === 'act');
  const methFiles = files.filter((f) => f.type === 'meth');

  console.log(`  GVL files:  ${gvlFiles.length}`);
  console.log(`  FB files:   ${fbFiles.length}`);
  console.log(`  PRG files:  ${prgFiles.length}`);
  console.log(`  ACT files:  ${actFiles.length}`);
  console.log(`  METH files: ${methFiles.length}`);
  console.log('');

  // Phase 2: Parse GVLs
  console.log('Phase 2: Parsing GVLs...');
  const gvlResults: GvlParseResult[] = [];
  for (const f of gvlFiles) {
    try {
      const result = await parseGvl(f.path);
      gvlResults.push(result);
      console.log(`  ${result.gvlName}: ${result.variables.length} vars, ${result.fbInstances.length} FB instances`);
    } catch (err) {
      console.error(`  Error parsing ${f.path}: ${err}`);
    }
  }
  const totalVars = gvlResults.reduce((s, g) => s + g.variables.length, 0);
  const totalInstances = gvlResults.reduce((s, g) => s + g.fbInstances.length, 0);
  console.log(`  Total: ${totalVars} variables, ${totalInstances} FB instances`);
  console.log('');

  // Phase 3: Parse FB definitions
  console.log('Phase 3: Parsing FB definitions...');
  const fbDefinitions: ParsedFbDefinition[] = [];
  for (const f of fbFiles) {
    try {
      const result = await parseFbDefinition(f.path, rootDir);
      if (result) {
        fbDefinitions.push(result);
      }
    } catch (err) {
      console.error(`  Error parsing ${f.path}: ${err}`);
    }
  }
  console.log(`  Parsed ${fbDefinitions.length} FB definitions`);
  console.log('');

  // Phase 4: Parse connections from programs and actions
  console.log('Phase 4: Parsing connections...');
  const connections: ParsedConnection[] = [];
  const connectionFiles = [...prgFiles, ...actFiles];
  for (const f of connectionFiles) {
    try {
      const result = await parseConnections(f.path, rootDir);
      if (result.length > 0) {
        connections.push(...result);
        console.log(`  ${f.path.split('/').pop()}: ${result.length} connections`);
      }
    } catch (err) {
      console.error(`  Error parsing ${f.path}: ${err}`);
    }
  }
  console.log(`  Total: ${connections.length} connections`);
  console.log('');

  // Phase 5: Store in database
  console.log('Phase 5: Storing in database...');
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    // Verify project exists
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      console.error(`Error: Project ${projectId} not found`);
      process.exit(1);
    }

    const parseResult: FbsprojParseResult = {
      sourcePath: rootDir,
      gvlResults,
      fbDefinitions,
      connections,
    };

    const importId = await storeParsedData(prisma, projectId, parseResult);
    console.log(`  Created CodesysImport id=${importId}`);
    console.log('');

    // Phase 6: Match signals
    console.log('Phase 6: Matching signals...');
    const matchCount = await matchSignals(prisma, importId, projectId);
    console.log(`  Matched ${matchCount} variables to signals`);
    console.log('');

    // Summary
    const importRecord = await prisma.codesysImport.findUnique({ where: { id: importId } });
    console.log('=== Summary ===');
    console.log(`  GVLs parsed:      ${importRecord?.gvlCount}`);
    console.log(`  FB definitions:   ${importRecord?.fbCount}`);
    console.log(`  FB instances:     ${importRecord?.instanceCount}`);
    console.log(`  Variables:        ${importRecord?.variableCount}`);
    console.log(`  Connections:      ${importRecord?.connectionCount}`);
    console.log(`  Matched signals:  ${importRecord?.matchedCount}`);

    // Show unmatched GVL_Physical variables
    const unmatchedPhysical = await prisma.codesysVariable.count({
      where: {
        importId,
        gvlName: 'GVL_Physical',
        signalId: null,
      },
    });
    const totalPhysical = await prisma.codesysVariable.count({
      where: {
        importId,
        gvlName: 'GVL_Physical',
      },
    });
    console.log(`  GVL_Physical match rate: ${totalPhysical - unmatchedPhysical}/${totalPhysical}`);

  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
