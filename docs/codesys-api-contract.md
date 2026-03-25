# CODESYS Integration API Contract

This document is the authoritative contract between MIAS-IO (the web app) and the
CODESYS scripting layer. **Neither agent may change this document unilaterally.**
Changes require agreement from both sides before implementation.

---

## Overview

MIAS-IO exposes a REST API that CODESYS IronPython scripts call to fetch
project data, generate CODESYS project artifacts (GVLs, hardware config, etc.),
and write back discovered hardware topology.
The CODESYS scripts live in `codesys-scripts/` and only call these endpoints — they
do not touch `src/` or `prisma/`.

```
MIAS-IO web app  ◄──►  /api/codesys/*  ◄──►  CODESYS IronPython script
```

---

## Authentication

All endpoints require an API key passed in the request header:

```
X-API-Key: <key>
```

The key is stored in MIAS-IO's environment as `CODESYS_API_KEY`. Scripts read it
from a local config file (see `codesys-scripts/config.example.ini`).

No OAuth, no cookies, no session. API keys only — IronPython 2.7 cannot handle
OAuth flows.

---

## Base URL

```
http://<mias-io-host>/api/codesys
```

For local development: `http://localhost:3000/api/codesys`

---

## Endpoints

### `GET /api/codesys/project/{id}`

Returns the full export payload for a project — hardware topology, networks, and
all signals organised by GVL. This is the primary endpoint; scripts call this once
and derive everything they need from it.

**Path parameter:** `id` — integer project ID

**Response: `200 OK`**

```json
{
  "project": {
    "id": 1,
    "name": "My Project",
    "status": "ACTIVE"
  },
  "codesysSettings": {
    "fbAlarmDigital": "FB_AlarmDigital",
    "fbAlarmAnalogue": "FB_AlarmAnalogue",
    "fbAnalogScaling": "FB_AnalogueIn_DeadBand_rev3",
    "fbTankLevel": "FB_TankLevel"
  },
  "plcs": [
    {
      "id": 10,
      "name": "PLC-01",
      "ipAddress": "192.168.1.10",
      "catalog": {
        "articleNumber": "750-8212",
        "manufacturer": "WAGO",
        "codesysDeviceId": "0000 0750 0000 0000"
      },
      "networks": [
        {
          "id": 20,
          "protocol": "MODBUS_TCP",
          "role": "MASTER",
          "description": "Field devices network",
          "hostedByCardId": null
        }
      ],
      "carriers": [
        {
          "id": 30,
          "name": "Local Bus",
          "networkId": null,
          "cabinetNumber": 3,
          "carrierNumber": 1,
          "catalog": {
            "articleNumber": "750-8212",
            "codesysDeviceId": "0000 0750 0000 0000"
          },
          "cards": [
            {
              "id": 40,
              "slotPosition": 0,
              "cardType": "DI",
              "typeCode": "I",
              "instanceNumber": 1,
              "catalog": {
                "articleNumber": "750-1405",
                "codesysModuleId": "0000 0750 0000 0000",
                "maxInputChannels": 4,
                "maxOutputChannels": 0
              }
            }
          ]
        }
      ]
    }
  ],
  "gvls": [
    {
      "id": 1,
      "name": "GVL_IO",
      "description": "Hardwired IO signals"
    }
  ],
  "signals": [
    {
      "id": 100,
      "tag": "FT_101",
      "description": "Flow transmitter inlet",
      "signalType": "ANALOG",
      "origin": "IEC",
      "direction": "INPUT",
      "gvlId": 1,
      "gvlName": "GVL_IO",
      "hwId": "N3:D01:I01",
      "ioCard": {
        "id": 40,
        "slotPosition": 0,
        "cardType": "AI",
        "plcName": "PLC-01",
        "carrierName": "Local Bus"
      },
      "instance": {
        "id": 42,
        "tag": "861-G01",
        "name": "Diesel Genset",
        "componentId": 7,
        "componentName": "ComAP Genset Controller"
      },
      "channelPosition": 0,
      "plcAddress": "%IW0",
      "plcDataType": "INT",
      "alarmFb": "FB_AlarmAnalogue",
      "scalingFb": "FB_AnalogueIn_DeadBand_rev3",
      "alarmGroup": null,
      "alarmBlockMask": null,
      "commBlockMask": null,
      "fatBlock": false,
      "suppressionSt": null,
      "specialAlarmInput": null,
      "anaToDigAlarm": false,
      "isRetain": false,
      "isPersistent": false,
      "loggingEnabled": false,
      "fbNameOverride": null,
      "useShortName": false,
      "analogSignal": {
        "inputType": "4-20mA",
        "rawMin": 0,
        "rawMax": 32767,
        "rawZero": null,
        "scaleMin": 0.0,
        "scaleMax": 100.0,
        "clampLow": null,
        "clampHigh": null,
        "deadband": null,
        "deadbandRawMin": null,
        "deadbandRawZero": null,
        "deadbandRawMax": null,
        "engineeringUnit": "L/min",
        "plcDataType": "INT",
        "scalingFb": "FB_AnalogueIn_DeadBand_rev3",
        "detectWireBreak": false,
        "detectShortCircuit": false,
        "detectOutOfRange": false,
        "namurNe43": false,
        "sensorFailRaw": null,
        "sensorFailMargin": null,
        "sensorFailBehavior": null,
        "sensorFailDelayMs": null,
        "alarms": []
      },
      "discreteSignal": null,
      "busSignal": null
    },
    {
      "id": 101,
      "tag": "XV_201_OPEN",
      "description": "Valve open feedback",
      "signalType": "DISCRETE",
      "origin": "MODBUS_TCP",
      "direction": "INPUT",
      "gvlId": 1,
      "gvlName": "GVL_IO",
      "hwId": null,
      "ioCard": null,
      "instance": null,
      "channelPosition": null,
      "plcAddress": null,
      "plcDataType": "BOOL",
      "analogSignal": null,
      "discreteSignal": {
        "trigger": "NO"
      },
      "busSignal": {
        "networkId": 20,
        "networkProtocol": "MODBUS_TCP",
        "unitId": 1,
        "registerType": "DISCRETE_INPUT",
        "registerOffset": 0,
        "rawDataType": "BOOL",
        "plcDataType": "BOOL"
      },
      "alarms": [
        {
          "type": "DISCRETE",
          "condition": "OFF_TRIGGER",
          "severity": "WARNING",
          "delaySeconds": 5,
          "message": "Valve failed to open"
        }
      ]
    }
  ]
}
```

