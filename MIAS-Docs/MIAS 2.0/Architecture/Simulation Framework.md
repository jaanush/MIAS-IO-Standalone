# Simulation Framework — MIAS_Core

## Concept

Every control component has a companion simulator FB that runs in a **separate CODESYS task** and writes simulated values into the same DAOs that real hardware would populate. The control FBs don't know they're running against simulation — the DAO layer is the abstraction point.

## How It Works

### DAO Override Chain (already built)

`FB_DataObject` has a 6-level priority chain:

```
1. Normal        — live value from FB_DataSource (real hardware)
2. Fallback      — activates on BAD quality (last-good, low, high, predefined)
3. Local Cache   — application-written value
4. Sideload      — injected value from external system ← SIMULATOR WRITES HERE
5. Simulation    — test/commissioning override (simple static values)
6. HMI Override  — operator override from visualisation
```

**Simulators use level 4 (Sideload)** — this injects values at the raw wire level, before scaling. To the control FB, sideloaded values look identical to real CAN/Modbus data. The data source quality stays GOOD because the DAO sees a valid value.

Level 5 (Simulation) is for static test values from the HMI/OPC UA. Level 4 (Sideload) is for dynamic simulation.

### Existing API

```iec-st
// Enable simulation on a single DAO
myDao.SetSimulation(bEnable := TRUE, rValue := 42.0);

// Enable simulation on all DAOs in a group
myDaoGroup.SetSimModeAll(bEnable := TRUE);

// For sideload (raw level, preferred for simulation):
myDao._bSideloadActive := TRUE;
myDao._xwSideloadValue := <raw value>;
```

## Architecture

```
┌─────────────────────────────────────┐
│  MAIN TASK (20ms cycle)             │
│                                     │
│  FB_KreiselBMS ←── DAOs ──→ CAN    │
│  FB_BatteryPack                     │
│  FB_PMS                             │
│  FB_EditronMC ←──── DAOs ──→ CAN   │
│  FB_PMSGenset                       │
│  FB_PMSPropulsion                   │
│                                     │
│  DAOs read from DataSources OR      │
│  from sideloaded simulation values  │
└─────────────────────────────────────┘
           ▲ sideload writes
           │
┌─────────────────────────────────────┐
│  SIM TASK (100ms cycle)             │
│                                     │
│  FB_SimDCBus        — bus voltage   │
│  FB_SimBattery [×2] — SOC, current  │
│  FB_SimConverter [×N] — status, pwr │
│  FB_SimGensetEngine — RPM, temp     │
│  FB_SimPropulsion [×2] — lever, load│
│                                     │
│  Reads WRITE DAOs (commands from    │
│  control FBs) and computes response │
│  Writes READ DAOs (feedback to      │
│  control FBs) via sideload          │
└─────────────────────────────────────┘
```

