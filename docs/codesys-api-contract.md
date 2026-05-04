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
      "codesysDeviceName": "WAGO 750-8210 PFC200 G2 4ETH",
      "kbusCycleTimeMs": null,
      "commissioningOverrides": [
        { "name": "KBus cycle time", "value": "10000", "notes": null }
      ],
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
          "baudRateKbit": null,
          "baudRateBps": null,
          "serialParity": null,
          "serialStopBits": null,
          "canMode": null,
          "canFrameFormat": null,
          "use29Bit": null,
          "canFramingMode": null,
          "canFramingDiscoveredAt": null,
          "canHeartbeatMs": null,
          "canSyncPeriodMs": null,
          "cyclePeriodMs": null,
          "cyclicCallIntervalMs": null,
          "canRole": null,
          "processImageBytes": null,
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
              "maxInputChannels": 4,
              "maxOutputChannels": 0,
              "hasDiagnostics": false,
              "diagnosticType": "NONE",
              "diagnosticBitsPerChannel": null,
              "commissioningOverrides": [],
              "catalog": {
                "articleNumber": "750-1405",
                "codesysModuleId": "0000 0750 0000 0000",
                "kbusImageSize": null
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
      "systemId": 3,
      "systemGroup": "Genset_861",
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
        "componentName": "ComAP Genset Controller",
        "commissioning": {
          "partId": "danfoss-editron:ec-c1200-450",
          "variant": "afe",
          "nodeId": 2,
          "networkId": 18
        }
      },
      "channelPosition": 0,
      "plcAddress": "%IW0",
      "isDiagnostic": false,
      "diagnosticParentId": null,
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
          "id": 165,
          "alarmNo": 19,
          "iecAlarmPath": null,
          "condition": "OFF_TRIGGER",
          "severity": "WARNING",
          "alarmGroup": "B",
          "delaySeconds": 5,
          "message": "Valve failed to open"
        }
      ]
    }
  ]
}
```

**Notes on `analogSignal.alarms[]` and `discreteSignal.alarms[]`:**

The plugin renders Älvelie-style alarm symbols (`aAlarm[N]`,
`aAlarmText[N]`, packed `axAlarmDigitalState[]` / `axAlarmAnalogueState[]`
DWORD arrays — see `MIAS-Docs/MIAS-Legacy/Älveli/Alarm System.md`) from
these rows. The render contract:

| Field | Source | Plugin use |
|---|---|---|
| `id` | `discrete_alarm.id` / `analog_alarm.id` (DB primary key) | Stable PATCH key when posting `iec_alarm_path` back via `POST /api/codesys/project/{id}/iec-paths` |
| `alarmNo` | locked sequential int from the JMobile tab | Drives the `aAlarm[N]` / `aAlarmText[N]` symbol slot. **Null = pending** — plugin should not emit a symbol for these (or emit at end-of-array as a temporary slot until the operator locks numbering) |
| `iecAlarmPath` | populated by the plugin via `POST /iec-paths` (FR-011) | Echoed back so the plugin can verify its own emit; null means codegen has not yet run for this alarm |
| `condition` | `ON_TRIGGER` / `OFF_TRIGGER` (discrete) or `HIGH` / `HIGH_HIGH` / `LOW` / `LOW_LOW` (analog) | Picks the FB and the level pin (e.g. `FB_AlarmAnalogue.HH := …`) |
| `severity` | `INFO` / `WARNING` / `ALARM` / `CRITICAL` | Maps to Älvelie's `class` (0=critical / 1=non-critical / 2=informational) — plugin picks per project convention |
| `alarmGroup` | `A` / `B` / `C` or null | METS_Lib priority tier. Falls back to `signal.alarmGroup` when null. Drives `AssignSettingsDig/Ana(... class)` |
| `delaySeconds` | int | `delay_s` parameter on `AssignSettingsDig/Ana` |
| `setpoint` / `hysteresis` | analog only | Per-level setpoint + hysteresis on `AssignSettingsAna` |
| `message` | varchar | `aAlarmText[alarmNo]` content |

Ordering: alarms are returned sorted by `alarmNo asc` with null last;
within a single signal, by `condition asc`. The plugin can therefore
walk the response in symbol-array order.

The plugin populates `iec_alarm_path` after generating the IEC code for
each alarm (e.g. `Application.GVL_ALARMS.fbAlarm_T101.HH`) via the
`/iec-paths` endpoint. Once written, the path round-trips through this
field on subsequent reads.

**Notes on `instance`:**
- `null` when the signal has no component instance binding (`instanceSignalId = null`)
- When present, contains the component instance tag/name and the parent component ID/name
- `componentId` + `componentName` identify the `HardwareComponent` — the plugin can use
  `componentId` to look up the associated function block in its own database

**Notes on `instance.commissioning` (FR-023):**
- Carries device-commissioning metadata for CANopen device-recipe codegen.
  Same shape on every signal of the same instance — plugin should dedupe by
  `instance.id` (or pre-build a project-level `devices[]` map indexed by
  instance id).
- `partId`: pointer into MIAS-ref hardware DB
  (`<vendor-slug>:<article-stem>`, e.g. `"danfoss-editron:ec-c1200-450"`).
  Plugin reads recipe from
  `MIAS-ref/docs/databases/<vendor>/parts.json[partId].specs.can_commissioning.variants[variant].minimum_sequence`.
- `variant`: firmware variant key matching the keys under
  `<part>.specs.can_commissioning.variants`. For Editron currently
  `dcdc | mc | afe | ug | bc | switch_control`. Mias-io accepts arbitrary
  strings (the docs JSON is the source of truth for valid values per
  vendor); plugin should validate against parts.json before consuming.
- `nodeId`: CANopen node id 1..127 reused from
  `ComponentInstance.nodeAddress`. `null` when not yet assigned — operator
  fills via mias-io UI before commissioning runs.
- `networkId`: bus FK reused from `ComponentInstance.busId`. Same value as
  `busSignal.networkId` for any signal on this instance — exposed here so
  the plugin doesn't have to reconcile across thousands of signals.
- LasseMaja's 7 Editron converters are backfilled (4 dcdc + 2 mc + 2 afe);
  `nodeId` left null for operator entry. New instances enter the metadata
  via the InstanceDetail UI's "Device Commissioning" section (visible on
  CAN-bus instances).

**Notes on `systemId` / `systemGroup`:**
- `systemId`: integer FK into `signal_system` (or `null`).
- `systemGroup`: stable string for grouping signals into per-system POUs
  (`PRG_MIAS_Init_System_<systemGroup>` etc.). Always non-null. Derivation
  order: (1) `signal_system.code` if IEC-clean → used verbatim,
  (2) normalized `signal_system.name` + numeric code suffix,
  (3) component-instance name prefix (`FWD…` → `Battery_866_C01`,
  `AFT…` → `Battery_866_C02`, `Genset…` → `Genset_861`),
  (4) `"System_Wide"` synthetic fallback. Plugin should never see `null`
  here — file a bug if it does. Values are not stable across renames of
  `signal_system.code`/`name` rows.

**Notes on network / bus fields:**
- `baudRateKbit` — speed in kbit/s. **Required** for `protocol IN
  ('CANBUS', 'CANOPEN', 'DEVICENET')` (DB-enforced via the
  `plc_network_baud_required_for_can` CHECK constraint). May be NULL on
  J1939 (defacto 250 kbit fallback) and on Ethernet protocols where the
  value is irrelevant.
- `canFrameFormat` — enum `STANDARD` (11-bit) | `EXTENDED` (29-bit) |
  `MIXED` | NULL. Set per-bus; reflects the protocol running on the
  wire, not subject to autodetection.
- `use29Bit` — convenience boolean derived from `canFrameFormat`:
  `STANDARD → false`, `EXTENDED → true`, `MIXED / null → null`.
- `canFramingMode` — enum `FIXED` (config authoritative) | `AUTO`
  (commissioning-time discovery; plugin posts back via
  `POST /api/codesys/projects/{id}/can-buses/{busId}/discovered`).
- `canFramingDiscoveredAt` — ISO-8601 timestamp of the last successful
  autobaud writeback, or NULL.
- `cyclicCallIntervalMs` (FR-019) — per-iface CAN_Task cadence override
  in milliseconds. `null` (default) means "use the CAN_Task cycle"
  (10 ms today). Plugin renderer emits `tCallInterval := T#<value>MS`
  per `iface_CAN_X` and auto-staggers `tCallOffset` so multiple slow
  ifaces don't all fire on the same tick. Only applies to CAN
  protocols (`CANBUS` / `CANOPEN` / `J1939` / `DEVICENET`); other
  protocols may carry the column but the field is meaningless and
  should be left null. Operator/plugin-controlled — write via
  `PATCH /api/codesys/projects/{id}/can-buses/{busId}`.
