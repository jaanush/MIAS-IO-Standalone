# CBM Lifecycle Pattern — MIAS_Core

All control components in MIAS_Core use **CODESYS CBM (Component-Based Model) composition** via the `LConC` (Level Control) pattern. This ensures consistent lifecycle management across all FBs without hand-rolled state machines.

## Why CBM

- **Standardized lifecycle**: every FB follows the same init → run → shutdown sequence
- **Clean error handling**: the model manages fault states and recovery transitions
- **No manual state machines**: the CBML framework handles state transitions
- **Composable**: parent FBs can coordinate child lifecycle automatically

## Interface Implementation

Every control FB implements three CBML interfaces:

```iec-st
FUNCTION_BLOCK FB_MyComponent
    IMPLEMENTS  CBML.IActionProvider,
                CBML.ILevelControlled,
                CBML.IHasContinuousBehaviour
```

And declares an internal model:

```iec-st
VAR
    _model : CBML.BehaviourModel;
END_VAR
```

The main body drives the model:

```iec-st
_model(
    itfActionProvider := THIS^,
    xControl          := xEnable
);
xBusy := _model.xBusy;
xError := _model.xError;
```

## Four Lifecycle Methods

Every control FB must implement these four methods:

### StartAction
Called once when `xEnable` transitions TRUE. Initialize state, prepare hardware.

```iec-st
METHOD StartAction
VAR_INPUT
    itfTimingController : CBML.ITimingController;
END_VAR
VAR_OUTPUT
    xComplete : BOOL;
    iErrorID  : INT;
END_VAR
```

- Zero all internal state
- Initialize communication (CAN NMT, Modbus connection)
- Validate configuration (pointers set, parameters valid)
- Set `xComplete := TRUE` when done (can span multiple cycles if needed)

### CyclicAction
Called every scan cycle while running. This is where all control logic lives.

```iec-st
METHOD CyclicAction
VAR_INPUT
    itfTimingController : CBML.ITimingController;
END_VAR
VAR_OUTPUT
    xComplete : BOOL;
    iErrorID  : INT;
END_VAR
```

- Read inputs (CAN data, Modbus registers, physical I/O)
- Compute derived values (power, status, faults)
- Execute control logic (state machines, PID, sequencing)
- Write outputs (commands to hardware)
- Set `xComplete := TRUE` every cycle (or FALSE to signal still processing)

### CleanupAction
Called when `xEnable` transitions FALSE or on error. Graceful shutdown.

```iec-st
METHOD CleanupAction
VAR_INPUT
    xAbortProposed  : BOOL;
    iErrorIDProposed: INT;
END_VAR
VAR_OUTPUT
    xComplete : BOOL;
    xAbort    : BOOL;
    iErrorID  : INT;
END_VAR
```

- Send safe-state commands to hardware (stop, standby, zero setpoints)
- Close communication cleanly (CAN NMT pre-op, etc.)
- Zero outputs
- Can take multiple cycles if hardware needs time to respond

### ResetAction
Called to clear error state and prepare for re-init.

```iec-st
METHOD ResetAction
VAR_OUTPUT
    xComplete : BOOL;
END_VAR
```

- Clear all fault flags
- Zero all state variables
- Ready for next StartAction

## State Flow

```
              xEnable = TRUE
    IDLE ─────────────────────► STARTING
                                   │ StartAction.xComplete
                                   ▼
              xEnable = FALSE   RUNNING ◄──── CyclicAction (every cycle)
    IDLE ◄───────────────────── STOPPING
              CleanupAction        │ error
              .xComplete           ▼
                                 ERROR
                                   │ ResetAction.xComplete
                                   ▼
                                 IDLE
```

## FBs Using This Pattern

| FB | Layer | Role |
|----|-------|------|
| FB_PMS | PMS | Supervisory power allocator |
| FB_BatteryPack | PMS | Pack management (strings, charge, calibration) |
| FB_EditronConverter | HAL/CAN | Base Editron FW11 driver |
| FB_EditronDCDC | HAL/CAN | DCDC specialization |
| FB_EditronMC | HAL/CAN | Motor controller specialization |
| FB_EditronAFE | HAL/CAN | AFE/Microgrid specialization |
| FB_KreiselBMS | HAL/CAN/BMS | Kreisel battery management system |
| FB_CANInterface | HAL/CAN | CAN bus management |
| FB_ModbusRTUInterface | HAL/Modbus | Modbus RTU bus management |
| FB_ModbusTCPInterface | HAL/Modbus | Modbus TCP connection management |
| FB_KbusMonitor | HAL/Kbus | WAGO K-bus monitoring |

**Rule: ALL new control FBs in MIAS_Core MUST use CBM composition.** No exceptions. Utility FBs (filters, scalers, timers) that don't manage hardware lifecycle are exempt.

## Example: Minimal CBM Component

```iec-st
FUNCTION_BLOCK FB_Example
    IMPLEMENTS  CBML.IActionProvider,
                CBML.ILevelControlled,
                CBML.IHasContinuousBehaviour
VAR_INPUT
    xEnable : BOOL;
END_VAR
VAR_OUTPUT
    xBusy   : BOOL;
    xError  : BOOL;
END_VAR
VAR
    _model  : CBML.BehaviourModel;
END_VAR

// Body
_model(itfActionProvider := THIS^, xControl := xEnable);
xBusy := _model.xBusy;
xError := _model.xError;
```

With methods:

```iec-st
METHOD StartAction ...
    // init
    xComplete := TRUE;

METHOD CyclicAction ...
    // control logic here
    xComplete := TRUE;

METHOD CleanupAction ...
    // safe shutdown
    xComplete := TRUE;

METHOD ResetAction ...
    // clear faults
    xComplete := TRUE;
```
