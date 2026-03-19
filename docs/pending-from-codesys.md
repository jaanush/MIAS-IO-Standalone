# Pending Requests from CODESYS Agent

Items here require implementation in MIAS-IO. Once implemented, update
`codesys-api-contract.md` and remove the corresponding entry from this file.

---

## ~~3. POST hardware write-back endpoint~~ — RESOLVED 2026-03-13

Implemented at `POST /api/codesys/project/{id}/hardware`. Read-compare only (no DB writes).
Matches PLCs by name/IP, carriers by name or card overlap, modules by slot position.
Returns `{ accepted, matched, unrecognised, warnings }`.
See `docs/codesys-api-contract.md` for full spec.

---

## ~~6. GVL_Modbus struct-based generation~~ — REDIRECTED to MIAS-Plugin 2026-03-13

MIAS-IO now provides `instance` (with `componentId` and `componentName`) on each
signal in the project export. The plugin should use `componentId` to look up the
associated FB/struct name and generate the appropriate GVL declarations.
This is a plugin-side code generation concern, not an MIAS-IO API concern.

---

## ~~8. GVL_CAN and GVL_BATT — extra declarations~~ — REDIRECTED to MIAS-Plugin 2026-03-13

> FB_INSTANCES generation mode and component data are in place.
> Signal-bound instances are now exposed via the `instance` field in the project export.

**Remaining — extra declarations (non-signal instances):**
GVL_BATT needs non-signal instances per pack (e.g. `Kreisel_BMS_Comm_FWD : Kreisel_BMS_Comm;`).
Signal-less instances are outside MIAS-IO's signal export scope — the plugin should
handle these as static declarations or request a separate endpoint if needed.

---

## 9. GVL_Physical — All physical signals lack I/O card mapping

**Status:** Data entry task. All 278 GVL_Physical signals have `ioCard=null` and
`channelPosition=null`. The plcAddress computation code is now fixed (carrier offset
accumulation works), but signals need ioCard + channelPosition populated.

Source data: 852 MIAS electrical drawings (852509–852514, I/O SYSTEM D03).

---

## ~~10, 11, 12~~ — WITHDRAWN

> These items incorrectly listed specific signals from the Alveli reference project
> and asked MIAS-IO to add them. Signal definitions must come from each project's
> own design documentation (electrical drawings, system specifications), not be
> reverse-engineered from another project's CODESYS implementation. MIAS-IO is the
> source of truth for signal data — the CODESYS agent consumes it, not the other
> way around.

---

## ~~13. `plcDataType` fallback chain~~ — RESOLVED 2026-03-13

Generator fallback chain implemented. Data population is a per-project task
handled through normal MIAS-IO signal entry, not a CODESYS agent request.

---

## ~~15. HVAC Modbus register metadata~~ — RESOLVED 2026-03-13

All 12 GVL_HVAC signals now have correct registerOffset, bitOffset, and unitId.
Migration: `prisma/migration_hvac_register_metadata.sql`

---

## ~~17. CODESYS Session API — remoting infrastructure~~ — IMPLEMENTED 2026-03-19

**Status:** New. Required for CODESYS ↔ MIAS-IO real-time communication.

The CODESYS plugin needs to register itself as online when it starts, so the
web UI can show the user that their CODESYS IDE is connected and can receive
remote commands (sync GVLs, build, etc.).

### Endpoints needed

#### `POST /api/codesys/sessions/register`

Called once at plugin startup. Creates a session.

**Request body:**
```json
{
  "email": "jaanus@metstech.se",
  "hostname": "OVARVET-PC",
  "pluginVersion": "2.1.0"
}
```

**Response: `200 OK`**
```json
{
  "sessionId": "uuid-string",
  "userId": "user-uuid-or-null",
  "pollInterval": 10
}
```

- `userId` is null if no MIAS-IO user matches the email. The plugin still
  polls — the user can be matched later.
- `pollInterval` is the recommended poll interval in seconds (server-controlled).

#### `POST /api/codesys/sessions/{sessionId}/heartbeat`

Called on every poll cycle to keep the session alive and fetch pending tasks.

**Request body:**
```json
{
  "projectOpen": true,
  "projectPath": "C:\\Projects\\MyProject.project",
  "miasProjectId": 1,
  "metadata": {
    "projectName": "MIAS_Template_PLC_2.1.0",
    "gvlCount": 12,
    "pouCount": 45,
    "dutCount": 8
  }
}
```

