# Data Completeness Assessment — Can MIAS-IO Generate These Exports?

Source: Analysis of `25432-852-Internal IO_list_Kopia_alveli.xlsx`
Compared against: MIAS-IO database schema (`prisma/schema.prisma`)

---

## Summary Verdict

| Export | Status | Confidence |
|--------|--------|-----------|
| CoDeSys GVL declarations (BY) | **POSSIBLE** — schema has field, needs data populated | High |
| CoDeSys variable FB declarations (BX) | **POSSIBLE** | High |
| Alarm GVL declarations (CA) | **POSSIBLE** | High |
| Alarm INIT code (CB) | **MOSTLY POSSIBLE** — minor gaps remain | Medium-High |
| Alarm cyclic code (CC) | **MOSTLY POSSIBLE** — minor gaps remain | Medium-High |
| Alarm suppression (CD) | **POSSIBLE** | High |
| Analog scaling GVL (CE) | **POSSIBLE** | Medium-High |
| Analog scaling body (CF) | **POSSIBLE** | Medium-High |
| Modbus address mapping (CG/CH/CI) | **CALCULABLE** — derivable from hardware tree slot layout | Medium |
| Logging (CK) | **POSSIBLE** | High |
| J-Mobile alarm export (AlarmsToExor) | **POSSIBLE** — all data derivable | Medium-High |

---

## What MIAS-IO Has (Confirmed in Schema)

| Field | Schema Location | Excel Equivalent |
|-------|----------------|-----------------|
| GVL assignment | `Signal.gvlId -> GlobalVariableList` | Col N — **field exists, needs data** |
| CoDeSys data type | `DiscreteSignal.plcDataTypeId -> PlcDataTypeCatalog` | Col L — **field exists, needs data** |
| | `AnalogSignal.plcDataTypeId -> PlcDataTypeCatalog` | |
| | `BusSignal.plcDataType` (enum, populated for bus signals) | |
| | `ComponentSignal.plcDataTypeId -> PlcDataTypeCatalog` | |
| IO type (DI/DO/AI/AO) | `ComponentSignal.ioType` | Col J |
| Discrete trigger NO/NC | `ComponentSignal.defaultTrigger`, `DiscreteSignal.trigger` | Col K |
| Analog scale min/max (engineering units) | `AnalogSignal.scaleMin/scaleMax` | Cols U/V |
| | `ComponentSignal.defaultScaleMin/Max` | |
| Raw ADC min/max | `AnalogSignal.rawMin/rawMax` | Cols R/T |
| Analog alarm setpoints + delays | `AnalogAlarm.setpoint, delaySeconds` per condition (HIGH/HIGH_HIGH/LOW/LOW_LOW) | Cols AK-AR |
| | `ComponentAnalogAlarm` — same at template level | |
| Discrete alarm delay | `DiscreteAlarm.delaySeconds` | Col AI |
| Alarm severity | `DiscreteAlarm.severity`, `AnalogAlarm.severity` (ALARM/WARNING/CRITICAL) | Maps to group A/B/C |
| Custom alarm text | `DiscreteAlarm.message`, `AnalogAlarm.message` | Col AY |
| Hardware tree | `Plc`, `IoCarrier`, `IoCard`, `IoCard.slotPosition` | Cols D/F/G |
| Card channel counts | `IoCard.maxInputChannels/maxOutputChannels` | Basis for address calculation |
| Card type | `IoCard.cardType` (DI/DO/AI/AO/MIXED/...) | Col H |
| Engineering units | `EngineeringUnit` (global) | Col M |
| Bus addressing | `BusSignal.registerOffset`, `canId`, `canopenIndex`, etc. | Col BF |
| Signal system grouping | `SignalSystem` model | Col A (System) |
| Drawing/component reference | `Signal.drawingRef`, `Signal.componentTag` | Col B |
| PdoConfig | `PdoConfig` (CANopen PDO params) | N/A in spreadsheet |

---

## Genuine Schema Gaps (Still Missing)

