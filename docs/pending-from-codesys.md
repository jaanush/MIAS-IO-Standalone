# Pending Requests from CODESYS Agent

Items here require implementation in MIAS-IO. Once implemented, update
`codesys-api-contract.md` and remove the corresponding entry from this file.

---

## 0. URGENT — Auth middleware blocks `/api/codesys/*` without session

**Status:** Blocking all headless script access. **Fix this first.**

The auth middleware currently redirects any unauthenticated request to `/login`,
including requests that carry a valid `X-API-Key` header:

```
GET /api/codesys/project/1 + X-API-Key: dev-key-change-me
→ 307 Redirect to /login?from=%2Fapi%2Fcodesys%2Fproject%2F1
```

This means no CODESYS script or Python tool can reach the API without a browser
session cookie. The API key is useless unless the caller is already logged in.

**Required fix:** In the auth middleware, add an exemption for the `/api/codesys`
path prefix when the request carries a valid `X-API-Key` header. Validate the key
first; if valid, bypass the session check and allow the request through.

Pseudocode:
```
if request.path starts with "/api/codesys":
    if request.headers["X-API-Key"] == env.CODESYS_API_KEY:
        allow  # skip session check
    else:
        return 401 Unauthorized
else:
    # normal session-based auth
```

**Without this fix**, the CODESYS agent cannot fetch project data, the worker
cannot poll for tasks, and the entire headless integration is non-functional.

---

## 1. URGENT — `plcAddress` is computed per-carrier, not globally

**Status:** Blocking GVL_Physical generation. All signals on D03-B and D03-C get
the same addresses as D03-A (`%IW0`, `%IX0.0`, etc.), making the output invalid.

**Root cause:** The `plcAddress` field in the signals API response is calculated
as the byte/bit offset within each carrier independently. For a multi-carrier
Wago 750 system (D03-A, D03-B, D03-C), the address must accumulate the total
I/O byte width of all preceding carriers.

**Example of the problem:**
```
Cooling_System_721_KS1_TT1  carrier=D03-C  slot=2  ch=0 → plcAddress=%IW0  ← WRONG
Genset_861_G01_N_END_Bearing carrier=D03-B  slot=2  ch=0 → plcAddress=%IW0  ← WRONG
Propulsion_FWD_625_M01_Wind  carrier=D03-A  slot=2  ch=0 → plcAddress=%IW0  ← correct
```

All three signals get `%IW0`, causing 75 address conflicts in 213 physical signals.
CODESYS will reject the GVL with duplicate AT addresses.

**Fix location:** `src/app/api/codesys/_address.ts`, function `computeCarrierAddresses()`.
Currently called once per carrier in isolation. Must instead be called in PLC-carrier
order, accumulating the final offsets from each carrier as the starting offsets for the
next carrier in the same address space.

**Required fix:** In `src/app/api/codesys/project/[id]/route.ts` (around line 228), the
loop that calls `computeCarrierAddresses(carrier.cards, carriersignals)` passes no initial
offset — it always starts from 0. Add parameters for the running cumulative offsets across
the four address spaces (DI byte, DO byte, AI word, AO word) and thread them through each
carrier in slot order.

Pseudocode change in route.ts:
```
let globalOffsets = { di: 0, do: 0, ai: 0, ao: 0 };
for (const carrier of plc.carriers.sortedByPosition) {
    const result = computeCarrierAddresses(carrier.cards, signals, globalOffsets);
    globalOffsets = result.nextOffsets;  // accumulate for next carrier
    for (const [sigId, addr] of result.addresses) addressMap.set(sigId, addr);
}
```

**Impact:** Until fixed, GVL_Physical cannot be generated with AT addressing.
Workaround would be to omit the AT address and declare signals as plain variables,
but that loses the direct hardware binding.

---

## 2. `SYNC_HARDWARE` task type — add to task queue contract

**Status:** CODESYS side fully implemented (`scripts/worker.py`, `lib/hw_config.py`).
The API contract only documents `SYNC_GVLS`. MIAS-IO needs to know the params so it
can queue `SYNC_HARDWARE` tasks from the UI or API.

### Task shape

```json
{
  "id": "a1b2c3d4-uuid",
  "type": "SYNC_HARDWARE",
  "projectId": 1,
  "params": {
    "codesysProject": "C:\\projects\\my.project",
    "strategy": "params"
  },
  "createdAt": "2026-03-11T10:00:00Z"
}
```

### `params` fields

