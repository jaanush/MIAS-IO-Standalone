# Alveli Deep Dive — Batteries, Charging, Propulsion & Editron

Companion to [[PMS Architecture]]. This document covers the subsystems in detail.

## Battery Management (BatteryControl)

### Architecture
- 2 battery packs: **PACK_C1** (AFT/MSB1) and **PACK_C2** (FWD/MSB4)
- PACK_C1: 5 string controllers, PACK_C2: 4 string controllers
- Each pack has 2 Editron DCDC converters (e.g. 866_U01_1 + 866_U01_2 for PACK_C1)
- Data in `GVL_BATT` structs with per-string: voltage, current, SOC, max charge/discharge, fault, connected status

### String Connection Logic (aConnectControl)

**Voltage matching before connection:**
- When DC bus is powered: string can only connect if `|Bus_voltage - String_voltage| < Batt_MaxVoltageDiff_Connection`
- When DC bus is dead (blackout): bypass voltage check, connect all available strings immediately (`Blackout_connect_String`)
- When no strings connected: checks inter-string voltage differences (pairwise) rather than bus-to-string

**Connection flow per string:**
1. Main program sets `Connect_Battery_PACK_Cx`
2. BatteryControl checks voltage compatibility
3. If OK (or blackout override): `ConnectCMD_String_Cx[i]` = TRUE
4. BMS physically closes string contactors
5. `StringData[i].ConnectedToDCbus` feedback confirms

**HMI status feedback:**
- `FX_Cmd_Status` function reports: Active, Inactive, or Waiting_For_Voltage — so operator knows why a string isn't connecting

### DCDC Converter Control (mConverterControl)

**Start logic:**
- DCDC starts when: strings connected > 0 AND Main gives connect command
- Start delay: configurable `DCDC_Start_Delay` setting
- Per bus section: `Converter_RunCmd_AFT` and `Converter_RunCmd_FWD`

**Current limiting:**
- `Current_Lim_Buck_A` (charge) = `PACK_MaxCharge × SafetyFactor / NrOfActiveConverters`
- `Current_Lim_Boost_A` (discharge) = `PACK_MaxDischarge × SafetyFactor / NrOfActiveConverters`
- Hard cap: 410A per converter (nominal inductor current)
- Filtered through `FB_Filter` for smooth ramp

**Power limiting (charge/buck):**
- `PowerLimitBuck = MIN(MIAS_Charge_PowerLimiter, PACK_MaxCharge / NrOfConverters, DCDC_MaxPowerBuck)`
- Set to 0 when: fully charged, or Ship in Off mode
- Special case: fully charged flag released during Harbor→Sea transition while syncing microgrid (prevents voltage spikes)

**Power limiting (discharge/boost):**
- Smart cross-pack limiting: if PACK_C1 discharge is limited but PACK_C2 is not, set PACK_C1 boost limit to 0 (let C2 handle the load)
- Re-limit after configurable timeout if the other pack's available power exceeds what's needed
- `Needed_Power_Pack_C1 = MAX(0, MaxDischarge_C2 - Power_used_Both_Sides)`

**Battery balancing:**
- When `Enable_Balancing` is TRUE, adjusts DC voltage setpoint per DCDC pair
- `BatteryBalancingOffset = LIMIT(0, (SOC_C1 - SOC_C2) / Max_BattLevel_Diff, 1) × Max_Voltage_Compensation`
- Higher SOC pack gets higher voltage reference → charges less / discharges more

### Battery Overload Protection (mBatteryDisconnection)

**Two-tier protection per pack:**
1. **Overload** (Threshold_1): any string current exceeds max charge + threshold OR max discharge + threshold
   - Timer: `Batt_OverloadDelay` seconds
   - Action: disconnect pack, latches until manual reset
2. **Critical Overload** (Threshold_2): same but higher threshold
   - Timer: `Batt_CritOverloadDelay` seconds (shorter)
   - Action: same — disconnect pack

**Override:**
- `PMS_BattEmDiscon_Override_AFT/FWD` setting disables overload disconnect (also disables DC voltage shutoff limit in Main)
- Manual reset via `Battery_Reset_PACK_Cx` from HMI

### Emergency Disconnect (from Main)
- Timer-based: `EmDisconnect_Timer` in BatteryControl
- If timer expires and override not active: Main removes `Connect_Battery` command
- `BattDisconnected_mem` prevents reconnection until override or warning clears

