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

**Root cause found:**
```json
{"error":"EACCES: permission denied, mkdir '/app/storage/plugin'","storageDir":"/app/storage/plugin"}
```
The deployed container doesn't have `/app/storage/plugin/` and can't create it.
Fix: create the directory in the Dockerfile or ensure the app has write access
to `/app/storage/`.

---

## Request: Auto-generate diagnostic signal bindings for I/O modules

**From:** MIAS-Plugin | **Date:** 2026-03-30

### Problem

WAGO I/O modules with diagnostics have extra bits/bytes in their process image
that indicate sensor faults (short circuit, wire break, overrange, underrange).
These diagnostic channels are not currently modelled in MIAS-IO — they need to
be auto-generated so the plugin can bind them to the DataSource quality chain.

### What modules have diagnostics

**Digital input modules with diagnostics** (e.g. 750-421, 750-422):
- Process image: N data bits + N diagnostic bits in the same byte
- 750-421 layout (2 channels):

  | Bit 3 | Bit 2 | Bit 1 | Bit 0 |
  |-------|-------|-------|-------|
  | S2 (diag ch2) | S1 (diag ch1) | DI2 (data) | DI1 (data) |

- Diagnostic bit HIGH = sensor supply short circuit to ground
- 100ms pulse extension after fault clears
- Auto-acknowledges when fault is rectified

**Analog input modules with diagnostics** (e.g. 750-496, 750-471, 750-472):
- Process image: 1 status byte (8 bits) + 1 data word (16 bits) **per channel**
- Status byte is **optional** — must be enabled in module configuration
- Status byte layout (standard across all WAGO analog input modules):

  | Bit | Name | Meaning |
  |-----|------|---------|
  | 0 | Underrange | Below measurement range lower limit |
  | 1 | Overrange | Above measurement range upper limit |
  | 2 | User Underrange | Below user-configured lower limit |
  | 3 | User Overrange | Above user-configured upper limit |
  | 4 | Underflow | Below ADC range |
  | 5 | Overflow | Above ADC range |
  | 6 | General Error | Set when bit 0 or 1 is set |
  | 7 | RegCom | Register communication flag |

- **Wire break on 4-20mA inputs**: open circuit → 0mA → triggers bit 1 (overrange)
  and bit 6 (general error)
- **Short circuit**: triggers bit 0 (underrange) and bit 6

### What MIAS-IO needs to do

1. **Module catalog awareness**: The card/module catalog should flag which
   articles have diagnostics. New fields on the card model:

   ```
   hasDiagnostics: BOOL
   diagnosticType: 'DIGITAL_PAIRED' | 'ANALOG_STATUS_BYTE' | 'NONE'
   diagnosticBitsPerChannel: INT  (e.g. 1 for digital, 8 for analog)
   ```

2. **Auto-generate diagnostic signals**: When a card with diagnostics is added
   to a carrier, MIAS-IO should automatically create diagnostic signals
   alongside the data signals. For example, if card 750-421 channel 1 has
   signal `PT_101_Feedback`, auto-create `PT_101_Feedback_Diag` with:
   - `origin: 'IEC'`
   - `signalType: 'DISCRETE'` (for digital diag) or `'DIAGNOSTIC'` (new type?)
   - `direction: 'INPUT'`
   - `plcAddress` pointing to the diagnostic bit (bit 2 for ch1, bit 3 for ch2)
   - A reference back to the parent signal it diagnoses

3. **For analog status bytes**: Either create one diagnostic signal per status
   bit (verbose but explicit), or create one diagnostic byte signal per channel
   and let the plugin decode the bits. Recommendation: **one signal per channel**
   with `signalType: 'ANALOG_STATUS'` and let the DataSource interpret the byte.

4. **Modbus TCP pass-through**: These diagnostics flow through the Modbus TCP
   remote I/O as regular register data. The carrier's register map already
   includes the diagnostic bits/bytes. MIAS-IO just needs to know which
   registers are diagnostic vs data when generating the signal list.

### How the plugin uses this

The plugin generates:
- `FB_DataSourceBit` for each data signal (bound to I/O mapping)
- A separate `FB_DataSourceBit` for each diagnostic signal
- In `PRG_MIAS_Init`: binds the diagnostic source to the data source's quality:

  ```iec-st
  // If diagnostic bit goes HIGH, set parent signal quality to BAD
  IF GVL_HAL.src_PT_101_Diag.AsBool THEN
      GVL_HAL.src_PT_101.SetQuality(E_DataQuality.BAD_SENSOR_FAILURE);
  END_IF
  ```

  Or for analog: reads the status byte and sets quality based on bit flags.

### Known diagnostic modules in LasseMaja

The LasseMaja project currently has no diagnostic modules in the MIAS-IO
signal database (all are standard 750-626 DI/DO combo without diagnostics).
But future projects will use diagnostic-capable modules. The catalog should
be ready for them.

