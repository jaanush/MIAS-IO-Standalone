import { readdir, readFile, stat } from 'fs/promises';
import { join, basename, extname, relative } from 'path';
import type { ScannedFile, StFileSections } from './types';

/**
 * Recursively walk a .fbsproj directory, classify files by type.
 */
export async function scanProject(rootDir: string): Promise<ScannedFile[]> {
  const files: ScannedFile[] = [];
  await walk(rootDir, rootDir, files);
  return files;
}

async function walk(dir: string, rootDir: string, files: ScannedFile[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    // Skip unreadable dirs (e.g., .auxiliaries)
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip hidden/internal directories
      if (entry.name.startsWith('.')) continue;
      await walk(fullPath, rootDir, files);
    } else if (entry.isFile()) {
      const classified = classifyFile(fullPath, rootDir);
      if (classified) files.push(classified);
    }
  }
}

function classifyFile(filePath: string, rootDir: string): ScannedFile | null {
  const name = basename(filePath);
  const relPath = relative(rootDir, filePath);

  if (name.endsWith('.gvl')) {
    return { path: filePath, type: 'gvl' };
  }
  if (name.endsWith('.fb.st')) {
    return { path: filePath, type: 'fb' };
  }
  if (name.endsWith('.prg.st')) {
    return { path: filePath, type: 'prg' };
  }
  if (name.endsWith('.act.st')) {
    const parentFb = extractParentFb(filePath);
    return { path: filePath, type: 'act', parentFb };
  }
  if (name.endsWith('.meth.st')) {
    const parentFb = extractParentFb(filePath);
    return { path: filePath, type: 'meth', parentFb };
  }
  if (name.endsWith('.fn.st')) {
    return { path: filePath, type: 'fn' };
  }

  return null;
}

/**
 * Extract parent FB name from path. Methods/actions are nested under
 * `SomeFB.fb.st^/MethodName.meth.st` — the parent dir ending in `.fb.st^`
 * tells us the FB name.
 */
function extractParentFb(filePath: string): string | undefined {
  const parts = filePath.replace(/\\/g, '/').split('/');
  for (const part of parts) {
    if (part.endsWith('.fb.st^') || part.endsWith('.fb.st')) {
      return part.replace(/\.fb\.st\^?$/, '');
    }
  }
  return undefined;
}

/**
 * Split an ST file into its three sections: __METADATA__, __DECLARATION__, __IMPLEMENTATION__
 */
export function splitStFile(content: string): StFileSections {
  const metaMatch = content.indexOf('__METADATA__');
  const declMatch = content.indexOf('__DECLARATION__');
  const implMatch = content.indexOf('__IMPLEMENTATION__');

  let metadata = '';
  let declaration = '';
  let implementation = '';

  if (metaMatch !== -1 && declMatch !== -1) {
    metadata = content.substring(metaMatch + '__METADATA__'.length, declMatch).trim();
  }
  if (declMatch !== -1) {
    const declStart = declMatch + '__DECLARATION__'.length;
    const declEnd = implMatch !== -1 ? implMatch : content.length;
    declaration = content.substring(declStart, declEnd).trim();
  }
  if (implMatch !== -1) {
    implementation = content.substring(implMatch + '__IMPLEMENTATION__'.length).trim();
  }

  return { metadata, declaration, implementation };
}

/**
 * Read a file and split into sections.
 */
export async function readAndSplit(filePath: string): Promise<StFileSections> {
  const content = await readFile(filePath, 'utf-8');
  return splitStFile(content);
}
