# IO List Code Generation — Analysis Documents

Reverse-engineered from: `import/25432-852-Internal IO_list_Kopia_alveli.xlsx`
Analysis date: 2026-03-11

## Documents in This Folder

| File | Contents |
|------|----------|
| `01-input-columns.md` | All input columns A–BW with types, descriptions, and the tag name construction pipeline |
| `02-codesys-output-columns.md` | All output columns BX–CK — exact logic, output format, key inputs for each CoDeSys ST code section |
| `03-jmobile-alarm-export.md` | The AlarmsToExor sheet structure — J-Mobile/Exor alarm export format, JavaScript output, analogue alarm expansion pattern |
| `04-data-completeness-gaps.md` | Data completeness assessment — what MIAS-IO has, what's missing, recommended schema additions, priority order |

## Quick Reference — Output Sections

| Column | Output | CoDeSys Destination |
|--------|--------|---------------------|
| BX | `TagName: Type;` | Inside FB/STRUCT |
| BY | `TagName: Type; (*comment*)` + RAW companion | GVL_Physical.gvl |
| BZ | DIG / ANA classifier | (intermediate) |
| CA | `AlarmNNN_Tag: FB_AlarmType;` | GVL_Alarms.gvl |
| CB | `AlarmSettings.AssignSettings(...)` | AlarmInit POU |
| CC | `GVL_Alarms.AlarmNNN_Tag(Input:=...)` | AlarmHandling POU |
| CD | `.Suppression := ST_expression;` | AlarmHandling POU |
| CE | `FB_AnalogueLeverIn_N: FB_Type;` | GVL_AnalogScaling.gvl |
| CF | `GVL_AnalogScaling.FB_...(RawInput:=...)` | AnalogScaling POU |
| CG | `[index]` — Modbus array index | (intermediate) |
| CH | `GVL_Physical.Tag_RAW := WORD_TO_L(BCInputData[n]);` | IOMapping_Read POU |
| CI | `BCOutputData[n] := L_TO_WORD(GVL_Physical.Tag_RAW);` | IOMapping_Write POU |
| CJ | `AlarmSettings.AssignSettings(...)` (FAT variant) | AlarmInitFAT POU |
| CK | `AnyConversion(GVL.Tag, logNo);` | Logging POU |

## Two Export Types

1. **CoDeSys ST code** (columns BX–CK): One output line per signal, pasted directly into CoDeSys
2. **J-Mobile alarm export** (AlarmsToExor sheet): CSV/JS import for Exor panel alarm system
   - Output format: `aT(posNo,"PosNo","AlarmNo","Alarm","LL","L","H","HH","SF");` per alarm

## Schema Status

**Has fields, needs data populated:**
- `Signal.gvlId -> GlobalVariableList` — GVL assignment (col N)
- `DiscreteSignal/AnalogSignal.plcDataTypeId -> PlcDataTypeCatalog` — CoDeSys type (col L)
- `AnalogAlarm` / `ComponentAnalogAlarm` — alarm limits LL/L/H/HH with setpoints and delays

**Card offsets are calculable** from `IoCard.slotPosition + cardType + maxInputChannels/maxOutputChannels`. Only missing piece: `IoCarrier.modbusInputBase/modbusOutputBase` — the start word address for each carrier's address space.

**Genuine gaps (schema additions needed):**
1. `AnalogSignal.rawZero` — zero-point for deadband/offset scaling
2. `IoCarrier.modbusInputBase / modbusOutputBase` — enables CH/CI code generation
3. Alarm group A/B/C — explicit priority group (severity is close but not the same)
4. Alarm block mask — which of LL/L/H/HH/D limits are blocked
5. FAT block, commissioning block flags
6. Alarm suppression ST expression
7. Special alarm FB / input reference
8. Signal retain/persistent flags, logging enable flag
