# CoDeSys ST Code Generation — Output Columns Reference

Source: `25432-852-Internal IO_list_Kopia_alveli.xlsx` · Sheet: `Internal IO-list`
Output columns: **BX through CK** (and supporting CL–CV)

Each column generates one line of CoDeSys Structured Text when copied from Excel.
All are array formulas that evaluate to `""` when the row is empty (C="").

---

## BX — Output WAGO VARIABLE FB

**Purpose:** Variable declaration for use inside a Function Block or STRUCT.

```
Logic:
  IF C="" OR BT="" → ""   (skip empty rows)
  IF L="WORD" OR L="INT" → TagName: REAL;
  ELSE                    → TagName: <L>;
```

**Output examples:**
```st
Pump01_Speed: REAL;
Valve01_Open: BOOL;
Motor01_Current: REAL;
```

**Key inputs:** `C` (empty check), `BT` (tag name), `L` (variable type)

**Note:** WORD and INT are promoted to REAL for physical signals.

---

## BY — Output WAGO GVL (Global Variable List)

**Purpose:** Full GVL variable declaration with AT address, comments, and RAW companion for analog signals.

```
Logic:
  IF BH<>"" → ""   (function block overrides: don't generate GVL line)
  IF H ends in "495" AND N="GVL_Physical" → ""  (495 = special card type, excluded)
  IF L="" → "//TBD"   (type not yet defined)

  IF BG<>"" → prepend "END_VAR VAR_GLOBAL <BG> " (RETAIN/PERSISTENT prefix)

  THEN:
    IF N="GVL_Physical" AND (L="WORD" OR L="INT"):
      → TagName: REAL; (* D_F.G *)
        {attribute 'symbol' := 'none'}TagName_RAW [AT CV_address]: INT; (* D_F.G *)
    ELSE:
      → TagName: L; (* D_F.G *)
```

**Output examples:**
```st
PT_001_Pressure: REAL; (* D01_AI01.1 *)
    {attribute 'symbol' := 'none'}PT_001_Pressure_RAW AT %IW100: INT; (* D01_AI01.1 *)

DI_001_RunFeedback: BOOL;
```

**Key inputs:** `BH`, `H`, `N`, `L`, `BG`, `BT`, `D`, `F`, `G`, `CV` (AT address)

---

## BZ — Alarm Type

**Purpose:** Classify signal as DIG / ANA / none.

```
Logic:
  IF I has no "A" AND BB="" → ""   (no alarm)
  IF (I contains "A" OR BB<>"") AND (L="BOOL" OR L="BIT" OR BA<>"") → "DIG"
  IF (I contains "A" OR BB<>"") AND L<>"BOOL" → "ANA"
```

**Output:** `"DIG"` | `"ANA"` | `""`

**Key inputs:** `I` (alarm identifier — "A" present = alarm signal), `BB` (locked alarm), `L` (type), `BA` (AnaAlarm-to-Dig override)

---

## CA — GVL_Alarms

**Purpose:** Alarm variable declaration in GVL_Alarms.

```
Logic:
  IF BZ="" → ""
  IF AW<>"" → Alarm{BP:000}_{BT}: {AW};   (special FB type)
  IF BZ="DIG" → Alarm{BP:000}_{BT}: FB_AlarmDigital;
  IF BZ="ANA" → Alarm{BP:000}_{BT}: FB_AlarmAnalogue;
```

**Output examples:**
```st
Alarm001_PT_001_Pressure: FB_AlarmAnalogue;
Alarm042_DI_001_RunFeedback: FB_AlarmDigital;
Alarm007_Motor01_Speed: FB_AlarmSpecial;
```

**Key inputs:** `BZ` (alarm type), `BP` (alarm number), `BT` (tag name), `AW` (special FB)

---

## CB — AlarmINIT

**Purpose:** Runtime alarm settings assignment — called in PLC initialization code.

**Digital alarm output:**
```st
METS_Lib.AlarmSettings.AssignSettingsDig(
  GVL_AlarmSettings.FactoryAlarmSettingsDigital[{BQ}],
  {BP},                          (* alarm number *)
  {blocked:TRUE/FALSE},          (* from AZ last char *)
  {activeHigh:TRUE/FALSE},       (* from K/AJ: NO→TRUE, NC→FALSE *)
  {delay},                       (* from AI *)
  {group:0/1/2}                  (* from AT: A→0, B→1, C→2 *)
); // {BW}
```

**Analogue alarm output:**
```st
METS_Lib.AlarmSettings.AssignSettingsAna(
  GVL_AlarmSettings.FactoryAlarmSettingsAnalogue[{BR}],
  {BP},
  {LL_blocked},{LL_limit},{LL_delay},
  {L_blocked},{L_limit},{L_delay},
  {H_blocked},{H_limit},{H_delay},
  {HH_blocked},{HH_limit},{HH_delay},
  {SF_blocked},5,
  {has_L},{has_LL}
); // {BW}
```