| Required Field | Excel Source | Notes |
|---------------|-------------|-------|
| Alarm group A/B/C (AT) | Priority group | `AlarmSeverity` is ALARM/WARNING/CRITICAL — need A/B/C mapping for METS_Lib |
| Alarm block bitmask (AZ) | 5-char D-LL-L-H-HH per-limit block flags | No per-limit blocked flag |
| Commissioning block mask (BE) | Block alarms during commissioning | |
| FAT block flag (BK) | Block for Factory Acceptance Test init | |
| Alarm suppression ST expression (AU) | `.Suppression := ST_expression;` | |
| Special alarm FB override (AW) | e.g. `FB_Alarm_FollowSetpoint`, `FB_AlarmAnalogue_LubrPress` | |
| Special alarm input ref (AX) | Variable ref for setpoint/RPM parameter | |
| AnaAlarm-to-DigAlarm override (BA) | Force analogue signal to use `FB_AlarmDigital` | |
| Tank scaling flag (Y) | Use `FB_TankLevel` instead of `FB_AnalogueIn` | |
| AnalogScaling FB override (Z) | Non-default scaling block name | |
| SensorFail overrides (AA-AD) | RawValueSensorFail behavior params | |
| DeadBand raw values (AE-AG) | Min/Zero/Max raw for deadband | |
| Raw zero point (S) | Zero raw value (offset point between min and max) | `rawMin`/`rawMax` exist but not `rawZero` |
| Persistent/retain flag (BG) | `VAR_GLOBAL RETAIN` or `PERSISTENT` | |
| FB/struct name override (BH) | Overrides generated tag prefix entirely | |
| Use short name flag (BJ) | Use A+B path only (not D+F+G) in tag | |
| Logging enable (BL) | Enable `AnyConversion()` logging for this signal | |
| Pre-assigned alarm number (BB/BC/BD) | Fixed alarm index override | |
| Alarm NO/NC override per-signal (AJ) | Overrides card-level K column | |

---

## Gap Analysis by Export Section

### 1. GVL Declarations (BY) — Variable declarations

**Status:** Schema-ready. `Signal.gvlId -> GlobalVariableList` and `plcDataTypeId -> PlcDataTypeCatalog` both exist.

**Remaining work:** Ensure data is populated when signals are created/imported. The GVL name drives which `.gvl` file the variable goes into. The `plcDataType` drives the declared type — without it, generation falls back to guessing from `ioType`.

---

### 2. Alarm Code (CA/CB/CC/CD)

**What works:**
- Alarm type (DIG/ANA) — derivable from `ioType` + `signalType`
- Alarm number (BP/BQ/BR) — auto-numbered at export time
- Alarm setpoints, delays — `AnalogAlarm` / `DiscreteAlarm` have setpoint, delay, severity
- Custom alarm text — `DiscreteAlarm.message` / `AnalogAlarm.message`

**What is missing:**
- **Alarm group A/B/C** — maps to priority 5/3/1 in J-Mobile and group param in `AssignSettingsDig`. Could derive from severity (CRITICAL=A, ALARM=B, WARNING=C) but this needs confirmation.
- **Block mask (AZ)** — which of D/LL/L/H/HH limits are blocked. One option: treat `AnalogAlarm` absence as blocked.
- **FAT block / commissioning block** — separate flags needed.
- **Suppression expression** — ST code string, no equivalent field.
- **Special alarm FB / input** — edge cases for lubrication pressure, follow-setpoint alarms.

---

### 3. Analog Scaling (CE/CF)

**What works:**
- `AnalogSignal.rawMin/rawMax` covers R and T columns
- `AnalogSignal.scaleMin/scaleMax` covers U and V
- Gain/Offset are computed (W = (scaleMax-scaleMin)/(rawMax-rawMin), X = offset)

**What is missing:**
- **rawZero (S column)** — the zero-point for deadband scaling. Add `rawZero: Decimal?` to `AnalogSignal`.
- **Tank level FB flag** — add boolean or string to `AnalogSignal`.
- **SensorFail overrides** — edge case fields.
- **DeadBand raw values** — add min/zero/max deadband to `AnalogSignal`.

---

### 4. Card Offsets / Modbus Address Calculation (CG/CH/CI)

**Status: Calculable** — the spreadsheet's "Card Offsets" sheet is not a static lookup table; it is itself computed from the hardware layout. The same logic can be implemented in MIAS-IO.

**Calculation algorithm:**