| Field | Type | Default | Meaning |
|---|---|---|---|
| `codesysProject` | string | worker default | Absolute path to `.project` file. Omit to use the worker's configured default. |
| `strategy` | string | `"params"` | Controls how aggressively CODESYS applies changes. See strategy table below. |

### Strategy values

| `strategy` | What CODESYS does |
|---|---|
| `report` | Computes and logs the diff only — no changes written to the project |
| `params` | Updates device IP addresses only (safe, non-destructive) |
| `additive` | Updates IPs + inserts missing modules (never removes) |
| `full` | Updates IPs + inserts missing + removes extra modules |

**Recommendation for the MIAS-IO UI:** expose `report`, `params`, and `additive`
as named options. Gate `full` behind a confirmation dialog — it can delete devices.

### What the worker returns via `POST /tasks/{id}/result`

The existing result endpoint is sufficient — `log` already contains a per-device
diff summary and `status` is `SUCCESS` / `FAILURE`. No new result fields needed.

---

## 3. New endpoint — `POST /api/codesys/project/{id}/hardware`
### Write actual device topology from CODESYS back to MIAS-IO

**Direction:** CODESYS → MIAS-IO (write-back / discovery)

**Purpose:** After CODESYS reads its device tree (e.g. after a hardware scan or
after connecting to a real PLC), the plugin can POST the actual topology so MIAS-IO
stays in sync with physical reality. This enables MIAS-IO to know what hardware is
*actually* installed, not just what was configured in the database.

**Auth:** `X-API-Key` header (same as all other endpoints)

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

**Expected response:**

```json
{
  "accepted": true,
  "matched": 3,
  "unrecognised": 0,
  "warnings": []
}
```

---

## 4. New task type — `REPORT_HARDWARE`

---

## 5. Signal-level Modbus register metadata — GVL_HVAC and GVL_Physical

**Status:** Blocking Modbus TCP code generation for HVAC and distributed I/O projects.

**Background:** In the Alveli project, HVAC data (AS1/AS2) and distributed I/O signals
(at remote Energy Router cabinets) are accessed via hand-coded Modbus TCP/UDP masters.
Each PLC variable corresponds to a specific Modbus register word and optionally a specific
bit within that word. Scaling factors apply to analogue signals.

MIAS-IO currently stores no Modbus register metadata per signal, so the plugin cannot
generate the register mapping assignments.

**Existing schema support** (`prisma/schema.prisma`, `BusSignal` model):
- `unitId` (Int?) — Modbus slave unit ID ✓ already exists
- `registerType` (ModbusRegisterType?) — COIL | DISCRETE_INPUT | HOLDING_REGISTER | INPUT_REGISTER ✓ already exists
- `registerOffset` (Int?) — register address within type ✓ already exists

**Still missing from BusSignal:**
- `registerBitOffset` — which bit within the word register (for BOOL signals)
- `scaleDivisor` — engineering unit scaling (divide raw word by this)
- (Device reference is implicitly `plcNetworkId` already)

**New fields needed** (add to BusSignal in schema):

| Field | Schema status | Type | Example | Meaning |
|-------|--------------|------|---------|---------|
| `registerOffset` | ✓ exists | int | `25` | Word index in `BCInputData` / `BCOutputData` array (0-based) |
| `registerBitOffset` | **missing** | int or null | `3` | Bit within the register word (0–15). Null = whole word. |
| `scaleDivisor` | **missing** | float or null | `10.0` | Divide raw register value by this to get engineering value. Null = no scaling. |
| `unitId` | ✓ exists | int | `1` | Modbus slave unit ID |
| `registerType` | ✓ exists | enum | `HOLDING_REGISTER` | Register type (COIL, DISCRETE_INPUT, HOLDING_REGISTER, INPUT_REGISTER) |

**Example signal record:**
```json
{
  "tag": "AS1_HMI_FAU1_GT1_RES",
  "type": "REAL",
  "gvlId": "<GVL_HVAC id>",
  "modbusRegisterOffset": 25,
  "modbusBitOffset": null,
  "modbusDirection": "read",
  "modbusScaleDivisor": 10.0,
  "modbusDeviceRef": "HVAC_AS1"
}
```

**Generated code** that the plugin will produce from this data:
```st
GVL_HVAC.AS1_HMI_FAU1_GT1_RES := TO_REAL(TO_INT(ModbusMasterTCP_HVAC_AS1.BCInputData[25])) / 10.0;
```

