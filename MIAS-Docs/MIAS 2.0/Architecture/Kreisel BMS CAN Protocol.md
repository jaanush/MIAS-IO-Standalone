# Kreisel BMS CAN Protocol — KBP63

Source: DBC files from `KBP63 00259028D 00259747D/02_BMS/`

## Two CAN Networks

### PT-CAN (Powertrain CAN) — Primary control network
Used for: BMS state control, current/voltage limits, SOC, power predictions, string connection.

| CAN ID | Name | Cycle | Direction | Key Signals |
|--------|------|-------|-----------|-------------|
| 282 | BMS_State | 10ms | BMS→PLC | state_BMS, chargeState, isolationError, hvilState, numberOfConnectedStrings, isolationState |
| 817 | BMS_CurrentVoltage | 10ms | BMS→PLC | linkVoltage_BMS (0.02V), current_BMS (0.1A, +discharge/-charge), dischargeCurrentResidual, regenCurrentResidual |
| 818 | BMS_DriveLimits | 10ms | BMS→PLC | maxVoltageLimit (0.02V), minVoltageLimit, regenCurrentLimit (0.05A), dischargeCurrentLimit |
| 819 | BMS_Charge | 100ms | BMS→PLC | chargeCurrentSetpoint (0.05A), chargeVoltageLimit (0.02V) |
| 820 | BMS_EnergySOH | 1000ms | BMS→PLC | energyAvailable (0.01kWh), minSOH (0.5%), maxSOH |
| 821 | BMS_BrickVoltages | 100ms | BMS→PLC | minBrickVoltage (0.0001V!), maxBrickVoltage, min/max indices |
| 822 | BMS_IsolationSOC | 1000ms | BMS→PLC | minSOC (0.01%), maxSOC, isolationResistanceExtern/Intern (2kOhm) |
| 823 | BMS_ModuleTemperatures | 100ms | BMS→PLC | minModuleTemp (0.5°C, offset -40), maxModuleTemp, maxDewPoint |
| 825 | BMS_StringVoltages | 100ms | BMS→PLC | minStringVoltage (0.02V), maxStringVoltage, linkVoltageAux1/2 |
| 826 | BMS_FluidMeasUserSOC | 1000ms | BMS→PLC | fluidTempInlet/Outlet (0.5°C), userSOC (0.01%), fluidPressureInlet (10mbar) |
| 827 | BMS_PowerPrediction | 100ms | BMS→PLC | regenCurrentPred (0.05A), dischargeCurrentPred, regenPowerPred (0.01kW), dischargePowerPred |
| 283 | PT_Request | 10ms | PLC→BMS | stateRequest, isolationRequest, sleepRequest, rangeRequest, chargePowerAvailable (0.01kW), alive, CRC |

**Per-string controller messages (SC01-SC30):**
| CAN ID | Name | Cycle | Signals |
|--------|------|-------|---------|
| 31 | SC01_State | 100ms | linkVoltage_SC01 (0.04V, offset -1250V), emergencyRequest, alive, CRC |
| 32 | SC02_State | 100ms | linkVoltage_SC02, emergencyRequest, alive, CRC |
| ... | SC05-SC30 | 100ms | Same pattern, IDs: 35,36,39,40,43,44,47,48,51,52,55,56,59,60 |

String controller numbering for Lasse-Maja:
- PACK_C1 (FWD, 3 strings × 2 packs): SC01+SC02, SC05+SC06, SC09+SC10
- PACK_C2 (AFT, 4 strings × 2 packs): SC13+SC14, SC17+SC18, SC21+SC22, SC25+SC26

### P-CAN (Debug/Diagnostic CAN) — Telemetry network
Much larger DBC (~3.8MB). Contains per-cell brick voltages, SPI diagnostics, contactor weld checks, NM network management, EEPROM status, calibration data, performance metrics, etc.

**Not needed for PMS control.** Used for:
- Deep diagnostics (individual cell voltages, temperatures)
- Manufacturing/service (calibration, firmware update)
- Development debugging

## Key Signals for PMS

### Voltage data IS available
Despite direct bus connection, the BMS reports:
- `linkVoltage_BMS` (ID 817) — DC link voltage as seen by BMS, 0.02V resolution, 0-1200V
- `minStringVoltage_BMS` / `maxStringVoltage_BMS` (ID 825) — per-string voltage envelope
- `minBrickVoltage_BMS` / `maxBrickVoltage_BMS` (ID 821) — per-cell voltage, 0.1mV resolution
- Per-SC `linkVoltage_SCxx` — individual pack voltages (0.04V, offset -1250V for signed range)
- `maxVoltageLimit_BMS` / `minVoltageLimit_BMS` (ID 818) — BMS-enforced voltage limits

### Current/power data for PMS
- `current_BMS` (ID 817) — total pack current, 0.1A, signed (+discharge/-charge)
- `dischargeCurrentLimit_BMS` / `regenCurrentLimit_BMS` (ID 818) — hard limits, 0.05A
- `dischargeCurrentPred_BMS` / `regenCurrentPred_BMS` (ID 827) — **short-term predictions** for available current, 0.05A
- `dischargePowerPred_BMS` / `regenPowerPred_BMS` (ID 827) — **power predictions in kW**, 0.01kW

**Use predictions (ID 827) for PMS mMax/mMin**, not hard limits (ID 818). Predictions account for thermal derating and SOC proximity to limits.

### SOC/SOH for battery level
- `minSOC_BMS` / `maxSOC_BMS` (ID 822) — SOC envelope across all strings, 0.01%
- `userSOC_BMS` (ID 826) — blended SOC, 0.01%
- `minSOH_BMS` / `maxSOH_BMS` (ID 820) — state of health, 0.5%
- `energyAvailable_BMS` (ID 820) — remaining energy in kWh, 0.01kWh

### Range request for charge target
`rangeRequest_PT` in PT_Request (ID 283) — sets target SOC for charging:
- 0 = MAXIMUM (100%)
- 1 = LIMITED (80%)
- 2 = SHIPPING (25%)
- 3-6 = Fixed SOC targets (20%, 30%, 40%, 50%)
- 7-13 = SOC targets (60%, 70%, 75%, 80%, 85%, 90%, 95%)
- 14 = MAXIMUM
- 15 = INVALID

This replaces the manual battery level scaling — the BMS itself handles the charge target based on this request.

## SNA (Signal Not Available)
All signals use a specific value for "not available" (typically 0xFFFF for 16-bit, 0xFF for 8-bit). Must be checked before using any value.

## CRC and Alive
PT_Request (PLC→BMS) includes alive counter (4-bit) and CRC-8. The METS-Lib `Kreisel_BMS_Comm` already implements the CRC calculation.
