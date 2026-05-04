# Alveli PMS Architecture

Analysis of the legacy power management system from `C:\Projects\Älvelie.fbsproj`.

## System Overview

Alveli is a DC hybrid vessel with:
- **DC bus** split into AFT (MSB1) and FWD (MSB4) sections, connected by a **DC bus tie breaker** (2Q1 + 3Q1)
- **AC bus** split into MSB1_AC and MSB2_AC
- **2x battery packs** (PACK_C1 on AFT, PACK_C2 on FWD) — Floattech energy storage, multi-string BMS
- **1x diesel genset** (861_G01) with ComAP controller via Modbus RTU
- **2x Editron microgrid/AFE converters** (875_U01 AFT, 875_U02 FWD) — DC/AC conversion
- **2x propulsion drives** (625_U01 AFT, 625_U02 FWD) — Editron motor controllers
- **DCDC converters** per battery pack (866_U01_1, 866_U01_2 for PACK_C1; 866_U02_1, 866_U02_2 for PACK_C2)
- **Shore AC connection** with precharge + direct breaker sequence
- **EVCC** (Electric Vehicle Charging Controller) — Advantics MCS for shore charging
- **Non-essential load management** (2 non-essential bus sections)

## Program Structure

```
Programs/
├── MAIN/              → Main.prg.st — top-level orchestration
├── PMS/
│   ├── 00_Functions/
│   │   ├── Base FB block/    → FB_AFE, FB_Microgrid, FB_Motor, FB_NonEss, FB_ShoreAC, FB_Sync
│   │   ├── Breakers/         → FB_BaseBreaker, FB_FeedBreaker, FB_LocFeedBreaker, FB_LocFeedBreaker_Precharge
│   │   └── Extension FB block/ → FB_AFE_Genset (extends FB_AFE for genset AC source)
│   ├── AFT/
│   │   └── FB_Genset/        → FB_GensetCtrl_V4, FB_AvailablePowerAtActualRpm, FB_GensetLoadHandle, FB_RampSpeedSetpoint
│   └── FWD/
├── Batteries/         → BatteryControl
├── Propulsion/        → Propulsion_AFT, Propulsion_FWD
├── EVCC/              → Advantics MCS charging control
├── HVAC/              → Heating/ventilation
├── Alarms/            → Alarm processing
├── PowerMeasurement/  → DEIF MK-II measurement tools
├── Modbus - RTU/      → Diesel genset communication
├── Modbus - TCP/      → ABB drives, other TCP devices
├── Redundancy/        → PLC redundancy handling
└── Tanks/             → Tank level monitoring
```

## Operational Modes

Defined in `eShipOpMode` enum:
- **Off** — everything shutdown, batteries disconnected
- **Harbor** — shore power connected, batteries charging, genset available optionally
- **Sea** — propulsion enabled, batteries + genset powering DC bus

## Control Flow — Main Program

`Main.prg.st` is the top-level orchestrator. It does NOT contain the detailed control logic — instead it:

1. **Calculates bus state**: DC bus tie status, voltage calculations per bus section
2. **Propulsion start conditions**: propulsion allowed when in Sea mode AND (genset running OR enough battery strings connected)
3. **Battery connection**: connects battery packs when operational mode > Off, disconnects on emergency or Off mode
4. **Genset start/stop logic**: the heart of PMS decision-making
5. **EVCC connection**: allowed in Harbor or Sea (with setting), blocked by blackout or missing tie breaker
6. **Blackout detection**: 250ms timer on low DC voltage per bus section

### Genset Auto-Start Conditions

The genset starts when ANY of:
- Battery SOC drops below `Genset_AutoStart_SoC_SP` AND battery+DCDC are ready AND no blackout
- Manual start from HMI (1.5s hold)
- DC blackout detected (with delay: normal = `Genset_StartUpDelayAtBlackout_s`, after Off mode = 20s extra delay)

### Genset Auto-Stop Conditions

The genset stops when ANY of:
- Battery SOC rises above `Genset_AutoStop_SoC_SP` AND battery+DCDC ready
- Batteries fully charged
- Genset not in auto mode (`Genset_InAuto = FALSE`)
- Harbor mode AND genset not available in harbor (`PMS_Genset_Available_Harbor = FALSE`)
- Ship in Off mode
- FWD AFE is running AND providing enough power (`AFE_PowerLimit > PMS_MinRequiredPower`)
- Manual stop from HMI