The `metadata` field is **only included when it has changed** since the last
heartbeat. Most heartbeats will omit it. When present, MIAS-IO should update
the stored session metadata. When absent, keep the previous values.

**Response: `200 OK`**
```json
{
  "status": "ok",
  "tasks": [
    {
      "id": "task-uuid",
      "type": "SYNC_GVLS",
      "projectId": 1,
      "params": {}
    }
  ]
}
```

- Returns `tasks: []` when nothing is pending.
- If the session hasn't sent a heartbeat within 2× pollInterval, MIAS-IO
  marks it as disconnected in the UI.

#### `POST /api/codesys/sessions/{sessionId}/task-result`

Called after the plugin finishes executing a task.

**Request body:**
```json
{
  "taskId": "task-uuid",
  "status": "SUCCESS",
  "log": ["line1", "line2"],
  "error": null,
  "data": {}
}
```

**Response: `200 OK`**
```json
{ "status": "ok" }
```

### Supported task types

| Type | Description | Params |
|------|-------------|--------|
| `SYNC_GVLS` | Regenerate GVLs + PRGs from MIAS-IO data | `projectId` |
| `SYNC_HARDWARE` | Sync hardware device tree | `projectId`, `strategy` |
| `BUILD` | Compile the CODESYS project | (none) |

### SYNC_HARDWARE result data

The `SYNC_HARDWARE` task returns detailed result data in the task-result `data`
field. MIAS-IO should store this to update I/O addresses and device links.

```json
{
  "changes": { "applied": 3, "skipped": 0, "warnings": 1 },
  "devices": [
    { "name": "Controller", "device_id": "1006 1209 ...", "ip": "192.168.1.10", "depth": 0 },
    { "name": "Kbus", "device_id": "...", "ip": null, "depth": 1 },
    { "name": "750-1405", "device_id": "...", "ip": null, "depth": 2 }
  ],
  "ioMapping": [
    {
      "name": "750-1405",
      "device_id": "...",
      "parent": "Kbus",
      "ip": null,
      "channels": [
        { "id": "%IW0", "value": "0" },
        { "id": "%IW1", "value": "0" }
      ]
    }
  ]
}
```

The project can contain **multiple PLCs** — all are synced in one task. The
`devices` list is a flattened depth-first tree of the entire hardware config.
`ioMapping` provides the I/O channel addresses CODESYS assigned to each module.

### UI requirements

- Show a "CODESYS Connected" indicator next to the user's avatar/name when
  they have an active session.
- Provide a "Sync to CODESYS" button on the project page that queues a
  `SYNC_GVLS` task for that user's session.
- Show task status (pending/running/success/failure) with log output.

### Auth

Uses the same `X-API-Key` header as all other `/api/codesys/*` endpoints.
The `email` field in the register request is used to match the CODESYS user
to a MIAS-IO user account — it is NOT used for authentication.

---

## 18. Plugin auto-update endpoints

**Status:** In progress. MIAS-IO needs a `VERSION` file in the plugin repo root.

### Request to MIAS-Plugin agent

MIAS-IO will serve plugin files and generate the manifest by scanning `lib/` and
`scripts/`. To determine the current plugin version, MIAS-IO needs:

1. **A `VERSION` file** in the MIAS-Plugin repo root containing the semver string
   (e.g. `2.1.0`). No other content — just the version number.
2. **`PLUGIN_VERSION`** constant in the main plugin script (e.g. `scripts/MIAS_IO.py`)
   that matches the `VERSION` file, used by the plugin to compare against the server.

Once the `VERSION` file exists, MIAS-IO will implement the manifest and file
endpoints, and add `updateAvailable`/`latestVersion` to the heartbeat response.

---

**Original request from CODESYS agent:**

### Endpoints needed

#### `GET /api/codesys/plugin/manifest`

Returns the list of plugin files with their SHA256 checksums.

**Response: `200 OK`**
```json
{
  "version": "2.2.0",
  "files": [
    { "path": "lib/instance_builder.py", "sha256": "abc123...", "size": 8432 },
    { "path": "lib/instance_renderer.py", "sha256": "def456...", "size": 12100 },
    { "path": "scripts/script_server.py", "sha256": "789abc...", "size": 15000 }
  ]
}
```

Only files in `lib/` and `scripts/` are included. Config files, tests, and
launchers are excluded.

