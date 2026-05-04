# Component Composition Patterns

How small components (actuators, sensors) compose into subsystems.

## Rules of Thumb

- **Single signal** → DAO extension (e.g. FB_TankSensor: one raw input + curve)
- **Multiple signals** → Component with CBM lifecycle (e.g. FB_DiscreteActuator: DO + DI + DI)
- **Multiple components wired together** → Composite component or wiring recipe

## Component Library (MIAS_Core)

### DAO Extensions (`DAO/`)
| FB | Signals | Purpose |
|----|---------|---------|
| FB_TankSensor | 1× AI raw | Non-linear tank level via CHARCURVE |

### Components (`Components/`)
| FB | Signals | Purpose |
|----|---------|---------|
| FB_DiscreteActuator | DO cmd + DI feedback + DI fault | Pump, fan, heater, contactor |
| FB_AnalogActuator | AO setpoint + AI feedback + DI fault | VFD, valve positioner |

All components use CBM (LConC). All have: xEnable, xLocalControl, xExternalFault, xInterlock, eStartStopMode, eStatus (derived from CBM state).

## Subsystem Composition

### Current: Wiring Recipes
MIAS-IO's `WiringRecipe` + `WiringRecipeParam` system can define internal connections between components within a composite. The MIAS-Plugin code generator produces the ST code.

**To extend:** Currently targets Editron converters. Needs to support generic actuator/sensor components.

### Future: Visual Wiring Editor
Graph-based UI in MIAS-IO:
1. Drag components onto canvas
2. Draw connections between ports
3. Add logic nodes (AND, OR, timer, comparison)
4. Export as composite component → generates wiring recipe → generates ST

The data model is the same as wiring recipes: nodes (component instances) + edges (port connections) + logic nodes.

### Example: Hydraulic Unit
```
Inputs: xEnable, xCommand1, xCommand2
Components:
  pump : FB_DiscreteActuator
  valve1 : FB_DiscreteActuator
  valve2 : FB_AnalogActuator
  pressureSensor : FB_DataObject (AI)
  tempSensor : FB_DataObject (AI)
Internal wiring:
  pump.xRunSignal := valve1.xRunCmd OR valve2.xRunEnable
  pump.xExternalFault := pressureSensor.AsReal > 250.0
  valve1.xRunSignal := xCommand1
  valve2.xRunEnable := pump.xRunIndication
  // etc.
```

This can be expressed as a wiring recipe today, or as a visual graph in the future.
