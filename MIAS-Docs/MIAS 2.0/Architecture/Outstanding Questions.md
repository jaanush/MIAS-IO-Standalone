# Outstanding Questions — Lasse-Maja / MIAS 2.0

Status legend: RESOLVED (answered from code/docs), DESIGN (needs design decision), SUPPLIER (needs vendor documentation), CONFIRM (needs stakeholder confirmation)

---

## PMS Architecture

### Q1: Equalization algorithm completeness
**Status: RESOLVED**

**Decision: Equalization is optional, disabled by default.**

Add a `xEnableEqualization : BOOL := FALSE` input to `FB_PMS`. When enabled, consumers within the `rEqualizeBand` priority window share shortage proportionally rather than sequentially. When disabled, strict priority ordering applies (current behavior).

**Implementation:** In the shortage allocation loop of `CyclicAction`, before curtailing:
1. Group consumers whose `cPrio` values are within `rEqualizeBand` of each other
2. Within each group: distribute available power proportionally to their requested amounts
3. Between groups: strict priority ordering (higher priority groups get power first)

**Use case:** Two thrusters with similar priority — equalization ensures symmetric thrust reduction rather than one getting full power and the other zero. Disabled by default because strict priority is simpler to reason about and sufficient for most configurations.

---

### Q2: DC bus PID vs converter droop interaction
**Status: RESOLVED**

The `FB_PMS` comment explicitly says: "Does NOT regulate DC bus voltage directly — converter droop settings handle fast transients. The PMS trims the operating point with a slow PID to correct steady-state drift."

The functional description confirms: "Each converter connected to MSB DC has built-in limits for when to be allowed to generate or consume power. These limits are set in relation to the voltage of the MSB."

**Answer:** The PID trim in FB_PMS corrects steady-state voltage drift by adjusting the power balance target. It does NOT fight the converter droop. The PID gains (Kp=2.0, Ki=0.5, Kd=0.1) are intentionally slow. The 0.02s cycle time with anti-windup at +/-500 ensures stability.

**Note for commissioning:** If the PID hunts, reduce Ki first. If bus voltage oscillates, the issue is in converter droop settings, not the PMS PID.

---

### Q3: Blackout detection method
**Status: DESIGN**

MIAS_Core uses `_rTotalMMax = 0` (no provider can deliver power). Legacy uses voltage-based detection (DC bus < 700V for > 250ms).

**Decision: Yes, add voltage-based detection alongside capacity-based.**

Add to `FB_PMS`:
- `rBlackoutVoltage : REAL := 500.0` — voltage threshold (V)
- `tBlackoutDelay : TIME := T#250MS` — timer delay (same as Alveli)
- `TON_Blackout : TON` — internal timer

In `CyclicAction` Phase 5:
```
TON_Blackout(IN := rDcBusVoltage < rBlackoutVoltage, PT := tBlackoutDelay);
xBlackout := (_rTotalMMax = 0 AND _usiProvCount > 0) 
          OR TON_Blackout.Q;
```

This catches the case where providers report stale mMax > 0 but the bus has actually collapsed.

---

### Q4: Priority configuration system (ship mode → priorities)
**Status: DESIGN**

The concept doc says priorities are influenced by: base actor type preset, actor state, ship mode, user configuration, and system configuration. MIAS_Core's `FB_PMSComponent` has `usiDefaultPPrio` and `usiDefaultCPrio` as compile-time constants and `_usiPPrio`/`_usiCPrio` as runtime variables settable in `UpdateDynamic()`.

**Decision: Yes — ship modes ARE priority presets.**

Each ship mode defines a complete set of pPrio/cPrio values for all PMS component types. When the operator switches mode, the PMS components update their priorities from the active preset. The mode itself doesn't contain control logic — it's just a priority configuration that the generic PMS algorithm uses.

**Implementation:**
```
TYPE strPMSModePreset : STRUCT
    usiPPrio : USINT;
    usiCPrio : USINT;
END_STRUCT END_TYPE

// Priority table: mode × component type
arrModePresets : ARRAY[E_ShipOpMode, E_PMSComponentType] OF strPMSModePreset;
```

Example presets:

| Component | Off (pP/cP) | Harbor (pP/cP) | Sea (pP/cP) |
|-----------|-------------|-----------------|-------------|
| Battery | 0/0 | 80/10 | 80/10 |
| Genset | 0/0 | 30/0 | 60/0 |
| Shore AC (AFE) | 0/0 | 90/90 | 0/0 |
| Shore DC (CCS) | 0/0 | 95/0 | 0/0 |
| Propulsion | 0/0 | 0/0 | 0/80 |
| Microgrid | 0/0 | 70/70 | 70/70 |
| Non-essential | 0/0 | 0/20 | 0/20 |