#### `GET /api/codesys/plugin/file?path=lib/instance_builder.py`

Returns the raw file content (binary). The `path` parameter must match a
path from the manifest.

**Response: `200 OK`** with `Content-Type: application/octet-stream`

**Errors:** `404` if path not in manifest, `400` if path is outside managed dirs.

### Heartbeat integration

The heartbeat response should include update info when a newer version is available:

```json
{
  "tasks": [],
  "updateAvailable": true,
  "latestVersion": "2.2.0"
}
```

The plugin compares `latestVersion` against its own `PLUGIN_VERSION`. When
`updateAvailable` is true, the user sees a notification in MIAS-IO's UI
and can trigger an `UPDATE_PLUGIN` task.

### How MIAS-IO serves plugin files

MIAS-IO should serve files from the `MIAS-Plugin` repo (git submodule or
copied during deployment). The manifest is generated by hashing all `.py`
files in `lib/` and `scripts/`.

---

## 19. Hardware sync: carrier device IDs and local bus filtering

**Status:** IMPLEMENTED 2026-03-19. Ready for plugin to consume.

### MIAS-IO implementation done:
- `isLocalBus` field on IoCarrier — LOCAL carriers filtered from export
- `codesysDeviceId` field on IoCarrier — included in hardware export
- Hardware API filters out `isLocalBus = true` carriers

### WAGO Device Catalog from MIAS-Plugin

Use this to populate `codesysDeviceId` on PLCs and carriers.

**PLCs:**
| Article | Description | codesysDeviceId |
|---------|-------------|-----------------|
| 750-8210 | PFC200 G2 4ETH | `1000 1006 1207 0000` |
| 750-8212 | PFC200 2ETH RS | *(needs scan — xmlDeviceId: 1006 1209)* |

**Carriers (all map to Modbus TCP Slave):**
| Article | Description | codesysDeviceId |
|---------|-------------|-----------------|
| 750-352 | Ethernet fieldbus coupler | `0059 0000 0005 0000` |
| 750-362 | Modbus TCP/UDP coupler | `0059 0000 0005 0000` |

**I/O Modules:**
| Article | Type | Description | I/O bits |
|---------|------|-------------|----------|
| 750-1405 | MIXED | 2DI+2DO 24VDC | 2in/2out |
| 750-1504 | DO | 4DO 24VDC | 0in/4out |
| 750-451 | AI | 2AI 4-20mA | 32in/0out |
| 750-483 | AI | 2AI 4-20mA diag | 32in/0out |
| 750-496 | AI | 8AI 0/4-20mA | 128in/0out |
| 750-508 | RELAY | 2DO relay | 0in/2out |
| 750-553 | AO | 2AO 0-20mA | 0in/32out |
| 750-626 | SUPPLY | 5V backplane ext | 0/0 |
| 750-652 | SERIAL | RS-232/485 | 48/48 |
| 750-658 | CAN | CAN gateway | 0/0 (FB) |
| 750-1605 | SUPPLY | 24VDC supply | 0/0 |
| 750-1607 | SUPPLY | 24VDC jumper | 0/0 |

### Response from MIAS-Plugin agent:

Remote I/O couplers (750-352 etc.) are NOT individual device types in CODESYS.
They are represented as **Modbus TCP Slave** devices in the device tree chain:

```
PLC [type=4096]
  Ethernet [type=110, id="0000 0002", ver="4.2.0.0"]
    Modbus TCP Master [type=88, id="0000 0003", ver="4.5.0.0"]
      Slave [type=89, id="0000 0005", ver="4.5.0.0"]  ← one per remote coupler
```

So the `codesysDeviceId` for ALL remote I/O carriers is the same:
- **Modbus TCP Slave: `"0059 0000 0005 0000"`** (type=89, id="0000 0005")

The article number (750-352) doesn't map to a unique CODESYS device — it's
always a Modbus TCP Slave. The I/O modules on each coupler are accessed via
Modbus registers, not as device tree children.

The plugin will handle creating the Ethernet → Master → Slave chain when it
sees carriers with this device ID.

### Request from MIAS-Plugin: Include local bus carrier with isLocalBus flag

