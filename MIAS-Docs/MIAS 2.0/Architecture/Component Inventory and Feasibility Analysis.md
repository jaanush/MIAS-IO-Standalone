# Component Inventory & PMS Feasibility Analysis

## Current State of MIAS_Core Library

MIAS_Core (`C:\Projects\MIAS_Core\MIAS_Core.fbslib`) already has significant infrastructure:

### HAL Layer (Hardware Abstraction)
| FB | Status | Purpose |
|----|--------|---------|
| FB_DataSource, FB_DataSourceBit/Byte/Word/DWord/LWord | Done | Generic data source with quality chain |
| FB_DataSourceCAN | Done | CAN-specific data source with PDO extraction |
| FB_DataSourceRTU | Done | Modbus RTU data source |
| FB_DataObjectRead/Write/ReadWrite | Done | OPC UA-exposed data objects |
| FB_CANInterface, FB_CAN658, FB_CANDevice | Done | CAN bus management |
| FB_CANBridge, FB_CANSync, FB_CANTxScheduler | Done | CAN infrastructure |
| FB_CANSdoClient | Done | SDO read/write for CAN configuration |
| FB_ModbusRTUInterface/Device/Slave | Done | Modbus RTU communication |
| FB_ModbusTCPInterface/Device | Done | Modbus TCP communication |
| FB_Carrier, FB_ComManager | Done | IO carrier and communication management |
| FB_DeviceSource, FB_InterfaceSource | Done | Hardware source abstraction |
| FB_PlcHealth, FB_SystemHealth | Done | PLC and system diagnostics |
| FB_StartRetry | Done | Configurable start retry with backoff |
| FB_KbusMonitor | Done | WAGO K-bus monitoring |
| FB_CommDiagnostics | Done | Communication diagnostic counters |
| FB_TraceLogger | Done | Runtime trace logging |

### Editron Converter Layer
| FB | Status | Purpose |
|----|--------|---------|
| FB_EditronConverter | Done | Base converter with CBM lifecycle |
| FB_EditronDCDC | Done | DCDC specialization |
| FB_EditronMC | Done | Motor controller specialization |
| FB_EditronAFE | Done | AFE/Microgrid specialization |

### PMS Layer
| FB | Status | Purpose |
|----|--------|---------|
| FB_PMS | Done | Supervisory balancer: priority-weighted allocation + PID bus trim |
| FB_PMSComponent | Done | Base component: I_PMSComponent interface + ROC limiting |
| I_PMSComponent | Done | 10-property interface (Min/Max/mMin/mMax/Current/Setpoint/pPrio/cPrio/ROC/Online) |
| FB_PMSGenset | Done | Genset wrapper |
| FB_PMSBattery | Done | Battery with DCDC wrapper |
| FB_PMSDirectBattery | Done | Battery directly on DC bus (NO DCDC) - **for Lasse-Maja** |
| FB_PMSAFE | Done | AFE/Microgrid wrapper |
| FB_PMSDCShore | Done | DC shore charging wrapper |
| FB_PMSPropulsion | Done | Propulsion consumer wrapper |

### HMI Layer
| FB | Status | Purpose |
|----|--------|---------|
| All 27 FB_Hmi* blocks | Done | Copied from Alveli and adapted |

### DAO Layer
| FB | Status | Purpose |
|----|--------|---------|
| FB_DataObject, FB_DAOGroup | Done | Data Access Object for HMI |

## What's Missing — MIAS_Core Gaps

### Needed NEW components