The sim task runs at a slower cycle (100ms is fine — simulation doesn't need 20ms resolution). It:
1. **Reads** from the write DAOs (commands the control FBs have sent)
2. **Computes** the simulated response (physics model, however crude)
3. **Writes** to the read DAOs via sideload (feedback to control FBs)

## Simulator FBs

### FB_SimDCBus — DC bus voltage model
The most important simulator. Without it, the PMS PID has no feedback.

**Model:** Simple capacitor + power balance
```
dV/dt = (P_total) / (C_bus × V_bus)

Where:
- P_total = sum of all power flows (positive = charging bus, negative = draining)
- C_bus = bus capacitance (configurable, ~10-50mF for typical marine DC bus)
- V_bus = current bus voltage
```

**Inputs:** (read from converter write DAOs)
- Power from each battery (computed from battery sim current × voltage)
- Power from genset converter (from power reference DAO)
- Power from shore (from AFE/DCDC power reference)
- Power consumed by propulsion (from MC power reference)
- Power consumed by microgrid/hotel (configurable base load)

**Outputs:** (sideloaded to read DAOs)
- DC bus voltage (to `linkVoltage_BMS` DAO and any bus voltage measurement DAO)

**Behavior:**
- Starts at nominal voltage (e.g. 700V)
- Drops when consumers exceed producers
- Rises when producers exceed consumers
- Rate of change proportional to power imbalance / capacitance
- Clamp to 0-900V range

### FB_SimBattery — Kreisel battery pack simulator
One instance per battery pack.

**Model:** SOC decay/charge with current limits

**State:**
- SOC (0-100%, starts at configurable value)
- String states (connected/disconnected)
- Fault flags (none by default, injectable for testing)

**Inputs:** (read from BMS write DAOs — PT_Request)
- stateRequest (STANDBY/DRIVE/CHARGE)
- chargePowerAvailable

**Outputs:** (sideloaded to BMS read DAOs)
- state_BMS → mirrors stateRequest after transition delay
- current_BMS → computed from bus power balance / number of connected packs
- linkVoltage_BMS → from FB_SimDCBus
- minSOC_BMS / maxSOC_BMS → from SOC model
- userSOC_BMS → average SOC
- dischargeCurrentLimit / regenCurrentLimit → configurable, reduced at low/high SOC
- dischargePowerPred / regenPowerPred → limit × voltage / 1000
- numberOfConnectedStrings → based on state (DRIVE = all, STANDBY = 0)
- Per-SC linkVoltage → from SOC-based OCV lookup

**SOC model:**
```
dSOC/dt = -I_batt / (C_rated × 3600) × 100

Where:
- I_batt = battery current (positive = discharge)
- C_rated = rated capacity in Ah (configurable)
```

**OCV lookup (crude):** Linear approximation:
```
V_OCV = V_min + (SOC/100) × (V_max - V_min)

Where V_min ≈ 590V, V_max ≈ 750V for a typical ~700V NMC pack
```

### FB_SimConverter — Generic Editron converter simulator
One instance per converter (propulsion, genset, AFE, DCDC).

**Model:** First-order response with delay

**Inputs:** (from converter write DAOs)
- RunCommand
- PowerRef / SpeedRef / VoltageRef (depending on type)
- ControlMode

**Outputs:** (sideloaded to converter read DAOs)
- eState → Off → Starting (2s delay) → Running
- DC_voltage → from FB_SimDCBus
- DC_current → PowerRef / DC_voltage
- Power_DC → PowerRef (with first-order lag)
- Junction_temp → slow ramp based on load (ambient + load × thermal coefficient)
- Fault → FALSE (injectable for testing)
- Communication_Fault → FALSE

**Start delay:** 2s from RunCommand = TRUE to eState = Running. Simulates converter initialization.

**Power response:** First-order lag with configurable time constant (default 200ms). Output tracks reference with exponential approach.

### FB_SimGensetEngine — Diesel engine simulator
Wraps around an FB_SimConverter for the generator-side MC.

**Model:** RPM ramp + load acceptance

**Additional state:**
- RPM (starts at 0, ramps to setpoint)
- Coolant temperature (starts cold, warms up)
- Engine state (ComAP states: Not_Ready → Prestart → Starting → Running → Loaded)

**Behavior:**
- RunCommand TRUE → crank (2s) → idle RPM (700)
- Speed setpoint change → ramp at configurable rate (100 RPM/s)
- Load applied only when RPM within 5% of setpoint
- Coolant temp: ambient + (load% × 40°C), slow time constant (minutes)
- Oil pressure: proportional to RPM (0 when stopped)

### FB_SimPropulsion — Propulsion load simulator
Simple: lever position → power demand on DC bus.

**Model:**
```
P_demand = (lever% / 100)² × P_rated × direction

Where:
- Squared relationship (propeller power ∝ RPM³, but lever is ~linear to RPM)
- direction = +1 (FWD) or -1 (AFT)
- P_rated = rated propulsion power (184kW for Lasse-Maja)
```

### FB_SimShoreConnection — Shore power simulator
Provides configurable constant power when connected.

**Model:** Simple: when connected and AFE running, provides up to P_max at configurable power factor.

## Simulation Controller — FB_SimController

Master controller that:
- Enables/disables simulation globally
- Coordinates all simulator instances
- Provides HMI interface for scenario selection
- Manages the sim task timing

```iec-st
FUNCTION_BLOCK FB_SimController
VAR_INPUT
    xEnable         : BOOL;        // master enable
    eScenario       : E_SimScenario;  // preset scenarios
    // Manual overrides
    rInitialSOC_C1  : REAL := 80.0;
    rInitialSOC_C2  : REAL := 80.0;
    rHotelLoad_kW   : REAL := 30.0;
    xShoreConnected : BOOL := FALSE;
    rShoreMaxPower  : REAL := 200.0;
    xGensetAvailable: BOOL := TRUE;
    // Fault injection
    xInjectBattFault_C1 : BOOL;
    xInjectBattFault_C2 : BOOL;
    xInjectCommFault    : BOOL;
END_VAR
```

### Preset Scenarios (E_SimScenario)

| Scenario | Description |
|----------|-------------|
| HARBOR_CHARGING | Shore connected, both packs charging, no propulsion |
| HARBOR_FULL | Shore connected, batteries full, hotel load only |
| SEA_NORMAL | No shore, both packs, light propulsion (50%) |
| SEA_HEAVY | No shore, both packs, full propulsion (100%) |
| SEA_LOW_BATT | No shore, SOC at 15%, genset should auto-start |
| BLACKOUT | No shore, batteries disconnected, bus at 0V |
| SINGLE_PACK | One pack offline (calibration), other pack + shore |
| GENSET_ONLY | No batteries, genset providing all power |

## Task Configuration

```
SIM_TASK
  Priority: 15 (lower than MAIN_TASK)
  Cycle time: 100ms
  Watchdog: 500ms
  Programs: PRG_Simulation
```

`PRG_Simulation` instantiates:
- 1× FB_SimController
- 1× FB_SimDCBus
- 2× FB_SimBattery (PACK_C1, PACK_C2)
- 4× FB_SimConverter (Prop_AFT, Prop_FWD, Genset, AFE)
- 1× FB_SimGensetEngine
- 2× FB_SimPropulsion (AFT, FWD)
- 1× FB_SimShoreConnection

## Sideload Pattern

Each simulator writes to DAOs using the sideload mechanism:

```iec-st
// In FB_SimBattery:
IF xSimActive THEN
    // Write simulated BMS current to the DAO that FB_KreiselBMS reads from
    pDaoCurrent^._bSideloadActive := TRUE;
    pDaoCurrent^._xwSideloadValue := REAL_TO_XWORD(rSimCurrent);

    pDaoVoltage^._bSideloadActive := TRUE;
    pDaoVoltage^._xwSideloadValue := REAL_TO_XWORD(rSimVoltage);
ELSE
    pDaoCurrent^._bSideloadActive := FALSE;
    pDaoVoltage^._bSideloadActive := FALSE;
END_IF
```

When simulation is disabled, sideload flags clear and DAOs revert to real hardware values automatically (level 1 in the priority chain).

## What This Enables

1. **PMS testing without hardware:** verify allocation, blackout detection, spinning reserve, equalization
2. **Scenario-based commissioning prep:** run through operational scenarios before connecting real equipment
3. **Regression testing:** automated test sequences to verify control logic after changes
4. **Training:** operators can practice mode changes and fault handling in simulation
5. **Remote development:** develop and test control logic on a laptop without PLC/hardware
