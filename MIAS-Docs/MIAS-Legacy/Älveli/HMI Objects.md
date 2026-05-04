# Alveli HMI Objects

Analysis of the HMI widget architecture from `C:\Projects\Älvelie.fbsproj\HMI\`.

## Architecture

The HMI system uses a **two-layer pattern**:

1. **FB_Hmi* function blocks** — PLC-side "view models" that extract and flatten data from control FBs into simple types (BOOL, INT, REAL) that the HMI can read via OPC UA symbol access
2. **Call_HmiWidgets program** — orchestrator that calls all HMI FB instances each cycle, wiring them to the actual control FBs
3. **GVL_HMI** — global variable list containing all HMI FB instances, marked `{attribute 'linkalways'}` so they appear in the OPC UA address space

The external HMI (JMobile/Exor panels) reads `GVL_HMI.fbHmi_*` variables directly. No intermediate protocol conversion — pure OPC UA variable access.

## Design Pattern

Each HMI FB follows the same pattern:

```
FUNCTION_BLOCK FB_Hmi<Widget>
VAR_INPUT
    {attribute 'symbol' := 'none'} ControlFB : REFERENCE TO <actual_FB> := dummy;
    // Additional raw inputs that don't come from the FB
END_VAR
VAR
    // Flattened outputs — these are what the HMI reads
    Status : eStatus_5state;
    Value1 : REAL;
    Value2 : INT;
    Fault  : BOOL;
    // ...