- `canRole` (FR-019 follow-up) — structured CAN bus role distinction.
  Enum `PT_CAN` (production / heartbeat-bearing — never throttle below
  the heartbeat cadence; maps to `FB_KreiselBMS.pIface`) | `P_CAN_DEBUG`
  (diagnostics-only debug bus — default disabled in app code, safe to
  throttle; maps to `FB_KreiselBMS.pPCanDevice`) | `GENERIC` (non-Kreisel
  CAN bus where the PT/P distinction doesn't apply, e.g. Editron
  CANopen) | `null` (same intent as `GENERIC`; either is fine). Lets
  the renderer + Kreisel auto-wiring read a structured field instead
  of parsing free-form bus descriptions. Write via the same PATCH
  endpoint as `cyclicCallIntervalMs`.
- `processImageBytes` (FR-020) — WAGO 750-658 K-bus process image size,
  bytes per direction. Allowed values: `8`, `12`, `16`, `20`, `24`,
  `32`, `40`, `48`. `null` (default) means "leave the module's
  EEPROM-saved value alone". Setting a value triggers a one-shot
  commissioning step on the plugin side that calls
  `FbModuleConfigurationAndStatus` with `xCmdWriteFlash` — per WAGO
  manual page 56, this triggers a controller restart, so it's
  commissioning-time only. Same PATCH endpoint as the other two CAN-bus
  fields.

