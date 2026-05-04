# Missing Fields — Function, Purpose, and Schema Recommendations

---

## 1. AnalogSignal.rawZero (Excel col S: "Zero value from/to IO")

**What it does:**
The physical zero point of the sensor in raw ADC units. For a simple 4–20 mA sensor this is the same as rawMin. Its real purpose is for **bidirectional signals** and **deadband scaling**. Example: a ±100 bar pressure sensor on 0–16383 ADC would have rawMin=0, rawZero=8192, rawMax=16383. The `FB_AnalogueIn_DeadBand_rev3` function block uses rawZero to define the center of the deadband — signals within ±deadband of rawZero output exactly zero, preventing noise from causing small non-zero readings.

**Schema addition — add to `AnalogSignal`:**
```prisma
rawZero  Decimal?  @db.Decimal(12,4) @map("raw_zero")
```

---

## 2. IoCarrier.modbusInputBase / modbusOutputBase (Excel: Card Offsets col O/P)

**What it does:**
The starting word address in the PLC's `BCInputData[]` / `BCOutputData[]` Modbus arrays for this carrier's channel block. Each carrier is a distributed IO node. The PLC programmer assigns a block of Modbus words to each carrier at project level. Without this, you can calculate the slot-relative offset (from IoCard positions) but you cannot produce the absolute `BCInputData[42]` index needed in CH/CI code generation.

**Example:** Carrier "D02" is assigned input base 100. It has an AI card in slot 1 (2 channels) and slot 2 (4 channels). Signals on slot 2 are at BCInputData[102], [103], [104], [105].

**Schema addition — add to `IoCarrier`:**
```prisma
modbusInputBase   Int?  @map("modbus_input_base")
modbusOutputBase  Int?  @map("modbus_output_base")
```

---

## 3. Alarm Group A/B/C (Excel col AT)

**What it does:**
METS_Lib groups alarms into three operational priority tiers:
- **A** = Critical / safety — triggers highest severity response, J-Mobile severity 5, red alarm
- **B** = Process warning — operator attention needed, J-Mobile severity 3
- **C** = Informational — log only, J-Mobile severity 1

This is passed as parameter 4 to `AssignSettingsDig` / `AssignSettingsAna` (mapped: A=0, B=1, C=2). The existing `AlarmSeverity` enum (INFO/WARNING/ALARM/CRITICAL) expresses a different concept — severity within the alarm — and doesn't cleanly map. Keep both: `severity` for the alarm type, `alarmGroup` for the operational tier.

**Schema addition — add to `DiscreteAlarm` and `AnalogAlarm`:**
```prisma
alarmGroup  String?  @db.Char(1) @map("alarm_group")  -- "A", "B", or "C"
```

Also add to `ComponentAnalogAlarm` and the discrete equivalent at component level (if a similar model is added).

---

## 4. Alarm Block Mask (Excel col AZ: "Block alarm D-LL-L-H-HH")

**What it does:**
A 5-character string where each position is "0" (active) or "1" (blocked). The positions are, **left to right**: `D` (digital / sensor fault), `HH` (high-high), `H` (high), `L` (low), `LL` (low-low).

Example: `"00100"` = H alarm is blocked, all others active.
Example: `"11111"` = all alarms blocked for this signal.

This is used in the `AssignSettingsAna` call — each blocked limit gets `TRUE` for its blocked parameter, which disables it in the PLC alarm system without deleting it. The setpoint value is still stored; the alarm just doesn't fire.

**Note:** In `AlarmInitFAT` (CJ column), if `BK=Yes` (FAT block flag), ALL positions are forced to `TRUE` regardless of this mask.

**Schema addition — add to `Signal`:**
```prisma
alarmBlockMask  String?  @db.VarChar(5) @map("alarm_block_mask")
```

*(One field on Signal covers all types — the 5 positions apply to both discrete and analogue. For discrete signals, only position 1 (D) is relevant.)*

---

## 5. FAT Block Flag (Excel col BK: "Blocked for FAT init")

**What it does:**
When `Yes`, this signal's alarm(s) are ALL blocked in the `AlarmInitFAT` POU — the code that initializes alarms for Factory Acceptance Testing. This is a separate initialization from the production `AlarmInit` (CB column). The FAT init forces blocked=TRUE on every limit regardless of the AZ mask, allowing the factory test to run without spurious alarms from sensors not yet connected.

**Schema addition — add to `Signal`:**
```prisma
fatBlock  Boolean  @default(false) @map("fat_block")
```

---

