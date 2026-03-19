import { basename } from 'path';
import { readAndSplit } from './scanner';
import type { GvlParseResult, ParsedVariable, ParsedFbInstance } from './types';

// Known FB types (non-primitive types that indicate an FB instance)
const PRIMITIVE_TYPES = new Set([
  'BOOL', 'BYTE', 'WORD', 'DWORD', 'LWORD',
  'SINT', 'INT', 'DINT', 'LINT', 'USINT', 'UINT', 'UDINT', 'ULINT',
  'REAL', 'LREAL', 'STRING', 'WSTRING', 'TIME', 'DATE', 'TOD', 'DT',
]);

/** Suffixes that mark auxiliary analog variables — skip these entirely */
const ANALOG_AUX_SUFFIXES = ['_RAW', '_SensorFaultAlarm', '_m3', '_cm'];

/**
 * Parse a .gvl file, extracting variables and FB instances.
 * Auxiliary analog variables (_RAW, _SensorFaultAlarm, _m3, _cm) are NOT
 * stored — they map to the same signal as the base REAL variable. The
 * connection resolver strips these suffixes when looking up variable refs.
 */
export async function parseGvl(filePath: string): Promise<GvlParseResult> {
  const gvlName = basename(filePath, '.gvl');
  const sections = await readAndSplit(filePath);
  const declaration = sections.declaration;

  const variables: ParsedVariable[] = [];
  const fbInstances: ParsedFbInstance[] = [];

  // Extract the content between VAR_GLOBAL and END_VAR
  const varBlock = extractVarBlock(declaration);
  if (!varBlock) return { gvlName, variables, fbInstances };

  // The GVL may have all declarations on one long line (analog groups)
  // or one declaration per line. We need to handle both.
  // Split by semicolons to get individual declarations.
  const declarations = splitDeclarations(varBlock);

  for (const decl of declarations) {
    const parsed = parseDeclaration(decl, gvlName);
    if (!parsed) continue;

    if (parsed.kind === 'variable') {
      variables.push(parsed.variable);
    } else if (parsed.kind === 'fbInstance') {
      fbInstances.push(parsed.instance);
    }
  }

  return { gvlName, variables, fbInstances };
}

function extractVarBlock(declaration: string): string | null {
  // Find VAR_GLOBAL ... END_VAR
  const startMatch = declaration.match(/VAR_GLOBAL\b[^\n]*/);
  if (!startMatch) return null;

  const startIdx = declaration.indexOf(startMatch[0]) + startMatch[0].length;
  const endIdx = declaration.lastIndexOf('END_VAR');
  if (endIdx === -1) return null;

  return declaration.substring(startIdx, endIdx);
}

/**
 * Split the VAR block into individual declarations.
 * Each declaration ends with a semicolon.
 * Lines in CODESYS can have multiple declarations on one line (analog groups).
 */
function splitDeclarations(block: string): string[] {
  const result: string[] = [];
  let current = '';
  let depth = 0; // track parentheses/brackets for initializer expressions

  for (let i = 0; i < block.length; i++) {
    const ch = block[i];
    if (ch === '(' && block[i + 1] !== '*') depth++;
    if (ch === ')' && i > 0 && block[i - 1] !== '*') depth--;
    if (ch === '[') depth++;
    if (ch === ']') depth--;

    current += ch;

    if (ch === ';' && depth <= 0) {
      const trimmed = current.trim();
      if (trimmed && trimmed !== ';') {
        result.push(trimmed);
      }
      current = '';
      depth = 0;
    }
  }

  // Handle any trailing content
  const trimmed = current.trim();
  if (trimmed && trimmed !== ';' && trimmed.includes(':')) {
    result.push(trimmed);
  }

  return result;
}

type ParsedDecl =
  | { kind: 'variable'; variable: ParsedVariable }
  | { kind: 'fbInstance'; instance: ParsedFbInstance }
  | null;