For a boolean bit signal:
```json
{
  "tag": "AS1_HMI_FAU1_ALM",
  "type": "BOOL",
  "modbusRegisterOffset": 40,
  "modbusBitOffset": 1,
  "modbusDirection": "read",
  "modbusDeviceRef": "HVAC_AS1"
}
```
```st
GVL_HVAC.AS1_HMI_FAU1_ALM := ModbusMasterTCP_HVAC_AS1.BCInputData[40].1;
```

**Impact if not implemented:** The CODESYS plugin cannot auto-generate the `HvacControl`
or `Modbus_IO` register mapping code. Engineers must hand-code all mappings, which is
error-prone and not maintainable via MIAS-IO.

---

## 6. GVL_Modbus struct-based generation — RTU devices

**Status:** Current output is unusable due to name truncation and wrong structure.

**Background:** In the Alveli project, Modbus RTU data from the diesel genset (ComAP/DEIF)
is stored in a single struct instance:
```st
Genset_861_G01_DieselData : T_strDiesel;  // 558-byte struct, 96 members
```

MIAS-IO currently generates 224 flat individual variables for GVL_Modbus, including all
`T_strDiesel` member fields as separate variables. This is wrong because:
1. 32-char name truncation causes all `ECU_Alarm_*` variables to collide at
   `Genset_861_G01_DieselData_ECU_Al` (200+ duplicate names)
2. The struct members are never declared as separate variables in the real project —
   they are accessed as `GVL_Modbus.Genset_861_G01_DieselData.RPM_actual` etc.
3. The Modbus register mapping is inside `FB_ModbusDiesel` FB, not in the GVL

**Required fix:** For Modbus RTU signals that belong to a struct device, MIAS-IO should
generate a single struct instance declaration instead of flat variables:

```st
VAR_GLOBAL
    Genset_861_G01_DieselData : T_strDiesel;
END_VAR
```

This requires a new concept in MIAS-IO: a "Modbus device" record that groups signals
and specifies the struct type name. Individual signals within the device are then accessed
as struct members, not as independent GVL variables.

**Minimum viable solution:** Allow a GVL to have a "struct instance" mode where one
line is emitted per device (`instanceName : StructType;`) rather than one line per signal.

---

## 7. Variable name length limit — GVL generation

**Status:** Causes compilation errors in CODESYS.

**Root cause:** MIAS-IO truncates generated variable names to 32 characters in
`sanitize_variable_name()`. When signal tag names are long (e.g. `Genset_861_G01_DieselData_ECU_Alarms_Description_12`), multiple signals truncate to the same identifier.

**Example collisions in Alveli GVL_Modbus:**
- All 15 `ECU_Alarms_*` sub-structs → all become `Genset_861_G01_DieselData_ECU_Al`
- This produces 15 duplicate variable declarations → CODESYS compilation error

**Required fix:** Either raise the limit to 64 characters (CODESYS supports up to 64),
or detect collisions and add a numeric suffix (`_2`, `_3`, …) before emitting the GVL.

CODESYS IEC 61131-3 identifier limit: **64 characters**.

---

## 8. URGENT — GVL_CAN and GVL_BATT need FB-instance generation mode

**Status:** Blocking all CAN and battery GVL generation. Currently MIAS-IO generates
one flat variable per signal, but CAN and BATT GVLs require **one FB instance declaration
per component**.

### Background

LasseMaja GVL_CAN has 431 signals structured as dot-notation paths:
```
Genset_861_U01.Speed_Actual_RPM        : INT
Propulsion_625_U01.Power_DC            : INT
Microgrid_875_U01.AFE_Grid_Frequency   : REAL
```

In CODESYS these are **not** declared as individual variables. Instead, the GVL declares
one instance of the FB, and CODESYS exposes all its members automatically:
```st
VAR_GLOBAL
    Genset_861_U01   : Editron_Converter_FW11_DCDC;
    Propulsion_625_U01 : Editron_Converter_FW11_MC;
    Microgrid_875_U01  : Editron_Converter_FW11_uG_AFE_Rev2;
END_VAR
```

Same pattern applies to GVL_BATT (Kreisel BMS instances).

### What MIAS-IO needs to add

**1. `codesysFbType` field on the component/device record**

Each device (component) that appears in a CAN-type GVL needs to know what CODESYS
function block type to instantiate. This is project-specific and must be stored in
MIAS-IO (it depends on which Editron firmware variant is used).

Proposed data model addition:
```
Component {
  tag: string          // e.g. "861-U01"
  codesysFbType: string  // e.g. "Editron_Converter_FW11_DCDC"
  // ... existing fields
}
```

**2. GVL "generation mode" config**

Each GVL should have a `generationMode` setting:
- `FLAT_VARS` (current behavior) — one variable per signal
- `FB_INSTANCES` — one FB instance per unique component prefix; signals are documentation only