END_VAR
```

Key characteristics:
- **Input references are `{attribute 'symbol' := 'none'}`** — hidden from OPC UA. The HMI never sees the control FB reference.
- **Output variables have NO attribute** — they default to `readwrite` and are visible to the HMI via OPC UA
- **Dummy instances** as default references — prevents null reference crashes if not wired. Each FB declares a `dummyXxx` instance.
- **Pure data extraction** — no control logic in HMI FBs. They only copy/transform values from the control layer.

## HMI FB Catalog

### Power Distribution
| FB | Purpose | Key Variables |
|----|---------|--------------|
| `FB_HmiPmsStatus` | System-wide PMS overview | DC voltages (MSB1/MSB4), power used/available/reserve per bus side, battery/microgrid/AFE/shore start commands and power values, short+long term consumption |
| `FB_HmiMsbDc` | DC bus section status | Voltage, isolation fault, blackout |
| `FB_HmiMsbAc` | AC bus section status | (similar pattern) |
| `FB_HmiBreaker` | Breaker status | Closed, precharge active, synch active, local manual control |
| `FB_HmiTrafo` | Transformer status | (temperature alarms, overload) |

### Battery System
| FB | Purpose | Key Variables |
|----|---------|--------------|
| `FB_HmiBatteryPack` | Battery pack overview | Status (5-state), SOC, SOH, power available, connected, fault, string count, powerflow, min/max cell voltage+temp, charge/discharge direction, level alarm color (green/yellow/red) |
| `FB_HmiBatteryStatus` | Aggregated battery status | (combined view of both packs) |
| `FB_HmiStringStatus` | Per-string status | (per-string voltage, current, SOC, fault) |
| `FB_HmiStringAlarms` | String alarm summary | (fault flags per string) |
| `FB_HmiStringModuleAlarms` | Module-level alarms | (deeper BMS module fault detail) |
| `FB_HmiConverter_DCDC` | DCDC converter detail | (from Editron DCDC FB) |
| `FB_HmiConverterCommon_DCDC` | Shared DCDC data | (struct for common DCDC info) |

### Editron Converters
| FB | Purpose | Key Variables |
|----|---------|--------------|
| `FB_HmiConverter_uGridAfe` | Microgrid/AFE converter | Status, comm error, EmStop, temperatures, DC voltage/current/power, microgrid-specific (running, frequency, voltage RMS, current RMS, power, reactive power, power factor), AFE-specific (running, grid frequency/power/voltage) |
| `FB_HmiConverter_MC` | Motor controller | (speed, torque, temperatures, status) |
| `FB_HmiConverter_DCDC` | DCDC converter | (buck/boost power, current limits, voltage) |

### Propulsion
| FB | Purpose | Key Variables |
|----|---------|--------------|
| `FB_HmiPropulsion` | Propulsion summary | Speed ahead, speed astern (from lever × direction) |
| `FB_HmiEMotor` | Electric motor status | (temperatures, running hours) |
| `FB_HmiLever` | Lever position | (lever percentage, direction) |
| `FB_HmiPropeller` | Propeller status | (RPM, direction) |

### Genset
| FB | Purpose | Key Variables |
|----|---------|--------------|
| `FB_HmiGensetEngine` | Diesel engine | (from strDiesel: RPM, load, temps, pressures, fuel, engine state) |
| `FB_HmiGenerator` | AC generator | (voltage, current, frequency, power) |

### Shore Connections
| FB | Purpose | Key Variables |
|----|---------|--------------|
| `FB_HmiShoreAC` | AC shore connection | Connected, local control, voltage, current, frequency, connection counter reset |
| `FB_HmiShoreDC` | DC shore (MCS/EVCC) | Status, SOC, max current allowed, DC current/voltage (request, present, battery, inlet), CP state/duty/voltage, PP resistance, PTC temperatures, communication stage, inlet lock, protocol, pins, contactors, fault/EmStop/comm fault |

### Auxiliary Systems
| FB | Purpose | Key Variables |
|----|---------|--------------|
| `FB_HmiBilge` | Bilge pump | (running, level, alarm) |
| `FB_HmiFireFightingPump` | Fire pump | (running, fault) |
| `FB_HmiCoolingPump` | Cooling pump | (running, fault) |
| `FB_HmiRedundancy` | PLC redundancy | (active PLC, sync status) |
| `FB_HmiPLCComm` | Inter-PLC communication | (watchdog, comm status) |
| `FB_HmiPower` | Power measurement | (energy counters, power flow) |

## GVL_HMI Instance Map

```
GVL_HMI/
├── Watchdogs (3)
│   ├── Watchdog_PLC_and_HMI_ER_OP1     — Engine room panel
│   ├── Watchdog_PLC_and_HMI_WH_OP2     — Wheelhouse panel
│   └── Watchdog_PLC_and_HMI_WH_OP3     — Wheelhouse panel 2
│
├── Battery (per pack: AFT + FWD)
│   ├── fbHmi_BatteryPack_AFT/FWD         — Pack overview
│   ├── fbHmi_BatteryModuleAlarms_AFT/FWD  — Module-level alarms
│   ├── fbHmi_BatteryStringAlarms_AFT/FWD  — String alarms
│   ├── fbHMI_BatteryStringStatus_AFT[1..5] / FWD[1..4]  — Per-string
│   ├── fbHmi_BatteryConverter_866_AFT[1..2] / FWD[1..2]  — DCDC converters
│   ├── fbHmi_BatteryConverterCommon_AFT/FWD — Shared DCDC data
│   ├── fbHmi_BatteryBreaker_AFT[1..5] / FWD[1..4]  — String breakers
│   ├── fbHmi_BatteryBreaker_Common_AFT/FWD  — Pack breakers
│   └── fbHmi_BatteryStatus                 — Combined battery status
│
├── PMS
│   ├── fbHmi_PmsStatus                     — System overview
│   ├── fbHmi_Msb1AC_AFT / fbHmi_Msb2AC_FWD — AC bus status
│   ├── fbHmi_Msb1DC_AFT / fbHmi_Msb4DC_FWD — DC bus status
│   ├── fbHmi_Trafo_T1 / T2                 — Transformers
│   ├── fbHmi_LcFilter_T1 / T2              — LC filters
│   └── fbHmi_GridConverter_875_U01 / U02    — Microgrid/AFE converters
│
├── Propulsion (AFT + FWD)
│   ├── fbHmi_PropulsionConverter_AFT/FWD    — Motor controllers
│   ├── fbHmi_PropulsionEmotor_AFT/FWD       — Electric motors
│   ├── fbHmi_Lever_AFT/FWD                  — Lever positions
│   ├── fbHmi_Propeller_AFT/FWD              — Propeller status
│   └── FB_HmiPropulsion_AFT/FWD             — Propulsion summary
│
├── Genset
│   ├── fbHmi_GensetConverter                — DCDC converter
│   ├── fbHmi_GensetEngine                   — Diesel engine
│   └── fbHmi_GensetGenerator                — AC generator
│
├── Shore
│   ├── fbHmi_ShoreAC                        — AC shore connection
│   └── fbHmi_ShoreDC                        — DC (MCS/EVCC) shore
│
├── Switchboard
│   └── fbHMI_SwitchBoard_Breaker[1..6]      — Bus tie + feed breakers
│
├── Auxiliary
│   ├── fbHMI_bilge* (7 instances)           — Bilge pumps
│   ├── fbHMI_FireFightingPump               — Fire pump
│   ├── fbHMI_CoolingPump1_aft / 2_fwd      — Cooling pumps
│   ├── fbHmi_EnergyShoreConn                — Shore energy
│   ├── fbHmi_EnergyMSB1_AC / MSB2_AC       — Bus energy
│   └── fbHmi_Redundancy / CommStatus        — PLC redundancy
│
└── Misc
    └── BilgePumpStartDelay / StopDelay      — Bilge pump timing settings