**Notes on top-level `commissioning` block (FR-022 Path B):**
- `policy`: `AUTO` | `MANUAL_ONLY` | `DISABLED`. See PATCH endpoint above.
- `initialXLocalCommReq`: initial value of `GVL_MIAS.xLocalCommReq`.
- `initialXRunPlaybook`: initial value of `GVL_Commission.xRun`. Plugin codegen
  forces TRUE when `policy = AUTO` regardless of this field.
- `rebootStrategy`: `BATCH_LAST_STEP` | `PER_SLOT` — drives SAVE_FLASH placement
  in the playbook codegen.
- `catalogVersion`: opaque string for plugin traceability/logging. Currently
  the path of the seed JSON; may grow into a hash if drift becomes a problem.
  Do not parse — just log it.

**Notes on per-PLC and per-IO-card `commissioning` block (FR-022 Path A):**
- Joined catalog + project view. The catalog data (settings, signals,
  apply method, library FB names) is mirrored from the canonical docs
  catalogue (`MIAS-ref/docs/databases/wago/module_commissioning.json`,
  owned by `mias-plugin` per NOTIF-011) into mias-io's
  `module_catalog.commissioning_data` / `device_catalog.commissioning_data`
  JSONB columns via the `prisma/seed_commissioning_catalog.ts` seeder.
- `partId`: `<vendor>:<article_number>`, e.g. `wago:750-658`. Lowercase vendor.
- `moduleClass`: catalog `module_class`, one of `controller` | `can_gateway` |
  `serial_gateway` | `fieldbus_coupler` | `digital_in` | `digital_out` |
  `digital_in_out` | `analog_in` | `analog_out` | `specialty` | `psu` |
  `filter_psu` | `field_module` | `isolation_amplifier` | `dc_dc_converter` |
  `end_module` | `extension_coupler`.
- `needsCommissioning`: catalog flag. `false` modules (e.g. 750-600 end
  module) ship factory-ready and the playbook should skip them.
- `iecGlobalsPath`: catalog `iec_globals_path_pattern` with `<slot>` resolved
  to the actual `slotPosition` (PLC has no slot, returns the pattern verbatim).
- `libraryFb`: pass-through of catalog `library_fb`
  (`{codesys_v2_lib, codesys_v3_namespace, config_fb, module_fb, extra_fbs}`).
- `applyMethod`: catalog `apply_method`
  (`{save_to_eeprom_required, takes_effect_immediately, requires_runtime_restart, requires_full_pfc_reboot, notes}`).
- `settings[]`: per-setting joined view. Per entry:
  - `name`: catalog setting name, matches override row.
  - `writableFromIec`: `true` if catalog `writable_via` includes
    `"Library FB input"` — drives whether the playbook emits a write step
    or a `WAIT_OPERATOR`.
  - `dataType` / `registerOrObject` / `valueRange` / `unit` /
    `defaultValue` / `miasConventionValue`: catalog pass-through.
  - `effectiveValue`: resolved value (override → mias_convention → default → null).
  - `isOverridden`: `true` if a `PlcCommissioning` / `IoCardCommissioning`
    row exists for this setting.
  - `overrideNotes`: project-side notes column on the override row.
  - `writableVia`: catalog list (`["Library FB input", "WAGO-I/O-CHECK", …]`).
  - `encodingHint`: catalog `encoding_observed` (e.g. `{"500 kbit/s": 5}`).
  - `verifyAgainst`: catalog field if present (NOTIF-011 follow-up addition);
    otherwise null and plugin uses its own pairing table.
  - `applyMethodOverride`: per-setting override (NOTIF-011 follow-up addition);
    null when the module-level `applyMethod` applies.
  - `description`: catalog text for UI hover.
  - `operatorInstruction` (only when `writableFromIec` is false): generated
    string for the `WAIT_OPERATOR` step.
  - **Note:** `miasOpCode` mapping (e.g. `SET_BAUD_658`) stays plugin-side —
    mias-io does not emit op codes per FR-022's accepted split.