## Genset Control — FB_GensetCtrl_V4

The most complex FB. Controls a ComAP diesel genset with RPM and load ramping.

### Start Sequence
1. Engine start pulse (3s) sent via Modbus
2. **Preheat phase** (idle at 700 RPM, 0% load, 3 minutes) — skipped if coolant temp > 65°C
3. **Nice mode** (ramp to 1300 RPM, 40.9% load, 10 minutes)
4. **Full power** (ramp to 1600 RPM, 100% load)

### Stop Sequence
1. **Load ramp-down** to 15% at current RPM (3 minutes at `Stop_Delay_TimeBeforeRampDownSpeed_s`)
2. When load reaches 25%, start RPM ramp-down to idle (700 RPM)
3. At idle: 0% load for 2 minutes (`Cooling_duration_s`)
4. Engine stop pulse

### Blackout Override
If `Blackout = TRUE`, skip nice mode and go straight to full power.

### Manual Override
If engine started/stopped from backup panel (not by MIAS), the system waits `ManualCmd_retryDelay` (60s) before MIAS takes over control again. Prevents fighting between PLC and operator.

### Start Failure
If engine doesn't reach Running state within `StartFail_Timeout` (25s), triggers StartFailure alarm. Requires manual reset.

## AFE / Microgrid Control — FB_AFE + FB_Microgrid

Each Editron 875 converter can operate as:
- **AFE mode**: Active Front End — converts AC shore power to DC bus
- **Microgrid mode**: Creates AC microgrid from DC bus (island mode)

### Mode Selection Logic (FB_Microgrid)
- Default: Microgrid mode
- Switch to AFE: when converter breaker is connected AND no microgrid run command AND extension enables it
- Cannot switch modes while microgrid or AFE is running

### AFE Run Conditions (FB_AFE)
- START_AFE signal active
- AFE mode selected on converter
- Power source active (battery or PTO)
- Converter breaker connected
- No stop alarms
- Optional: stop when battery fully charged

### AFE Power Limiting
PID controller limits shore power draw:
- Setpoint: max shore current × safety factor (0.95)
- Actual: measured shore current (from DEIF MK-II)
- Output: `AFE_Converter_PowerLimit_Min` (negative = power from shore to DC bus)
- Max power calculated from: `(MaxCurrent - 10A) × Voltage × √3 × 0.001`

## Shore Connection — FB_ShoreAC

Two-phase connection:
1. **Precharge**: closes precharge breaker first (capacitor charging via resistor)
   - Retries: 2 attempts, 2s between retries, 3s charge time, 5min cooldown on failure
2. **Direct**: closes main contactor after precharge succeeds
   - Requires: inlet connected, sync OK, droop settings OK
3. **Disconnect**: 4s delay before disconnect command after conditions drop

