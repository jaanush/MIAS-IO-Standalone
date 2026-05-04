# Legacy vs New PMS — Gap Analysis

Comparison of the Alveli legacy PMS with the Lasse-Maja functional description and the Self-Regulating PMS concept.

## Fundamental Architecture Shift

### Legacy (Alveli)
- **Centralized control**: Main.prg makes all decisions — when to start genset, connect batteries, enable propulsion, shed loads
- **Hard-coded interlocks**: every condition is explicit S=/R= logic with specific signals
- **Component-blind PMS**: the PMS knows exactly what each component is and handles each one differently
- **State-based mode switching**: Ship operational mode (Off/Harbor/Sea) drives everything

### New (Self-Regulating PMS)
- **Decentralized with common interface**: every power component reports the same set of properties (Min, Max, mMin, mMax, Current, Setpoint, pPrio, cPrio, ROC)
- **State changes are NOT PMS scope**: switching between PTI/PTO, uGrid/AFE, etc. only affects the PMS by changing the component's reported properties
- **Generic balancing algorithm**: summarizes all mMax to determine system state, then distributes power based on priority
- **DC bus voltage as the communication medium**: low voltage = power shortage, high voltage = excess generation

## Common Interface Properties

Each power component in the new PMS reports:

| Property | Meaning | Legacy Equivalent |
|----------|---------|-------------------|
| Min (kW) | Minimum power (negative = consumption capacity) | Hard-coded per component |
| Max (kW) | Maximum power (positive = production capacity) | Hard-coded per component |
| mMin (kW) | Momentary minimum (currently achievable) | BMS MaxCharge, GensetLoadFactor |
| mMax (kW) | Momentary maximum (currently achievable) | BMS MaxDischarge, GensetAvailablePower |
| Current (kW) | Actual power flow | Measured per converter |
| Setpoint (kW) | PMS-assigned power allotment | PowerLimit commands to converters |
| pPrio (0-100) | Provider priority | Implicit in code structure |
| cPrio (0-100) | Consumer priority | Implicit in code structure |
| ROC (kW/s) | Rate of change capability | Ramp times, filter times |

## Feature Coverage Matrix

### Battery Management

| Feature | Legacy (Alveli) | Lasse-Maja Spec | Gap |
|---------|----------------|-----------------|-----|
| Multi-string packs | Yes (5+4 strings) | Yes (3+4 strings, Kreisel NMC) | Different BMS vendor (Kreisel vs EST) |
| Voltage-matched connection | Yes (per-string voltage check) | Yes (voltage window) | Same concept |
| Blackout connection bypass | Yes (connect all on low voltage) | Yes (pre-charge circuit in MSB DC) | Lasse-Maja has stronger pre-charge in MSB |
| Charge/discharge current limits from BMS | Yes | Yes | Same |
| SOC-to-Battery-Level scaling | No (direct SOC) | Yes (configurable scaling for lifetime) | **NEW** — battery level vs SOC distinction |
| Battery lifetime management (SOH) | No | Yes (adjustable scaling over battery life) | **NEW** — SOH-based scaling |
| Emergency override below 0% battery level | No (hard disconnect) | Yes (operator choice to continue) | **NEW** — operator can override safety |
| Battery disconnection warning prompt | No | Yes (at SOC 6%, operator decides) | **NEW** |
| Cross-pack balancing | Yes (voltage offset) | TBD (new PMS may handle differently) | Need to verify |
| Overload protection (2-tier) | Yes | Yes (from BMS limits) | BMS handles more in new system |
| DCDC converter control | Yes (via Editron DCDC FBs) | **No DCDC** — batteries direct to MSB DC | **MAJOR CHANGE** — no DCDC converters |

### Power Generation

| Feature | Legacy | Lasse-Maja | Gap |
|---------|--------|------------|-----|
| Diesel genset | Yes (ComAP, Modbus RTU) | Yes (~130kW, backup/range extender) | Similar but smaller role |
| Genset auto-start on low SOC | Yes | Described in PMS | New PMS handles via priority |
| Genset auto-stop on high SOC | Yes | Described in PMS | New PMS handles via priority |
| Genset RPM/load ramping | Yes (preheat→nice→max) | TBD | May need same warmup/cooldown |
| Manual override detection | Yes (60s before PLC takes over) | Backup control described | Need same feature |
| Genset converter (AFE) | Yes (Editron) | Yes (generator inverter) | Same concept |
| Blackout → genset start | Yes (with delay) | Yes (genset as backup) | Same |

### Shore Power

| Feature | Legacy | Lasse-Maja | Gap |
|---------|--------|------------|-----|
| AC shore connection | Yes (400VAC, precharge+direct) | Yes (400VAC) | Same |
| DC shore connection (MCS/EVCC) | Yes (Advantics MCS, CCS) | Yes (2× CCS2 high-power DC) | **2 CCS connectors** vs 1 |
| PID-controlled AFE power limit | Yes | Part of self-regulating PMS | New PMS replaces PID approach |
| Charge current from BMS limits | Yes | Yes | Same |
| Stop charging when full | Yes | Yes (with hysteresis) | Hysteresis NEW |
| Shore lost alarm | Yes | Yes | Same |

### Microgrid / AFE

