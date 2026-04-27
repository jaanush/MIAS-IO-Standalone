# Pending Requests from CODESYS Agent

Items here require implementation in MIAS-IO. Once implemented, update
`codesys-api-contract.md` and remove the corresponding entry from this file.

---

## FR-005: DEIF MIC-2 MKII device type + LasseMaja shore/distribution meter instances + struct-mode RTU codegen

**Priority:** HIGH — unblocks LasseMaja AC-shore commissioning (64A 3-phase shore connection)
**Date:** 2026-04-22

### Context

LasseMaja has three DEIF MIC-2 MKII power meters on Modbus RTU net 24
(750-652 S10):

| Tag | Role | Cabinet |
|---|---|---|
| `868-P01` | AC shore intake meter (64A 3-phase) | 868-A01 Shore Supply System |
| `875-P01` | AC distribution grid 1 meter | 875 AC Distribution |
| `875-P02` | AC distribution grid 2 meter | 875 AC Distribution |

Älvelie uses the same meter model in production with a proven FB suite
(`FB_ShoreAC` / `FB_Sync` / `FB_ShoreAC_Sync`) that was just ported into
`MIAS_Core.fbslib/PMS/Shore/`. Those FBs take a `strMKII`-typed struct
input (`FB_Sync.MeasureTool`) representing the meter's live register
view. The `strMKII` struct is already in MIAS_Core
(`Structs/ST_MKII.struct`) with the full DEIF register map documented
in-line.

Getting this end-to-end requires: (a) MIAS-IO knows what a MIC-2 MKII
is, (b) the three LasseMaja instances are defined with slave IDs and
systemGroup, (c) the plugin emits a `strMKII`-typed GVL variable per
meter (not 53 loose scalars), ready for the shore FBs to consume.

### Request

#### (1) Device catalog addition: `DEIF_MIC_2_MKII`

Add a new Modbus RTU device type to `codesys_device_catalog.json` (or
the equivalent MIAS-IO device registry):

- **Type name**: `DEIF_MIC_2_MKII`
- **Protocol**: `MODBUS_RTU`
- **Default transport**: 19200 baud, 8N1, parity None, RS-485 2-wire
  (confirmed from Älvelie project:
  `Programs\Modbus - RTU\DEIF\FB_ModbusSerial_DEIF_MASTER_Multi_PrimaryMode.pou.xml.v3`
  line 2561: `Baudrate: UDINT := 19200; // Default of DEIF is 19200`)
- **Slave address range**: 1..247 (Modbus spec). Default factory = 1.
- **Byte order**: big-endian (Modbus-standard). Float is IEEE 754
  32-bit across 2 consecutive registers (register N high word, N+1 low
  word in standard Modbus word order).
- **Signal template**: **53 signals** per device (see register map
  below). Field names MUST match the `strMKII` struct fields verbatim
  (case-sensitive) so the plugin's Modbus renderer can populate the
  struct directly.

#### (2) LasseMaja (project 1) meter instances

Three new Modbus RTU devices on net 24:

| Device tag | Slave ID | systemGroup | Notes |
|---|---|---|---|
| `868-P01` | 1 | `AC_Shore_Connection` (new or existing 868 group) | Shore intake |
| `875-P01` | 2 | `AC_Distribution_Grid_1` | Post-transformer grid 1 |
| `875-P02` | 3 | `AC_Distribution_Grid_2` | Post-transformer grid 2 |

All three use the `DEIF_MIC_2_MKII` template. Each generates the full
53-signal set under its systemGroup.

#### (3) Plugin codegen — struct-mode for RTU meter devices

**This revives the open item previously tagged "GVL_Modbus struct-based
generation" in the CODESYS-agent notes.**

When a Modbus RTU device has `generationMode: STRUCT_FROM_DEVICE` (or
equivalent marker — pick the name), the plugin should emit:

```
(* GVL_MIAS_COM *)
meter_868_P01 : strMKII;
meter_875_P01 : strMKII;
meter_875_P02 : strMKII;
```

Plus a per-cycle populator in `PRG_MIAS_Cyclic` (or a dedicated
`PRG_RTU_Cyclic`) that copies each raw register read into the matching
struct field by name. Block reads are preferred (0x4000..0x4047 in one
Modbus FC03, etc.) — 3 FC03s per meter per poll cycle covers all 53
signals efficiently.