When `FB_INSTANCES` is set, the CODESYS plugin/generator:
1. Groups signals by component prefix (part of tag before the first `.`)
2. For each unique prefix, emits one line: `<prefix> : <codesysFbType>;`
3. Reads `codesysFbType` from the component record

**3. Required FB types for LasseMaja GVL_CAN** (from signal analysis and METS_LIB 2.0.1):

| Component in MIAS-IO | Device | FB type |
|---|---|---|
| `Genset_861_U01` | 861-U01 | `Editron_Converter_FW11_DCDC` |
| `Propulsion_625_U01` | 625-U01 | `Editron_Converter_FW11_MC` |
| `Propulsion_625_U02` | 625-U02 | `Editron_Converter_FW11_MC` |
| `Microgrid_875_U01` | 875-U01 | `Editron_Converter_FW11_uG_AFE_Rev2` |
| `Microgrid_875_U02` | 875-U02 | `Editron_Converter_FW11_uG_AFE_Rev2` |
| `Energy_Storage_System_866_U01_1` | 866-U01:1 | `Editron_Converter_FW11_DCDC` (role TBD) |
| `Energy_Storage_System_866_U01_2` | 866-U01:2 | `Editron_Converter_FW11_DCDC` (role TBD) |
| `Energy_Storage_System_866_U02_1` | 866-U02:1 | `Editron_Converter_FW11_DCDC` (role TBD) |
| `Energy_Storage_System_866_U02_2` | 866-U02:2 | `Editron_Converter_FW11_DCDC` (role TBD) |

**Note:** 866-U01/U02 do not appear in the 866 drawings — their physical role is
**unknown**. Do not generate GVL entries for these until confirmed. Add a flag in
MIAS-IO to mark components as "excluded from GVL generation."

**Required FB types for LasseMaja GVL_BATT:**

| Component in MIAS-IO | Device | FB type |
|---|---|---|
| `Energy_storage_system_866_PACK_C1` | 866-C01 (FWD) | `FB_Kreisel_BMS` |
| `Energy_storage_system_866_PACK_C2` | 866-C02 (AFT) | `FB_Kreisel_BMS` |

GVL_BATT also needs three additional non-signal instances per pack:
- `Kreisel_BMS_Comm_FWD : Kreisel_BMS_Comm;` (CAN comm handler)
- `CommInterface_Kreisel_FWD : strKreisel_CommInterface;` (struct, qualified_only)
These are infrastructure declarations that have no corresponding signals in MIAS-IO.
They should be declared as "extra declarations" in the GVL config.

### Missing CAN signals — DC Shore 869-D01/D02

The two DC Shore Editron DCDC converters (869-D01 on net 16, 869-D02 on net 17)
have **zero CAN signals** in MIAS-IO. Only physical I/O signals (contactor states)
are in GVL_Physical.

These devices have the same Editron DCDC signal pattern as 861-U01. They need to
be added to GVL_CAN with approximately 45-50 signals each (same structure as
`Genset_861_U01` signals).

FB types:
- `DC_Shore_Connection_869_D01 : Editron_Converter_FW11_DCDC;`
- `DC_Shore_Connection_869_D02 : Editron_Converter_FW11_DCDC;`

---

## 9. GVL_Physical — All physical signals lack I/O card mapping

**Status:** Blocking GVL_Physical generation. All 278 GVL_Physical signals have
`ioCard=null` and `channelPosition=null`. Without this data, MIAS-IO cannot compute
`plcAddress` AT-addressing.

This is a data entry issue. The I/O mapping must be entered in MIAS-IO for each signal:
- Which WAGO module (ioCard) handles this signal
- Which channel position on that module

The source data for this mapping is in the 852 MIAS electrical drawings, specifically
the I/O system circuit diagrams:
- 852509 — I/O SYSTEM D03 (overview)
- 852510 — I/O SYSTEM D03:A2-A3
- 852511 — I/O SYSTEM D03:A4
- 852512 — I/O SYSTEM D03:A5
- 852513 — I/O SYSTEM D03:A6-A7
- 852514 — I/O SYSTEM D03:A8

These diagrams show terminal-level signal connections to specific WAGO I/O modules.
The CODESYS agent can extract this data and provide it as an import-ready table for
MIAS-IO to ingest.

**Also note:** Even after ioCard/channelPosition is set, the carrier address offset
bug (item 1) must be fixed before plcAddress AT-addresses are correct.

---

## 4. New task type — `REPORT_HARDWARE`