function parseDeclaration(decl: string, gvlName: string): ParsedDecl {
  // Strip leading comment lines (// comments often bleed from previous declaration)
  let cleaned = decl.replace(/^(\s*\/\/[^\n]*\n)+/g, '').trim();
  if (!cleaned) return null;

  // Skip comments-only lines
  if (cleaned.startsWith('//')) return null;

  // Strip {attribute ...} blocks (e.g. {attribute 'symbol' := 'none'})
  cleaned = cleaned.replace(/\{[^}]*\}/g, '').trim();
  if (!cleaned || !cleaned.includes(':')) return null;

  // Extract the name:type pair. Format: name: TYPE;
  const nameTypeMatch = cleaned.match(
    /(?:^|\s)([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([\s\S]+)/
  );
  if (!nameTypeMatch) return null;

  const name = nameTypeMatch[1];
  let rest = nameTypeMatch[2];

  // Skip REFERENCE TO and ARRAY declarations (system-level arrays)
  if (/^REFERENCE\s+TO\b/i.test(rest)) return null;
  if (/^ARRAY\s*\[/i.test(rest)) return null;

  // Extract the type (before any := initializer or ; or comment)
  // Type can be: BOOL, REAL, INT, FB_AlarmDigital, FB_AnalogueIn_DeadBand_rev3, STRING(3), etc.
  const typeMatch = rest.match(/^([A-Za-z_][A-Za-z0-9_]*(?:\([^)]*\))?)/);
  if (!typeMatch) return null;

  const dataType = typeMatch[1];

  // Determine if this is a primitive variable or an FB instance
  const baseType = dataType.replace(/\(.*\)$/, '').toUpperCase();
  const isPrimitive = PRIMITIVE_TYPES.has(baseType);

  if (isPrimitive) {
    // Skip auxiliary analog variables — they are not separate signals
    if (ANALOG_AUX_SUFFIXES.some((s) => name.endsWith(s))) return null;

    // Extract comment and hardware address from the FULL original declaration
    // (before stripping attributes), so we capture (*D03_B2.1*) even from multi-decl lines
    const comment = extractComment(decl);
    const hwInfo = extractHardwareAddress(decl);

    return {
      kind: 'variable',
      variable: {
        name,
        dataType,
        gvlName,
        hwAddress: hwInfo?.address,
        ioDirection: hwInfo?.direction,
        comment: comment ?? undefined,
      },
    };
  }

  // FB instance
  const comment = extractComment(decl);
  return {
    kind: 'fbInstance',
    instance: {
      name,
      fbTypeName: dataType,
      gvlName,
      comment: comment ?? undefined,
    },
  };
}

interface HwInfo {
  address: string;
  direction?: string;
}

/**
 * Extract hardware address from comments.
 * Patterns:
 *   //DI D03_B7.1
 *   //DO D04_B9.1
 *   (*D03_B2.1*)
 */
function extractHardwareAddress(decl: string): HwInfo | null {
  // Pattern 1: //DI D03_B7.1 or //DO D04_B9.1
  const slashMatch = decl.match(
    /\/\/\s*(DI|DO|AI|AO)\s+([A-Z]\d{2}_[A-Z]\d+\.\d+)/
  );
  if (slashMatch) {
    return { address: slashMatch[2], direction: slashMatch[1] };
  }

  // Pattern 2: (*D03_B2.1*)
  const parenMatch = decl.match(/\(\*([A-Z]\d{2}_[A-Z]\d+\.\d+)\*\)/);
  if (parenMatch) {
    return { address: parenMatch[1] };
  }

  return null;
}

function extractComment(decl: string): string | null {
  // Extract // comment (take everything after //)
  const slashMatch = decl.match(/\/\/(.+?)(?:$|(?=\{))/);
  if (slashMatch) return slashMatch[1].trim();

  // Extract (* comment *)
  const parenMatch = decl.match(/\(\*(.+?)\*\)/);
  if (parenMatch) return parenMatch[1].trim();

  return null;
}
