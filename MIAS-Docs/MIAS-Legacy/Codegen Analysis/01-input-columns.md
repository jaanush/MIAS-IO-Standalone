# IO List — Input Column Reference

Source: `25432-852-Internal IO_list_Kopia_alveli.xlsx` · Sheet: `Internal IO-list`
Header row: **Row 3**. First data row: **Row 4**. Data extent: ~2828 rows.

## Column Classification Key
- **D** = Direct data entry (user types value)
- **F** = Formula / computed
- **D/F** = Usually entered but occasionally formula-driven

---

## Core Signal Identity (A–I) — All Direct Entry

| Col | Header | Type | Notes |
|-----|--------|------|-------|
| A | System | D | Top-level system grouping |
| B | Component identifier / drawing reference | D | Component tag from drawings |
| C | Signal name | D | **Key field** — empty = row ignored in all formulas |
| D | PLC / Distr IO Identifier | D | PLC/distributed IO node ID (e.g. `D01`) |
| E | PLC Location | D | Physical location label |
| F | IO Card identifier | D | Card ID (combined with D to form lookup key `D&"_"&F`) |
| G | Channel on Card | D | 1-based channel number on the IO card |
| H | Card type | D | Card article suffix — last 3 chars used (e.g. `495`, `652`) |
| I | Alarm/Signal Identifier | D | Encoded string — contains `A` = has alarm, `LL/L/H/HH` = analog limit indicators |

---

## Signal Characterisation (J–N) — Direct Entry

| Col | Header | Type | Notes |
|-----|--------|------|-------|
| J | IO type | D | `AI` / `AO` / `DI` / `DO` |
| K | Signal type / NO/NC | D | `NO` or `NC` — affects alarm inversion logic |
| L | Variable type (CoDeSys naming) | D | **Critical** — `BOOL`, `BIT`, `INT`, `WORD`, `REAL` — drives code generation branches |
| M | Unit | D | Engineering unit string (display only) |
| N | Global variable list name | D | **Critical** — e.g. `GVL_Physical`, `GVL_Settings` — determines output code target |
| O | Notes | D | Free text |
| P | Revision | D | Document revision |
| Q | IO Checked | D | Checkbox / status |

---

## Analog Scaling Parameters (R–XD) — Direct Entry

| Col | Header | Type | Notes |
|-----|--------|------|-------|
| R | Minimum value from/to IO (Raw) | D | Raw ADC minimum (e.g. 0 for 4–20 mA at 0) |
| S | Zero value from/to IO (Raw) | D | Raw value at physical zero |
| T | Maximum value from/to IO (Raw) | D | Raw ADC maximum |
| U | Actual value minimum | D | Engineering unit min (for scaling) |
| V | Actual value maximum | D | Engineering unit max (for scaling) |
| W | Gain | **F** | Computed from U/V/R/T — array formula |
| X | Offset | **F** | Computed from U/V/R/T — array formula |
| Y | Tank scaling structure name | D | If set → uses `FB_TankLevel` instead of standard analog block |
| Z | AnalogScaling FB override | D | Override function block name (default: `FB_AnalogueIn_DeadBand_rev3`) |
| AA | RawValueSensorFail override | D | Optional |
| AB | RawValueSensorFailMargin override | D | Optional |
| AC | SensorFailBehavior override | D | Optional |
| AD | SensorFailDelay override | D | Optional |
| AE | DeadBand Minimum IO (Raw) | D | |
| AF | DeadBand Zero IO (Raw) | D | |
| AG | DeadBand Max IO (Raw) | D | |

---

## Alarm Configuration (AI–AZ) — Direct Entry