**Depends on:** endpoint in item 2 above.

MIAS-IO queues this task to trigger a CODESYS hardware scan and write-back.

```json
{
  "id": "b2c3d4e5-uuid",
  "type": "REPORT_HARDWARE",
  "projectId": 1,
  "params": {
    "codesysProject": "C:\\projects\\my.project"
  },
  "createdAt": "2026-03-11T10:30:00Z"
}
```

---

## 10. GVL_Internal — 38 of 42 signals missing

**Status:** Only 4 of 42 MIAS-IO-managed signals exist. The reference CODESYS project
has 42 signals in the "IO-list pasted" section of GVL_Internal (lines 36–82). MIAS-IO
has only 4 of them.

**Present (4):**
- `Contr_Mon_System_852_MIAS_Voltage_MSB1_DC` (REAL)
- `Contr_Mon_System_852_MIAS_Voltage_MSB4_DC` (REAL)
- `HVAC_AS1_Communication_fault` (BOOL)
- `HVAC_AS2_Communication_fault` (BOOL)

**Missing (38) — must be added to MIAS-IO:**

| Signal tag | Type | Category |
|---|---|---|
| `AC_Distribution_875_T01_Overload` | INT | Transformer protection |
| `AC_Distribution_875_T02_Overload` | INT | Transformer protection |
| `Contr_Mon_System_852_MIAS_CAN_A2_bus_Communication_fault` | BOOL | CAN diagnostics |
| `Contr_Mon_System_852_MIAS_CAN_A2_overload_warning_CAN_frames_might_get_lost` | BOOL | CAN diagnostics |
| `Contr_Mon_System_852_MIAS_CAN_A2_overload_fault_CAN_frames_have_been_lost` | BOOL | CAN diagnostics |
| `Contr_Mon_System_852_MIAS_CAN_A3_bus_Communication_fault` | BOOL | CAN diagnostics |
| `Contr_Mon_System_852_MIAS_CAN_A3_overload_warning_CAN_frames_might_get_lost` | BOOL | CAN diagnostics |
| `Contr_Mon_System_852_MIAS_CAN_A3_overload_fault_CAN_frames_have_been_lost` | BOOL | CAN diagnostics |
| `Contr_Mon_System_852_MIAS_CAN_A4_bus_Communication_fault` | BOOL | CAN diagnostics |
| `Contr_Mon_System_852_MIAS_CAN_A4_overload_warning_CAN_frames_might_get_lost` | BOOL | CAN diagnostics |
| `Contr_Mon_System_852_MIAS_CAN_A4_overload_fault_CAN_frames_have_been_lost` | BOOL | CAN diagnostics |
| `Contr_Mon_System_852_MIAS_PLC_and_HMI_ER_OP1_Communication_fault` | BOOL | Comm diagnostics |
| `Contr_Mon_System_852_MIAS_PLC_and_HMI_WH_OP2_Communication_fault` | BOOL | Comm diagnostics |
| `Contr_Mon_System_852_MIAS_PLC_and_HMI_WH_OP3_Communication_fault` | BOOL | Comm diagnostics |
| `Contr_Mon_System_852_MIAS_Shore_Connected_in_Sea_Mode` | BOOL | Shore status |
| `Contr_Mon_System_852_MIAS_PLC_and_AC_Shore_powermodule_Communication_Fault` | BOOL | Comm diagnostics |
| `Contr_Mon_System_852_MIAS_PLC_and_MSB1_AC_powermodule_Communication_Fault` | BOOL | Comm diagnostics |
| `Contr_Mon_System_852_MIAS_PLC_and_MSB2_AC_powermodule_Communication_Fault` | BOOL | Comm diagnostics |
| `Contr_Mon_System_852_MIAS_PLC_and_861_ComAP_Communication_Fault` | BOOL | Comm diagnostics |
| `Contr_Mon_System_852_MIAS_PLC_and_DistrIO_D03_Communication_fault` | BOOL | Comm diagnostics |
| `Contr_Mon_System_852_MIAS_PLC_and_DistrIO_D04_Communication_fault` | BOOL | Comm diagnostics |
| `Contr_Mon_System_MIAS_852_Bilge_pump_prop_room_aft_PS_run_command` | BOOL | Pump commands |
| `Contr_Mon_System_MIAS_852_Bilge_pump_prop_room_aft_SB_run_command` | BOOL | Pump commands |
| `Contr_Mon_System_MIAS_852_Bilge_pump_prop_room_fwd_PS_run_command` | BOOL | Pump commands |
| `Contr_Mon_System_MIAS_852_Bilge_pump_prop_room_fwd_SB_run_command` | BOOL | Pump commands |
| `Contr_Mon_System_MIAS_852_Bilge_engine_room_run_command` | BOOL | Pump commands |
| `Contr_Mon_System_MIAS_852_FireFighting_pump_run_command` | BOOL | Pump commands |
| `Contr_Mon_System_MIAS_852_Prop_1_cooling_pump_run_command_aft` | BOOL | Pump commands |
| `Contr_Mon_System_MIAS_852_Prop_2_cooling_pump_run_command_fwd` | BOOL | Pump commands |
| `Contr_Mon_System_MIAS_852_Prop_1_cooling_pump_Status_aft` | BYTE | Pump status |
| `Contr_Mon_System_MIAS_852_Prop_2_cooling_pump_Status_fwd` | BYTE | Pump status |
| `Main_Switchboard_871_MSB1_Blackout_MSB_DC` | BOOL | Blackout detection |
| `Main_Switchboard_871_MSB4_Blackout_MSB_DC` | BOOL | Blackout detection |
| `Power_Distribution_875_MSB1_Blackout_MSB_AC` | BOOL | Blackout detection |
| `Power_Distribution_875_MSB2_Blackout_MSB_AC` | BOOL | Blackout detection |
| `Propulsion_AFT_852_MIAS_Waiting_for_lever_zero_position` | BOOL | Propulsion interlock |
| `Propulsion_FWD_852_MIAS_Waiting_for_lever_zero_position` | BOOL | Propulsion interlock |
| `Redundant_link_Error` | BOOL | Redundancy status |