## 6. Commissioning Block Mask (Excel col BE: "COMMISSIONING TEMP Block alarm")

**What it does:**
Same 5-char mask format as AZ (D-HH-H-L-LL) but applied during commissioning mode. Certain signals need their alarms suppressed during initial site commissioning (e.g., a pressure transmitter not yet calibrated). This generates a separate commissioning assignment that can be toggled by the PLC program mode.

**Schema addition — add to `Signal`:**
```prisma
commBlockMask  String?  @db.VarChar(5) @map("comm_block_mask")
```

---

## 7. Alarm Suppression ST Expression (Excel col AU)

**What it does:**
A CoDeSys Structured Text expression that is assigned to `AlarmObject.Suppression`. When this expression evaluates to TRUE, the alarm is hidden from the operator (suppressed) but still monitored. Used for interlocks — e.g., "suppress low oil pressure alarm when engine is off":

```st
GVL_Alarms.Alarm042_PT_001_OilPressure.Suppression := NOT GVL_Modes.bEngineRunning;
```

This generates the CD output column directly. The expression is an arbitrary ST string referencing other GVL variables — it cannot be auto-generated and must be entered by the engineer.

**Schema addition — add to `Signal`:**
```prisma
suppressionSt  String?  @map("suppression_st")
```
*(No length limit — ST expressions can be long.)*

---

## 8. Special Alarm FB Override (Excel col AW) and Input Ref (Excel col AX)

**What it does (AW):**
Replaces the standard `FB_AlarmDigital` or `FB_AlarmAnalogue` with a project-specific alarm function block. Known values in use:
- `FB_Alarm_FollowSetpoint` — alarm that tracks a setpoint variable (e.g., speed alarm that adjusts its limit based on current RPM setpoint)
- `FB_AlarmAnalogue_LubrPress` — lubrication pressure alarm that compensates for RPM

When AW is set, it also changes which GVL_Alarms declaration is generated (CA uses `AW` as the type string directly).

**What it does (AX):**
The extra input parameter for the special FB. When AW=`FB_Alarm_FollowSetpoint`, AX is the setpoint variable path. When AW=`FB_AlarmAnalogue_LubrPress`, AX is the RPM variable path. Generates as an extra named parameter in the FB call:
```st
GVL_Alarms.Alarm007_...(Input:=..., SetpointPos:=GVL_Settings.SpeedSetpoint, ...);
```

**Schema addition — add to `Signal`:**
```prisma
specialAlarmFb     String?  @db.VarChar(100) @map("special_alarm_fb")
specialAlarmInput  String?  @db.VarChar(255) @map("special_alarm_input")
```

---

## 9. AnaAlarm to DigAlarm Override (Excel col BA)

**What it does:**
For analogue signals where the alarm should be treated as a binary on/off condition rather than limit-based. When set, the code generator uses `FB_AlarmDigital` (not `FB_AlarmAnalogue`) for this signal's alarm. The alarm `Input` becomes the full GVL variable (e.g., a BOOL status bit derived from the analogue value elsewhere in the PLC program) rather than the scaled output.

Use case: A flow switch that is technically an analogue input (4–20 mA) but is alarmed as "flow present / not present" — the engineer has already scaled it to a BOOL elsewhere.

**Schema addition — add to `Signal`:**
```prisma
anaToDigAlarm  Boolean  @default(false) @map("ana_to_dig_alarm")
```

---

## 10. Tank Level FB Flag (Excel col Y: "Tank scaling structure name")

**What it does:**
When non-empty, use `FB_TankLevel` instead of the standard `FB_AnalogueIn_DeadBand_rev3` for this signal's scaling. `FB_TankLevel` handles tanks with non-linear geometry (strapping tables) — the raw sensor reading is a level in mm but the output should be volume in liters, using a non-linear lookup. The value in col Y is a name used in the FB instance (`FB_TankLevel_{BO}`).

**Schema addition — add to `AnalogSignal`:**
```prisma
useTankLevel  Boolean  @default(false) @map("use_tank_level")
```

