import { basename, relative } from 'path';
import { readAndSplit } from './scanner';
import type { ParsedFbDefinition, ParsedFbParameter } from './types';

/**
 * Parse an .fb.st file, extracting the FB definition (name, extends, parameters).
 */
export async function parseFbDefinition(
  filePath: string,
  rootDir: string,
): Promise<ParsedFbDefinition | null> {
  const sections = await readAndSplit(filePath);
  const declaration = sections.declaration;

  // Match: FUNCTION_BLOCK name [EXTENDS parent]
  const fbMatch = declaration.match(
    /FUNCTION_BLOCK\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+EXTENDS\s+([A-Za-z_][A-Za-z0-9_.]*))?/
  );
  if (!fbMatch) return null;

  const name = fbMatch[1];
  const extendsName = fbMatch[2] ?? undefined;
  const sourceFile = relative(rootDir, filePath).replace(/\\/g, '/');

  const parameters = parseParameters(declaration);

  return { name, extendsName, sourceFile, parameters };
}

/**
 * Parse VAR_INPUT, VAR_OUTPUT, VAR_IN_OUT, VAR sections from declaration.
 */
function parseParameters(declaration: string): ParsedFbParameter[] {
  const params: ParsedFbParameter[] = [];
  const sections = ['VAR_INPUT', 'VAR_OUTPUT', 'VAR_IN_OUT', 'VAR'];

  for (const sectionName of sections) {
    const sectionParams = extractSection(declaration, sectionName);
    params.push(...sectionParams);
  }

  return params;
}

function extractSection(declaration: string, sectionName: string): ParsedFbParameter[] {
  const params: ParsedFbParameter[] = [];

  // Find all blocks of this section type
  // Pattern: VAR_INPUT ... END_VAR
  const regex = new RegExp(
    `\\b${escapeRegex(sectionName)}\\b[^\\n]*\\n([\\s\\S]*?)\\bEND_VAR\\b`,
    'g'
  );

  let match;
  while ((match = regex.exec(declaration)) !== null) {
    const block = match[1];
    const lines = block.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty, comments, attributes
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('{') || trimmed.startsWith('(*')) continue;

      // Match: varName: TYPE; // optional comment
      // Handle array types: ARRAY [1..8] OF BYTE
      const varMatch = trimmed.match(
        /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+?)\s*(?:;|:=|$)/
      );
      if (!varMatch) continue;

      const name = varMatch[1];
      let dataType = varMatch[2].trim();
      // Clean trailing comment/semicolon
      dataType = dataType.replace(/\s*\/\/.*$/, '').replace(/\s*\(\*.*$/, '').replace(/;$/, '').trim();

      params.push({
        name,
        direction: sectionName,
        dataType,
      });
    }
  }

  return params;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