- `monitoringSignals[]`: pass-through of catalog `monitoring_signals` for
  VERIFY-pair lookups + alarm threshold seeds.
- `constraints[]`: catalog `commissioning_constraints` pass-through.
- `sourceVerified` / `sourceVerificationProject`: catalog `source` pass-through.

**Notes on `commissioningOverrides` (PLC and IO card level):**
- Project-side overrides for the hardware commissioning function. Each entry's
  `name` matches a `commissioning_settings[].name` in the canonical catalog
  entry (`MIAS-ref/docs/databases/wago/module_commissioning.json`, owned by
  `mias-plugin` per the NOTIF-011 split).
- Effective value resolution at commissioning time:
  1. Project override row in this list, OR
  2. Catalog `mias_convention_value`, OR
  3. Catalog `default_value`, OR
  4. `null` (skip — operator handles manually).
- `value` is stored as text and interpreted by the plugin per the catalog
  entry's `data_type`. Examples: `"500"` (UDINT baud), `"Asynchronous"`
  (ENUM), `"0"` (INT thread priority).
- Empty list = no overrides; use catalog defaults verbatim. **Most projects
  will have empty lists** — overrides exist only when a specific deployment
  needs to deviate from the MIAS convention.
- Catalog data itself is not in this response (plugin reads its own
  `module_commissioning.json` catalog). Mias-io's mirrored copy lives in
  `data/commissioning/wago_module_commissioning.json` (vendored, seeded into
  `module_catalog.commissioning_data` / `device_catalog.commissioning_data`
  Json columns).
- Specific MIAS conventions worth knowing:
  - 750-658 PI size (`processImageBytes` field on the Bus, see above).
  - 750-658 frame format (`canFrameFormat` STANDARD/EXTENDED, the historical
    R16+R32 register pair documented in the catalog under
    "CAN data format").
  - 750-658 baud rate (Bus `baudRateKbit`, surfaced redundantly as a
    commissioning override under "CAN baud rate" if present).
  - K-bus cycle time for the PLC controller (`kbusCycleTimeMs` field on
    the Plc, see FR-021).

**Notes on `plcAddress`:**
- Computed server-side from `ioCard.slotPosition` + `channelPosition` + `cardType`
- Format follows IEC 61131-3: `%IX{byte}.{bit}` (DI), `%QX{byte}.{bit}` (DO),
  `%IW{word}` (AI), `%QW{word}` (AO)
- `null` for bus/network signals (no hardware address — configured via Modbus/CAN mapping instead)
- For DI cards with `diagnosticType: "DIGITAL_PAIRED"`: byte count = `ceil(maxInputChannels * 2 / 8)` (data + diag bits in same byte)
- For AI cards with `diagnosticType: "ANALOG_STATUS_BYTE"`: word count = `maxInputChannels * 2` (interleaved status word + data word per channel)

**Notes on `catalog.kbusImageSize` (module catalog only):**
- Bytes per direction of Kbus process image (symmetric input/output). Integer 8, 24, or 48.
- `null` for modules with a fixed image (majority of cards). Only set for modules that ship as multiple CODESYS device variants sharing one article number — currently `750-658` (CAN gateway) and `750-652` (RS-232/485); default 24 for both.
- Plugin uses this to pick the matching device-ID suffix (`0808`/`2424`/`4848`) when inserting the module into CODESYS.

**Notes on diagnostic signals:**
- `isDiagnostic: true` marks auto-generated diagnostic companion signals
- `diagnosticParentId` references the parent data signal ID
- Diagnostic signals are auto-created when a data signal is assigned to a card with `hasDiagnostics: true`
- For `DIGITAL_PAIRED`: diagnostic signal type is DISCRETE, bit offset = data channel + maxInputChannels
- For `ANALOG_STATUS_BYTE`: diagnostic signal type is ANALOG, same logical channel — address is the status word (even offset), parent data signal gets the data word (odd offset)
- The plugin uses diagnostic signals to drive the DataSource quality chain (`BAD_SENSOR_FAILURE` on fault)
- Card-level `hasDiagnostics`, `diagnosticType`, and `diagnosticBitsPerChannel` are also included in the response

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

### `PATCH /api/codesys/projects/{id}/can-buses/{busId}`  (FR-019, FR-019 follow-up, FR-020)

