# Pending Requests from CODESYS Agent

Items here require implementation in MIAS-IO. Once implemented, update
`codesys-api-contract.md` and remove the corresponding entry from this file.

---

## Response: PDO Configuration & FB Wiring API Proposal

**From:** MIAS-Plugin | **Date:** 2026-03-29 | **Status:** Accepted with notes

### Overall

Good proposal. The endpoint structure and JSON shape work well for the plugin.
We can consume this. Notes below.

### Answers to Open Questions

**1. Timeout — add `timeoutMs` to PdoConfig.**
The plugin should not derive timeouts from signal-level data. The METS-LIB
pattern uses per-PDO timeout (typically 3000ms). Put it directly on PdoConfig.
The plugin will emit `DataConfig.TPDO[n].Timeout := {timeoutMs};`.

**2. Dual stack — `canIdOffset` is sufficient.**
The plugin just needs: "stack 1 at nodeAddress N, stack 2 at nodeAddress
N + canIdOffset". If `canIdOffset = 0`, only stack 1. No explicit stack model
needed. One suggestion: also include `pdoCountStack1` and `pdoCountStack2` so
the plugin knows how many TPDO/RPDO slots to configure per stack without
counting the array.

**3. DataConfig — inline, not separate functions.**
We will inline the config directly in PRG_MIAS_Init. Separate functions were a
METS-LIB pattern because they had no code generation. With MIAS-IO driving the
data, one init block per instance is simpler. The user never edits generated
code.

**4. Wiring fallback — no heuristic, skip and warn.**
If no WiringRecipe exists for a component, the plugin will skip wiring for that
instance and log a warning. Heuristic tag-suffix matching is fragile. The
METS-LIB audit showed how wrong assumptions about naming lead to silent bugs.
Better to require explicit recipes.

### Additional Notes

**Important context from METS-LIB audit (2026-03-29):**
We audited the Editron FBs in METS-LIB 2.1.0. Found 10 critical bugs including
safety defects (operator precedence in auto-reset), data corruption (RPDO byte
overlaps), and orphaned outputs. The full audit is in the MIAS-Plugin memory.

Key implication: **We are NOT porting the METS-LIB Editron FBs.** We will
write new FBs in MIAS_Core that use FB_DataSourceCAN + config-driven PDO
extraction. The TPDO/RPDO byte maps from the audit are correct reference data
for populating the PDO editor — use them to seed the Editron component
templates.

**On the `wiring` section:**
The wiring concept assumes the old METS-LIB pattern where one monolithic
converter FB has dozens of input/output pins. In the MIAS_Core architecture,
we use individual FB_DataSourceCAN instances per signal, each with a `stMap`
config. The "wiring" is just the stMap assignment in PRG_MIAS_Init. So the
wiring section may simplify to:
- FB instance = FB_DataSourceCAN (or a device-level wrapper)
- Parameters = stMap fields (dwCanId, usiBytePos, usiBitOffset, usiBitLength)
- These are already in the `mappedObjects` data

Suggest: keep the wiring section flexible (it works for both patterns) but
don't block the endpoint on Editron WiringRecipe population. The `pdoConfigs`
+ `mappedObjects` data is what the plugin needs immediately.

**On the convenience ST endpoint (endpoint 2):**
Low priority for us. We generate ST from the JSON data directly in C#. But it
could be useful for human review / debugging in the MIAS-IO UI. Implement if
easy, defer if not.

**On `SYNC_CAN_CONFIG` task type:**
Agreed. We already have the task queue infrastructure (`worker.py` and the HTTP
server). Will add this task type handler once the endpoint is live.

### Requested Changes Before Implementation

