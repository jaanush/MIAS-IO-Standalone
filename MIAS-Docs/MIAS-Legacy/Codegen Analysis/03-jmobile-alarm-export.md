# J-Mobile Alarm Export — AlarmsToExor Sheet Reference

Source: `25432-852-Internal IO_list_Kopia_alveli.xlsx` · Sheet: `AlarmsToExor`
Rows: ~6186 · Columns: A–DC (107 columns)

---

## Architecture Overview

The `AlarmsToExor` sheet is a **flattened alarm table** for export to Exor J-Mobile HMI panels. It is **not** a 1:1 mirror of the IO list. Each analogue alarm signal produces **5 rows** (LL, L, H, HH, SF = Sensor Fault) and each digital alarm produces **1 row**. The sheet references the IO list via VLOOKUP/INDEX/MATCH using alarm sequence numbers (`BP`, `BQ`, `BR`).

**Row structure (rows 3+):** Each alarm entry is the "master" row (row N, integer E counter). Rows N+1 through N+4 expand analogue sub-alarms referencing the master row (using `$K3`, `$M3`, `$E3` etc. — note absolute reference to master).

---

## Key Columns in AlarmsToExor

### Identification / Source Link

| Col | Header | Formula / Notes |
|-----|--------|-----------------|
| A | Tempnum0 | Internal counter |
| B | Tempnum1 | Internal sub-counter (1 = master, 1–5 = ANA sub-rows) |
| C | PLC name | Hard-coded `'PLC'` |
| D | GVL name | `=INDEX('Internal IO-list'.$N$4:$N$2828, MATCH($E3, ...BP..., 0))` — pulls GVL from IO list |
| E | Alarm no | Sequential counter: `=MAX($E$2:$E2)+1` |
| F | Tagname | `=SUBSTITUTE(VLOOKUP($E3, ...$BP→$BT..., BT_col, FALSE), ".", "_")` |
| G | Tagname truncated | `=IF(RIGHT(LEFT(F3,$G$2),1)="_", LEFT(F3,$G$2-1), LEFT(F3,$G$2))` — max 255 chars |
| H | Alarm text | Array formula — from IO list C (signal name) + A + B |
| I | Activated alarms | From IO list column I (alarm identifier string) |
| J | Custom alarm text used | `=IF(AY<>"", AY, "")` — pulls custom text from IO list |
| K | Type of Alarm | `=VLOOKUP($E3, ...$BP→$BZ..., BZ_col, FALSE)` — "DIG" or "ANA" |
| L | Numbering w/o blanks DIGITAL | `=VLOOKUP($E3, ...$BP→$BQ..., BQ_col, FALSE)` |
| M | Numbering w/o blanks ANALOGUE | `=VLOOKUP($E3, ...$BP→$BR..., BR_col, FALSE)` |

### J-Mobile Event / Alarm Properties

| Col | Header | Default Value | Notes |
|-----|--------|---------------|-------|
| N | eventBuffer | `AlarmBuffer1` | Fixed |
| O | logToEventArchive | `TRUE` | Fixed |
| P | eventType | `14` | Fixed |
| Q | subType | `1` | Fixed |
| R | storeAlarmInfo | `TRUE` | Fixed |
| S | name | `="Alarm"&TEXT($E3,"000")` | e.g. `Alarm001` — unique alarm name |
| T | groups | From IO list AT column (A/B/C) | Pulled via INDEX/MATCH |
| U | source | Array formula — `abAlarmAnalogueStateHMI` for ANA sub-rows |
| V | index | Array formula — `(M3*5)-5/4/3/2/1` for ANA LL/L/H/HH/SF |
| W | arrayType | `TRUE` |  |
| X | alarmType | `bitMaskAlarm` | Fixed |
| Y | lowLimit | Default `1000` |  |
| Z | highLimit | `1000` | Fixed default |
| AB | bitMask | `2` | Fixed |
| AC | deviation | `50` | Fixed |
| AD | setPoint | `20` | Fixed |
| AF | remoteAck | Array — `axAlarmAnalogueAcksHMI` for ANA sub-rows |
| AG | index2 | Array — `(M3*5)-5/4/3/2/1` for ANA sub-rows |
| AH | arrayType3 | `TRUE` | Fixed |
| AI | ackNotify | Fixed `""` unless HIDEALWAYS mode |
| AJ | enabled | `TRUE` | Fixed |
| AK | requireAck | `TRUE` | Fixed |
| AN | severity | Array — `A→5, B→3, C→1` from groups column T |
| AO | priority | `3` | Fixed |
| AP | logMask | `76` | Fixed |
| AQ | notifyMask | `76` | Fixed |
| AR | actionMask | `1` | Fixed |
| AS | printMask | `1` | Fixed |

### Alarm Text (Language)

| Col | Header | Notes |
|-----|--------|-------|
| AT | L1 (Lang1 alarm text) | Array formula — builds alarm text per sub-type |
| AU | langName | `Lang1` |
| AV | L14 | `=$K3` (alarm type label) |
| AW | langName5 | `Lang1` |

### Visual Style (Fixed color scheme)