Partial update of CAN-bus configuration values that the plugin owns.
Each supported field is optional; absent = no change. At least one
supported field must be present in the body.

**Auth:** `X-API-Key` header

**Request body**

```json
{
  "cyclicCallIntervalMs": 50,
  "canRole": "P_CAN_DEBUG",
  "processImageBytes": 48
}
```

| Field | Notes |
|---|---|
| `cyclicCallIntervalMs` | (FR-019) Integer in `[10, 200]`, multiple of 10. `null` clears the override (bus reverts to CAN_Task cycle = 10 ms today). |
| `canRole` | (FR-019 follow-up) One of `PT_CAN` / `P_CAN_DEBUG` / `GENERIC`, or `null`. Case-insensitive accepted; stored uppercase. |
| `processImageBytes` | (FR-020) Integer in `{8, 12, 16, 20, 24, 32, 40, 48}` or `null`. `null` leaves the module's EEPROM-saved value alone. |

**Validation**

- Body must contain at least one of the three supported fields.
- Sending the same field as both omitted and a value is impossible —
  there is no "merge with existing" mode beyond the natural per-field
  partial update.
- `null` for any field is treated as a clear (no override).
- Bus must exist and belong to `{id}`.
- Bus protocol must be CAN-family (`CANBUS` / `CANOPEN` / `J1939` /
  `DEVICENET`); any other protocol is rejected.

**Response: `200 OK`**

```json
{
  "accepted": true,
  "bus": {
    "id": 18,
    "protocol": "CANOPEN",
    "cyclicCallIntervalMs": 50,
    "canRole": "P_CAN_DEBUG",
    "processImageBytes": 48
  }
}
```

The response always echoes all three fields, regardless of which were
in the request — so the plugin can verify the post-update state of any
field on a single round-trip.

**Errors**

| Status | Reason |
|---|---|
| `400` | Invalid JSON / no supported field present / wrong type / out of range / not a multiple of 10 / not an allowed PI size / unknown enum value / bus not in project / non-CAN protocol |
| `401` | Missing or invalid `X-API-Key` |
| `404` | Bus not found |

---

### `PATCH /api/codesys/projects/{id}/plcs/{plcId}`  (FR-021)

Partial update of PLC configuration values that the plugin owns. Today
only `kbusCycleTimeMs` — the PFC200 K-bus device parameter Id=128.
Will be extended as more plugin-owned PLC fields appear.

**Auth:** `X-API-Key` header

**Request body**

```json
{ "kbusCycleTimeMs": 10 }
```

| Field | Required | Notes |
|---|---|---|
| `kbusCycleTimeMs` | yes | Integer in `[1, 50]` (per WAGO Kbus device parameter limits). `null` clears the override (renderer leaves the device default — 10 ms — in place). |

**Validation**

- `kbusCycleTimeMs` must be present in the body. Sending `{}` returns 400.
- `null` is allowed and clears the override.
- PLC must exist and belong to `{id}`.

**Plugin-side semantics**: requires a full CODESYS download to take
effect. Online change of device parameters is not supported.

**Response: `200 OK`**

```json
{
  "accepted": true,
  "plc": {
    "id": 1,
    "name": "D01",
    "kbusCycleTimeMs": 10
  }
}
```

**Errors**

| Status | Reason |
|---|---|
| `400` | Invalid JSON / missing `kbusCycleTimeMs` / wrong type / out of range / PLC not in project |
| `401` | Missing or invalid `X-API-Key` |
| `404` | PLC not found |

---

### `PATCH /api/codesys/projects/{id}/commissioning`  (FR-022 Path B)

Partial update of the project-level hardware commissioning policy. Plugin
codegen reads these to emit `GVL_MIAS.xLocalCommReq` /
`GVL_Commission.xRun` initial values + the `SAVE_FLASH` scheduling in
the IEC commissioner's playbook.

**Auth:** `X-API-Key` header

**Request body** (any subset of the four supported fields):

```json
{
  "policy": "MANUAL_ONLY",
  "initialXLocalCommReq": true,
  "initialXRunPlaybook": false,
  "rebootStrategy": "BATCH_LAST_STEP"
}
```