---

## Shore Charging Infrastructure

### AC Shore Connection (FB_ShoreAC)

**Physical setup:**
- Shore power inlet with cable detection
- Isolation transformer (winding temp monitored per phase)
- Precharge breaker + direct breaker (2-phase connection)
- DEIF MK-II power measurement on AC side

**Connection sequence:**
1. Operator connects cable → `Inlet_Connected` = TRUE
2. `Connect_Shore` command from PMS
3. `FB_ShoreAC` activates precharge breaker via `FB_LocFeedBreaker_Precharge`
   - 2 retries, 2s between retries, 3s charge time
   - On failure: 5min cooldown, then retry
4. When precharge succeeds + sync OK + droop settings OK → close direct breaker
5. `ShoreAC_Connected` = TRUE when inlet + main breaker both confirmed

**Disconnection:**
- 4s delay after conditions drop (prevents bounce)
- Transformer overtemp (HH on any phase) forces immediate disconnect
- Shore lost alarm: cable was connected but now isn't

**Interlocks:**
- Transformer overtemperature (3 phases monitored)
- StartStopMode forced off
- Local control (disables PLC control)
- Shore connection lost alarm

### DC Shore Charging — MCS/EVCC (Advantics)

**System:**
- Advantics MCS (Megawatt Charging System) EVCC (Electric Vehicle Charge Controller)
- CAN-based communication (CANOpen)
- Supports CCS ISO 15118-20 (AC and DC)
- Controlled via `AdvanticsMCS_EVCC2_0` FB

**Physical setup:**
- EVCC controller powered by PLC (24V switched output)
- DC current/voltage measurement via IVT sensor (3 voltage channels + current)
- Main contactor for DC shore connection
- Inlet lock mechanism (CCS connector)

**Charge current calculation (mChargeCurrent):**
```
minPowerLimit = (TieClosed × PowerLimitBuck_C1) + PowerLimitBuck_C2
minCurrentLimit = minPowerLimit / DC_Bus_Voltage × 1000
ChargeCurrent = MinCurrentLimit + Microgrid_DC_current (hotel load compensation)
ChargeCurrent = LIMIT(0, ChargeCurrent, MaxChargeSetting_kW / Bus_Voltage)
```

If not connected: ChargeCurrent = 0
If connected but not yet in power transfer: ChargeCurrent = 10A (trickle)

**Energy capacity reporting:**
- `EnergyCapacity = (TieClosed × EnergyAtTargetSocMax_C1) + EnergyAtTargetSocMax_C2`
- Battery level: average SOC of connected packs
- Reported to shore charger for remaining time calculation

**Connection sequence:**
1. Main sets `Connect_EVCC` based on: Harbor mode, or Sea mode with `Allow_MCS_Seamode`
2. EVCC FB controls power supply to Advantics controller
3. Communication stages: Waiting → Precharge → Power Transfer → Ending → Closing
4. Inlet lock must engage (CCS connector locked)
5. DC contactors close on EVCC request (or PLC-controlled)
6. Charge current ramps up via filtered setpoint

**Disconnection sequence:**
1. `Connect` goes FALSE → ramp charge current down to `Current_limit_to_stop` (1A)
2. When current below threshold: `DC_Normal_End_of_Charge` → EVCC stops
3. Contactors open
4. Inlet unlocks
5. Power supply to EVCC can be turned off

**Emergency stop:**
- 3s delay (`Emdiscon_delay`) before opening contactors
- During delay: sends normal end of charge to EVCC (graceful)
- After delay: force-open contactors and ready-to-charge flag

**EVCC conditions blocking:**
- Ship in Sea mode without `Allow_MCS_Seamode`
- DC blackout on MSB4
- DC tie breaker open
- Both battery packs in fault

**DC measurement transfer (mTransfer):**
- IVT sensor provides: current, temperature, 3 voltages (intake, DC bus, DC minus)
- Charging power calculated: `Intake_Voltage × Current × 0.001` (kW)
- DC bus voltage: when main contactor closed = direct reading, when open = `U2 - U3` (differential)
- Values mapped to `GVL_DC_Charge` for use by other programs

**EVCC reboot:**
- Can be triggered from HMI
- Cuts 24V power to Advantics for 3s then restores

---