| Component | Priority | Description |
|-----------|----------|-------------|
| **FB_BatteryManager_Kreisel** | HIGH | Kreisel BMS communication. METS-Lib has `FB_Kreisel_BMS` + `Kreisel_BMS_Comm` — needs conversion to MIAS_Core patterns (FB_DataSourceCAN-based, not raw CAN buffers) |
| **FB_BatteryPack** | HIGH | Battery pack management: string connection with voltage matching, SOC-to-BatteryLevel scaling with SOH, emergency override, overload protection. Legacy: `BatteryControl` program (9 actions/methods). Needs to be converted from a monolithic program to a reusable FB |
| **FB_ShoreAC** | HIGH | AC shore connection: precharge+direct breaker, sync, PID power limiting. Legacy: `FB_ShoreAC` + `FB_ShoreAC_Sync`. Convert to MIAS_Core patterns |
| **FB_EVCC_Advantics** | HIGH | Advantics MCS/CCS2 EVCC. Legacy: `AdvanticsMCS_EVCC2_0` + `AdvanticsMCS_Comm`. Need 2 instances for Lasse-Maja (dual CCS2). Convert CAN layer to FB_DataSourceCAN |
| **FB_GensetController** | HIGH | Genset lifecycle (ComAP Modbus): preheat/nice mode/full power, RPM+load ramping, manual override. Legacy: `FB_GensetCtrl_V4` + `FB_ModbusDiesel`. Convert Modbus to FB_ModbusRTUDevice |
| **FB_PropulsionControl** | HIGH | Propulsion with Kongsberg PCS interface, 3 lever modes, rate ramp, overtemp deration. Legacy: `FB_PropControl_rev4`. Mostly portable, needs PCS interface added |
| **FB_NonEssentialLoad** | MEDIUM | Load shedding. Legacy: `FB_NonEss`. In new PMS, may be implemented as a PMSComponent with adjustable cPrio instead of a separate FB |
| **FB_BreakerControl** | MEDIUM | Generic breaker with precharge variant. Legacy: `FB_BaseBreaker`, `FB_FeedBreaker`, `FB_LocFeedBreaker`, `FB_LocFeedBreaker_Precharge` |
| **FB_MicrogridControl** | MEDIUM | Microgrid/AFE mode switching logic. Legacy: `FB_Microgrid`, `FB_AFE`, `FB_AFE_Genset`. In new architecture: handled by FB_EditronAFE + PMS, but mode selection logic needs a home |
| **FB_BatteryLevelScaler** | MEDIUM | SOC → Battery Level translation with configurable SOH-based scaling, hysteresis, lifetime warnings. NEW — not in legacy |
| **FB_DroopHandling** | LOW | Grid frequency/voltage droop. Legacy: `FB_DroopHandling_Rev2`. May not be needed if converters handle droop internally |
| **FB_EnergyCounter** | LOW | Energy consumption tracking. Legacy: `FB_EnergyCounter` |
| **FB_AverageConsumption** | LOW | Power consumption averaging for PMS overview. Legacy: `AverageConsumption.prg` |

### Components to convert from METS-Lib

| METS-Lib FB | Target | Conversion Notes |
|-------------|--------|------------------|
| `FB_AlarmDigital`, `FB_AlarmAnalogue` | Keep as-is or wrap | Core alarm logic is sound. May wrap with MIAS_Core DAO for OPC UA integration |
| `FB_AlarmBanner` | Keep as-is | Banner logic for HMI |
| `AlarmSettings` (static methods) | Keep as-is | `AssignSettingsDig/Ana` pattern works well |
| `FB_AnalogueIn`, `FB_AnalogueIn_Deadband_rev3` | Wrap with DataSource | Add quality chain from MIAS_Core diagnostic signals |
| `FB_Filter` | Keep as-is | Used everywhere for signal smoothing |
| `FB_LeverCtrl` | Keep as-is | Lever deadband and direction logic |
| `FB_Ramp` | Keep as-is | Generic ramp function |
| `FB_RunningHours` | Keep as-is | Equipment running hour counter |
| `FB_SimpleScale_rev2` | Keep as-is | Linear scaling |
| `FB_BatteryPack_EST_V2_0_0` | **Replace with Kreisel variant** | EST battery FBs not used on Lasse-Maja |
| `FB_Kreisel_BMS` | Convert to MIAS_Core | New Kreisel BMS FB needed |
| `FB_ShoreConn_Grid_Hamnen_Rev5` | Convert | Latest shore connection revision → FB_ShoreAC |
| `FB_AdvanticsCCS` | Convert | CCS → EVCC with dual connector support |
| `Advantics_Comm` | Convert | CAN comm → FB_DataSourceCAN |
| `FB_PropControl_rev3` | Already done | rev4 is in Alveli, carries forward |
| `CAN_FB_CanOpenDevice` | **Replaced** | MIAS_Core uses FB_CANDevice + FB_DataSourceCAN instead |
| All `Editron_Converter_FW11_*` | **Replaced** | MIAS_Core has FB_EditronConverter/DCDC/MC/AFE |

### Components NOT needed for Lasse-Maja

| Component | Reason |
|-----------|--------|
| `FB_DTI` / `DTI_Comm` | DTI drives not used |
| `FB_Deutronic_DCDC` | Deutronic DC/DC not used |
| `FB_EoDev_FC` | Fuel cells not used |
| `FB_ME_HybridGear_Ctrl` / `FB_PTI_PTO_Ctrl` | No PTI/PTO on Lasse-Maja |
| `FB_PropControl_Derating` | Replaced by overtemp deration in rev4 |