### References

- WAGO 750-421 manual: 2DI 24VDC 3ms with diagnostics
  (process image Table 1, diagnostic function §4.3)
- WAGO 750-496 manual: 8AI 0/4-20mA with status bytes
  (status byte Table 18, bit definitions §6)
- Standard across all WAGO 750 series analog input modules with diagnostics

---

## Specification: MIAS DevTools — Live PLC Monitoring & IO-Check

**From:** MIAS-Plugin | **Date:** 2026-03-31

### Purpose

A mobile-first web tool for **development and commissioning** of MIAS PLC
systems. Two core use cases:

1. **Live monitoring** — real-time variable display with value-change logging
   during development (replaces staring at CODESYS online view)
2. **IO-check** — walk-around commissioning tool on a phone/tablet, verifying
   physical wiring signal by signal with pass/fail tracking

### Why MIAS-IO should build this

MIAS-IO already has: Node.js backend, React frontend, signal metadata (tags,
GVL grouping, ioCard, channelPosition, data types, units), project/PLC model,
and user auth. Building the devtools frontend here avoids duplicating all of
that. The CODESYS plugin side will handle the PLC-facing parts (OPC UA symbol
configuration, variable pragmas).

### Architecture

```
Phone/Tablet (vessel WiFi or VPN)
    │ HTTPS
    ▼
MIAS-IO (Node.js backend)
    ├── React frontend (new DevTools pages)
    ├── node-opcua client (new backend module)
    │       │ opc.tcp://<plc-ip>:4840
    │       ▼
    │   CODESYS Runtime on WAGO PFC200
    │   (free OPC UA server, port 4840)
    │
    └── Existing signal metadata from database
```

**Key design point**: MIAS-IO maintains a single OPC UA session per PLC and
fans out to multiple browser clients via Socket.IO/WebSocket. This keeps PLC
load minimal (1 subscription regardless of how many browser tabs are open).

### OPC UA Connection

- **Free CODESYS OPC UA server** — no license cost, limited to fewer
  simultaneous clients but sufficient for dev/commissioning
- **Endpoint**: `opc.tcp://<plc-ip>:4840`
- **Security**: `None` for development on isolated vessel networks. Optional
  `Basic256Sha256` for networks with external access.
- **Node ID format**: `ns=4;s=|var|Application.GVL_xxx.SignalName`
  (CODESYS convention — namespace 4, string node ID with pipe-delimited path)
- **Recommended library**: `node-opcua` (npm) — mature, MIT licensed, full
  subscription support

### What the plugin provides (PLC side)

The MIAS-Plugin / GVL generator will:

1. **Add `{attribute 'symbol' := 'readwrite'}` pragma** to all generated GVL
   variables so they appear in the OPC UA address space. This is a one-line
   addition per variable block in the GVL text output.

2. **Add a Symbol Configuration object** to the CODESYS project (via C#
   plugin) that includes the generated GVLs. This is required for the OPC UA
   server to serve the variables.

3. **Expose the OPC UA node ID mapping**: The node ID for each signal follows
   a deterministic pattern:
   ```
   ns=4;s=|var|Application.{gvlName}.{variableName}
   ```
   MIAS-IO can construct the node ID from existing signal metadata (gvlName +
   tag) without any new API endpoint.

### What MIAS-IO should build

#### Backend: OPC UA Bridge Module

New module in the MIAS-IO backend that:

1. **Connects to PLC OPC UA servers** — one connection per PLC in the project.
   Connection parameters (IP, port) come from the existing PLC model in MIAS-IO.

2. **Subscription management**:
   - Creates one `ClientSubscription` per PLC with configurable publishing
     interval (default 250ms, configurable per session)
   - Adds `MonitoredItem` for each signal the frontend requests
   - Pushes value changes to frontend via Socket.IO
   - Single subscription shared across all browser clients (fan-out pattern)

3. **Value write** — accepts write requests from the frontend, validates
   against signal metadata (data type, read/write flag), calls
   `session.write()` on OPC UA

4. **Connection lifecycle**:
   - Connect on first browser request (lazy)
   - Reconnect automatically on connection loss (node-opcua has built-in
     reconnection strategy)
   - Disconnect after configurable idle timeout (no browsers watching)
   - Expose connection status via Socket.IO event

5. **REST endpoints** (under `/api/devtools/`):
   ```
   GET  /api/devtools/plc/:plcId/status        — connection status
   POST /api/devtools/plc/:plcId/connect        — trigger connection
   POST /api/devtools/plc/:plcId/disconnect     — drop connection
   GET  /api/devtools/plc/:plcId/browse?path=   — browse OPC UA tree
   POST /api/devtools/plc/:plcId/read           — one-shot read (body: {nodeIds})
   POST /api/devtools/plc/:plcId/write          — write value (body: {nodeId, value, dataType})
   GET  /api/devtools/plc/:plcId/log            — change log (query: since=ISO)
   GET  /api/devtools/plc/:plcId/log/csv        — export log as CSV
   ```