**Generation mode:** FLAT_VARS (same as GVL_Physical). No AT addressing — these are
software-only variables with no direct hardware binding.

**Note:** GVL_Internal also contains ~15 additional variables that are NOT from MIAS-IO
(FB instances like `FB_ShoreAC`, `FB_Microgrid_AFT/FWD`, `FB_DC_Genset`, RETAIN energy
counters, debug references, etc.). These are local program infrastructure and should NOT
be generated by MIAS-IO. Only the 42 signals in the "IO-list" section are MIAS-IO managed.

---

## 11. GVL_HVAC — 48+ of ~60 signals missing

**Status:** Only 12 alarm-type signals exist out of ~60 total variables. MIAS-IO has
only alarm indicators; all temperature readings, setpoints, fan status, damper status,
and heating system variables are missing.

**Present (12) — all alarm BOOLs:**
`AS1_HMI_FAU1_ALM`, `AS1_HMI_FAU1_GT4_ALM`, `AS1_HMI_FAU2_ALM`,
`AS1_HMI_FAU2_GT4_ALM`, `AS1_HMI_RSD_ALM`, `AS1_HMI_SYS_ALARM`,
`AS1_HMI_VP1_ALARM_NUM`, `AS1_HMI_VP2_ALARM_NUM`, `AS2_HMI_BVP_ALM`,
`AS2_HMI_HYDB1_ALM`, `AS2_HMI_HYDB2_ALM`, `AS2_HMI_SYS_ALARM`

**Missing categories:**

| Category | Count | Examples |
|---|---|---|
| Temperature readings (REAL) | 14 | `AS1_HMI_OAT_GT3_RES`, `AS1_HMI_FAU1_GT1_RES`, `AS2_HMI_GT11_ACK_RES` |
| Fan speed setpoints (INT, RETAIN) | 2 | `AS1_HMI_FAU1_FAN_SPD_SP`, `AS1_HMI_FAU2_FAN_SPD_SP` |
| Temperature setpoints (REAL, RETAIN) | 2 | `AS1_HMI_FAU1_GT2_STP`, `AS1_HMI_FAU2_GT2_STP` |
| Mode/config setpoints (INT/BOOL, RETAIN) | 10 | `AS1_HMI_PAX_MODE`, `AS1_HMI_EMPTY_SHIP_REDUCTION`, `AS1_HMI_FAU1_AUTO` |
| Fan status/speed (BOOL/INT) | 8 | `AS1_HMI_FAU1_RUN`, `AS1_HMI_FAU1_FAN_SPD`, `AS1_HMI_FAU1_FAN_MIN_SPD` |
| Damper status (BOOL) | 5 | `AS1_HMI_FAU1_ST1_OPN`, `AS1_HMI_DAMPER_EXERCISE_ON` |
| Heat pump/heating (BOOL/INT/REAL) | 9 | `AS2_HMI_BVP_RUN`, `AS2_HMI_CP03_RUN`, `AS2_HMI_411V01_VALVE_POS` |
| Freeze protection resets (BOOL) | 2 | `AS1_HMI_FAU1_GT4_RESET`, `AS1_HMI_FAU2_GT4_RESET` |