The plugin needs D03-LOCAL's **card list** to sync modules on the PLC's built-in
Kbus. Please send D03-LOCAL in the export with `isLocalBus: true` (and no
`codesysDeviceId`). The plugin will:
- NOT add/remove the Kbus device itself (it's built-in)
- Sync the Kbus **modules** to match the local carrier's cards (remove wrong ones, add correct ones)

Without the local carrier's card data, the plugin can't configure the Kbus modules.

### ~~BUG REPORT from MIAS-Plugin agent (2026-03-19)~~ — FIXED:

`GET /api/codesys/project/1` returned 500 because the Prisma client needed
regeneration after the schema changes. Fixed after `prisma generate` + server restart.
Deploy will apply the fix to production.

### What MIAS-IO now provides in the hardware export:

- Local bus carriers (name ending in `-LOCAL`) are **filtered out** — not sent
- Remote carriers include `codesysDeviceId: "0059 0000 0005 0000"` (Modbus TCP Slave)
- All 750-352 coupler-based carriers are populated with this device ID
- The plugin can now create the full Ethernet → Master → Slave device chain

When the plugin receives a SYNC_HARDWARE task, it needs `codesysDeviceId` on
each carrier to add it to the CODESYS device tree. Currently carriers are sent
without device IDs, so the plugin can only rename the PLC but can't add carriers.

### Changes needed

1. **Don't include the local bus carrier** (e.g. "D03-LOCAL") in the hardware
   export. The PLC's built-in Kbus is managed automatically by CODESYS when
   the PLC device is added — the plugin should not create or remove it.

2. **Include `codesysDeviceId` on remote I/O carriers** (e.g. "D03-A" through
   "D03-D"). These are Modbus TCP slaves (750-352 couplers). The CODESYS device
   tree chain is:
   ```
   PLC [type=4096]
     Ethernet [type=110, id="0000 0002"]
       Modbus TCP Master [type=88, id="0000 0003"]
         Slave [type=89, id="0000 0005"]  ← one per remote coupler
   ```
   The carrier's `codesysDeviceId` should be the Modbus TCP Slave ID:
   `"0059 0000 0005 0000"` (type=89=0x59, id="0000 0005", additional=0).

   The plugin will create the Ethernet → Modbus TCP Master → Slave chain
   under the PLC when it sees remote carriers with this device ID.

---

## 16. Component Group + Component Global Signals — CAN/fieldbus signal hierarchy

**Status:** Plan drafted 2026-03-19. Awaiting review before implementation.

This adds a three-level signal hierarchy (group → component → instance) for CAN bus
converter families like Editron. Required for proper GVL_Settings generation and
component-shared configuration parameters.

### Proposed Schema

```
ComponentGroup (NEW)
  id, name, description, projectId?
  → groups related HardwareComponents (e.g. "Editron Converter Family")
  → one group can contain multiple component types

HardwareComponent (existing)
  + groupId? → ComponentGroup (nullable FK)
  → component types within a group share configuration

ComponentGroupSignal (NEW)
  id, groupId → ComponentGroup
  name, description, dataType, defaultValue
  → signals shared across ALL components in the group
  → e.g. "StartStopMode", "OperatingMode" — written once, applied to all instances
  → generates GVL_Settings entries

ComponentInstance (existing, unchanged)
  → instances of components within a group inherit group signals
```

### Use Case: Editron Converters

```
ComponentGroup: "Editron Power System"
  ├── HardwareComponent: "Editron DCDC"  (4 instances: 866-U01:1, U01:2, U02:1, U02:2)
  ├── HardwareComponent: "Editron MC"    (3 instances: 625-U01, 625-U02, 861-U01)
  └── HardwareComponent: "Editron uG AFE" (2 instances: 875-U01, 875-U02)

ComponentGroupSignals (shared across all 9 instances):
  - StartStopMode: eStartStopMode (enum)
  - AlarmsCtrlBuzzer: strAlarmsCtrlBuzzer_SharedVars (struct)
```

### Code Generation Impact

- `GVL_Settings.Settings.StartStopModes` → from ComponentGroupSignal
- `GVL_Settings.Settings.AlarmsCtrlBuzzer` → from ComponentGroupSignal
- Each instance still generates its own device FB + signals as before

### UI

- New section in component editor: "Group" dropdown (assign to group or create new)
- Group editor page: list group signals, manage which components belong
- Instance view: shows inherited group signals (read-only, managed at group level)

### Implementation Order

1. Schema: add ComponentGroup + ComponentGroupSignal models
2. UI: group management on component detail page
3. Code generation: extend GVL_Settings generation to include group signals
4. Import: auto-detect groups from parsed fbsproj data