For each carrier (distributed IO node):
1. Sort `IoCard` rows by `slotPosition` ascending
2. Walk through cards in order, accumulating separate counters:
   - `diWordOffset` — bit address for DI signals (1 bit per channel, counted in bits, address as `word.bit`)
   - `doWordOffset` — bit address for DO signals
   - `aiWordOffset` — word address for AI signals (1 word per channel)
   - `aoWordOffset` — word address for AO signals
3. For each card:
   - Record its start addresses (the accumulated offsets at time of processing)
   - Add `maxInputChannels` or `maxOutputChannels` to the appropriate counter
4. The AT address for a signal on channel G = `start_address + G - 1`

**Inputs available in MIAS-IO:**
- `IoCard.slotPosition` — sort key
- `IoCard.cardType` — determines which counter to increment (DI/DO/AI/AO)
- `IoCard.maxInputChannels`, `IoCard.maxOutputChannels` — how many addresses each card consumes
- `IoCarrier` — the container (maps to the distributed IO node `D`)
- `IoCarrier.nodeAddress` — the Modbus unit ID / node ID

**One missing piece:** The base word offset for each carrier's address space within the PLC's Modbus map. In the spreadsheet the `O` and `P` columns in Card Offsets hold "INPUT Offset due to different jobs" and "OUTPUT Offset". This is a per-carrier configuration value (what word address does this carrier's inputs start at). Add `IoCarrier.modbusInputBase: Int?` and `IoCarrier.modbusOutputBase: Int?` to enable full computation.

---

## Priority Schema Additions

### P1 — Unblocks most generation (small additions, large impact)
1. Ensure `Signal.gvlId` is populated for all signals (data task, no schema change)
2. Ensure `plcDataTypeId` is populated on `DiscreteSignal`/`AnalogSignal` (data task)
3. Add `AnalogSignal.rawZero: Decimal?` — the zero-point for scaling
4. Add `IoCarrier.modbusInputBase: Int?` and `IoCarrier.modbusOutputBase: Int?` — enables CG/CH/CI

### P2 — Alarm configuration
5. Add alarm group field — either map severity to A/B/C, or add explicit `alarmGroup: String?` (A/B/C)
6. Add `alarmBlockMask: String?` to `DiscreteAlarm`/`AnalogAlarm` (or per-signal)
7. Add `fatBlock: Boolean` to alarm config
8. Add `commissioningBlock: String?` bitmask

### P3 — Analog scaling edge cases
9. Add `AnalogSignal.useTankLevelFb: Boolean`
10. Add `AnalogSignal.scalingFbOverride: String?`
11. Add `AnalogSignal.deadbandRawMin/Zero/Max: Decimal?`

### P4 — Alarm code generation edge cases
12. Add `Signal.suppressionSt: String?`
13. Add `Signal.specialAlarmFb: String?`
14. Add `Signal.specialAlarmInputRef: String?`
15. Add `Signal.anaToDigAlarm: Boolean`
16. Add `Signal.isRetain: Boolean`, `Signal.isPersistent: Boolean`
17. Add `Signal.loggingEnabled: Boolean`

---

## Fields Already Mapped (No Action Needed)

| Excel Column | MIAS-IO Field | Match Quality |
|-------------|---------------|---------------|
| A (System) | `SignalSystem` | Good |
| B (Component) | `Signal.componentTag` / `HardwareComponent.name` | Good |
| C (Signal name) | `Signal.description` / `ComponentSignal.description` | Good |
| D (PLC ID) | `Plc.name` | Good |
| F (IO Card ID) | `IoCarrier.name` + slot | Composite |
| G (Channel) | `Signal.channelPosition` / `ComponentSignal.channelOffset` | Direct |
| H (Card type) | `IoCard.cardType` + `ModuleCatalog.articleNumber` | Derivable |
| J (IO type) | `ComponentSignal.ioType` | Direct |
| K (NO/NC) | `ComponentSignal.defaultTrigger` | Direct |
| L (CoDeSys type) | `PlcDataTypeCatalog` via `plcDataTypeId` | Direct (needs data) |
| N (GVL name) | `GlobalVariableList` via `gvlId` | Direct (needs data) |
| AK-AR (alarm limits) | `AnalogAlarm` per condition | Direct |
| AI (digital delay) | `DiscreteAlarm.delaySeconds` | Direct |
| AY (custom text) | `DiscreteAlarm.message` / `AnalogAlarm.message` | Direct |