Each component reads its preset in `UpdateDynamic()` and can further adjust based on local state (e.g. battery reduces pPrio when SOC is low, genset increases pPrio during blackout recovery).

**Configurable from MIAS-IO** — the preset table is stored in `GVL_Settings` (persistent) and editable from the HMI. MIAS-IO can generate the initial preset values from component template configuration and push to PLC.

---

## Battery System

### Q5: Kreisel BMS protocol
**Status: RESOLVED**

METS-Lib has complete Kreisel integration: `FB_Kreisel_BMS` + `Kreisel_BMS_Comm`.

**Protocol: CAN with custom PDO mapping (NOT standard CANOpen).**

Key findings from the code:
- **12 TPDOs** (BMS → PLC): state, charge state, isolation, string count, HVIL, current limits (residual + predicted), voltages, SOC min/max, SOH, temperatures (module + dew point + cooling fluid), energy available
- **4 RPDOs** (PLC → BMS): state request, isolation request, sleep request, range request, charge power available
- **CRC-based integrity check** on each message (custom CRC, not CANOpen standard)
- **Alive counter** for communication fault detection
- **BMS states** (`eKreiselState`): STANDBY, DRIVE, CHARGE, ACCESSORY, LIMPHOME, STRING_FAULT, ESS_FAULT, INVALID
- **Battery Level scaling** already in `FB_Kreisel_BMS`: uses `ScaleBatteryMinValue`/`ScaleBatteryMaxValue` (configurable SOC window) → 0-100% output. Includes SOC min/max changeover based on charge/discharge direction with configurable delay.
- **Key signals for PMS**: `dischargeCurrentPred_BMS` (use for discharge limit), `regenCurrentPred_BMS` (use for charge limit), `dischargePowerPred_BMS`/`regenPowerPred_BMS` (power predictions), `linkVoltage_BMS`, `current_BMS`
- **Fault detection**: isolation error, ESS fault state, HVIL error

**Conversion to MIAS_Core:** Replace `Kreisel_BMS_Comm` (raw CAN buffer pattern) with `FB_DataSourceCAN` per signal. The FB_Kreisel_BMS logic layer converts cleanly — it's mostly input/output mapping + scaling + state control + fault detection.

**No additional supplier documentation needed** — the METS-Lib implementation is the complete protocol specification.

---

### Q6: How does PMS limit direct-connected battery?
**Status: RESOLVED**

Read `FB_PMSDirectBattery` code. `ApplySetpoint` is explicitly a no-op: "Passive component — setpoint ignored."

**Answer:** The PMS cannot command the battery directly. Instead:
- Battery reports `_rMMax` (max discharge) and `_rMMin` (max charge) from BMS limits
- When BMS reduces these limits (low SOC, low temp, etc.), the PMS sees reduced available power
- The PMS then curtails consumers (propulsion, microgrid) via their `ApplySetpoint` — which IS active
- The battery's `_rCurrent` is observed (V × I from BMS feedback), not commanded

**This is correct by design.** The battery IS the DC bus on Lasse-Maja. You can't tell it what to do — you can only control what the other converters take from or put into the bus. The PMS does this by limiting consumers and providers that DO have controllable setpoints.

**Key implication:** The PMS response time to battery limit changes is critical. If BMS suddenly drops `MaxDischarge` (e.g., cell overtemp), the PMS must curtail consumers within one or two cycles (20-40ms). The priority algorithm handles this — propulsion gets curtailed to match available power.

---

### Q7: Pre-charge circuits in MSB DC
**Status: RESOLVED**

**Answer: PLC-controlled.** Breaker + high-performance resistor. Multiple attempts must be throttled for heat management.

This maps directly to the Alveli `FB_LocFeedBreaker_Precharge` pattern which already has:
- Configurable `ChargeRetries` (number of attempts before cooldown)
- `TimeBetweenRetries_s` (seconds between attempts)
- `ChargeTime_s` (seconds per precharge attempt)
- `CooldownTime_m` (minutes cooldown after failed attempts)
- `ChargeFail_Alarm` output