| Field | Type | Notes |
|---|---|---|
| `policy` | enum | `AUTO` \| `MANUAL_ONLY` \| `DISABLED`. `AUTO`: commissioner task active, `xRun` initialised TRUE — runs on first cycle post-`xLocalCommActive`. `MANUAL_ONLY`: task active, `xRun` initialised FALSE — operator pulses `xRun` to start. `DISABLED`: empty playbook + `xLocalCommReq` = FALSE; `Commissioning_Task` is removable from the deployed project (CODESYS V3 dead-code-eliminates the `Commission/*` subtree). |
| `initialXLocalCommReq` | boolean | Initial value of `GVL_MIAS.xLocalCommReq`. Default `true` (commissioning enabled at boot). |
| `initialXRunPlaybook` | boolean | Initial value of `GVL_Commission.xRun`. Default `false` (operator must pulse). When `policy = AUTO` the plugin codegen overrides this to TRUE regardless. |
| `rebootStrategy` | enum | `BATCH_LAST_STEP` (single SAVE_FLASH at end of playbook → one PFC reboot total) \| `PER_SLOT` (SAVE_FLASH per module → reboot per slot, longer outage but safer per-step). Default `BATCH_LAST_STEP`. |

**Validation**

- Body must contain at least one of the four fields. Sending `{}` returns 400.
- Enum values are case-sensitive; type errors return 400.
- Project must exist.

**Response: `200 OK`** — full commissioning block echoed:

```json
{
  "accepted": true,
  "commissioning": {
    "policy": "MANUAL_ONLY",
    "initialXLocalCommReq": true,
    "initialXRunPlaybook": false,
    "rebootStrategy": "BATCH_LAST_STEP"
  }
}
```

The same block also surfaces on `GET /api/codesys/project/{id}` under
the top-level `commissioning` key (alongside `catalogVersion` for plugin
traceability).

**Errors**

| Status | Reason |
|---|---|
| `400` | Invalid JSON / no supported fields / wrong enum / wrong type |
| `401` | Missing or invalid `X-API-Key` |
| `404` | Project not found |

**Defaults for new projects:** `policy = MANUAL_ONLY`,
`initialXLocalCommReq = true`, `initialXRunPlaybook = false`,
`rebootStrategy = BATCH_LAST_STEP`. Existing projects backfill to these
defaults on migration.

---

### `GET /api/codesys/project/{id}/components`

Returns all component instances in a project with their PDO configurations
(CANopen mapped objects) and wiring recipes. This is the primary endpoint for
CAN configuration and FB wiring code generation.

**Path parameter:** `id` — integer project ID

**Response: `200 OK`**

