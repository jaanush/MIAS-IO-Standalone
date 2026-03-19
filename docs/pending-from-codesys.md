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
