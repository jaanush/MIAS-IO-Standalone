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