```json
{
  "instances": [
    {
      "id": 42,
      "name": "EDR_Port01",
      "tag": "861-M01",
      "componentId": 4,
      "componentName": "Editron Converter FW11 MC",
      "functionBlock": "Editron_Converter_FW11_MC",
      "functionBlockOverride": null,
      "busId": 7,
      "busProtocol": "CANOPEN",
      "nodeAddress": 5,
      "canIdOffset": 0,
      "byteOrder": "LITTLE_ENDIAN",
      "pdoConfigs": [
        {
          "id": 17,
          "direction": "TPDO",
          "pdoNumber": 1,
          "cobIdBase": 384,
          "cobIdResolved": 389,
          "transmissionType": 254,
          "eventTimerMs": 100,
          "inhibitTimeUs": null,
          "syncWindowUs": null,
          "timeoutMs": 3000,
          "description": "System status, fault words, DC link voltage",
          "mappedObjects": [
            {
              "position": 0,
              "bitOffset": 0,
              "bitLength": 8,
              "canopenIndex": 8320,
              "canopenIndexHex": "0x2080",
              "canopenSubIndex": 0,
              "mappingDword": "0x20800008",
              "signalId": 249,
              "signalTag": "861-M01_Running",
              "rawDataType": "UINT8",
              "description": "System status"
            }
          ]
        }
      ],
      "wiring": [
        {
          "fbName": "Editron_Converter_FW11_MC",
          "instanceName": "GVL_CAN.861_M01",
          "targetGvl": "GVL_CAN",
          "parameters": [
            {
              "name": "Enable",
              "direction": "INPUT",
              "sourceType": "LITERAL",
              "value": "TRUE"
            },
            {
              "name": "Speed_reference_RPM",
              "direction": "INPUT",
              "sourceType": "SIGNAL",
              "signalTag": "861-M01_SpeedReferenceRPM",
              "gvlName": "GVL_CAN"
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
| `instances[].functionBlock` | string\|null | Resolved: `functionBlockOverride ?? component.functionBlock` |
| `instances[].cobIdResolved` | int | `cobIdBase + nodeAddress` — actual 11-bit COB-ID on the bus |
| `instances[].pdoConfigs[].mappedObjects[].mappingDword` | string | Standard CANopen encoding: `(index << 16) \| (subindex << 8) \| bitLength` |
| `instances[].pdoConfigs[].mappedObjects[].signalId` | int\|null | Project signal ID for cross-referencing with main signals array |
| `instances[].pdoConfigs[].mappedObjects[].signalTag` | string\|null | Resolved project signal tag (GVL variable name) |
| `instances[].pdoConfigs[].timeoutMs` | int\|null | PLC monitoring threshold — commFault after this duration |
| `instances[].wiring` | array | Resolved from WiringRecipe + WiringRecipeParam; empty if no recipe defined |

**Errors:**

| Status | Meaning |
|---|---|
| `400` | Invalid project id |
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

### `POST /api/codesys/fb-definitions`

Push FB pin definitions from the plugin. Upserts by `(fbName, sourceFile)`.
Auto-links to HardwareComponent where `functionBlock` matches `fbName`.

**Full replacement semantics:** re-pushing a FB deletes its existing
parameters (and their hints, via cascade) and recreates them from the
payload. Don't try to "patch" — push the full pin set every time.

**Auth:** `X-API-Key` header

**Request body** — single object or array:

```jsonc
[
  {
    "fbName": "FB_HmiPropeller",
    "extendsName": "FB_HmiBase",
    "sourceFile": "FB_HmiPropeller.fb.st",
    "alwaysReview": false,
    "hintSchemaVersion": "1.0.0",
    "parameters": [
      {
        "name": "Power",
        "direction": "VAR_OUTPUT",
        "dataType": "REAL",
        "wiringHint": {
          "kind": "signal",
          "semantic": "power_active",
          "valueRole": "actual",
          "expectedUnit": "kW",
          "matchTag": ["Power", "Power_kW"],
          "required": true,
          "humanReview": false,
          "commandKind": null,
          "structRole": null,
          "arrayCardinality": null,
          "instrumentClass": null,
          "defaultLiteral": null,
          "pairedWith": null,
          "notes": null
        }
      },
      {
        "name": "Synchronize",
        "direction": "VAR_IN_OUT",
        "dataType": "BOOL"
      }
    ]
  }
]
```

**FB-level fields:**

| Field | Required | Notes |
|---|---|---|
| `fbName` | yes | FB type name |
| `extendsName` | no | Parent FB (inheritance). Matcher walks this chain at match time; pin-level hints on the leaf override the base. |
| `sourceFile` | no | Default `"plugin-api"` |
| `alwaysReview` | no | Default `false`. When `true`, the matcher classifies every pin on this FB as `needs_review` regardless of pin-level score — for FBs whose wiring has physical consequences (contactor drives, e-stops, isolation requests). |
| `hintSchemaVersion` | no | Semantic version of the wiringHint schema this push uses. Start at `"1.0.0"`. Stored on the FB and copied onto each hint row at write time. |
| `parameters[].name` | yes | Parameter name |
| `parameters[].direction` | yes | `VAR_INPUT`, `VAR_OUTPUT`, `VAR_IN_OUT`, `VAR` |
| `parameters[].dataType` | yes | IEC 61131-3 type |
| `parameters[].wiringHint` | no | Auto-wire metadata — see below. Omit (don't `null`) when no hint is available; an omitted hint = no row written, not an empty hint. |

**`wiringHint` fields** (all optional; absent = "no opinion"):

| Field | Type | Notes |
|---|---|---|
| `kind` | `"signal" \| "parameter"` | Default `"signal"`. `"signal"` = matcher resolves to a project signal. `"parameter"` = matcher fills from `defaultLiteral` / a setpoint, no signal binding. |
| `semantic` | string | Vocabulary tag (e.g. `power_active`, `temperature_bearing_de`). See vocabulary in NOTIF-023 / FR-015 reply. Free-form — unknown tags fall through to manual wiring. |
| `valueRole` | `"actual" \| "setpoint" \| "reference" \| "limit" \| "alarm" \| "command"` | Disambiguates measurement vs command on otherwise identical pins. Critical for converter FBs that have both `_actual` and `_reference` pins of the same physical quantity. |
| `expectedUnit` | string | Primary unit per quantity (e.g. `"kW"`, `"degC"`). Matcher prefers candidate signals whose unit converts cleanly within the same `engineering_unit.quantity` family. |
| `matchTag` | string[] | Tag-suffix candidates the matcher should look for in `componentSignal.tag_suffix`. High-weight signal in scoring. |
| `required` | boolean | Default `false`. When `true`, no confident match → block the recipe and surface for human review. |
| `humanReview` | boolean | Default `false`. When `true`, even a high-confidence match is classified as `needs_review` — for pins where wrong wiring is dangerous. |
| `commandKind` | `"pulse" \| "level"` | Edge-triggered vs sustained. Used for `command_*` semantics. |
| `structRole` | string | For struct-typed pins, identifies the *role* of the struct (e.g. `"power_measurement"`) independent of the concrete struct type. |
| `arrayCardinality` | integer | For array pins: how many elements. Matcher expects either N siblings or one composite signal that fans out. |
| `instrumentClass` | string | ISA tag class if applicable: `PT`, `TT`, `FT`, `LT`, … |
| `defaultLiteral` | string | Template-time default for `kind: "parameter"` or for HMI / VAR_IN_OUT pins. User can override per instance. Presence on a `signal`-kind pin signals "skip signal binding". |
| `pairedWith` | string | For in/out pairs (e.g. `HmiStartButton` ↔ `HmiStartButton_out`). |
| `notes` | string | Free-form note for the curator — surfaced in review UI, ignored by matcher. |

**Versioning rule:** the endpoint always accepts the push, even when
`hintSchemaVersion`'s major doesn't match the matcher's expected major.
Push-time rejection would block the plugin cold. Instead, the matcher
logs a `wiring_recipe_gap` row with reason `INCOMPATIBLE_HINT_VERSION`
lazily at match time. This keeps the plugin's curated payload safe across
matcher upgrades.

**Response: `200 OK`**

```json
{
  "accepted": true,
  "definitions": [
    {
      "id": 42,
      "fbName": "FB_HmiPropeller",
      "componentId": 4,
      "componentMatched": true,
      "parametersCount": 12,
      "hintsCount": 11,
      "alwaysReview": false,
      "hintSchemaVersion": "1.0.0"
    }
  ]
}
```

`hintsCount` is the number of parameters in the payload that carried a
`wiringHint`. Use it to verify your curated hints made it through.

---

### `POST /api/codesys/project/{id}/iec-paths`

Push resolved IEC paths back to MIAS-IO after a codegen run. Used by the
plugin to record the fully-qualified IEC expression for each generated
GVL variable so other consumers (live monitoring, JMobile alarm export)
can address it.

The endpoint accepts a mixed batch of two entry kinds — signal entries
(FR-007) and alarm entries (FR-011). Per-entry errors do **not** reject
the batch; the rest proceed and bad ids are reported in `errors[]`. A
field with value `null` clears any previously-stored path.

**Auth:** `X-API-Key` header

**Request body**

```json
{
  "paths": [
    {
      "signalId": 12345,
      "iecPath": "Application.GVL_IO.fbT101.rValue",
      "iecPathRaw": "Application.GVL_IO.fbT101.rRawValue"
    },
    {
      "alarmId": 678,
      "alarmKind": "discrete",
      "iecAlarmPath": "Application.GVL_ALARMS.bSomeAlarm"
    },
    {
      "alarmId": 789,
      "alarmKind": "analog",
      "iecAlarmPath": "Application.GVL_ALARMS.fbAlarm_T101.HH"
    }
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `signalId` | for signal entries | `signal.id` from `GET /api/codesys/project/{id}` |
| `iecPath` | optional on signal entries | Scaled-value path, e.g. `Application.GVL_IO.fbT101.rValue`. `null` clears. |
| `iecPathRaw` | optional on signal entries | Raw-value path. `null` clears. |
| `alarmId` | for alarm entries | `discrete_alarm.id` or `analog_alarm.id` |
| `alarmKind` | for alarm entries | `"discrete"` or `"analog"` — picks the table |
| `iecAlarmPath` | optional on alarm entries | One path per row. For analog alarms each row covers one condition (HH/H/L/LL) so the path points at *that* condition's bit (e.g. `...fbAlarm_T101.HH`). `null` clears. |

Entry discrimination is by which id field is present: an entry with
`alarmId` is treated as an alarm regardless of any extra fields.

**Response: `200 OK`**

```json
{
  "ok": true,
  "updated": 312,
  "updatedSignals": 304,
  "updatedAlarms": 8,
  "errors": [
    { "signalId": 99999, "reason": "Signal not in project or does not exist" },
    { "alarmId": 4242, "alarmKind": "analog", "reason": "Alarm not in project or does not exist" }
  ]
}
```

The server pre-validates project membership for both signal ids and
alarm ids in one round-trip, so per-entry membership checks are O(1).

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

### `GET /api/codesys/plugin/repository`

**Auth:** None (public endpoint)

Returns a JSON feed of available plugin packages. Can be polled by CODESYS
Package Manager or the web UI to check for updates.

**Response:**
```json
{
  "latest": {
    "version": "1.2.3",
    "filename": "MIAS-IO-Plugin-1.2.3.package",
    "size": 4521984,
    "downloadUrl": "https://io.demo.neptun.ztna/api/codesys/plugin/download"
  },
  "packages": [...]
}
```

`latest` is `null` when no packages are available.