6. **Socket.IO events** (namespace `/devtools`):
   ```
   Client → Server:
     subscribe     {plcId, nodeIds[]}       — start monitoring
     unsubscribe   {plcId, nodeIds[]}       — stop monitoring
     write         {plcId, nodeId, value}   — force/override

   Server → Client:
     connection:status  {plcId, connected, message}
     value:update       {plcId, nodeId, value, timestamp, statusCode}
     value:changed      {plcId, nodeId, from, to, timestamp}  — change log
     snapshot           {plcId, values: {nodeId: {...}}}       — initial state
   ```

#### Frontend: DevTools Pages

**Page 1: Live Monitor** (`/devtools/monitor/:plcId`)

- Variable table with columns: Signal Tag | GVL | Value | Unit | Status | Last Changed
- Real-time updates via Socket.IO (no polling)
- Filter/search by signal name, GVL, or IO card
- Group by: GVL (default) | IO Card | Protocol (CAN/Modbus/Physical)
- Sparkline for numeric values (last 60 seconds)
- Color coding: green = good, yellow = stale (no update in >5s), red = OPC UA bad status
- Click a variable row to expand: shows full history, write control, OPC UA node ID

**Page 2: IO-Check** (`/devtools/io-check/:plcId`)

This is the mobile-first commissioning tool:

- **Layout**: Card/list view optimized for phone portrait mode
- **Grouping**: By IO card / physical cabinet location (using `ioCard` and
  `channelPosition` from MIAS-IO signal metadata)
- **Per signal card**:
  - Signal tag (large, readable)
  - Live value (large font, high contrast — readable in sunlight)
  - For BOOL: big ON/OFF indicator with color
  - For analog: value + unit + simple bar gauge showing % of range
  - **Force button** (for outputs): tap to toggle/set value — clearly marked
    as FORCE with warning color
  - **Verify checkbox**: tap to mark signal as "checked OK" or "fault found"
  - Optional notes field per signal
- **Progress tracker**: "47/278 signals verified" progress bar at top
- **Checklist export**: Generate PDF/CSV commissioning report with:
  - All signals, their measured values at check time, pass/fail status, notes
  - Timestamp, project name, PLC ID, operator name
  - Suitable for project documentation / handover

**Page 3: Connection Setup** (`/devtools/settings`)

- List of PLCs in the project with connection status indicators
- Per-PLC: edit OPC UA endpoint (IP pre-filled from PLC model), test connection
- Publishing interval slider (100ms – 2000ms)
- Session log (connection events, errors)

### Signal-to-NodeID Mapping

MIAS-IO can derive the OPC UA node ID from existing data:

```
nodeId = `ns=4;s=|var|Application.${signal.gvlName}.${signal.tag}`
```

Where `gvlName` and `tag` already exist in the signal model. No new API or
lookup table needed. If the application name differs from "Application", the
PLC model should store the application name (it's already in CODESYS project
metadata).

### Performance Expectations

- **Target**: 500-1000 monitored variables at 250ms publishing interval
- OPC UA subscriptions are push-based — only changed values are sent
- Single subscription with 1000 MonitoredItems is well within OPC UA spec
- End-to-end latency: ~100-300ms (PLC → OPC UA → node-opcua → Socket.IO → browser)
- Bandwidth: ~50-200 KB/s for 1000 variables at 250ms (only deltas)

### PFC200 Docker Deployment (Future)

For commissioning without a separate server, the MIAS-IO backend (or a
stripped-down version) could run in Docker on the WAGO PFC200 itself:

- PFC200 G2 supports Docker (armhf, ~256-512MB RAM)
- Lightweight Node.js image (Alpine-based, <100MB)
- Access via `https://<plc-ip>:8443`
- This is a future enhancement — initial version runs on dev laptop or
  ship's local server alongside MIAS-IO

### Dependencies on Plugin Side

The plugin (MIAS-Plugin) must ensure:

1. Generated GVLs include `{attribute 'symbol' := 'readwrite'}` on all variables
2. A Symbol Configuration object exists in the CODESYS project referencing the GVLs
3. The free CODESYS OPC UA server package is installed in the runtime

Items 1-2 are changes to the C# plugin code. Item 3 is a manual step during
project setup (or automated via the plugin's project template).

### Priority

This is a **development tool**, not production HMI. Priorities:
1. Live monitor (most immediately useful during development)
2. IO-check (needed for first commissioning, likely a few months out)
3. Docker deployment (nice-to-have, can always run on laptop)
4. OpenBridge Design System integration (future production HMI — separate spec)