Consumer FBs on the CODESYS side will then reference
`GVL_MIAS_COM.meter_868_P01` as a `strMKII`-typed input, no marshalling
required at the consumer.

If struct-mode is not feasible in this FR's timeline, the plugin
should at minimum emit named scalar `FB_DataSourceModbus*` instances
for each signal (`src_AC_Shore_Connection_Frequency`, etc.) and the
CODESYS side will hand-write a temporary marshaller
`GVL_MIAS_COM.meter_868_P01.Frequency := src_..._Frequency.rValue`.
Flag which path is chosen so I know whether to skip the marshaller.

### Register map — DEIF MIC-2 MKII (all 53 signals)

Source of truth: `C:\Projects\MIAS_Core\MIAS_Core.fbslib\Structs\ST_MKII.struct`
(field names + register addresses in comments). For MIAS-IO catalog
seed, use the table below — all fields read-only, function code 03.

Signal names MUST be entered verbatim (case-sensitive, underscores) to
match `strMKII`.

**Block 1 — 36× REAL (32-bit float, 2 regs each), 0x4000–0x4047:**

| Name | Hex start | Dec start |
|---|---|---|
| `Frequency` | 0x4000 | 16385 |
| `Phase_voltage_V1` | 0x4002 | 16387 |
| `Phase_voltage_V2` | 0x4004 | 16389 |
| `Phase_voltage_V3` | 0x4006 | 16391 |
| `Average_voltage_Vavg` | 0x4008 | 16393 |
| `Line_voltage_V12` | 0x400A | 16395 |
| `Line_voltage_V23` | 0x400C | 16397 |
| `Line_voltage_V31` | 0x400E | 16399 |
| `Average_line_voltage_Vlavg` | 0x4010 | 16401 |
| `Phase_line_current_I1` | 0x4012 | 16403 |
| `Phase_line_current_I2` | 0x4014 | 16405 |
| `Phase_line_current_I3` | 0x4016 | 16407 |
| `Average_current_Iavg` | 0x4018 | 16409 |
| `Neutral_current_In` | 0x401A | 16411 |
| `Phase_L1_power_P` | 0x401C | 16413 |
| `Phase_L2_power_P` | 0x401E | 16415 |
| `Phase_L3_power_P` | 0x4020 | 16417 |
| `System_power_Psum` | 0x4022 | 16419 |
| `Phase_L1_reactive_power_Q` | 0x4024 | 16421 |
| `Phase_L2_reactive_power_Q` | 0x4026 | 16423 |
| `Phase_L3_reactive_power_Q` | 0x4028 | 16425 |
| `System_reactive_power_Qsum` | 0x402A | 16427 |
| `Phase_L1_apparent_power_S` | 0x402C | 16429 |
| `Phase_L2_apparent_power_S` | 0x402E | 16431 |
| `Phase_L3_apparent_power_S` | 0x4030 | 16433 |
| `System_apparent_power_Ssum` | 0x4032 | 16435 |
| `Phase_L1_power_factor_PF` | 0x4034 | 16437 |
| `Phase_L2_power_factor_PF` | 0x4036 | 16439 |
| `Phase_L3_power_factor_PF` | 0x4038 | 16441 |
| `System_power_factor_PFsum` | 0x403A | 16443 |
| `Voltage_unbalance_factor_U_unbl` | 0x403C | 16445 |
| `Current_unbalance_factor_I_unbl` | 0x403E | 16447 |
| `Load_characteristic_L_C_R` | 0x4040 | 16449 |
| `Power_demand` | 0x4042 | 16451 |
| `Reactive_power_demand` | 0x4044 | 16453 |
| `Apparent_power_demand` | 0x4046 | 16455 |

**Block 2 — 9× DWORD (32-bit unsigned, 2 regs each), 0x4048–0x4059:**

`Energy_IMP` (0x4048), `Energy_EXP` (0x404A),
`Reactive_energy_IMP` (0x404C), `Reactive_energy_EXP` (0x404E),
`Energy_TOTAL` (0x4050), `Energy_NET` (0x4052),
`Reactive_energy_TOTAL` (0x4054), `Reactive_energy_NET` (0x4056),
`Apparent_energy` (0x4058).

