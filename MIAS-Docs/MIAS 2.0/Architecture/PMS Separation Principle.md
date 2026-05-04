# PMS Separation Principle — Operation vs Configuration

## Core Rule

The PMS has exactly one job: **distribute power by writing setpoints to components based on their reported properties and priorities.**

Everything else — deciding what's available, handling user commands, managing physical start sequences — belongs to the component layer.

## Three Layers

```
┌─────────────────────────────────────────────┐
│  CONFIGURATION (user-driven)                │
│  Ship mode, lever, start/stop overrides,    │
│  charge targets, connect commands           │
│  Writes to: component configuration inputs  │
├─────────────────────────────────────────────┤
│  COMPONENT (self-managing)                  │
│  Reports: Min/Max/mMin/mMax/pPrio/cPrio/ROC │
│  Handles: physical lifecycle, interlocks,   │
│  start sequences, fault recovery            │
│  Reads: PMS setpoint                        │
│  Writes: hardware commands (CAN, Modbus)    │
├─────────────────────────────────────────────┤
│  PMS (autonomous balancer)                  │
│  Reads: component properties                │
│  Writes: setpoints only                     │
│  Never touches: configuration, lifecycle    │
└─────────────────────────────────────────────┘
```

## What the PMS does

- Reads all component properties each cycle
- Sums mMax/mMin to determine system balance
- Applies DC bus PID trim
- Sorts by priority
- Allocates power: writes setpoint to each component
- Detects blackout/shortage

## What the PMS does NOT do

- Start or stop any component
- Decide ship mode
- React to operator commands
- Handle breaker sequences, precharge, synchronization
- Manage BMS communication or string connection
- Apply interlocks or safety logic

## How components report availability

**Critical principle: components report what they CAN provide, not what they ARE providing.**

A genset that is stopped but available reports its full rated mMax. The PMS may then send it a non-zero setpoint, which the genset component interprets as "start and deliver this much power." The genset handles the physical start sequence internally — preheating, ramping RPM, loading — and its actual delivered power (`Current`) gradually approaches the setpoint.

A component reports mMax = 0 only when:
- The user has explicitly put it offline (StartStopMode = ForcedOff)
- It has a fault that prevents operation
- It's physically disconnected (comm loss, breaker open, etc.)

This means the PMS doesn't need to know WHY a component can't deliver — it just sees mMax = 0 and allocates elsewhere.

## Examples

### Genset auto-start (how it actually works)
1. Genset is stopped but in Auto mode
2. Genset component reports mMax = 130kW (its rated capacity)
3. Batteries are discharging, SOC dropping, but PMS has enough power — genset setpoint = 0
4. Load increases, PMS calculates shortage, sends genset setpoint = 80kW
5. Genset component receives setpoint > 0 → starts engine internally (preheat, ramp, etc.)
6. Genset `Current` gradually rises from 0 toward 80kW as engine reaches operating state
7. PMS continuously adjusts setpoint based on actual balance

The PMS never issued a "start" command. It just said "I need 80kW from you" and the genset figured out how to deliver.

### Battery discharge limiting
1. Battery BMS reports MaxDischarge = 200A → component calculates mMax = 150kW
2. PMS sees 150kW available from battery
3. BMS suddenly reduces MaxDischarge = 50A (cell overtemp) → component reports mMax = 37kW
4. PMS sees reduced availability → curtails consumers in next cycle
5. Battery component didn't need a command — it just reported its new state

### Shore connection
1. Operator presses "Connect Shore" on HMI → configuration input
2. Shore component handles precharge sequence, breaker closing, sync
3. Once connected: component reports mMax = available shore power
4. PMS sees new provider, adjusts allocation (reduces genset setpoint, increases shore)
5. Shore component was never "started by PMS" — it was started by operator configuration

### Propulsion
1. Operator moves lever → configuration input (via Kongsberg PCS analog signal)
2. Propulsion component translates lever to power request → reports mMin = -150kW (consumer)
3. PMS checks available power, sends setpoint = -150kW (full request) or less if shortage
4. Propulsion component converts setpoint to RPM reference for Editron MC
5. If PMS curtails to -80kW, propulsion reduces speed — operator sees reduced thrust

## Configuration inputs (user-driven)

| Input | Source | Affects |
|-------|--------|---------|
| Ship mode (Off/Harbor/Sea) | HMI | Priority presets for all components |
| Lever position | Kongsberg PCS analog | Propulsion power request (mMin) |
| Start/stop mode override | HMI per component | ForcedOff → mMax/mMin = 0 |
| Connect shore | HMI | Shore component starts connection sequence |
| Charge target / hysteresis | HMI settings | Battery fully-charged logic |
| Genset in auto | HMI toggle | Whether genset reports capacity or stays offline |
| Lever response mode | HMI | Propulsion ramp rates and lever curve |
| Battery emergency override | HMI | Allows operation below safe SOC |