## Outstanding Questions

### PMS Architecture
1. **Equalization window**: The concept doc mentions equalization for consumers within a priority window. MIAS_Core's FB_PMS has `rEqualizeBand` (5kW default) but the allocation currently uses simple priority ordering, not proportional equalization. **Is the equalization algorithm correct/complete?**

2. **DC bus PID vs converter droop**: The functional description says converters handle voltage regulation via built-in limits (self-regulating DC system). MIAS_Core has a slow PID trim. **What's the interaction? Does the PID fight the droop?** The FB_PMS comment says "NOT for fast voltage regulation — droop handles that" which is correct, but needs verification during commissioning.

3. **Blackout detection**: Legacy uses 250ms timer on voltage. MIAS_Core checks `_rTotalMMax = 0` (no provider can deliver). **Is voltage-based detection also needed? What if providers report mMax > 0 but actual bus voltage collapsed?**

4. **Priority dynamics**: The concept doc says priorities are influenced by local state + external (ship mode, user config). **Where is the priority calculation implemented?** Each FB_PMS* wrapper has `UpdateDynamic()` which could set priorities, but the configuration system (ship mode → priority presets) isn't visible yet.

### Battery System
5. **Kreisel BMS protocol**: What communication protocol does Kreisel use? CAN? Modbus TCP? **Need supplier documentation** to design FB_BatteryManager_Kreisel.

6. **Direct battery connection**: Lasse-Maja batteries connect directly to DC bus (no DCDC). `FB_PMSDirectBattery` exists in MIAS_Core with `ApplySetpoint` as no-op. **How does the PMS limit battery charge/discharge if there's no DCDC to command?** The converters (propulsion, microgrid, genset, shore) are the only controllable elements — battery is passive. Does the PMS need to limit consumers instead of commanding the battery directly?