**Generation mode:** FLAT_VARS. But note this GVL has TWO sections:
- `VAR_GLOBAL RETAIN` — setpoints, modes, config values (user-editable from HMI)
- `VAR_GLOBAL` — read-only status, temps, alarms

MIAS-IO currently has no concept of `RETAIN` vs non-RETAIN GVL sections. This is
needed for GVL_HVAC (and GVL_Internal which also uses RETAIN for energy counters).

**New requirement:** Add a `retain` boolean field on signal records (default false).
When generating the GVL text, group RETAIN signals into a `VAR_GLOBAL RETAIN` section.

**Modbus register data:** All GVL_HVAC variables are exchanged via Modbus TCP with
HVAC cabinets AS1 and AS2. The commented-out AT addresses in the reference (e.g.
`// AT %MW20:INT;`) are the Modbus register addresses. This metadata maps to item 5
(signal-level Modbus register metadata). Each signal needs `registerOffset` and
optionally `scaleDivisor` (Gain: 0.1 = divide by 10).

---

## 12. GVL_DC_Charge — entire GVL missing from MIAS-IO

**Status:** Zero signals in MIAS-IO. No GVL record exists. The reference project has
17 variables for the DC shore charging system (CCS2/Advantics).

**What GVL_DC_Charge contains in the reference project:**

| Variable | Type | Category |
|---|---|---|
| `CommInterface_IVT` | `IVT_S` (struct) | CAN comm infrastructure |
| `CommInterface_MCS` | `StrAdvanticsMCS_CommInterface` (struct) | CAN comm infrastructure |
| `IVT_Comm` | `IVT_Comm` (FB) | CAN comm handler |
| `IVT` | `IVT` (FB) | Current/voltage transducer |
| `AdvanticsMCS_EVCC` | `AdvanticsMCS_EVCC2_0` (FB) | CCS2 charge controller |
| `Contr_Mon_System_DC_Meter_U101A_Voltage_U1_Intake` | REAL | DC measurement |
| `Contr_Mon_System_DC_Meter_U101A_Voltage_U2_DC_Bus` | REAL | DC measurement |
| `Contr_Mon_System_DC_Meter_U101A_Voltage_U3_DC_Minus` | REAL | DC measurement |
| `Contr_Mon_System_DC_Meter_U101A_Current` | REAL | DC measurement |
| `Contr_Mon_System_DC_Meter_U101A_Temperature` | REAL | DC measurement |
| `MCS_Charging_Power` | REAL | Charge status |
| `Contr_Mon_System_DC_Meter_Calculated_U101A_Voltage_U2_DC_Bus` | REAL | Calculated |
| `DC_Shore_connection_852_MIAS_Shore_connection_Lost` | BOOL | Shore status |
| `MCS_Connect` | BOOL | Charge commands |
| `MCS_Connected` | BOOL | Charge status |
| `AdvanticsMCS_Comm` | `AdvanticsMCS_Comm` (FB) | CAN comm handler |
| `MCS_Disconnect_CMD_From_HMI` | BOOL | HMI command |
| `DC_Shore_connection_869_A01_Advantics_MCS_Communication_fault` | BOOL | Comm diag |
| `DC_Shore_connection_869_A01_IVT_Communication_fault` | BOOL | Comm diag |
| `MCS_ChargingSessionResetCV` | BOOL | Session control |
| `MCS_ChargingSessionCV` | WORD (RETAIN) | Session counter |
| `MCS_ChargingSessionCV_Total` | WORD (RETAIN) | Session counter |

**Generation mode:** FB_INSTANCES (mixed). Contains FB instances (`IVT`, `AdvanticsMCS_EVCC`,
`AdvanticsMCS_Comm`, `IVT_Comm`), comm interface structs, flat measurement variables,
and RETAIN session counters.

**Required action:**
1. Create GVL_DC_Charge in MIAS-IO
2. Add the ~10 flat signals (DC meter voltages, currents, status bools)
3. FB instances and comm infrastructure need the FB_INSTANCES generation mode (item 8)
4. RETAIN variables need the retain field (item 11)

This GVL overlaps with item 8 (DC Shore 869 missing CAN signals) — the `IVT` and
`AdvanticsMCS` FBs are on CAN buses communicating with the shore charging hardware.

---

## 13. `plcDataType` is NULL for all 1156 signals

