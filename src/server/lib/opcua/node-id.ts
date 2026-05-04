/**
 * Construct OPC UA node IDs from MIAS-IO signal metadata.
 *
 * CODESYS exposes application variables under string node IDs of the form:
 *
 *   ns=4;s=|var|<deviceName>.Application.<gvlName>.<halTag>[.<getter>]
 *
 * Where:
 *   - <deviceName>  — CODESYS device-tree name (e.g. "WAGO 750-8210 PFC200 G2 4ETH").
 *                      Stored on Plc.codesysDeviceName.
 *   - <gvlName>     — The GVL the signal lives in (e.g. "GVL_Physical").
 *   - <halTag>      — The HAL FB instance name. Constructed from the project's
 *                      signal tag by stripping the systemGroup prefix and
 *                      prepending an underscore. The HAL codegen uses this
 *                      shape per project convention (verified on LasseMaja
 *                      2026-04-30; canonical rule pending plugin reply on
 *                      FR-017).
 *   - <getter>      — For READS: AsReal (analog) / AsBool (discrete). These
 *                      are FB property getters that resolve the override
 *                      chain (HMI → SIM → SIDELOAD → FALLBACK → NORMAL).
 *                      For WRITES: omit and append a sub-field via the
 *                      WriteMessage.subField field (e.g. "_rHmiValue",
 *                      "_xHmiBool", "_bHmiOverrideActive").
 */

/** Sanitize per the plugin's HalDaoModel.cs convention:
 *  every non-alphanumeric character → "_". */
function sanitize(s: string): string {
  return s.replace(/[^A-Za-z0-9]/g, "_");
}

/** Compute the HAL FB instance name as the plugin codegen does (DaoVarName).
 *  When component_tag is present, the result is the substring of the
 *  sanitized signal tag starting at the first occurrence of the sanitized
 *  component tag. If not found, falls back to `<componentTag>_<signalTag>`.
 *  When component_tag is null, just sanitize the signal tag.
 *  Always IEC-prefixed if it starts with a digit. Capped at 64 chars.
 *
 *  Examples:
 *    halTag("Contr_Mon_System_Level_Fuel_Tank", "LT-FUEL")
 *      → "LT_FUEL_Contr_Mon_System_Level_Fuel_Tank" (substring not found, fallback)
 *    halTag("AC_Distribution_875_A01_Feedback_ON", "875-A01")
 *      → "875_A01_Feedback_ON" (substring found, slice from it)
 *    halTag("574_TT01_Temp", null)
 *      → "_574_TT01_Temp" (no component, IEC digit-prefix)
 */
export function halInstanceTag(signalTag: string, componentTag: string | null | undefined): string {
  if (!componentTag) {
    let r = sanitize(signalTag);
    if (r.length > 0 && /^[0-9]/.test(r)) r = "_" + r;
    return r.length > 64 ? r.slice(0, 64) : r;
  }
  const ctRaw = sanitize(componentTag);
  const tagRaw = sanitize(signalTag);
  const idx = tagRaw.indexOf(ctRaw);
  let r = idx >= 0 ? tagRaw.slice(idx) : `${ctRaw}_${tagRaw}`;
  if (r.length > 0 && /^[0-9]/.test(r)) r = "_" + r;
  return r.length > 64 ? r.slice(0, 64) : r;
}

interface NodeIdComponents {
  deviceName: string;
  gvlName: string;
  signalTag: string;
  componentTag: string | null;
}

/** Base node ID — points at the FB instance Object. Use this as the root for
 *  WriteMessage.subField writes (HMI override via _rHmiValue / _xHmiBool /
 *  _bHmiOverrideActive). */
export function buildBaseNodeId(c: NodeIdComponents, appName = "Application"): string {
  const halTag = halInstanceTag(c.signalTag, c.componentTag);
  return `ns=4;s=|var|${c.deviceName}.${appName}.${c.gvlName}.${halTag}`;
}

/** Read node ID — appends the property getter that resolves the
 *  override chain (HMI → SIM → SIDELOAD → FALLBACK → NORMAL).
 *  AsReal for ANALOG (engineering value via DAO scale + offset),
 *  AsBool for DISCRETE. */
export function buildReadNodeId(
  c: NodeIdComponents,
  signalType: "DISCRETE" | "ANALOG",
  appName = "Application",
): string {
  const base = buildBaseNodeId(c, appName);
  const getter = signalType === "DISCRETE" ? "AsBool" : "AsReal";
  return `${base}.${getter}`;
}

/** Raw read node ID — analog only. Returns the unscaled raw counts
 *  (the value before scale + offset is applied) via the canonical `AsRaw`
 *  getter on FB_DataObject — return type is `__XWORD` (DWORD on 32-bit
 *  IEC). Confirmed by plugin in FR-021 reply 2026-05-01. Note: `AsRaw`
 *  is resolved through the override chain, so when an HMI override is
 *  active the value reflects the override-equivalent counts, not the
 *  physical card reading. After the plugin's HAL/DAO refactor lands,
 *  swap to `AsLastGood` for source-only physical-input semantics.
 *  Returns null for DISCRETE since "raw" is not meaningful there. */
export function buildRawReadNodeId(
  c: NodeIdComponents,
  signalType: "DISCRETE" | "ANALOG",
  appName = "Application",
): string | null {
  if (signalType !== "ANALOG") return null;
  const base = buildBaseNodeId(c, appName);
  return `${base}.AsRaw`;
}

/** Legacy entry point kept for any older callers — produces the
 *  Application.<gvl>.<rawTag> form WITHOUT device prefix or transformation.
 *  Do NOT use for new code; prefer buildReadNodeId / buildBaseNodeId. */
export function buildNodeId(gvlName: string, signalTag: string, appName = "Application"): string {
  return `ns=4;s=|var|${appName}.${gvlName}.${signalTag}`;
}

/** Parse a CODESYS-style node ID back into components. Best-effort —
 *  returns null if the format doesn't match. */
export function parseNodeId(nodeId: string): { appName: string; gvlName: string; signalTag: string } | null {
  const match = nodeId.match(/^ns=4;s=\|var\|([^.]+)\.([^.]+)\.(.+)$/);
  if (!match) return null;
  return { appName: match[1], gvlName: match[2], signalTag: match[3] };
}
