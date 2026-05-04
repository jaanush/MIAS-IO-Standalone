# Alveli Alarm System

Analysis of the alarm architecture from `C:\Projects\Älvelie.fbsproj\Programs\Alarms\`.

## Architecture Overview

The alarm system is **entirely code-generated from an Excel IO-list** and uses METS_Lib alarm FBs. All alarm code comments say "Auto-gen from Excel" or "Paste from Internal IO-list column".

### Execution Order

| Program | Task | Purpose |
|---------|------|---------|
| `Alarms_RunBefore` | Runs first | Resets `AnyUnackAlarm` flags to FALSE each cycle |
| `Alarms` | Main alarm cycle | Calls all alarm FB instances with inputs + settings |
| `AlarmInit` | On first boot only | Sets factory default alarm settings (persistent) |
| `AlarmInit_FAT` | FAT mode | Overrides settings for Factory Acceptance Testing |
| `AlarmSuppression` | After alarms | Sets context-dependent suppression conditions |
| `SMS_Sender` | After alarms | Maps critical alarms to physical SMS relay outputs |

## Two Alarm Types

### Digital Alarms (FB_AlarmDigital)
- From METS_Lib
- Single BOOL input
- 2-bit state per alarm: `00` = normal, `01` = not triggered/not acked, `10` = triggered/not acked, `11` = triggered/acked
- Settings: `AssignSettingsDig(settings, alarmNo, suppressed, enabled, delay_s, class)`
  - `class`: 0 = Class A (critical), 1 = Class B (non-critical), 2 = Class C (informational)

### Analogue Alarms (FB_AlarmAnalogue)
- From METS_Lib
- REAL input value
- 5 alarm levels: **LL, L, H, HH, SF** (sensor fault)
- Each level has 2-bit state (same encoding as digital)
- Settings: `AssignSettingsAna(settings, alarmNo, LL_suppressed, LL_setpoint, LL_delay, L_suppressed, L_setpoint, L_delay, H_suppressed, H_setpoint, H_delay, HH_suppressed, HH_setpoint, HH_delay, SF_suppressed, SF_delay, enabled, ..., unit)`
- Properties per level: setpoint, hysteresis, delay, enable/suppress
- Units: `eUnit.DegreesC`, `eUnit.None`, etc.

## Settings Storage

### Three Layers
1. **Factory defaults** (`FactoryAlarmSettingsDigital/Analogue[]`) — set by `AlarmInit` function, non-persistent
2. **Current normal** (`CurrentNormalAlarmSettingsDigital/Analogue[]`) — for restoring from FAT
3. **Active settings** (`AlarmSettingsDigital/Analogue[]`) — **PERSISTENT** (survives reboot), what the FBs use

### Initialization Flow
- `AlarmSettingsInitiated` is a persistent BOOL, starts FALSE
- On first boot: `AlarmInit()` runs, populates factory defaults, copies to active settings, sets `AlarmSettingsInitiated = TRUE`
- On subsequent boots: persistent settings loaded from flash, `AlarmInit` skipped
- Factory reset: operator can trigger from HMI to restore factory defaults

### FAT Mode
`AlarmInit_FAT` overrides settings for Factory Acceptance Testing:
- Some alarms suppressed during FAT that aren't suppressed in normal operation
- Sensor fault alarms enabled with 5s delay in FAT (disabled in normal for some)
- Allows testing alarm logic without nuisance alarms from disconnected equipment

## Alarm State Communication to HMI

### Packed DWORD Arrays
Alarm states are packed into DWORD arrays for efficient HMI transfer:
- `axAlarmDigitalState[]` — 2 bits per digital alarm, packed into DWORDs (16 alarms per DWORD)
- `axAlarmAnalogueState[]` — 2 bits × 5 levels per analog alarm
- `axAlarmDigitalAcks[]` — 1 bit per alarm for acknowledge from HMI
- `axAlarmAnalogueAcks[]` — 1 bit per alarm level for acknowledge

### Latest Alarm Banner
- `LatestAlarmText` — text of most recent alarm
- `LatestAlarmTimestamp` — when it occurred
- `LatestAlarmIsActive` / `LatestAlarmIsAcknowledged` — current state
- `LatestAlarmStatus` — 0=inactive, 1=active+acked, 2=active, 3=inactive+unacked
- `HideBanner` — HMI can suppress the banner
- `AcknowledgeAllAlarms` — bulk acknowledge from HMI

### Ordered Alarm Lists
- `AlarmAckInOrder[]` — acknowledgment flags sorted by occurrence
- `AlarmInOrder[]` — active alarm flags sorted by occurrence
- `AlarmOccurence[]` — order index per alarm
- `Alarms[]` — full `strAlarmInfo` structs for detailed HMI display

## Suppression System

`AlarmSuppression.prg.st` sets contextual suppression conditions. Key patterns:

### Equipment-dependent suppression
- **Hydraulic alarms**: suppressed when hydraulic pump is not running (irrelevant)
- **Start-up interlock**: suppressed when propulsion converter is running (expected during startup)
- **Running status alarms**: suppressed when run command not active (expected to not be running)
- **Fan running alarms**: suppressed when fan start command not given

### Communication-dependent suppression
- **Converter faults/warnings/temps**: suppressed when CAN communication is lost (values unreliable)
- **Battery string faults**: suppressed when string communication fault (can't trust data)
- **BMS data alarms (SOC, level)**: suppressed when pack not connected or all strings have comm fault

### State-dependent suppression
- **DC voltage alarms**: suppressed during blackout (already handling the situation)
- **Battery SOC/level**: suppressed when battery pack not connected or in fault
- **Battery string faults**: suppressed during emergency stop (expected to disconnect)
- **Genset oil pressure**: suppressed when RPM < 600 during startup (not yet at operating pressure)
- **Water flow sensors**: suppressed in Off mode (no flow expected)

## SMS Sender

Maps critical alarm conditions to 8 physical digital outputs for GSM SMS relay:

| Output | Condition |
|--------|-----------|
| Blackout MIAS AC/DC | Any AC or DC blackout on any bus |
| High bilge level | Bilge tank H or HH alarm triggered and unacked |
| Fire alarm | Fire alarm active |
| Intrusion | Intruder detected alarm active |
| Loss of shore power/charging | AC shore lost OR DC shore lost |
| Backup genset charging activated | Microgrid FWD fault while shore connected |
| Low temp battery room | Battery room temp L or LL in either room |
| Battery alarm | Any battery level alarm OR discharge limited |

Enabled/disabled by `GVL_Settings.Settings.Enable_SMS_Sender` — all outputs forced FALSE when disabled.

## Alarm Count

From the Alarms.prg.st and GVL_Alarms.gvl, the project has approximately:
- **~150+ digital alarm FBs** (FB_AlarmDigital)
- **~50+ analogue alarm FBs** (FB_AlarmAnalogue) — each with 5 levels = ~250 alarm points
- Total alarm points: **~400+**

Alarm categories cover:
- AC/DC distribution (isolation, overload, overtemp)
- Shore connection (lost, overload, MCB tripped, local control)
- Propulsion (AZT system faults, hydraulic, oil, interlock)
- HVAC (system alarms from Regin controllers)
- Battery packs (SOC, level, overload, string faults, DCDC faults, temperatures)
- Genset (diesel engine faults, converter faults, temperatures)
- Microgrid/AFE (faults, running status, temperatures)
- Tank levels (fuel, sewage, freshwater, bilge, lube oil, sludge)
- Safety (fire, bilge, emergency batteries, intrusion)
- Ventilation (fan running, damper position)
- Cooling (water flow, pump running)

## Key Design Observations

1. **All code is generated from Excel** — the IO-list spreadsheet has columns that produce the alarm handling code, init code, suppression code, and FAT init code. This is a manual copy-paste workflow.

2. **METS_Lib dependency** — alarm FBs (`FB_AlarmDigital`, `FB_AlarmAnalogue`), settings helpers (`AlarmSettings.AssignSettingsDig/Ana`), and GVL infrastructure all come from the METS_Lib library.

3. **Flat structure** — all alarms are global singletons in `GVL_Alarms`, numbered sequentially. No grouping by subsystem in the GVL declaration (though naming convention provides implicit grouping).

4. **Persistent settings** — alarm settings survive reboot. Factory reset is explicit. This means field adjustments to alarm setpoints/delays are preserved across power cycles.

5. **Two-bit state encoding** — compact representation for HMI transfer via packed DWORDs. The HMI reads/writes bit arrays rather than individual alarm objects.

6. **Suppression is a separate program** — runs after alarm evaluation. Suppression conditions are project-specific and hand-written (not generated), reflecting engineering judgment about when alarms are irrelevant.

7. **SMS relay is hardwired** — 8 dedicated digital outputs mapped to the most critical conditions. Simple and reliable — works even if HMI communication fails.

## Source Files

```
Programs/Alarms/
├── Alarms_RunBefore.prg.st   — Reset AnyUnack flags (3 lines)
├── Alarms.prg.st             — ~900 lines, all alarm FB calls (auto-gen)
├── AlarmInit.fn.st           — ~500 lines, factory default settings (auto-gen)
├── AlarmInit_FAT.fn.st       — ~500 lines, FAT override settings (auto-gen)
├── AlarmSuppression.prg.st   — ~130 lines, contextual suppression (hand-written)
└── SMS_Sender.prg.st         — ~45 lines, critical alarm → SMS relay mapping

GVL/
├── GVL_Alarms.gvl            — All alarm FB instances + HMI arrays
├── GVL_AlarmSettings.gvl     — Settings arrays (persistent + factory)
└── GVL_AlarmText.gvl         — Alarm text strings for HMI display
```