| State | Text color | Background |
|-------|------------|-----------|
| Acked | `#ff0000` | `#ffff00` |
| Disabled | `#000000` | `#999999` |
| Triggered | `#000000` | `#f14216` |
| Not triggered | `#000000` | `#ffffff` |
| Triggered+Acked | `#000000` | `#e6e600` |
| Triggered+NotAcked | `#000000` | `#f14216` |
| NotTriggered+Acked | `#000000` | `#ffffff` |
| NotTriggered+NotAcked | `#000000` | `#74d900` |

### Alarm Text Construction (AT column — Lang1)

**Analogue alarm sub-rows (rows 4–8 relative to master at row 3):**
- Row 4 (LL, sub `_LL`): `{E3}{J3_prefix}A. {H3} - {Pre-defined texts B7}` (if LL activated in I3)
- Row 5 (L, sub `_L`): `{E3}{J3_prefix}B. {H3} - {Pre-defined texts B6}` (if L activated)
- Row 6 (H, sub `_H`): `{E3}{J3_prefix}C. {H3} - {Pre-defined texts B4}` (if H activated)
- Row 7 (HH, sub `_HH`): `{E3}{J3_prefix}D. {H3} - {Pre-defined texts B5}` (if HH activated)
- Row 8 (SF, sub `_SF`): `{E3}E. {H3} - Sensor Fault` (if GVL_Physical)

**Prefix logic:** If J (custom text) = "" → prefix = `"A. "` etc.; otherwise `". "`

**Pre-defined texts sheet:** Provides standard alarm suffix strings (e.g., "Too high", "Too low", "Sensor Fault").

### AlarmTable Output for JavaScript (CY / CZ / DA–DC)

| Col | Header | Content |
|-----|--------|---------|
| CX | AlarmTable array posno | `=MAX($E$2:$E2)+1` — position number |
| CY | AlarmTable array | Full JavaScript object: `project.AlarmTable[{CX}]=[PosNoTxt="{CH}",AlarmNo="{CJ}",Alarm="{CL}",AlarmLL="{CN}",AlarmL="{CP}",AlarmH="{CR}",AlarmHH="{CT}",AlarmSF="{CV}"]` |
| CZ | AlarmTable array ver2 | Compact JS: `aT({CX},"{CH}",{CJ},"{CL}","{CN}","{CP}","{CR}","{CT}","{CV}");` |
| DA | AlarmBanner Text | Array formula building banner text per alarm type |
| DC | AlarmBanner Text (alt) | Similar banner text for PLC import |

---

## Alarm Table Column Data (CF–CV)

These produce the JavaScript table position data. Key ones:

| Col | Header | Content |
|-----|--------|---------|
| CF | rowType | Array — alarm type identifier |
| CG | PosNo_type | `STRING` |
| CH | PosNo_value | Position number string |
| CI | AlarmNo_type | `STRING` |
| CJ | AlarmNo_value | `"Alarm{E:000}"` |
| CK | Alarm_type | `STRING` |
| CL | Alarm_value | Digital alarm tag |
| CM | AlarmLL_type | `STRING` |
| CN | AlarmLL_value | LL alarm tag |
| CO | AlarmL_type | `STRING` |
| CP | AlarmL_value | L alarm tag |
| CQ | AlarmH_type | `STRING` |
| CR | AlarmH_value | H alarm tag |
| CS | AlarmHH_type | `STRING` |
| CT | AlarmHH_value | HH alarm tag |
| CU | AlarmSF_type | `STRING` |
| CV | AlarmSF_value | SF (sensor fault) alarm tag |

---

## JavaScript Output Format (CZ column)

The compact JavaScript format exported to J-Mobile:

```javascript
aT(1,"1001",1,"Alarm001","Alarm001_LL","Alarm001_L","Alarm001_H","Alarm001_HH","Alarm001_SF");
aT(2,"1002",2,"Alarm002","Alarm002_LL","Alarm002_L","Alarm002_H","Alarm002_HH","Alarm002_SF");
// ... one line per alarm entry
```

The longer CY format is a JavaScript object assignment:
```javascript
project.AlarmTable[1]=[PosNoTxt="1001",AlarmNo="Alarm001",Alarm="Alarm001",AlarmLL="Alarm001_LL",...];
```

---

## Analogue Alarm Expansion Pattern

Each analogue signal with alarm generates **5 J-Mobile alarm rows** (1 master + 4 sub-alarms):

```
Master row (E=N): The analogue signal itself
  Sub-row N+1 (S = Alarm_LL): Low-Low limit
  Sub-row N+2 (S = Alarm_L):  Low limit
  Sub-row N+3 (S = Alarm_H):  High limit
  Sub-row N+4 (S = Alarm_HH): High-High limit
  Sub-row N+5 (S = Alarm_SF): Sensor Fault
```

Sub-rows reference master row fields using absolute column reference (`$K3`, `$M3` etc.) where row 3 = master.

Array index into `abAlarmAnalogueStateHMI[x]`: `(M*5)-5` for LL, `-4` for L, `-3` for H, `-2` for HH, `-1` for SF.
