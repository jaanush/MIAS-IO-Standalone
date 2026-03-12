# CODESYS Integration API Contract

This document is the authoritative contract between MIAS-IO (the web app) and the
CODESYS scripting layer. **Neither agent may change this document unilaterally.**
Changes require agreement from both sides before implementation.

---

## Overview

MIAS-IO exposes a read-only REST API that CODESYS IronPython scripts call to fetch
project data and generate CODESYS project artifacts (GVLs, hardware config, etc.).
The CODESYS scripts live in `codesys-scripts/` and only call these endpoints — they
do not touch `src/` or `prisma/`.

```
MIAS-IO web app  ──GET──►  /api/codesys/*  ──JSON──►  CODESYS IronPython script
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
          "catalog": {
            "articleNumber": "750-8212",
            "codesysDeviceId": "0000 0750 0000 0000"
          },
          "cards": [
            {
              "id": 40,
              "slotPosition": 0,
              "cardType": "DI",
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
      "ioCard": {
        "id": 40,
        "slotPosition": 0,
        "cardType": "AI",
        "plcName": "PLC-01",
        "carrierName": "Local Bus"
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
      "ioCard": null,
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
- Truncate to 32 characters

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