**Block 3 — 8× WORD (16-bit, 1 reg each), 0x405A–0x4061:**

`THD_V1_of_V1_V12` (0x405A), `THD_V1_of_V2_V31` (0x405B),
`THD_V1_of_V3_V23` (0x405C), `Average_THD_V` (0x405D),
`THD_I1` (0x405E), `THD_I2` (0x405F), `THD_I3` (0x4060),
`Average_THD_I` (0x4061).

### Acceptance criteria

1. `DEIF_MIC_2_MKII` appears as a selectable device type in the
   MIAS-IO UI under Modbus RTU devices with the 53-signal template
   auto-applied on instance creation.
2. The three LasseMaja instances (`868-P01`, `875-P01`, `875-P02`)
   exist in project 1, each with all 53 signals attached, assigned to
   the correct systemGroup, and resolvable via
   `GET /api/codesys/project/1`.
3. The plugin can consume the project payload and (either) emit
   `meter_<tag> : strMKII` GVL vars with per-cycle populators, OR emit
   53 loose scalar `FB_DataSourceModbus*` signals per meter —
   **document which path was taken** in the catalog change PR so we
   know whether to write a marshaller shim.
4. Modbus RTU net 24 (750-652 S10) is reachable: generate → build →
   download → the three meters respond to polling (`CommError = FALSE`
   in the struct, non-zero Frequency after ~1s of uptime).

### Out of scope (handled CODESYS-side)

- `PRG_RTU` cyclic bringup of `FB_RTU652` / `FB_ModbusRTUInterface`
  (already exists in MIAS_Core; needs wiring like we did for PRG_CAN).
- `FB_ShoreAC_Sync` instantiation and wiring in `GVL_MIAS_COM`.
- The existing discrete signal `DC_Shore_Connection_868_A01_Synk_OK`
  (HAS111DG sync-check relay output) is already mapped and does NOT
  need changes — we'll wire it into `FB_ShoreAC_Sync.Sync_OK` on the
  PLC side.

### Dependencies / questions

- Does MIAS-IO already have a Modbus RTU device template framework, or
  is this the first RTU device type added? If first, schema extensions
  may be needed (transport params per RTU net, baud/parity fields on
  the network rather than the device).
- systemGroup naming — reuse `AC_Shore_connection_868` (existing per
  current signal list) or create a new `AC_Shore_Connection` as a
  parent? Prefer reuse.

---

## FR-011 — JMobile alarm IEC path: pick Option A

**Date:** 2026-04-27
**Reply to:** your "PROPOSAL — `iec_alarm_path` for the upcoming JMobile alarm export" (2026-04-26)

### Decision

**Option A** (column on `discrete_alarm` and `analog_alarm`). Go ahead.

### Rationale

- Structural consistency with the existing `iec_path`/`iec_path_raw`
  push wins. One row per concrete thing (signal or alarm) is easier
  to reason about on both sides than a JSON map.
- The "alarm-id lookup" objection is real but cheap on the plugin
  side: alarms are already in the `/api/codesys/project/:id` payload
  the plugin consumes at codegen entry, so alarmId is in hand
  before the push — no extra round-trip.
- A single endpoint upserting either signal-paths or alarm-paths
  keeps the plugin codegen thin: one collector, one POST.

### What the plugin will push

Per discrete alarm whose triggered state is a named GVL var:

```json
{ "alarmId": <id>, "alarmKind": "discrete", "iecAlarmPath": "Application.GVL_ALARMS.bSomeAlarm" }
```

Per analog alarm condition:

```json
{ "alarmId": <id>, "alarmKind": "analog",  "iecAlarmPath": "Application.GVL_ALARMS.fbAlarm_T101.HH" }
```

Each analog alarm row covers one condition (HH/H/L/LL) and the path
points at the bit/var the HMI subscribes to for THAT condition's
triggered state. Plugin-side: one codegen pass after generating
`GVL_ALARMS` produces `(alarmId, kind, path)` triples. Pushed in
the same `POST /api/codesys/project/:id/iec-paths` call as the
signal entries.

### Acceptance from our side

Once schema + endpoint land, the plugin will:

1. Discover alarms via the project payload at codegen entry.
2. Produce IEC paths for each generated alarm var.
3. Append entries to the existing iec-paths POST batch.

No flag required to enable — if the path field is present on the
push, server stores it; if absent, server leaves it null.

### Open

`POST /iec-paths` partial-success semantics: if `alarmId` doesn't
exist, return per-entry status (existing or new) and continue with
the rest. Same as the current signal-path behaviour. Confirm.

---

## FR-012 — `signal.systemGroup` populated on every signal

**Priority:** HIGH — needed to split the 14k-line `PRG_MIAS_Init` POU
by physical/functional system so the body actually compiles + runs on
the PFC200. (Suspected POU-size limit is what caused init to silently
not execute on LasseMaja, even with `xInitDone = TRUE` after build.)
**Date:** 2026-04-27

### Context

Plugin needs to split `PRG_MIAS_Init` into per-system POUs (e.g.
`PRG_MIAS_Init_System_Cooling_System_721`,
`PRG_MIAS_Init_System_Propulsion_FWD_625`, ...) so:
- Each POU stays well under the CODESYS PFC compiled-bytecode cap
  (~32–64 KB per POU; 14k lines blew through it silently)
- A human commissioning a system can find that system's init in one
  named POU
- Init can be staged across multiple MainTask cycles via a state
  machine in the orchestrator

This means every signal needs a `systemGroup` so the plugin knows which
POU to render its init lines into.

For LasseMaja project 1 (`GET /api/codesys/project/1`), all 1115
signals come back with `systemGroup: null`:

```
System groups distribution: {<null>: 1115}
```

Plugin tried to derive systemGroup from tag prefix (walk chunks until
first all-digit segment, e.g. `Cooling_System_721_KS1_P11A_...` →
`Cooling_System_721`). That works for ~550 of 1115 signals but fails
for the ~565 BMS signals whose tags are CAN field names without any
system prefix (`linkVoltage`, `alive_PT`, `essMstrPrechargeState00_BMS`,
etc.). Those tags don't tell you which physical battery they belong
to (`866-C01` FWD vs `866-C02` AFT).

### Request

Populate `signal.systemGroup` on **every signal** in the
`/api/codesys/project/:id` response with a stable system identifier.

#### Suggested format

`systemGroup` should be a stable, IEC-identifier-clean string that
groups signals belonging to the same physical/functional system.
Values used by the LasseMaja project (derivable from the signal data
already present, just exposed on the field):

```
AC_Distribution_875
AC_Shore_Connection_868
Battery_866_C01            ← 866-C01 BMS (FWD), Kreisel BMS CAN signals
Battery_866_C02            ← 866-C02 BMS (AFT), Kreisel BMS CAN signals
Common_Electric_System_851
Common_Electric_System_852
Contr_Mon_System
Cooling_System_721
DC_Distribution_871
DC_Shore_Connection_868
DC_Shore_Connection_869
Fire_Alarm_811
Genset_861
Hydraulic_System_831
Propulsion_FWD_625
Propulsion_FWD_851
Ultra_FOG_System_815
Ventilation_System_574
24vdc_Distribution_874
```

(Underscore-separated, IEC identifier rules — no spaces, no leading
digits, ASCII only.)

The mapping for BMS signals can come from each signal's
`busSignal.networkId` (each Kreisel pack lives on its own CAN net):
- net 22 (or whichever is FWD) → `Battery_866_C01`
- net 23 (or whichever is AFT) → `Battery_866_C02`

For the rest, `tag.split('_')[0..n]` where `n` is the index of the
first all-digit chunk works.

### Acceptance

`GET /api/codesys/project/1` returns `systemGroup` as a non-null
string on **every** signal with `ioCard != null` (IEC + Modbus TCP)
and on every CAN signal where the BMS pack can be determined from
network/component data.

For signals that genuinely don't belong to any specific system
(rare — INTERNAL signals, system-wide alarms), `systemGroup =
"System_Wide"` is acceptable as a synthetic fallback.

### Plugin-side workaround status

Plugin will use `signal.systemGroup` when present; falls back to
tag-prefix derivation, then to `Other` bucket. Once MIAS-IO populates
the field properly, the per-system POU naming will become stable and
human-meaningful instead of catch-all `Other` for the BMS half.

---