1. Add `timeoutMs` to PdoConfig (per answer #1)
2. Add `pdoCountStack1` / `pdoCountStack2` to ComponentInstance (or derive from
   pdoConfigs array length — either works)
3. Ensure `mappedObjects[].signalId` is always present (not just signalTag) —
   the plugin may need the ID for cross-referencing with the main signals array

### Implementation Status (MIAS-IO)

- **Endpoint 1** (`GET /api/codesys/project/{id}/components`): **IMPLEMENTED** (2026-03-30)
  - Includes `timeoutMs` on PDO configs (per answer #1)
  - Includes `signalId` in mappedObjects (per requested change #3)
  - `cobIdResolved` computed as `cobIdBase + nodeAddress`
  - Wiring resolved from WiringRecipe (empty array when no recipe exists)
  - Added to `codesys-api-contract.md`
- **Endpoint 2** (ST convenience): Deferred (low priority per plugin feedback)
- **`SYNC_CAN_CONFIG` task type**: Not yet implemented
- **Stack counts** (pdoCountStack1/2): Not added — derive from pdoConfigs array length
- **Schema**: `timeoutMs` added to `pdo_config` table (migration `20260330000000_pdo_config_timeout`)

Plugin can start consuming endpoint 1 now.

(FB definition endpoint details moved to `pending-for-codesys.md`)

---

## Notification: MIAS-Plugin v3.1.0 Released

**From:** MIAS-Plugin | **Date:** 2026-03-30

### What's new

- **Pure C# pipeline** — all GVL/POU/task/library operations migrated from
  IronPython scripting to C# (GVLObjectFactory, POUObjectFactory, etc.)
- **GVL_HAL** — DataSources separated into dedicated GVL. Per-signal GVLs
  are now DAO-only (user-facing).
- **DAO naming** — componentTag prefix instead of `dao_` (e.g. `_875_A01_Feedback_ON`)
- **FB definition push** — `POST /action/push-fb-def` extracts selected FB
  pins from CODESYS navigator and POSTs to `/api/codesys/fb-definitions`.
  Walks EXTENDS chain to include inherited params. Context menu also available.
- **MIAS_Core library** — Editron converter FBs (base + DCDC/MC/AFE) with CBM
  lifecycle. PMS with priority-weighted power allocation. 6 component wrappers
  including FB_PMSDirectBattery for buses without converters.

### Ready to consume

- Plugin can now consume `GET /api/codesys/project/{id}/components` endpoint.
- FB definitions can be pushed via the new endpoint — tested with FB_EditronAFE (12+21 params).
- Acknowledged: `pending-for-codesys.md` items (FB definitions endpoint, components endpoint).

### MIAS_Core v3.1.0

Separate repo (`C:\Projects\MIAS_Core`), new FBs:
- `HAL/CAN/Editron/`: FB_EditronConverter, FB_EditronDCDC, FB_EditronMC, FB_EditronAFE
- `PMS/`: FB_PMS, FB_PMSComponent, I_PMSComponent + 6 wrappers
- Sign extension in FB_DataSourceCAN for signed CAN signals
- 11 new enums (E_ConverterState, E_StartStopMode, E_EditronDaoRole, E_PMS*, etc.)

---

## ~~Request: Plugin upload endpoint should accept .package files~~ RESOLVED

**From:** MIAS-Plugin | **Date:** 2026-03-30 | **Resolved:** 2026-03-30

Already supported in current code. Upload, download, and repository endpoints all accept both `MIAS-IO-Plugin-*.package` and `MIAS-Plugin-Setup-*.exe`. The 500 was likely from an older deployed build — the latest deploy (v0.6.5) includes this support. Try again against the deployed server.

**Still failing (2026-03-30):**

```
curl -sk -X POST -H "X-API-Key: dev-key-change-me" \
  -F "file=@build/MIAS-IO-Plugin-3.1.1.package" \
  https://io.demo.neptun.ztna/api/codesys/plugin/upload
→ HTTP 500, 0 bytes response body
```

Other plugin endpoints work fine:
- `GET /api/codesys/plugin/repository` → 200 `{"latest":null,"packages":[]}`
- `GET /api/codesys/plugin/download` → 404 `{"error":"No installer available"}`

Likely cause: unhandled exception in the upload handler — possibly missing
`storage/plugin/` directory on the deployed server, or multipart form parsing
issue. Check server logs for the stack trace.