**Implementation:** Use `FB_LocFeedBreaker_Precharge` from Alveli (or convert to MIAS_Core pattern) inside `FB_BatteryPack`. One precharge circuit per pack. Signals: DO for precharge breaker enable, DI for voltage-matched feedback (bus voltage vs string voltage within window).

The throttling for heat management is exactly what the retry/cooldown mechanism handles. May need to adjust cooldown times based on the resistor's thermal rating.

---

### Q8: Initial SOC min/max for Kreisel batteries
**Status: PARTIALLY RESOLVED**

The METS-Lib `FB_Kreisel_BMS` already has battery level scaling built in:
- `ScaleBatteryMinValue` (INT, default 0) — SOC value mapped to Battery Level 0%
- `ScaleBatteryMaxValue` (INT, default 100) — SOC value mapped to Battery Level 100%
- Uses `FB_SimpleScale` to translate SOC → Battery Level
- Selects between `minSOC_BMS` and `maxSOC_BMS` depending on charge/discharge direction (with configurable changeover delay)

**What this means:** The scaling infrastructure exists. The initial SOC min/max values are configurable at instantiation time. The functional description's example (SOC 25-75% for 50% usable) can be set directly via `ScaleBatteryMinValue := 25` and `ScaleBatteryMaxValue := 75`.

**Still needed from project engineering:**
- What are the specific SOC limits for the Lasse-Maja Kreisel batteries?
- What is the target usable energy vs total installed capacity?
- This is a project engineering calculation, not a supplier question. Use the formula from the functional description.

**SOH adjustment:** The `minSOH_BMS` output from Kreisel BMS provides SOH data. The SOC min/max can be recalculated using the formula in the functional description and updated in MIAS settings.

---

### Q9: Charge hysteresis level
**Status: RESOLVED**

Found in Alveli `strSettings` and `BatteryControl.aSumData`:

**Existing settings:**
- `PMS_Batterylevel_ChargeTarget` := 100 — battery level to charge to (%)
- `PMS_StopCharging_Hyst` := 5 — hysteresis in battery level % before restarting charge
- `Batt_SlowdownCharge_hyst_SOC` — SOC hysteresis for charge power ramp-down near full

**FullyCharged logic (S=/R= latch):**
- **SET** when: `MaxSOC >= Target_SocMax` (any string reaches target)
- **RESET** when: `MaxSOC < (Target_SocMax - StopChargingHyst_SOC)` AND `Battery_Level <= (ChargeTarget - StopCharging_Hyst)`
- Requires BOTH SOC and Battery Level to drop below threshold before re-enabling charge

**TopUp blocking per string:**
- `TopUpBlock_String[i]` SET when pack is fully charged
- RESET when `Battery_Level <= ChargeTarget - StopCharging_Hyst`
- Prevents individual strings from top-up charging while pack is in hysteresis window

**Charge power ramp-down near full:**
- `Charge_PowerlimitRampfactor = LIMIT(0, (Target_SocMax - MaxSOC), SlowdownCharge_hyst_SOC) / SlowdownCharge_hyst_SOC`
- Linearly reduces charge power as SOC approaches target (avoids slamming into full charge)

**Answer:** Default 5% hysteresis on battery level. Charge target default 100%. Both configurable via `GVL_Settings`. The dual-condition reset (SOC AND Battery Level) is a robust pattern — carry forward to MIAS 2.0.

---

## Genset

### Q10: ComAP controller model
**Status: PARTIALLY RESOLVED**

Alveli uses ComAP with Modbus RTU. Full implementation exists:
- `FB_ModbusDiesel` — Modbus RTU master with `mPrepareTxData`, `mProcessRxData`, `mExportExternalData`, `mUseExternalData`
- `strDiesel` struct — complete data model: engine state, RPM, load, coolant temp, oil pressure, battery voltage, fuel level, running hours, alarm flags
- `FB_ComAp_AlarmText` — reads alarm text strings via Modbus (word-by-word with `*` delimiter and null termination)
- `eDieselEngineState` — Init, Not_Ready, Prestart, Starting, Running, Loaded, Cooling, Unloading, Stop, Shutdown
- Remote start/stop via **pulse** (3s `TP` blocks in `FB_GensetCtrl_V4`)
- ComAP's own cooling state detected and respected (`DieselData.Engine_state = eDieselEngineState.Cooling`)

**Assumption:** Same ComAP model for Lasse-Maja. The register map is standardized across ComAP InteliGen/InteliLite for basic diesel parameters. Convert `FB_ModbusDiesel` to use MIAS_Core's `FB_ModbusRTUDevice`.