**Notes on `instance`:**
- `null` when the signal has no component instance binding (`instanceSignalId = null`)
- When present, contains the component instance tag/name and the parent component ID/name
- `componentId` + `componentName` identify the `HardwareComponent` — the plugin can use
  `componentId` to look up the associated function block in its own database

**Notes on `plcAddress`:**
- Computed server-side from `ioCard.slotPosition` + `channelPosition` + `cardType`
- Format follows IEC 61131-3: `%IX{byte}.{bit}` (DI), `%QX{byte}.{bit}` (DO),
  `%IW{word}` (AI), `%QW{word}` (AO)
- `null` for bus/network signals (no hardware address — configured via Modbus/CAN mapping instead)

**Errors:**

| Status | Meaning |
|---|---|
| `401` | Missing or invalid `X-API-Key` |
| `403` | Project exists but requesting user has no access |
| `404` | Project not found |

---

### `POST /api/codesys/project/{id}/hardware`

Write-back endpoint: CODESYS posts its discovered device topology so MIAS-IO can
compare it against the configured hardware and flag mismatches. This is a
**read-compare** operation — it does not create or modify hardware in the database.

**Path parameter:** `id` — integer project ID

**Request body (`application/json`):**

```json
{
  "source": "codesys_scan",
  "scannedAt": "2026-03-11T10:15:00Z",
  "plcs": [
    {
      "name": "PLC-01",
      "ipAddress": "192.168.1.10",
      "deviceId": "0000 0750 0000 0000",
      "children": [
        {
          "name": "Local Bus",
          "deviceId": "0000 0750 0000 0000",
          "modules": [
            {
              "slot": 0,
              "moduleId": "0000 0750 1405 0000",
              "articleNumber": "750-1405"
            },
            {
              "slot": 1,
              "moduleId": "0000 0750 0430 0000",
              "articleNumber": "750-430"
            }
          ]
        }
      ]
    }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `source` | string | Identifies where the scan came from (e.g. `"codesys_scan"`) |
| `scannedAt` | string | ISO 8601 timestamp of when the scan was performed |
| `plcs[].name` | string | PLC name — matched case-insensitively against DB |
| `plcs[].ipAddress` | string | Fallback match key if name doesn't match |
| `plcs[].deviceId` | string | CODESYS device identifier (logged, not matched) |
| `plcs[].children[].name` | string | Carrier/bus segment name — matched case-insensitively |
| `plcs[].children[].modules[].slot` | int | Slot position (0-based) — matched against `io_card.slot_position` |
| `plcs[].children[].modules[].articleNumber` | string | Module article number — compared against catalog |

**Matching logic:**
1. PLCs matched by name (case-insensitive) or IP address
2. Children matched by name against carriers; if no name match, falls back to matching by overlapping card article numbers at the same slot positions
3. Modules matched by slot position; article numbers verified against DB

**Response: `200 OK`**

```json
{
  "accepted": true,
  "matched": 3,
  "unrecognised": 0,
  "warnings": []
}
```

| Field | Type | Notes |
|---|---|---|
| `accepted` | bool | Always `true` on 200 |
| `matched` | int | Number of items (PLCs, carriers, modules) successfully matched |
| `unrecognised` | int | Number of scanned items not found in the DB |
| `warnings` | string[] | Human-readable messages about mismatches, missing items, or conflicts |

**Warning examples:**
- `PLC "PLC-02" (192.168.1.11) not found in project`
- `Slot 3 on carrier "Local Bus": DB has 750-1405, scan has 750-430`
- `Slot 5 on carrier "Local Bus": DB has 750-430 but not found in scan`
- `Slot 2 on carrier "Local Bus": scanned module 750-1506 exists in catalog but not assigned in project`

**Errors:**

| Status | Meaning |
|---|---|
| `400` | Invalid JSON or missing `plcs` array |
| `401` | Missing or invalid `X-API-Key` |
| `404` | Project not found |

---

### `GET /api/codesys/project/{id}/gvl/{gvlId}`

Returns a single GVL's signals as a ready-to-paste CODESYS GVL declaration (plain
text, not JSON). Useful for diffing or quick inspection.

**Response: `200 OK`, `Content-Type: text/plain`**

```
VAR_GLOBAL
    FT_101     : INT;       (* Flow transmitter inlet [L/min] — %IW0 *)
    XV_201_OPEN : BOOL;     (* Valve open feedback — MODBUS_TCP unit:1 DI:0 *)