## Editron Converter Base (Editron_Converter_FW11_LW)

**Architecture:**
- Base FB for ALL Editron FW11 converters (DCDC, MC, AFE/uGrid)
- Supports 2 CANOpen stacks per converter (normally only stack 1 used, stack 2 for extended data)
- Each stack has: NodeID, DataConfig, Rx/Tx buffers, heartbeat
- Inherits from `CAN_FB_CanOpenDevice_LW` for low-level CAN management

**Key outputs:**
- `Running`, `Fault`, `EmStop`, `Warning`, `StartFailure`
- `DC_voltage`, `DC_current`, `Power_DC` (computed: V × I / 1000)
- Junction temperature, PT100 channels (3 + max)
- FaultWord_1/2 (UDINT bit fields decoded to struct)
- Communication fault, config failed, CANOpen error

**Start/Stop handling (mStartStopHandling):**
- Uses `eStartStopMode`: Auto, ForcedOff, ForcedOn
- `Run_command` → CAN control word
- StartFailure: 12s timeout, triggers alarm if converter doesn't reach Running state

**Auto-reset:**
- Enabled via `Enable_AutoReset`
- 3 retries with 3s delay (configurable)
- Resets after 60s of successful running
- Disabled for EmStop and junction overtemp faults (safety-critical — no auto-reset)

**Fault handling (mFaultWordsToBits, mActiveFaultsToStruct):**
- FaultWord_1/2 decoded to `strEditronFaults_FW11` struct
- Individual fault bits for: EmStop, overcurrent, overvoltage, undervoltage, overtemp, communication loss, etc.
- Active fault ID tracked for diagnostic display

**Specialized converters extending this base:**
- `Editron_Converter_FW11_DCDC_Rev2_LW` — battery DCDC: buck/boost power limits, current limits, voltage setpoint
- `Editron_Converter_FW11_MC_Rev2_LW` — motor controller: speed reference, torque limit, resolver debug
- `Editron_Converter_FW11_uG_AFE_Rev3_LW` — microgrid/AFE: mode selection, power limits, frequency/voltage control

Each specialized FB has its own TPDO/RPDO methods for CAN data marshalling (Stack1 and Stack2).

---

## Propulsion Control (FB_PropControl_rev4)

**Architecture:**
- One FB per thruster (AFT + FWD)
- Inputs: lever position (-100% to +100%), start command, interlocks
- Outputs: RPM reference to converter, transmission FWD/AFT commands, status

**Lever processing:**
1. Optional rate ramp (`FB_RateRamp`): configurable accel/decel ramp times
2. `FB_LeverCtrl`: deadband, transmission direction, neutral detection
3. `mLever_to_speed`: configurable curve mapping (percent → RPM), stored in `strPropLever_to_speed`
4. RPM clamped to `RPM_Min`/`RPM_Max`

**Start conditions:**
- `Start` command from Main (based on operational mode + power availability)
- NOT EmStop
- NOT Start_Interlock
- Optional: turn off RunCmd when lever in neutral and RPM within threshold (saves power)

**Start interlocks (mStartInterlock in Propulsion_AFT/FWD):**
- Shore connected in Sea mode
- Battery not available
- DC voltage too low
- Converter communication fault

**Overtemp deration (mOvertempDeration):**
- Monitors converter junction temperature
- Reduces power limit progressively as temperature rises
- Prevents thermal shutdown while maintaining some propulsion

**Transmission control:**
- FWD/AFT gear commands based on lever direction
- `Keep_Neutral` option: allows lever input but keeps transmission in neutral
- Anti-condensation heater: ON when system stopped (prevents moisture in motor windings)

**Start failure:**
- 15s timeout: if converter reports fault after RunCmd, triggers StartFailure alarm

---

## Key Enumerations

### eShipOpMode
| Value | Mode | Description |
|-------|------|-------------|
| 0 | Off | Everything shutdown |
| 1 | Harbor | Shore power, battery charging, no propulsion |
| 2 | Sea | Propulsion enabled, full PMS active |

### eStartStopMode
| Value | Mode | Description |
|-------|------|-------------|
| Auto | Normal PLC control |
| ForcedOff | Override: force stop |
| ForcedOn | Override: force run |