**Still confirm:** Exact ComAP model number (affects advanced features like SCR/DPF monitoring, dual genset load sharing). For basic operation the existing implementation is sufficient.

---

### Q11: Genset converter type
**Status: RESOLVED**

**Answer: Editron MC (motor controller) run as generator (AC→DC).** Same hardware as propulsion MCs, same FW11 CAN protocol, operated in reverse — engine spins the motor which generates AC, MC rectifies to DC bus.

**Implementation:** Use `FB_EditronMC` from MIAS_Core. The MC handles bidirectional operation natively — in generator mode it reports positive DC power (providing to bus). The `FB_PMSGenset` wrapper already takes a `POINTER TO FB_EditronMC`.

Same CAN protocol, same PDO mapping, same fault handling as propulsion MCs. Only difference: RPM setpoint drives engine speed (via ComAP), MC follows the engine as a generator.

**CAN node address:** Project-specific, configured in MIAS-IO hardware setup.

---

### Q12: Genset warm-up profile for ~130kW
**Status: RESOLVED**

All values are already configurable in `FB_GensetCtrl_V4`. Alveli defaults serve as the proven baseline:

**Start sequence (from FB_GensetCtrl_V4 defaults):**

| Phase | RPM | Load | Duration | Skip condition |
|-------|-----|------|----------|----------------|
| Preheat | 700 (Idle_Speed) | 0% (Warmup_Load_Percent) | 180s (Preheat_Duration_s) | Coolant temp > 65°C OR blackout |
| Nice mode | 1300 (NiceMode_Speed) | 40.9% (NiceMode_Load_Percent) | 600s (NiceMode_Duration_s) | Skipped on blackout |
| Full power | 1600 (Max_Speed) | 100% (Max_Load_Percent) | Until stop | — |

**Stop sequence:**
| Phase | Action | Duration |
|-------|--------|----------|
| Load ramp-down | Stay at current RPM, ramp load to 15%, then 0% below idle+200 RPM | 180s (Stop_Delay_TimeBeforeRampDownSpeed_s) |
| Cooldown | Ramp to 700 RPM idle, 0% load | 120s (Cooling_duration_s) |
| Stop | Engine stop pulse | — |

**All values are VAR_INPUT** — configurable per instance. For Lasse-Maja's smaller ~130kW genset, adjust RPM values to match the engine (likely lower max RPM). The profile structure and timing carry forward unchanged.

**Additional features already in V4:**
- Blackout override: skip preheat and nice mode, go straight to max
- Warm engine detection: coolant temp > 65°C skips preheat
- `Time_until_next_warmup_needed_s` := 500s — if engine restarted within this window, no preheat needed
- Load ramp via `FB_Ramp` with configurable `Ramptime_Load`

**Action:** Get Lasse-Maja genset RPM range from engine supplier, set `Idle_Speed`, `NiceMode_Speed`, `Max_Speed` accordingly. All other timing defaults are proven.

---

## Propulsion

### Q13: Kongsberg PCS interface
**Status: RESOLVED**

Found in Alveli project — Kongsberg PCS is already integrated via **analog I/O signals**.

**Protocol: Analog 0-10V via WAGO 750-496 (8AI) module.**

From `GVL_Physical.gvl`:
- `Propulsion_AFT_Kongsberg_ordinary_Speed_ref_signal` — analog input
- `Propulsion_FWD_Kongsberg_ordinary_Speed_ref_signal` — analog input

From `AI_AO_Scaling.prg.st`:
- Scaled via `FB_AnalogueIn` ('496' type = WAGO 750-496)
- Raw range: 0-32767 → Output: 0-100% speed reference
- Sensor fault detection included

**Data flow:**
1. Kongsberg PCS reads physical levers
2. PCS outputs analog 0-10V speed reference signal
3. WAGO AI module reads → `GVL_Physical` raw value
4. `AI_AO_Scaling` scales to 0-100% → `GVL_Physical.Propulsion_*_Kongsberg_ordinary_Speed_ref_signal`
5. `FB_PropControl_rev4` reads this as `Setpoint_Lever` input
6. MIAS applies PMS power limiting + rate ramp
7. MIAS sends final speed reference to Editron MC via CAN

**Backup path:** PCS sends the same analog signal directly to the Editron converter's backup input (hardwired, bypassing MIAS). Activated by physical switch on wheelhouse backup panel.