7. **Pre-charge in MSB DC**: The spec mentions additional pre-charge circuits in MSB DC (stronger than battery's built-in). **Who controls these? Is this hardwired logic or PLC-controlled?** Needs electrical design clarification.

8. **Battery Level scaling**: The SOC → Battery Level translation with SOH adjustment needs specific implementation. **What are the initial SOC min/max values for the Kreisel batteries?** Need from supplier.

9. **Charge hysteresis**: "Frequent topping up charge should be avoided" — **what is the hysteresis level?** Not specified in the functional description.

### Genset
10. **ComAP model**: Which ComAP controller? Same Modbus register map as Alveli? **Need ComAP model number and register map.**

11. **Genset converter**: The functional description mentions a "generator inverter" (AC→DC). Is this still an Editron converter? **Confirm converter type and CAN node configuration.**

12. **Genset warm-up profile**: Alveli uses preheat→nice mode (1300RPM/40.9% load/10min)→full power. **Is the same profile required for Lasse-Maja's smaller genset (~130kW)?**

### Propulsion
13. **Kongsberg PCS interface**: What protocol? What signals? Speed reference format? **Need Kongsberg interface specification.**

14. **Lever response modes**: Economy/Normal/High — **what are the ramp rates and curves for each mode?** Not specified in functional description.

15. **Pod gear ratio**: 3:1 confirmed, but **what is the exact max propeller RPM?** Spec says ~700rpm at 2200rpm motor.

### Shore
16. **Dual CCS2**: How are the two CCS2 connectors coordinated? **Can both charge simultaneously?** If yes, how is the current split between them?

17. **AC shore 400V**: Same precharge+direct sequence as Alveli? **Confirm AC shore breaker configuration.**

### General
18. **PLC redundancy**: Is Lasse-Maja redundant like Alveli (dual PLC)? The functional description mentions redundant power supplies but isn't explicit about PLC redundancy. **Confirm redundancy requirement.**

19. **HMI panels**: How many panels? Same JMobile/Exor platform? The spec mentions wheelhouse + engine room + dedicated propulsion display. **Confirm HMI hardware and layout.**

20. **Ship operational modes**: Alveli has Off/Harbor/Sea. Lasse-Maja functional description describes the same. **Are there additional modes? What triggers mode transitions?**

21. **Remote access**: Cloud-based VPN with key switch. **What platform? What router/gateway hardware?**

## Feasibility Analysis — Self-Regulating PMS

### Verdict: FEASIBLE — already partially implemented

The Self-Regulating PMS concept is **not just feasible, it's already built** in MIAS_Core. The core algorithm (FB_PMS) implements:

- Component registration with I_PMSComponent interface
- Priority-weighted allocation (sort providers/consumers by pPrio/cPrio)
- Shortage handling (curtail consumers from lowest priority)
- Surplus handling (reduce providers from lowest priority)
- DC bus PID trim (slow correction, not fighting converter droop)
- Blackout detection
- Rate-of-change limiting per component

### What works well

1. **The interface is clean**: 10 properties per component, dynamic updates via `UpdateDynamic()`, hardware commands via `WritePowerCommand()`. This matches the concept doc exactly.

2. **Component specializations exist**: Genset, Battery (with and without DCDC), AFE, DC Shore, Propulsion — all have FB_PMS* wrappers. Lasse-Maja's direct battery is specifically handled by `FB_PMSDirectBattery`.

3. **No special cases in PMS**: State transitions (AFE↔microgrid, genset start/stop) are handled inside the component wrappers, not in the PMS. The PMS only sees the properties change. This is exactly the concept doc's design intent.

4. **CBM lifecycle**: MIAS_Core uses CODESYS CBM (Component-Based Model) with `IActionProvider`, `ILevelControlled`, etc. This gives proper lifecycle management (init, start, cyclic, cleanup) without hand-rolled state machines.

### Risks and gaps

1. **Equalization not fully implemented**: The `rEqualizeBand` exists but the current allocation is binary (get-what-you-need or get-nothing). The proportional equalization described in the concept doc (consumers within a priority window share the shortage proportionally) isn't visible in the CyclicAction. **RISK: Medium. Impact: Low-priority consumers may get zero instead of a fair share.**

2. **No ship mode → priority mapping system**: The concept doc says priorities are influenced by ship mode, user configuration, and local state. MIAS_Core's component wrappers can set priorities in `UpdateDynamic()`, but there's no visible framework for ship-mode-based priority presets. **RISK: Medium. Need to implement a priority configuration system.**

3. **Direct battery is passive**: `FB_PMSDirectBattery.ApplySetpoint` is a no-op because you can't command a direct-connected battery. The PMS can only limit consumers to protect the battery. **RISK: Medium. The PMS must ensure that when BMS reports reduced discharge limits, consumers are curtailed fast enough.** The ROC property helps here — battery can report a high ROC indicating fast response, and the PMS adjusts other components accordingly.

4. **No genset start/stop orchestration visible**: In legacy, Main.prg decides when to start the genset based on SOC, blackout, etc. In the new PMS, this should happen automatically — when battery mMax drops low, the genset component should start (internally), then register its mMax increasing. **Where does the genset auto-start decision live?** Inside `FB_PMSGenset.UpdateDynamic()`? Or in a separate genset controller? This needs clarification.

5. **Shore connection handoff**: When switching from shore to battery (leaving harbor), the PMS needs to gracefully ramp down shore power while ramping up battery. The priority system should handle this (lower shore pPrio → PMS reduces shore first), but the actual disconnection sequence (ramp current, open breakers) is physical and needs to be coordinated. **RISK: Low if the FB_ShoreAC wrapper handles the physical sequence internally.**

6. **Testing complexity**: A priority-based system is harder to test exhaustively than explicit hard-coded logic. Edge cases (two equally-prioritized consumers, rapid mode switching, communication loss during allocation) need simulation. **RISK: Medium. Recommendation: Build a PLC simulation environment for PMS testing before commissioning.**

### Conclusion

The Self-Regulating PMS is architecturally sound and already implemented at the core level. The remaining work is:

1. **Complete the component wrappers** (Kreisel BMS, genset controller, shore AC, EVCC, propulsion with PCS)
2. **Add equalization** to the allocation algorithm
3. **Build the priority configuration system** (ship mode presets)
4. **Add genset auto-start logic** (inside the genset wrapper or as a separate orchestrator)
5. **Convert legacy utility FBs** (alarms, breakers, analog scaling, filters)
6. **Generate HMI FBs** from MIAS-IO component templates (already started with MIAS_Core HMI layer)
7. **Test with simulation** before commissioning

Estimated effort for Lasse-Maja readiness: the HAL, CAN, Editron, PMS core, and HMI layers are done. The remaining work is component-specific wrappers and the legacy utility conversion — significant but well-defined.
