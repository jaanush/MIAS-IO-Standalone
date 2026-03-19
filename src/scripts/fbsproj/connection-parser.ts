import { relative } from 'path';
import { readAndSplit } from './scanner';
import type { ParsedConnection } from './types';

/**
 * Parse a .prg.st or .act.st file, extracting FB call connections.
 *
 * Patterns recognized:
 *   GVL.Instance(Input:=GVL.Signal, Output=>GVL.Signal);
 *
 * `:=` means input assignment, `=>` means output assignment.
 */
export async function parseConnections(
  filePath: string,
  rootDir: string,
): Promise<ParsedConnection[]> {
  const sections = await readAndSplit(filePath);
  const code = sections.implementation;
  if (!code) return [];

  const sourceFile = relative(rootDir, filePath).replace(/\\/g, '/');
  const connections: ParsedConnection[] = [];

  // Match FB calls: QualifiedName(params...)
  // The qualified name includes GVL prefix: GVL_Alarms.Alarm001_...
  // Params are comma-separated: ParamName:=Expr or ParamName=>Expr
  const fbCallRegex = /([A-Za-z_][A-Za-z0-9_.]*)\s*\(([^)]*)\)\s*;/g;

  let match;
  while ((match = fbCallRegex.exec(code)) !== null) {
    const fbInstanceRef = match[1];
    const paramsStr = match[2];

    // Skip if no dot (not a qualified reference like GVL.Instance)
    if (!fbInstanceRef.includes('.')) continue;

    const paramConnections = parseParams(paramsStr, fbInstanceRef, sourceFile);
    connections.push(...paramConnections);
  }

  return connections;
}

function parseParams(
  paramsStr: string,
  fbInstanceRef: string,
  sourceFile: string,
): ParsedConnection[] {
  const connections: ParsedConnection[] = [];

  // Split params by comma — but be careful about nested parens and expressions
  const params = splitParams(paramsStr);

  for (const param of params) {
    const trimmed = param.trim();
    if (!trimmed) continue;

    // Match: ParamName:=Expression or ParamName=>Expression
    const assignMatch = trimmed.match(
      /^([A-Za-z_][A-Za-z0-9_]*)\s*(:=|=>)\s*(.+)$/s
    );
    if (!assignMatch) continue;

    const parameterName = assignMatch[1];
    const operator = assignMatch[2];
    const rawExpression = assignMatch[3].trim();

    // Determine direction
    const direction: 'INPUT' | 'OUTPUT' = operator === ':=' ? 'INPUT' : 'OUTPUT';

    // Only record connections to GVL variables (qualified refs with dot)
    // Skip array indexing like GVL_AlarmSettings.AlarmSettingsDigital[1]
    // and literal values like 1, TRUE, 'string', expressions with operators
    const variableRef = extractVariableRef(rawExpression);
    if (!variableRef) continue;

    connections.push({
      fbInstanceRef,
      parameterName,
      direction,
      variableRef,
      rawExpression,
      sourceFile,
    });
  }

  return connections;
}

/**
 * Split parameter list by commas, respecting nested parentheses.
 */
function splitParams(paramsStr: string): string[] {
  const result: string[] = [];
  let current = '';
  let depth = 0;

  for (const ch of paramsStr) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) result.push(current);

  return result;
}

/**
 * Extract a GVL-qualified variable reference from an expression.
 * Returns null for literals, array indexing, or complex expressions.
 */
function extractVariableRef(expr: string): string | null {
  const trimmed = expr.trim();

  // Skip empty
  if (!trimmed) return null;

  // Skip literals: numbers, TRUE/FALSE, strings
  if (/^\d/.test(trimmed)) return null;
  if (/^(TRUE|FALSE)$/i.test(trimmed)) return null;
  if (/^'/.test(trimmed)) return null;
  if (/^T#/i.test(trimmed)) return null;

  // Skip array indexing (e.g., GVL_AlarmSettings.AlarmSettingsDigital[1])
  if (/\[/.test(trimmed)) return null;

  // Skip expressions with operators (but not the dot operator)
  if (/[+\-*/]/.test(trimmed)) return null;

  // Must be a qualified reference with at least one dot: GVL.Variable
  if (!trimmed.includes('.')) return null;

  // Must match the pattern of a qualified identifier
  if (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}