### eDieselEngineState (from ComAP)
| Value | State |
|-------|-------|
| Init | Controller initializing |
| Not_Ready | Not ready to start |
| Prestart | Prestart checks (preheating etc.) |
| Starting | Cranking |
| Running | Running at idle/speed |
| Loaded | Running under load |
| Cooling | Cooling down |
| Unloading | Removing load |
| Stop | Stopping |
| Shutdown | Emergency shutdown |

### eAFE_uGrid_Selection
| Value | Mode |
|-------|------|
| AFE | Active Front End (AC→DC from shore/genset) |
| uGrid | Microgrid (DC→AC island mode) |

### eStatus_5state
Used throughout for HMI status display:
| Value | State |
|-------|-------|
| Stopped | Not running, no command |
| Starting | Run command but no running feedback |
| Running | Running normally |
| Fault | Active fault |
| Interlock | Prevented from starting |

---

## Communication Bus Summary

### CAN Bus (500kbit, with redundancy)
| Device | Node ID | Type | Stacks |
|--------|---------|------|--------|
| Microgrid 875_U01 (AFT) | configurable | AFE/uGrid | 1 (+optional 2) |
| Microgrid 875_U02 (FWD) | configurable | AFE/uGrid | 1 (+optional 2) |
| Propulsion 625_U01 (AFT) | configurable | MC | 1 (+optional 2) |
| Propulsion 625_U02 (FWD) | configurable | MC | 1 (+optional 2) |
| DCDC 866_U01_1 (PACK_C1) | configurable | DCDC | 1 (+optional 2) |
| DCDC 866_U01_2 (PACK_C1) | configurable | DCDC | 1 (+optional 2) |
| DCDC 866_U02_1 (PACK_C2) | configurable | DCDC | 1 (+optional 2) |
| DCDC 866_U02_2 (PACK_C2) | configurable | DCDC | 1 (+optional 2) |
| Genset 861_U01 | configurable | DCDC/AFE | 1 |
| EVCC (Advantics MCS) | configurable | Custom CANOpen | 1 |

CAN redundancy: `CAN_FB_proj_rev3_500kb_Redundancy` handles dual-CAN with message comparison, buffer management, and failover.

### Modbus RTU
| Device | Protocol | Data |
|--------|----------|------|
| ComAP genset controller | RTU | Engine state, RPM, load, temps, alarms, start/stop |

### Modbus TCP
| Device | Protocol | Data |
|--------|----------|------|
| ABB ACS880 drives | TCP | Status, speed, torque, faults |
| DEIF MK-II (power meter) | TCP | Voltages, currents, power, frequency |
| IVT sensor (DC meter) | TCP/CAN | DC current, voltages, temperature |

---

## Source File Reference

```
Programs/
├── Batteries/BatteryControl.pou.xml.v3^/
│   ├── aConnectControl.act.st        — String connection with voltage matching
│   ├── aEnableStrings.act.st         — String enable logic
│   ├── mConverterControl.meth.st     — DCDC run/power/current limiting + balancing
│   ├── mBatteryDisconnection.meth.st — Overload protection (2-tier)
│   ├── mCalcValues.meth.st           — SOC, limit calculations
│   └── aMoveBCUdata.act.st           — BMS data transfer
├── EVCC/MCS.pou.xml.v3^/
│   ├── mChargeCurrent.meth.st        — DC charge current calculation
│   ├── mTransfer.meth.st             — IVT sensor data mapping
│   └── mDisableIsolationMonitoring   — IMD control during charging
├── Propulsion/
│   ├── FBs/FB_PropControl_rev4.fb.st — Propulsion FB with rate ramp
│   ├── U01/Propulsion_AFT.pou.xml    — AFT thruster instance
│   └── U02/Propulsion_FWD.pou.xml    — FWD thruster instance
Functions, Enums, Structs/Functions/
├── CAN-BUS comFaultTest/
│   ├── Editron_Converter_FW11_LW.fb.st         — Base Editron converter
│   ├── Editron_Converter_FW11_DCDC_Rev2_LW.fb.st — DCDC specialization
│   ├── Editron_Converter_FW11_MC_Rev2_LW.fb.st   — Motor controller
│   └── Editron_Converter_FW11_uG_AFE_Rev3_LW.fb.st — AFE/Microgrid
├── EVCC/
│   ├── AdvanticsMCS_EVCC2_0.fb.st    — EVCC charge controller
│   └── AdvanticsMCS_Comm.fb.st       — CAN communication layer
```