*(The instance name suffix is auto-generated from the signal sequence number at export time, so it doesn't need storing.)*

---

## 11. Analog Scaling FB Override (Excel col Z)

**What it does:**
Replaces the default `FB_AnalogueIn_DeadBand_rev3` with a different scaling function block. The default block handles standard linear scaling with deadband and sensor fault detection. Override is used when a signal needs different scaling behavior — e.g., a custom PT100 temperature block or a non-standard current input.

**Schema addition — add to `AnalogSignal`:**
```prisma
scalingFbOverride  String?  @db.VarChar(100) @map("scaling_fb_override")
```

---

## 12. SensorFail Overrides (Excel cols AA–AD)

**What they do:**
Override the default sensor failure detection parameters in `FB_AnalogueIn_DeadBand_rev3`:
- **AA (RawValueSensorFail):** The raw ADC value that indicates sensor failure. Default is typically 0 (wire break on 4–20 mA = 0 ADC). Override needed when a sensor has a different failure indication.
- **AB (RawValueSensorFailMargin):** Tolerance band around the fail value. Default varies by card type.
- **AC (SensorFailBehavior):** What to do on sensor failure — hold last value (`HOLD`), go to min, go to max. Passed as an enum string to the FB.
- **AD (SensorFailDelay):** How long (ms) to wait before declaring sensor failure and triggering the SF alarm.

**Schema addition — add to `AnalogSignal`:**
```prisma
sensorFailRaw       Decimal?  @db.Decimal(12,4) @map("sensor_fail_raw")
sensorFailMargin    Decimal?  @db.Decimal(12,4) @map("sensor_fail_margin")
sensorFailBehavior  String?   @db.VarChar(50)   @map("sensor_fail_behavior")
sensorFailDelayMs   Int?      @map("sensor_fail_delay_ms")
```

---

## 13. DeadBand Raw Values (Excel cols AE–AG)

**What they do:**
Define the raw ADC deadband zone passed to `FB_AnalogueIn_DeadBand_rev3`. Within this zone (around rawZero), the output is clamped to exactly zero. Purpose: prevent small sensor noise from causing non-zero readings when the physical value is truly zero.
- **AE:** DeadBand minimum (raw ADC value — lower edge of deadband)
- **AF:** DeadBand zero (raw ADC value that maps to exactly 0 output)
- **AG:** DeadBand maximum (raw ADC value — upper edge of deadband)

When all three are set, the scaling has a flat zone between AE and AG that outputs zero, useful for flow meters, position sensors, and torque sensors near zero.

**Schema addition — add to `AnalogSignal`:**
```prisma
deadbandRawMin   Decimal?  @db.Decimal(12,4) @map("deadband_raw_min")
deadbandRawZero  Decimal?  @db.Decimal(12,4) @map("deadband_raw_zero")
deadbandRawMax   Decimal?  @db.Decimal(12,4) @map("deadband_raw_max")
```

---

## 14. Persistent / Retain Flag (Excel col BG)

**What it does:**
Controls the CoDeSys variable storage class. Two distinct values:
- **RETAIN** — variable survives a warm restart (watchdog reset, program download). Survives power loss on battery-backed PLCs. Used for: trip counters, resettable values, operator setpoints that should persist across reboots.
- **PERSISTENT** — variable survives cold restart AND power cycle. Stored to non-volatile flash. Used for: factory calibration values, long-term counters.

When BG is set, the BY output wraps the GVL declaration with `END_VAR VAR_GLOBAL RETAIN` or `END_VAR VAR_GLOBAL PERSISTENT`.

**Schema addition — add to `Signal`:**
```prisma
isRetain      Boolean  @default(false) @map("is_retain")
isPersistent  Boolean  @default(false) @map("is_persistent")
```

*(Mutually exclusive in practice — persistent implies retain — but store separately to match the source data.)*

---

## 15. Logging Enable (Excel col BL)

**What it does:**
When "Yes", generates `AnyConversion(GVL.TagName, logNo)` in the Logging POU. This connects the signal to the WAGO data logging system, which periodically samples and stores the value to flash or SD card. The `logNo` is a sequential number (CL column) among all logged signals.

**Schema addition — add to `Signal`:**
```prisma
loggingEnabled  Boolean  @default(false) @map("logging_enabled")
```

---

## 16. FB / Struct Name Override (Excel col BH)

**What it does:**
Overrides the auto-generated tag name prefix entirely. Normally the tag is constructed as `System_Component.SignalName` or `PLC_Card_Channel.SignalName`. When BH is set, it replaces the prefix (the part before the dot). Used when a signal belongs to a named function block that doesn't follow the standard naming convention — e.g., a signal that is part of `FB_PumpStation_01` would have BH = `FB_PumpStation_01`.

Also used in a special way: if BH equals the SUBSTITUTE-cleaned version of `A&"_"&B`, it triggers "short name" mode without BJ being set (the formula handles this via equality check).

**Schema addition — add to `Signal`:**
```prisma
fbNameOverride  String?  @db.VarChar(255) @map("fb_name_override")
```

---

## 17. Use Short Name Flag (Excel col BJ)

**What it does:**
When "Yes", the tag prefix uses only `System_Component` (A+B columns) instead of the full hardware path `System_Component_PLC_Card_Channel` (A+B+D+F+G). Used for signals that are logically associated with a component but physically wired to different cards on different systems — the hardware address is irrelevant to the tag identity.

**Schema addition — add to `Signal`:**
```prisma
useShortName  Boolean  @default(false) @map("use_short_name")
```

---

## Consolidated Schema Additions

### `Signal` model additions
```prisma
// Alarm configuration
alarmGroup      String?   @db.Char(1)    @map("alarm_group")       -- A/B/C
alarmBlockMask  String?   @db.VarChar(5) @map("alarm_block_mask")  -- "D-HH-H-L-LL" 5-char bitmask
commBlockMask   String?   @db.VarChar(5) @map("comm_block_mask")   -- same format
fatBlock        Boolean   @default(false) @map("fat_block")
suppressionSt   String?   @map("suppression_st")
specialAlarmFb  String?   @db.VarChar(100) @map("special_alarm_fb")
specialAlarmInput String? @db.VarChar(255) @map("special_alarm_input")
anaToDigAlarm   Boolean   @default(false) @map("ana_to_dig_alarm")
// Code generation flags
isRetain        Boolean   @default(false) @map("is_retain")
isPersistent    Boolean   @default(false) @map("is_persistent")
loggingEnabled  Boolean   @default(false) @map("logging_enabled")
fbNameOverride  String?   @db.VarChar(255) @map("fb_name_override")
useShortName    Boolean   @default(false) @map("use_short_name")
```

### `AnalogSignal` model additions
```prisma
// Scaling
rawZero          Decimal?  @db.Decimal(12,4) @map("raw_zero")
useTankLevel     Boolean   @default(false)   @map("use_tank_level")
scalingFbOverride String?  @db.VarChar(100)  @map("scaling_fb_override")
// Deadband
deadbandRawMin   Decimal?  @db.Decimal(12,4) @map("deadband_raw_min")
deadbandRawZero  Decimal?  @db.Decimal(12,4) @map("deadband_raw_zero")
deadbandRawMax   Decimal?  @db.Decimal(12,4) @map("deadband_raw_max")
// Sensor failure detection overrides
sensorFailRaw      Decimal?  @db.Decimal(12,4) @map("sensor_fail_raw")
sensorFailMargin   Decimal?  @db.Decimal(12,4) @map("sensor_fail_margin")
sensorFailBehavior String?   @db.VarChar(50)   @map("sensor_fail_behavior")
sensorFailDelayMs  Int?      @map("sensor_fail_delay_ms")
```

### `DiscreteAlarm` and `AnalogAlarm` additions
```prisma
alarmGroup  String?  @db.Char(1) @map("alarm_group")  -- A/B/C
```

### `IoCarrier` additions
```prisma
modbusInputBase   Int?  @map("modbus_input_base")
modbusOutputBase  Int?  @map("modbus_output_base")
```

---

## What to Skip / Defer

| Field | Reason |
|-------|--------|
| `specialAlarmFb` / `specialAlarmInput` | Edge case — only a handful of signals in a project. Implement as last step. |
| `commBlockMask` | Can default to same as `alarmBlockMask` — rarely differs. Defer. |
| `fbNameOverride` / `useShortName` | Tag naming edge cases — the auto-generated tag is correct for 95% of signals. |
| `sensorFailOverrides` | The FB defaults handle most cases. Add only if import requires it. |
| `scalingFbOverride` | Very rare. Standard block handles everything but tank levels. |
| Pre-assigned alarm numbers (BB/BC/BD) | Used only when alarm numbers must be stable across projects. Not needed for generation, only for locking. |

## Recommended Implementation Order

1. **`IoCarrier.modbusInputBase/OutputBase`** — small migration, unlocks CH/CI generation entirely
2. **`AnalogSignal.rawZero`** — one field, enables proper deadband scaling output
3. **`DiscreteAlarm.alarmGroup`, `AnalogAlarm.alarmGroup`** — enables correct METS_Lib priority assignment
4. **`Signal.alarmBlockMask`, `fatBlock`** — enables AlarmInitFAT generation
5. **`Signal.loggingEnabled`, `isRetain`, `isPersistent`** — simple boolean flags, no UI complexity
6. **`Signal.suppressionSt`** — just a text field, but important for correctness
7. **`AnalogSignal.useTankLevel`, deadband fields** — complete analog scaling coverage