| Feature | Legacy | Lasse-Maja | Gap |
|---------|--------|------------|-----|
| Microgrid mode (DC→AC island) | Yes (2 converters) | Yes (2 microgrid converters) | Same |
| AFE mode (AC→DC from shore/genset) | Yes | Yes | Same |
| Mode switching logic | In FB_Microgrid | **Outside PMS scope** in new concept | Component handles internally |
| Sync to shore grid | Yes (FB_Sync) | Yes | Same |
| Droop handling | Yes (FB_DroopHandling_Rev2) | TBD | Need to verify |

### Propulsion

| Feature | Legacy | Lasse-Maja | Gap |
|---------|--------|------------|-----|
| Dual propulsion (AFT+FWD) | Yes | Yes (2× ~184kW pods) | Same topology |
| Lever response modes | No | Yes (Economy/Normal/High) | **NEW** |
| Rate ramp | Yes (FB_RateRamp) | Yes (implied by lever modes) | Same concept |
| PCS interface (Kongsberg) | No (direct lever to MIAS) | Yes (PCS sends reference to MIAS) | **NEW** — Kongsberg PCS |
| Overtemp deration | Yes | Expected | Same |
| Start interlock (mode, power) | Yes | Yes | Same |
| Backup control | Yes (from bridge panel) | Yes (wheelhouse backup) | Same |
| Local control | Yes | Yes | Same |
| Anti-condensation heater | Yes | Expected | Same |

### Non-Essential Load Management

| Feature | Legacy | Lasse-Maja | Gap |
|---------|--------|------------|-----|
| Load shedding | Yes (FB_NonEss) | Yes (AC load shedding) | Same concept |
| 3-context shedding (shore/battery/neither) | Yes | New PMS handles via priority | Simplified in new PMS |
| Sequential reconnection | Yes (NonEss_1 then NonEss_2) | TBD | Need to verify |

### Alarm System

| Feature | Legacy | Lasse-Maja | Gap |
|---------|--------|------------|-----|
| E0 unattended machinery space | Yes | Yes | Same |
| 3-class system (A/B/C) | Yes | Yes (Critical/Non-critical/Notification) | Same |
| Suppression | Yes (hand-written) | Yes (generated by MIAS 2.0) | Automated |
| SMS relay | Yes (8 outputs) | Yes (email via router/gateway) | Different medium |
| FAT mode | Yes | Expected | Same |
| Persistent settings | Yes | Expected | Same |

### HMI

| Feature | Legacy | Lasse-Maja | Gap |
|---------|--------|------------|-----|
| JMobile/Exor panels | Yes | Yes (wheelhouse + engine room) | Same |
| FB_Hmi* view model pattern | Yes (hand-written) | Yes (to be generated) | Automated |
| OPC UA transport | Yes | Yes | Same |
| Watchdog | Yes | Expected | Same |
| Dedicated propulsion display | No | Yes | **NEW** |
| Remote access (VPN) | Limited | Yes (cloud service, key switch) | Enhanced |

## Key Differences Requiring New Implementation

### 1. No DCDC Converters
Lasse-Maja batteries connect **directly to MSB DC** — no Editron DCDC converters between batteries and bus. This is a fundamental change:
- Battery voltage IS the bus voltage (they track together)
- Charging/discharging controlled by all converters on the bus (microgrid, propulsion, genset, shore)
- Pre-charge is in MSB DC (stronger than individual string pre-charge)
- The entire `mConverterControl` method from BatteryControl is obsolete

### 2. Self-Regulating PMS replaces centralized control
- No more explicit genset start/stop conditions in Main
- Each component reports capabilities, PMS balances automatically
- Priority-based allocation with equalization
- DC bus voltage PID for precise regulation
- Components decide their own state transitions

### 3. Battery Level vs SOC
- New concept: SOC is the raw BMS value, Battery Level is a configurable scaled range
- Scaling adjustable over battery lifetime (SOH degradation)
- Operator can override below 0% battery level in emergencies
- Hysteresis on charging to avoid top-SOC stress

### 4. Kongsberg PCS Interface
- PCS sends speed reference to both MIAS and directly to inverter (backup path)
- MIAS provides the PMS-limited speed reference
- Three lever response modes (Economy/Normal/High)

### 5. Dual CCS2 DC Shore
- Two CCS2 connectors vs one MCS in legacy
- Both connect to same MSB DC
- Need to coordinate two EVCC instances

### 6. Enhanced Remote Access
- Cloud-based encrypted VPN with key switch (Off/On-ViewOnly/FullAccess)
- Email alarm notifications via router/gateway
- Replaces SMS relay approach

## What Carries Forward Unchanged

1. **HMI FB pattern** — FB_Hmi* view models with OPC UA. Same JMobile panels.
2. **Breaker control** — precharge + direct breaker sequence for shore
3. **eStartStopMode** — Auto/ForcedOff/ForcedOn for all components
4. **eStatus_5state** — Stopped/Starting/Running/Fault/Interlock for HMI
5. **Alarm system structure** — 3-class, suppression, acknowledge, persistent settings
6. **CAN communication** — Editron converters via CANOpen (but different FB architecture via MIAS_Core)
7. **Emergency stop hierarchy** — per-system and combined
8. **Backup control philosophy** — bridge backup, local control for all essential systems

## Source Documents

- [[../Lasse-Maja/Functional Description|Lasse-Maja Functional Description]] — full spec
- [[Self Regulating PMS Concept]] — new PMS architecture
- [[../../MIAS-Legacy/Älveli/PMS Architecture|Alveli PMS Architecture]] — legacy reference