```

## Call_HmiWidgets Program

The orchestrator has **action blocks** per subsystem:

| Action | Wires |
|--------|-------|
| `Battery()` | BatteryPack FBs → battery control data; string status → BMS data; DCDC converter FBs → CAN data; breaker FBs → physical I/O |
| `Genset()` | GensetEngine → Modbus diesel data; GensetGenerator → measurement data; GensetConverter → CAN data |
| `PMS()` | PmsStatus → Main program outputs (voltages, power, consumption, start commands, power flows) |
| `PowerDistribution()` | MSB DC/AC → voltage/blackout/isolation; breakers → physical I/O; transformers → temp alarms; energy → power measurement |
| `Propulsion()` | PropulsionConverter → CAN MC data; EMotor → temperatures; Lever → lever FBs; Propeller → RPM |
| `Shore()` | ShoreAC → FB_ShoreAC data; ShoreDC → Advantics EVCC data |
| `Redundancy()` | PLC redundancy and comm status |
| `Misc()` | Bilge pumps, fire pump, cooling pumps, etc. |

## Data Flow

```
Physical I/O (GVL_Physical)
    ↓
Control FBs (Programs/*)     ←→  CAN/Modbus data (GVL_CAN, GVL_Modbus, GVL_BATT)
    ↓
Call_HmiWidgets (wiring)
    ↓
FB_Hmi* instances (GVL_HMI)  ←  flatten/transform data
    ↓
OPC UA symbol access          →  JMobile/Exor HMI panels
```

## Key Design Observations

1. **Clean separation**: Control logic never references HMI. HMI FBs only read from control FBs — no writes back. HMI commands (like reset, acknowledge) go through separate GVL paths (GVL_Settings, GVL_Alarms ack arrays).

2. **View model pattern**: HMI FBs are essentially DTOs (Data Transfer Objects). They flatten complex nested structures into simple scalar variables that HMI tools can bind to.

3. **OPC UA is the transport**: All HMI data access is via CODESYS OPC UA server. Variables in GVL_HMI are automatically exported. `{attribute 'symbol' := 'none'}` hides implementation details.

4. **Dummy references prevent crashes**: Every REFERENCE TO input has a default pointing to a dummy instance. If Call_HmiWidgets doesn't wire a reference, the FB still runs safely with zero/default values.

5. **Battery level color logic in HMI FB**: `FB_HmiBatteryPack` computes `BatteryLevelAlarm` (0=green, 1=yellow, 2=red) from SOC thresholds defined in the parent program. This is presentation logic in the PLC — could be in HMI.

6. **Watchdog pattern**: Three watchdog BOOLs toggled between PLC and HMI panels. If the HMI stops toggling, the PLC knows the panel is dead (and vice versa).

7. **~50 HMI FB instances** total in GVL_HMI — this is the complete HMI contract for the vessel.

8. **No HMI code generation**: Unlike alarms, the HMI FBs are hand-written. This is a candidate for MIAS 2.0 automation — the FB_Hmi* pattern is repetitive and could be generated from component templates.

## Source Files

```
HMI/
├── Call_HmiWidgets.prg.st             — Orchestrator
│   ├── Battery.act.st                 — Battery wiring
│   ├── Genset.act.st                  — Genset wiring
│   ├── PMS.act.st                     — PMS status wiring
│   ├── PowerDistribution.act.st       — Buses/breakers/trafos
│   ├── Propulsion.act.st              — Thruster wiring
│   ├── Shore.act.st                   — Shore AC + DC wiring
│   ├── Redundancy.act.st              — PLC redundancy
│   └── Misc.act.st                    — Bilge/fire/cooling
├── FBs/                               — 27 HMI function blocks
│   ├── FB_HmiBatteryPack.fb.st
│   ├── FB_HmiBatteryStatus.fb.st
│   ├── FB_HmiBilge.fb.st
│   ├── FB_HmiBreaker.fb.st
│   ├── FB_HmiConverter_DCDC.fb.st
│   ├── FB_HmiConverterCommon_DCDC.fb.st
│   ├── FB_HmiConverter_MC.fb.st
│   ├── FB_HmiConverter_uGridAfe.fb.st
│   ├── FB_HmiCoolingPump.fb.st
│   ├── FB_HmiEMotor.fb.st
│   ├── FB_HmiFireFightingPump.fb.st
│   ├── FB_HmiGenerator.fb.st
│   ├── FB_HmiGensetEngine.fb.st
│   ├── FB_HmiLever.fb.st
│   ├── FB_HmiMsbAc.fb.st
│   ├── FB_HmiMsbDc.fb.st
│   ├── FB_HmiPLCComm.fb.st
│   ├── FB_HmiPmsStatus.fb.st
│   ├── FB_HmiPower.fb.st
│   ├── FB_HmiPropeller.fb.st
│   ├── FB_HmiPropulsion.fb.st
│   ├── FB_HmiRedundancy.fb.st
│   ├── FB_HmiShoreAC.fb.st
│   ├── FB_HmiShoreDC.fb.st
│   ├── FB_HmiStringAlarms.fb.st
│   ├── FB_HmiStringModuleAlarms.fb.st
│   ├── FB_HmiStringStatus.fb.st
│   └── FB_HmiTrafo.fb.st
└── Structs/
    └── strConv_FW11_DCDC_Common.struct — Shared DCDC data structure

GVL/
└── GVL_HMI.gvl                        — All FB instances + watchdogs
```