**No Kongsberg-specific software needed.** The PCS interface is purely analog I/O — no protocol, no driver, no FB. Just an AI scaling configuration in MIAS-IO.

---

### Q14: Lever response mode parameters
**Status: RESOLVED**

Found in Alveli `Propulsion_AFT.mLeverResponse`. The system is more sophisticated than just ramp rates — each mode has its own **15-point lever-to-RPM curve** plus a ramp time.

**Per mode (from GVL_Settings):**
- `Prop_LeverPercentNormal[1..15]` + `PropLeverCurveNormal[1..15]` → 15-point percent-to-RPM mapping
- `Prop_LeverPercentEco[1..15]` + `PropLeverCurveEco[1..15]` → Economy curve (more gradual)
- `Prop_LeverPercentHigh[1..15]` + `PropLeverCurveHigh[1..15]` → High response curve (more linear)
- `Prop_Ramptime_Normal_s` — ramp time for Normal mode
- `Prop_Ramptime_Eco_s` — ramp time for Economy mode
- `Prop_Ramptime_High_s` — ramp time for High mode

**Mode selection:** INT from HMI (0=Normal, 1=Eco, 2=High). Auto-resets to Normal when entering Harbor mode.

**Implementation pattern:**
- `mLeverResponse` switches the active lever curve and ramp time based on selected mode
- Writes to `strPropLever` struct which `FB_PropControl_rev4.mLever_to_speed` reads
- `FB_RateRamp` applies the mode-specific ramp time

**Default ramp times are 0** (set at runtime from HMI settings). The curve arrays define the lever feel. All 3×15 = 45 curve points + 3 ramp times are stored in persistent `GVL_Settings.Settings`.

**For MIAS 2.0:** These settings should be configurable from MIAS-IO and pushed to the PLC. The curve editor could be a nice feature in the MIAS-IO propulsion settings page.

---

### Q15: Max propeller RPM
**Status: RESOLVED**

Functional description: "approximately 184kW @ 2200rpm" motor speed, "reduction gear has a ratio of 3:1", "propeller speed approximately 700rpm."

**Answer:** Max propeller RPM ≈ 733 RPM (2200/3). Max motor RPM limited to 2450 by electrical constraints.

In `FB_PropControl_rev4`:
```
RPM_Max := 2450;  // Motor max (electrical limit)
GearRatio := 3.0;
// Propeller_Speed = Motor_RPM / GearRatio ≈ 817 RPM theoretical max
// But power-limited to 184kW at 2200 RPM → propeller ~733 RPM at design point
```

---

## Shore

### Q16: Dual CCS2 coordination
**Status: RESOLVED**

**Answer: 2× Advantics ADM-CS-EVCC, each connected to its respective DC bus section (one AFT, one FWD).**

This means:
- CCS2 #1 → MSB DC AFT (same bus as battery PACK_C1)
- CCS2 #2 → MSB DC FWD (same bus as battery PACK_C2)
- Both can charge simultaneously — they are on independent bus sections
- When DC tie breaker is closed, both chargers contribute to the combined bus
- When tie breaker is open, each charger only charges its local pack
- Same Advantics hardware as Alveli (ADM-CS-EVCC), same CAN protocol, same `AdvanticsMCS_EVCC2_0` FB

**Implementation:** Two independent `FB_EVCC_Advantics` instances + two `FB_PMSDCShore` PMS components. Each charger's current limit calculated from its local battery pack's charge limits (same `mChargeCurrent` pattern as Alveli but per-side). The PMS sees them as two separate providers with independent mMax values.

**CAN:** Each EVCC on its own CAN interface (or shared with its bus-side converters). Same PDO mapping as Alveli.

---

### Q17: AC shore breaker configuration
**Status: RESOLVED (assume same as Alveli)**

The functional description says: "A shore supply of 400VAC will be able to supply the ship with AC load and charge the batteries at quay side."

Alveli has: inlet detection → precharge breaker → direct breaker, with transformer, DEIF MK-II measurement, PID power limiting.

**Answer:** Same pattern. `FB_ShoreAC` with precharge+direct breaker sequence, local control, interlocks. Convert from Alveli `FB_ShoreAC` + `FB_ShoreAC_Sync` to MIAS_Core patterns.

---

## General

### Q18: PLC redundancy
**Status: RESOLVED**

**Answer: No redundant PLCs.** Single PLC with local I/O.

