# Battery Calibration Procedure — Lasse-Maja

## Constraint

Kreisel batteries require periodic offline calibration for SOC/SOH accuracy. This typically happens nightly during long port stays. One pack at a time must be disconnected for calibration.

## Reconnection Challenge

After calibration, the offline pack's OCV will differ from the bus voltage (the online pack has been charging). The BMS will not close string contactors if the voltage difference exceeds **±4V**.

Since there is no DCDC converter between batteries and bus, the only way to match voltages is to let the online pack's bus voltage drift down toward the offline pack's OCV — by reducing or stopping charge and letting hotel load drain the bus.

## Procedure (HMI-controlled)

### Disconnect for calibration
1. Operator selects pack to calibrate on HMI
2. MIAS sends `stateRequest_PT = STATE_STANDBY` to target BMS
3. BMS opens string contactors, pack goes offline
4. BMS performs internal SOH/SOC calibration
5. PMS sees pack mMax → 0, allocates from remaining pack only

### Reconnection after calibration
1. BMS calibration completes (BMS returns to STANDBY, ready for DRIVE)
2. Operator presses "Reconnect" on HMI
3. MIAS enters **voltage matching mode**:
   - Reads offline pack string voltages (`linkVoltage_SCxx` from PT-CAN)
   - Reads bus voltage (`linkVoltage_BMS`)
   - Calculates `deltaV = |busVoltage - offlinePackVoltage|`
   - If `deltaV > 4V`: reduce shore charge power (lower AFE power limit) or stop charging entirely
   - HMI displays: `deltaV`, estimated time to match, progress bar
4. When `deltaV <= 4V`: MIAS sends `stateRequest_PT = STATE_DRIVE`
5. BMS initiates precharge sequence internally
6. Strings connect one by one (voltage matching per-string via BMS)
7. Pack reports `numberOfConnectedStrings > 0` → pack is back online
8. Resume normal charging
9. PMS sees pack mMax return to full capacity

### Timeout / failure
- If voltage doesn't converge within configurable timeout (e.g. 30 minutes): alarm to operator
- Operator can choose to abort (leave offline until next attempt) or force (if within safe precharge range)
- If BMS precharge fails: `strMstrStrPrechgState = STRING_PRCHG_FAULT` on P-CAN

## Implementation in FB_BatteryPack

New method: `mCalibrationControl()`

**Inputs:**
- `xStartCalibration : BOOL` — HMI trigger (edge)
- `xReconnectCommand : BOOL` — HMI reconnect trigger (edge)
- `rVoltageTolerance : REAL := 4.0` — V window for reconnection

**Outputs:**
- `xCalibrationActive : BOOL` — pack is offline for calibration
- `xWaitingForVoltageMatch : BOOL` — waiting for bus voltage to drop
- `rVoltageDelta : REAL` — current voltage difference (for HMI display)
- `xReadyToReconnect : BOOL` — voltage within tolerance
- `xReconnectFailed : BOOL` — precharge failed after attempt

**States:**
```
IDLE → DISCONNECTING → CALIBRATING → WAITING_VOLTAGE_MATCH → RECONNECTING → IDLE
```

During WAITING_VOLTAGE_MATCH, the FB signals that shore charging should be reduced. This is communicated to the configuration layer (not PMS) — the shore component reduces its power limit or stops. The PMS sees the shore's mMax decrease naturally.

## Scheduling

For now: fully HMI-controlled. Future enhancement: scheduled calibration (e.g. every night at 02:00 if shore connected and both packs above 80% SOC).

## Impact on Other Systems

- **PMS:** No special logic. Sees one pack offline (mMax=0), allocates from the other.
- **Shore/AFE:** Configuration layer may reduce charge power during voltage matching.
- **Propulsion:** No impact if in Harbor mode (propulsion disabled).
- **Alarms:** "Battery calibration active" notification. "Reconnection timeout" alarm.