| Col | Header | Type | Notes |
|-----|--------|------|-------|
| AI | Time delay digital alarm | D | Delay in ms/s (0 = no delay) |
| AJ | Alarm NO/NC | D | Override for alarm polarity (blank = use K) |
| AK | Limit low 1 (LL) | D | Analog low-low setpoint |
| AL | Time delay LL | D | |
| AM | Limit low 2 (L) | D | Analog low setpoint |
| AN | Time delay L | D | |
| AO | Limit high 1 (H) | D | Analog high setpoint |
| AP | Time delay H | D | |
| AQ | Limit high 2 (HH) | D | Analog high-high setpoint |
| AR | Time delay HH | D | |
| AS | Sensorfault delay | D | |
| AT | Alarm group A/B/C | D | Maps to priority: A=5, B=3, C=1 |
| AU | Suppression (as structured text) | D | ST expression for alarm suppression |
| AV | Alarm need special coding | D | Flag |
| AW | Special alarm block | D | Override function block name |
| AX | Alarm special input (setpoint, rpm etc.) | D | Extra parameter for special alarm FBs |
| AY | Custom alarm text | D | Replaces auto-generated alarm text |
| AZ | Block alarm D-LL-L-H-HH | D | 5-char bitmask — each `1` = alarm blocked. Position: `D`, `HH`, `H`, `L`, `LL` from left |
| BA | AnaAlarm to DigAlarm override | D | Forces analog alarm to be treated as digital |
| BB | Locked alarm no | D | Pre-assigned alarm number |
| BC | Locked alarm no. DIGITAL | D | |
| BD | Locked alarm no. ANALOGUE | D | |
| BE | COMMISSIONING TEMP Block alarm | D | Bitmask — blocks during commissioning |

---

## Hardware / Addressing (BF–BM) — Direct Entry

| Col | Header | Type | Notes |
|-----|--------|------|-------|
| BF | Modbus address or similar | D | Manual address override |
| BG | Persistent / retain variable | D | If set → adds `VAR_GLOBAL RETAIN` / `VAR_GLOBAL PERSISTENT` prefix |
| BH | Functionblock / struct name | D | If set → overrides the auto-generated tag name (full override) |
| BI | Functionblock / struct type | D | |
| BJ | Use short name in FB/struct | D | `Yes` → tag = `A&"_"&B` only (not full path) |
| BK | Blocked for FAT init | D | `Yes` → alarm blocked in AlarmInitFAT, forces blocked=TRUE |
| BL | Logging available | D | `Yes` → generates logging code in CK |
| BM | Component signal number | D | |

---

## Computed Intermediate Columns (BO–BW)

| Col | Header | Notes |
|-----|--------|-------|
| BO | Numbering without blanks | Row counter — increments for each non-empty C column. Used as signal index. |
| BP | Numbering without blanks ALARMS ONLY | Alarm sequence number — used in alarm FB names |
| BQ | Numbering without blanks DIGITAL ALARMS ONLY | Digital alarm index into `FactoryAlarmSettingsDigital[]` array |
| BR | Numbering without blanks ANALOGUE ALARMS ONLY | Analogue alarm index into `FactoryAlarmSettingsAnalogue[]` array |
| BS | Tag Name untrimmed (HIDDEN) | Full tag path before trim — complex SUBSTITUTE chain cleaning special chars |
| BT | Tag Name | Final trimmed tag name — leading/trailing `_` removed from BS |
| BU | Tag length | `LEN(BT) + LEN("ALARM000__ALARMSum")` — validation field |
| BV | Full tag name | `GVL_name.TagName` — GVL prefix resolved from N column |
| BW | Tag Name clear text | Human-readable: `TRIM(A & " " & B & ": " & C)` |

---

## Tag Name Construction Pipeline

```
A + B + C + D + F + G
        ↓
    BS: TRIM + SUBSTITUTE chain
    (removes: spaces→_, ?,(),%,/,-,,,: → _, special chars, double-underscores)
        ↓
    BT: Strip leading/trailing underscores from BS
        ↓
    BV: N_column_GVL_prefix + "." + BT
        (N="strSettings" → "GVL_Settings.Settings.TagName")
        (N="GVL_Physical" → "GVL_Physical.TagName")
        ↓
    BW: Plain text label (A + B + C)
```

**Override logic in BS:**
- If C contains "spare" → uses full path (A_B_C_D_F_G)
- If BJ="Yes" OR BH matches A_B pattern → uses short form (A_B only) + "." + C
- If BH is set → BH overrides the prefix entirely
- Default → full path (uses D, F, G components too)