None of these go through the PMS. They go directly to the component, which updates its properties accordingly. The PMS sees the result.

## Momentary Power, Rate of Change & Spinning Reserve

### mMax/mMin vs Max/Min

The distinction between rated capacity (Max/Min) and momentary capacity (mMax/mMin) is central to the PMS:

- **Max/Min** — what the component can deliver/consume when fully operational. Static or slowly changing.
- **mMax/mMin** — what it can deliver/consume *right now*, accounting for current state. Changes every cycle.

A genset at idle with engine warm might report: Max = 130kW, mMax = 20kW (current output + what it can ramp to within its ROC). As the engine ramps up, mMax gradually approaches Max. The PMS uses mMax for allocation — it knows it can't get 130kW instantly from a genset that just started.

A battery reports mMax equal to BMS MaxDischarge × Voltage — this can change rapidly based on temperature, SOC, and cell state. The PMS reacts to the change within one cycle.

### Rate of Change (ROC)

ROC tells the PMS how fast a component can respond to setpoint changes (kW/s). This is used for:

1. **Setpoint ramping** — `FB_PMSComponent` rate-limits the setpoint target so components aren't asked to jump faster than they can respond
2. **Allocation planning** — fast components (battery: high ROC) can cover transients while slow components (genset: low ROC) ramp up

ROC is dynamic. A genset in preheat has effectively ROC = 0 (can't increase load). Once at operating RPM, ROC reflects how fast the engine governor can accept load.

### Spinning Reserve

The PMS must ensure that a configurable amount of power is available at a moment's notice — the spinning reserve. This is power that mMax exceeds current demand by.

**Implementation:** Add to `FB_PMS`:
```
rSpinningReserve : REAL := 50.0;  // kW that must be instantly available
```

In the allocation cycle: after calculating balance, verify that `SUM(mMax of fast providers) - SUM(current consumer demand) >= rSpinningReserve`. If not:
- Start additional providers (by allocating setpoint to idle providers, which triggers their start sequence)
- Curtail low-priority consumers to maintain reserve

"Fast providers" means components with ROC above a threshold — a genset in preheat doesn't count as spinning reserve because it can't deliver instantly, but a running genset with spare capacity does, and a connected battery always does (high ROC).

### Component-Influenced Priority

Components can and should adjust their own priority based on local state. The base priority comes from the ship mode preset table, but the component adds a dynamic offset in `UpdateDynamic()`.

**Examples:**

| Component | Condition | Priority Adjustment |
|-----------|-----------|-------------------|
| Battery | SOC dropping below 20% | Increase cPrio (wants to charge more urgently) |
| Battery | SOC below 10% | cPrio → maximum (emergency charge demand) |
| Battery | Fully charged | cPrio → 0 (no charge needed), reduce pPrio slightly (prefer genset to top up) |
| Genset | Just started, in preheat | pPrio unchanged, but mMax is low (PMS sees limited availability naturally) |
| Genset | Running at max load for >10min | Could reduce pPrio to signal stress, encourage battery takeover |
| Propulsion | Operator in High response mode | Increase cPrio (operator expects responsive thrust) |
| Shore | Overload condition | Reduce mMax (physical limit), pPrio stays high |
| Non-essential | PMS has been curtailing for >30s | Could reduce cPrio further (graceful degradation) |

**Implementation pattern:**
```
METHOD UpdateDynamic
  // Start from ship mode preset
  _usiCPrio := modePreset.usiCPrio;
  
  // Local state adjustment
  IF rBatteryLevel < 20.0 THEN
    _usiCPrio := MIN(100, _usiCPrio + 30);  // More urgently wants to charge
  END_IF
  IF rBatteryLevel < 10.0 THEN
    _usiCPrio := 100;  // Emergency — charge me now
  END_IF
```

The priority adjustment range should be bounded — a component can influence its priority within a configured span, but cannot override the fundamental ship mode intent. For example, a battery in Sea mode shouldn't raise its cPrio above propulsion's cPrio just because it's low on charge — the operator chose Sea mode knowing propulsion is essential.

**Configurable bounds per component:**
```
usiPrioAdjustMin : USINT := 0;    // Component can't reduce below this
usiPrioAdjustMax : USINT := 100;  // Component can't raise above this
rPrioHealthSpan  : REAL := 30.0;  // Max adjustment range from base preset
```

This keeps the system predictable while allowing components to signal their state to the PMS. The operator always has the final word via ship mode and manual overrides.

## Implications for MIAS-IO

MIAS-IO configures the system by:
1. Defining components (hardware topology, CAN node addresses, rated capacities)
2. Setting priority presets per ship mode (the priority table)
3. Setting component parameters (charge targets, ramp times, alarm thresholds)
4. Generating the GVL declarations, init code, and HMI widgets

MIAS-IO never generates PMS logic. The PMS is generic and unchanged between projects. Only the components and their configuration change.