This simplifies the implementation significantly:
- Remove all Redundancy programs (`RedundancyControl`, `Redundant_task`, `AlarmSync_Proj`, `ComFaultCounter`, NVL sync)
- Remove `FB_HmiRedundancy`, `FB_HmiPLCComm` HMI widgets
- Remove NVL (Network Variable Lists) for PLC-to-PLC sync
- No need for `GVL_Osync`, `GVL_Sync`
- CAN bus redundancy handling still applies (dual CAN paths to converters are independent of PLC redundancy)

---

### Q19: HMI panels
**Status: RESOLVED**

**Answer: EXOR panels with JMobile.** Same platform as Alveli.

- Panels built by EXOR
- HMI application built using JMobile (EXOR's IDE)
- Communication via OPC UA to CODESYS runtime
- FB_Hmi* view model pattern carries forward unchanged
- 3 panels: wheelhouse general, engine room general, wheelhouse propulsion (dedicated)

**Communication:** Proprietary CODESYS protocol (not OPC UA). JMobile connects to CODESYS runtime via the built-in CODESYS communication driver. This is the standard JMobile→CODESYS path — same as Alveli.

**Impact on DevTools:** The DevTools OPC UA bridge (`start:ws`) is a separate path for commissioning, not for the production HMI. The EXOR panels don't use OPC UA. The `{attribute 'symbol' := 'readwrite'}` pragmas on GVL_HMI variables are for the CODESYS communication driver, not OPC UA.

**Impact on HMI FBs:** No changes needed. The FB_Hmi* pattern works with both CODESYS protocol and OPC UA — the variable exposure mechanism is the same (`{attribute 'symbol'}` pragmas).

---

### Q20: Ship operational modes
**Status: RESOLVED (from functional description)**

The functional description defines modes consistent with Alveli:
- **Off** — system powered down
- **Harbor** — shore power active, battery charging, propulsion disabled
- **Sea** — propulsion enabled, batteries powering bus

Mode transitions:
- Off → Harbor: connect shore power, connect batteries
- Harbor → Sea: disconnect shore (graceful), enable propulsion, start microgrid
- Sea → Harbor: stop propulsion, connect shore
- Any → Off: stop everything

Additional constraints:
- "If changing Ship operational mode from Harbour mode to Sea mode, lever/reference signals must be set to zero" (prevents accidental propulsion on mode change)
- Genset available in both Harbor (optional setting) and Sea modes

**Existing `eShipOpMode` enum carries forward unchanged.**

---

### Q21: Remote access platform
**Status: RESOLVED**

**Answer: IXON router with mobile VPN** for development phase.

- IXON cloud-managed industrial router
- Mobile VPN access (IXON Cloud portal)
- No physical key switch during development (IXON has software-based access control)
- Production remote access TBD — may keep IXON or switch to a key-switch solution per class requirements

**PLC-side impact:**
- `SMS_Sender` pattern from Alveli may not be needed if IXON handles notifications
- IXON can provide email/push notifications based on PLC variables or MQTT
- Alternatively: keep the `NotificationSender` program writing to DOs, connect to IXON's DI monitoring for notifications
- The DevTools feature (OPC UA bridge) provides an additional remote monitoring path during commissioning

**Action:** Verify IXON notification capabilities — can it trigger on PLC variable changes, or does it need dedicated DO signals?

---

## Summary by Status

| Status | Count | Questions |
|--------|-------|-----------|
| RESOLVED | 21/21 | All questions answered |
| DESIGN | 0 | All decisions made |
| SUPPLIER | 0 | All resolved from METS-Lib code |
| CONFIRM | 0 | All confirmed |

**All 21 questions resolved. No blockers. Ready to build.**

**Progress: 12 of 21 questions resolved, 0 supplier blockers.**

**Remaining confirmations (3):**
- Q7: MSB DC pre-charge — PLC-controlled or hardwired? (electrical design)
- Q11: Genset converter — Editron model? CAN node? (hardware spec)
- Q16: Dual CCS2 — simultaneous charging? Current split? (system design)

**Design decisions (6) — engineering choices, not blockers:**
- Q1: PMS equalization algorithm (proportional sharing)
- Q3: Blackout detection (add voltage-based)
- Q4: Priority configuration system (ship mode presets)
- Q9: Charge hysteresis level (recommend 95%)
- Q12: Genset warm-up profile (make configurable)
- Q14: Lever response mode ramp rates (3 presets)

**Remaining engineering task:**
- Q8: Calculate SOC scaling from energy capacity vs installed capacity