**Status:** Blocking GVL text generation. The API contract says `plcDataType` is the
IEC 61131-3 type to use in the GVL declaration. It is NULL for every signal in
project 1 (LasseMaja).

**Impact:** The GVL export endpoint cannot generate correct type declarations. It
must fall back to guessing (BOOL for discrete, INT for analog), which is wrong for
REAL, BYTE, WORD, and other types used throughout the project.

**Required fix:** Populate `plcDataType` for all signals. Source:
- GVL_Physical: types visible in reference GVL (`BOOL`, `INT`, `REAL`)
- GVL_Internal: types in reference GVL (`BOOL`, `INT`, `REAL`, `BYTE`)
- GVL_HVAC: types in reference GVL (`BOOL`, `INT`, `REAL`)
- GVL_CAN/BATT: `plcDataType` is not meaningful for FB-instance GVLs (the FB
  defines member types), but individual signal records could store the member type
  for documentation purposes
- GVL_Modbus: same as CAN/BATT — struct members have types defined by the struct

Note: `busSignal.plcDataType` IS populated for some signals (e.g. HVAC has `BOOL`),
but the top-level `plcDataType` field is always null. Either populate the top-level
field, or document that the generator should fall back to `busSignal.plcDataType` →
`analogSignal` defaults → `discreteSignal` defaults.

---

## 14. CAN/BATT signal `origin` field is wrong — set to `IEC` instead of CAN protocol

**Status:** Data quality issue. Not blocking generation but misleading.

All GVL_CAN signals (431) have `origin: "IEC"` — they should be `CANOPEN`.
All GVL_BATT signals (207) have `origin: "IEC"` — they should be `CANBUS`.

**Correct origins by GVL:**

| GVL | Current origin | Correct origin |
|---|---|---|
| GVL_CAN (nets 16-19) | `IEC` | `CANOPEN` |
| GVL_BATT (nets 22-23) | `IEC` | `CANBUS` |
| GVL_Physical | `IEC` | `IEC` (correct) |
| GVL_Internal | `IEC` / `MODBUS_TCP` | mixed (correct for the 4 that exist) |
| GVL_HVAC | `MODBUS_TCP` | `MODBUS_TCP` (correct) |
| GVL_Modbus | `IEC` (15) / `MODBUS_RTU` (209) | The 15 `IEC` signals need review |

---

## 15. HVAC Modbus register metadata missing

**Status:** All 12 GVL_HVAC signals have `busSignal.registerOffset: null` and
`busSignal.unitId: null`. The reference project has commented-out Modbus register
addresses for every variable (e.g. `// AT %MW20:INT;`).

This is a subset of item 5, but specifically for the LasseMaja HVAC signals that
already exist. The register data from the Alveli HVAC Modbus address table
(revision 3, dated 2025-01-14) should be entered.

**Register mapping for existing 12 signals:**

| Signal | registerType | registerOffset | unitId | Notes |
|---|---|---|---|---|
| `AS1_HMI_RSD_ALM` | COIL | bit 38.6 | 1 | Remote shutdown |
| `AS1_HMI_SYS_ALARM` | COIL | bit 30.1 | 1 | System alarm |
| `AS1_HMI_FAU1_GT4_ALM` | COIL | bit 1.2 | 1 | Freeze protection |
| `AS1_HMI_FAU2_GT4_ALM` | COIL | bit 1.3 | 1 | Freeze protection |
| `AS1_HMI_FAU1_ALM` | COIL | bit 40.1 | 1 | VFD alarm |
| `AS1_HMI_FAU2_ALM` | COIL | bit 40.4 | 1 | VFD alarm |
| `AS1_HMI_VP1_ALARM_NUM` | HOLDING_REGISTER | 31 | 1 | Changed to BOOL |
| `AS1_HMI_VP2_ALARM_NUM` | HOLDING_REGISTER | 32 | 1 | Changed to BOOL |
| `AS2_HMI_SYS_ALARM` | COIL | bit 1.0 | 2 | System alarm |
| `AS2_HMI_BVP_ALM` | COIL | bit 50.1 | 2 | Heat pump alarm |
| `AS2_HMI_HYDB1_ALM` | COIL | bit 55.1 | 2 | Hydrobox 1 alarm |
| `AS2_HMI_HYDB2_ALM` | COIL | bit 60.1 | 2 | Hydrobox 2 alarm |

Note: The "bit X.Y" notation means Modbus word register X, bit Y within that word.
This maps to `registerOffset` = X and `bitOffset` = Y (item 5's `registerBitOffset`).