END_VAR
```

Rules for variable name generation:
- Use `signal.tag` as the variable name
- Replace all non-alphanumeric characters with `_`
- Ensure name starts with a letter (prefix `SIG_` if tag starts with a digit)
- Truncate to 64 characters (CODESYS identifier limit)
- Deduplicate collisions by appending `_2`, `_3`, etc.

**Generation modes:**
- `FLAT_VARS` (default): One variable per signal — `tag : plcDataType;`
- `FB_INSTANCES`: One FB instance per component instance — `instanceTag : functionBlock;`

---

### `GET /api/codesys/projects`

Lists all projects. Used for discovery / selection dialogs in scripts.

**Response: `200 OK`**

```json
[
  { "id": 1, "name": "My Project", "status": "ACTIVE", "client": "Acme", "location": "Oslo" },
  { "id": 2, "name": "Archive Plant", "status": "COMPLETED", "client": null, "location": null }
]
```

---

### `GET /api/codesys/tasks/pending`

Returns tasks queued for the authenticated API key, in FIFO order. Called by
`scripts/worker.py` on every poll cycle. MIAS-IO marks returned tasks as claimed
immediately so a concurrent worker cannot receive the same task twice.

**Auth:** `X-API-Key` header

**Response: `200 OK`**

```json
[
  {
    "id": "a1b2c3d4-uuid",
    "type": "SYNC_GVLS",
    "projectId": 1,
    "params": {
      "codesysProject": "C:\\projects\\my.project",
      "gvlFilter": ["GVL_IO"]
    },
    "createdAt": "2026-03-11T10:00:00Z"
  }
]
```

Returns `[]` when no tasks are queued — the worker treats this as a no-op.

**Supported task types:**

| `type` | Meaning |
|---|---|
| `SYNC_GVLS` | Fetch signals for `projectId` and update GVLs. `params.gvlFilter` is optional (sync all GVLs if absent). `params.codesysProject` is optional (worker falls back to its configured default). |

---

### `POST /api/codesys/tasks/{id}/result`

Worker posts this after each task attempt, whether success or failure.

**Auth:** `X-API-Key` header

**Request body (`application/json`):**

```json
{
  "status": "SUCCESS",
  "log": [
    "[10:01:02] Task SYNC_GVLS | MIAS project 1",
    "[10:01:04] Syncing GVL_IO -> Updated.",
    "[10:01:04] Project saved (1 GVL changed)."
  ],
  "error": null
}
```

| Field | Type | Notes |
|---|---|---|
| `status` | string | `"SUCCESS"` or `"FAILURE"` |
| `log` | string[] | Ordered log lines from the worker run |
| `error` | string\|null | Exception message on failure; `null` on success |

**Response:** `204 No Content`

---

## IEC Address Computation Rules

The MIAS-IO server computes `plcAddress` according to these rules. The CODESYS
agent must use the server-provided value — do not recompute it client-side.

| Card type | Direction | Address format | Example |
|---|---|---|---|
| DI | INPUT | `%IX{byteOffset}.{bitOffset}` | `%IX0.3` |
| DO | OUTPUT | `%QX{byteOffset}.{bitOffset}` | `%QX1.0` |
| AI | INPUT | `%IW{wordOffset}` | `%IW4` |
| AO | OUTPUT | `%QW{wordOffset}` | `%QW2` |
| COUNTER | INPUT | `%ID{dwordOffset}` | `%ID0` |
| MIXED | INPUT/OUTPUT | Same as DI/DO/AI/AO depending on `direction` | — |

Offset calculation is carrier-scoped (resets per carrier), slot-sequential. The
exact algorithm is an internal implementation detail of MIAS-IO.

---

## Data Model Notes for the CODESYS Agent

- `signal.origin` values: `IEC` (hardwired local IO), `MODBUS_RTU`, `MODBUS_TCP`,
  `CANBUS`, `CANOPEN`, `PROFIBUS`, `PROFINET`, `ETHERNETIP`, `DEVICENET`,
  `BACNET`, `J1939`, `INTERNAL` (PLC-internal variable, no physical IO)
- `signal.signalType`: `DISCRETE` or `ANALOG` — maps to BOOL and numeric IEC types
- `plcDataType` on the signal is the IEC 61131-3 type to use in the GVL declaration.
  If null, default to `BOOL` (discrete) or `INT` (analog)
- `busSignal` is present when `origin != IEC && origin != INTERNAL`
- `discreteSignal` and `analogSignal` are mutually exclusive (vertical inheritance)
- Signals without a `gvlId` belong to no GVL — put them in a catch-all `GVL_UNGROUPED`

---

## CODESYS-side Responsibilities

The CODESYS agent owns `codesys-scripts/` and is responsible for:

1. Fetching project data from the above endpoints
2. Generating and applying GVL text to CODESYS projects
3. Optionally configuring hardware device tree from carrier/card data
4. Building and/or downloading to PLC

The CODESYS agent does **not**:
- Modify `src/`, `prisma/`, or any MIAS-IO application code
- Add new API endpoints (requests go through the human)
- Store API keys in version control

---

## Change Protocol

If the CODESYS script needs data not currently in the response:
1. The CODESYS agent documents the need in `codesys-scripts/AGENTS.md`
2. The human relays the requirement to the MIAS-IO agent
3. The MIAS-IO agent adds the field and updates this document
4. Both agents are then on the updated contract

Never consume undocumented fields — they are not guaranteed stable.

---

## Plugin Installer Download

### `GET /api/codesys/plugin/download`

**Auth:** None (public endpoint)

Serves the latest MIAS-Plugin installer `.exe` from `../MIAS-Plugin/build/`.

**Response (success):**
- `200` with `Content-Type: application/octet-stream`
- `Content-Disposition: attachment; filename="MIAS-Plugin-Setup-X.Y.Z.exe"`

**Response (no installer):**
```json
{ "error": "No installer available — no setup files found" }
```
Status: `404`

The endpoint checks `storage/plugin/` (uploaded installers) then falls back to
`../MIAS-Plugin/build/` (local dev). Returns the latest version by filename sort.

### `POST /api/codesys/plugin/upload`

**Auth:** `X-API-Key` header required

Upload a new installer. Multipart form with a `file` field.
Filename must match `MIAS-Plugin-Setup-*.exe`. Replaces any existing installer.

**Request:**
```
POST /api/codesys/plugin/upload
Content-Type: multipart/form-data
X-API-Key: <key>

file: MIAS-Plugin-Setup-1.2.3.exe
```

**Response (success):**
```json
{ "ok": true, "filename": "MIAS-Plugin-Setup-1.2.3.exe", "size": 4521984 }
```

**Response (error):**
```json
{ "error": "Invalid filename — expected MIAS-Plugin-Setup-X.Y.Z.exe" }
```
Status: `400`