**Key inputs:** `BZ`, `BQ`, `BR`, `BP`, `AZ` (block bitmask), `K`, `AJ`, `AI`, `AT`, `AK–AR` (limits), `BK`, `BW`

**AZ bitmask decoding (5 chars, D-HH-H-L-LL from left):**
- Position 1 (left) = Digital / HH alarm blocked
- Position 2 = HH (analogue)
- Position 3 = H
- Position 4 = L
- Position 5 (right) = LL

---

## CC — Alarm Handling Code (Alarms)

**Purpose:** The actual alarm FB call placed in the cyclic program.

**Digital:**
```st
GVL_Alarms.Alarm{BP:000}_{BT}(
  Input:={BV}
  [,{BA override if set}],
  AlarmSettings:=GVL_AlarmSettings.AlarmSettingsDigital[{BQ}],
  AlarmDigNo:={BQ}
  [,SetpointPos:={AX}]   (* if AW="FB_Alarm_FollowSetpoint" *)
  [,RPM:={AX}]           (* if AW="FB_AlarmAnalogue_LubrPress" *)
);
```

**Analogue:**
```st
GVL_Alarms.Alarm{BP:000}_{BT}(
  InputAnalogue:=GVL_AnalogScaling.FB_AnalogueLeverIn_{BO}.ScaledOutput,
  AlarmSettings:=GVL_AlarmSettings.AlarmSettingsAnalogue[{BR}],
  ...
);
```

**Key inputs:** `BZ`, `BP`, `BT`, `BV`, `BA`, `BQ`, `BR`, `AW`, `AX`

---

## CD — Alarm Suppression

**Purpose:** One-time suppression assignment. Only generated if AU is filled.

```
IF AU="" → ""
ELSE:
  GVL_Alarms.Alarm{BP:000}_{BT}.Suppression := {AU};
```

**Key inputs:** `AU`, `BP`, `BT`

---

## CE — GVL_AnalogScaling

**Purpose:** Analog scaling function block declaration.

```
Conditions to generate (all must be true):
  L ∈ {INT, WORD, REAL}
  N = "GVL_Physical"
  H is not empty, not "652", not "495"

Then:
  IF Y<>"" (tank level):
    → FB_TankLevel_{BO}: FB_TankLevel; // {BW}

  IF S<>"" (standard analog with zero/deadband):
    → FB_AnalogueLeverIn_{BO}: {Z or FB_AnalogueIn_DeadBand_rev3}
         [:= (overrides if AA/AB/AC/AD set)];
```

**Key inputs:** `L`, `N`, `H`, `Y`, `Z`, `S`, `AA`, `AB`, `AC`, `AD`, `BO`, `BW`

---

## CF — Analog Scaling BODY

**Purpose:** Analog scaling FB call in cyclic program.

**Tank level variant:**
```st
GVL_AnalogScaling.FB_TankLevel_{BO}(
  RawInput:=GVL_Physical.{BT}_RAW,
  AnalogueType:='{last 3 chars of H}',
  Gain:={W}, Offset:={X},
  FilterTime:=2000,
  RawLimitLow:={R}, RawLimitHigh:={T},
  OutputLimitLow:=..., OutputLimitHigh:=...
);
```

**Standard analog variant:**
```st
GVL_AnalogScaling.FB_AnalogueLeverIn_{BO}(
  RawInput:=GVL_Physical.{BT}_RAW,
  ScaledMin:={U}, ScaledMax:={V},
  RawMin:={R}, RawMax:={T},
  ...
);
```

**Note:** Commas in W/X replaced with dots (locale normalization via SUBSTITUTE).

**Key inputs:** `L`, `N`, `H`, `Y`, `BO`, `BT`, `W`, `X`, `R`, `S`, `T`, `U`, `V`

---

## CG — IO Modbus Address

**Purpose:** Computes the Modbus/BC bus array index for this signal.

```
IF N<>"GVL_Physical" → ""
IF Card Offsets lookup says "Is mounted on PLC" = "Yes" → ""
IF H ends in "495" or "652" → "//Placeholder"

IF J="AI" → "[" & VLOOKUP(D&"_"&F, CardOffsets, AI_start_col) + G - 1 & "]"
IF J="AO" → "[" & VLOOKUP(D&"_"&F, CardOffsets, AO_start_col) + G - 1 & "]"
IF J="DI" → (bit address format)
IF J="DO" → (bit address format)
```

**Output example:** `[42]` or `%IX5.3`

**Key inputs:** `N`, `D`, `F`, `H`, `J`, `G`, `Card Offsets` sheet (lookup by `D&"_"&F`)

---

## CH — Modbus IO Input

**Purpose:** Assignment statement reading from Modbus/BCInputData into GVL variable.

