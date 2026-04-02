/**
 * Construct an OPC UA node ID from MIAS-IO signal metadata.
 *
 * CODESYS convention: ns=4;s=|var|Application.{GVL_Name}.{SignalTag}
 * - Namespace 4 = application-defined variables
 * - String node ID with pipe-delimited path
 */

export function buildNodeId(gvlName: string, signalTag: string, appName = "Application"): string {
  return `ns=4;s=|var|${appName}.${gvlName}.${signalTag}`;
}

/**
 * Parse a CODESYS-style node ID back into components.
 * Returns null if the format doesn't match.
 */
export function parseNodeId(nodeId: string): { appName: string; gvlName: string; signalTag: string } | null {
  const match = nodeId.match(/^ns=4;s=\|var\|([^.]+)\.([^.]+)\.(.+)$/);
  if (!match) return null;
  return { appName: match[1], gvlName: match[2], signalTag: match[3] };
}