### Interlocks
- Transformer overtemperature (HH alarms on any phase winding)
- Shore connection lost (inlet was connected but now isn't)
- Local control (disables PLC control)
- StartStopMode forced off

## Non-Essential Load Management — FB_NonEss

Sheds non-essential loads to protect essential systems. Three operating contexts:

### Shore Connected Mode
- **Trip**: when shore overloaded AND (AFE power limit = 0 OR AFE current limit = 0)
- **Reconnect**: when no overload AND shore current < max setpoint + margin AND no blackout
- Trip delay: 5000ms, Reconnect delay: 10s per stage

### Battery Connected Mode (no shore)
- **Trip**: when PTI power limit below margin AND battery discharge below limit
- **Reconnect**: when PTI power limit above margin AND no blackout

### Neither Shore nor Battery
- **Trip**: when thruster power limit below margin
- **Reconnect**: when thruster power limit above margin AND no blackout

Stages reconnect sequentially (NonEss_1 first, then NonEss_2 after delay).

## Battery Management

### Battery Pack Structure
- 2 packs: PACK_C1 (AFT bus) and PACK_C2 (FWD bus)
- Each pack: multiple strings (up to 5), each with its own BMS communication
- Connection: via DCDC converters (2 per pack)

### Charge/Discharge Limits
Calculated per pack from BMS data:
- `Min_Discharge_limit_used`: minimum allowed discharge current across all connected strings
- `Min_Charge_limit_used`: minimum allowed charge current
- `MaxDischarge_power = Min_Discharge_limit × Bus_voltage × 0.001`

### Tie Breaker Impact
When DC tie breaker is CLOSED:
- Both packs contribute to both bus sections
- Limits are combined (both packs must agree)
- Battery level = average of both packs

When DC tie breaker is OPEN:
- PACK_C1 only serves AFT bus
- PACK_C2 only serves FWD bus
- Limits calculated independently

### Emergency Disconnect
Timer-based emergency disconnect when BMS signals critical condition. Can be overridden via `PMS_BattEmDiscon_Override` setting (disables DC voltage shutoff limit).

## Propulsion — Start Conditions

Propulsion allowed when in Sea mode AND:
- **AFT thruster (625_U01)**: genset running without fault OR enough battery strings (PACK_C1 strings + PACK_C2 strings if tie closed > 2)
- **FWD thruster (625_U02)**: same but requires tie breaker closed for genset, PACK_C2 primary

## Blackout Detection

Per DC bus section:
- `Blackout_MSB1_DC`: DC voltage < 700V for > 250ms on AFT bus
- `Blackout_MSB4_DC`: DC voltage < 700V for > 250ms on FWD bus
- `Blackout_MSB1_AC` / `Blackout_MSB2_AC`: similar for AC buses

Blackout triggers:
- Genset auto-start (with configurable delay)
- Non-essential load shedding
- EVCC disconnect
- Skip genset preheat (go straight to max power)

## Communication Architecture

### CAN Bus (Editron converters + DCDC)
- `GVL_CAN` — all Editron converter data
- Microgrid_875_U01/U02 — AFE/microgrid converters
- Propulsion_625_U01/U02 — motor controllers
- Energy_Storage_System_866_U01_1/U01_2/U02_1/U02_2 — DCDC converters
- Genset_861_U01 — genset converter (if Editron)

### Modbus RTU (Diesel genset)
- ComAP genset controller
- `strDiesel` struct: engine state, RPM, load, coolant temp, oil pressure, etc.
- Engine states: Init, Not_Ready, Prestart, Starting, Running, Loaded, Cooling, Unloading, Stop, Shutdown

### Modbus TCP
- ABB drives
- DEIF MK-II power measurement (AC voltages, currents, power, frequency)
- `strMKII` struct: phase voltages, currents, power, frequency, apparent power

### Battery BMS
- `GVL_BATT` — per-pack data: SOC, voltage, current, string status, faults
- Communication via CAN or Modbus (varies by BMS vendor)

## Key GVLs

| GVL | Purpose |
|-----|---------|
| GVL_Physical | Hardwired I/O: breaker states, running indicators, emergency stops |
| GVL_CAN | Editron converter data (status, faults, power limits, running) |
| GVL_BATT | Battery pack data (SOC, voltage, string status, faults) |
| GVL_Internal | Calculated values (voltages, blackout flags, computed states) |
| GVL_Settings | Operator settings (setpoints, modes, enable flags) |
| GVL_Alarms | Alarm FB instances and states |
| GVL_HMI | HMI interface variables |
| GVL_Modbus | Modbus communication data |
| GVL_DC_Charge | DC charging data |

## Key Interdependencies

```
Shore AC → AFE converter → DC Bus
Genset → AFE_Genset (extends FB_AFE) → DC Bus
Battery (via BMS) → DCDC converter → DC Bus
DC Bus → Microgrid converter → AC Bus (island mode)
DC Bus → Propulsion motor controller → Thruster
DC Bus voltage → Blackout detection → Genset start / Load shedding
Battery SOC → Genset auto-start/stop
Tie breaker state → Battery limit calculations, propulsion start logic
```

## Key Design Patterns

1. **Set/Reset (S=/R=) pattern**: extensively used for latching logic with multiple reset conditions
2. **FB inheritance via "Extension"**: base FBs (FB_AFE, FB_Microgrid) have `{attribute 'symbol' := 'none'}` variables accessible only from extension FBs (FB_AFE_Genset)
3. **Struct-based data**: `strDiesel`, `strMKII`, `strShoreConnInlet_Hamnen` for grouping related data
4. **Timer cascading**: preheat → nice mode → full power → stop delay → cool down → stop
5. **GVL coupling**: FBs read from and write to GVLs directly — no formal interface/contract
6. **Manual override acknowledgment**: system waits before re-asserting control after manual intervention

## Source Files

All source at: `C:\Projects\Älvelie.fbsproj\Programs\`