```
IF N<>"GVL_Physical" OR J not in {AI, DI} → ""
IF Card Offsets says "mounted on PLC" → ""
IF CG starts with "//" → CG (pass through placeholder)

IF J="AI" AND L<>"WORD":
  → GVL_Physical.{BT}_RAW := WORD_TO_{L}(BCInputData{CG});

IF J="DI" AND L="BOOL":
  → GVL_Physical.{BT} := [NOT ]BCInputData{CG};  (* NOT if K="NC" *)

IF DI on same word/card (CR=CS, fits in 16 bits):
  → %IX{CS}.{G-1}   (direct bit address format)
```

**Key inputs:** `N`, `J`, `L`, `K`, `BT`, `CG`, `CR`, `CS`, `CT`, `G`, `D`, `F`

---

## CI — Modbus IO Output

**Purpose:** Assignment writing GVL variable to Modbus/BCOutputData.

```
IF N<>"GVL_Physical" OR J not in {AO, DO} → ""

IF L="BOOL":
  → BCOutputData{CG} := GVL_Physical.{BT};

IF L<>"WORD":
  → BCOutputData{CG} := {L}_TO_WORD(GVL_Physical.{BT}_RAW);
```

**Key inputs:** `N`, `J`, `L`, `BT`, `CG`

---

## CJ — AlarmInitFAT

**Purpose:** Factory Acceptance Test alarm initialization — like CB but forces all alarms blocked if BK="Yes".

Identical structure to CB (AlarmINIT) but:
- Digital: `blocked = TRUE if BK="Yes" OR AZ last char = "1"`
- Analogue: each limit blocked individually, `BK="Yes"` forces all TRUE

---

## CK — Logging to WAGO

**Purpose:** Generates data logging call.

```
IF N="GVL_Physical" AND D="D01" AND BL="Yes":
  → AnyConversion(GVL_Physical_Transfer.{BT}, {CL});

IF BL="Yes":
  → AnyConversion({N}.{BT}, {CL});

ELSE → ""
```

**Key inputs:** `N`, `D`, `BL`, `BT`, `CL`

---

## Supporting Columns (CL–CV)

| Col | Header | Notes |
|-----|--------|-------|
| CL | Logging no | Sequential counter for rows where BL="Yes" |
| CM | Commissioning alarmAssign | Blocks alarms during commissioning phase |
| CN | Modbus external | External Modbus address mapping |
| CO | Short tag name | Abbreviated tag for display |
| CP | Job no | Project/job number |
| CQ | Internal BCInputData no offset | Raw channel number without offset |
| CR | Start word address | Card's first word address (from Card Offsets lookup) |
| CS | End word address | Card's last word address |
| CT | No of channels | Channel count on card |
| CU | Last channel on card | |
| CV | PLC AT Address | Full `%IW` / `%QW` address for AT mapping in GVL |

---

## Card Offsets Sheet (Address Lookup Table)

Lookup key: `D & "_" & F` (e.g., `D01_AI01`)

| Column offset | Content |
|---------------|---------|
| 1 (F) | Searchstring (key) |
| 2 (G) | DI start address |
| 3 (H) | DI stop address |
| 4 (I) | DO start address |
| 5 (J) | DO stop address |
| 6 (K) | AI start word address |
| 7 (L) | AI stop word address |
| 8 (M) | AO start word address |
| 9 (N) | AO stop word address |
| 12 (Q) | AI start address **used in IO list** |
| 13 (R) | AO start address **used in IO list** |
| 14 (S) | Is IO card mounted on PLC? (Yes/No) |

**Usage:** CG uses VLOOKUP(D&"_"&F, F3:R176, Q1 offset, FALSE) to get AI start, then adds G-1 for channel.

---

## Code Generation Summary Table

| Column | Output Section | Destination File in CoDeSys |
|--------|---------------|------------------------------|
| BX | Variable declaration | Inside FB/STRUCT definition |
| BY | GVL variable declaration | `GVL_Physical.gvl` (or named GVL) |
| BZ | Alarm type classifier | (intermediate — feeds CA–CD) |
| CA | Alarm variable declaration | `GVL_Alarms.gvl` |
| CB | Alarm init call | `AlarmInit` POU (called once at startup) |
| CC | Alarm cyclic call | `AlarmHandling` POU (called every scan) |
| CD | Alarm suppression | `AlarmHandling` POU |
| CE | Analog scaling declaration | `GVL_AnalogScaling.gvl` |
| CF | Analog scaling body | `AnalogScaling` POU (cyclic) |
| CG | IO address index | (intermediate — feeds CH/CI) |
| CH | Modbus read (inputs) | `IOMapping_Read` POU |
| CI | Modbus write (outputs) | `IOMapping_Write` POU |
| CJ | FAT alarm init | `AlarmInitFAT` POU |
| CK | Logging call | `Logging` POU |
