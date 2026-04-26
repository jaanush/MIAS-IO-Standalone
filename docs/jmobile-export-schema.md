# JMobile Export Schema (legacy IO-list workflow)

Reference for the 5 XML files that the legacy Alveli IO-list Excel macro
produces and that JMobile (Exor SCADA HMI) imports during commissioning.

Source workflow doc: `import/Instruktion import IO-lista till Jmobile - SIMPLE 1.docx`

Source templates (Lasse-maja project): `…/Kungälvs kommun/Lasse-maja/Program/02 HMI/MIAS_HMI_Lassemaja_v0.1/Importfiler/`

Each `.xlsx` template embeds a `xl/xmlMaps.xml` defining its export schema; the
operator pastes data into the template and uses Excel's Developer → Export to
produce the XML. The schemas below were extracted from those embedded XSDs.

---

## 1. ExportedAlarms.xml — alarm definition table

Imported into JMobile **Alarms** menu.

```
<alarms>
  <alarm eventBuffer="..." logToEventArchive="true" eventType="..." subType="..." storeAlarmInfo="...">
    <name>… alarm tag, e.g. "T101_HH" …</name>
    <groups>…</groups>
    <source index="…" arrayType="…">… PLC alarm-bit reference …</source>
    <alarmType>HighLimit | LowLimit | BitMask | Value | Deviation | …</alarmType>
    <lowLimit>…</lowLimit>           <!-- int -->
    <highLimit>…</highLimit>          <!-- int -->
    <value>…</value>                  <!-- int (for Value type) -->
    <bitMask>…</bitMask>              <!-- int (for BitMask type) -->
    <deviation>…</deviation>          <!-- double (for Deviation type) -->
    <setPoint>…</setPoint>            <!-- double (for Deviation type) -->
    <enableTag>…</enableTag>
    <remoteAck index="…" arrayType="…">…</remoteAck>
    <ackNotify>…</ackNotify>
    <enabled>true|false</enabled>
    <requireAck>true|false</requireAck>
    <blinkTxt>true|false</blinkTxt>
    <requireReset>true|false</requireReset>
    <severity>…</severity>            <!-- int -->
    <priority>…</priority>            <!-- int -->
    <logMask>…</logMask>              <!-- int -->
    <notifyMask>…</notifyMask>        <!-- int -->
    <actionMask>…</actionMask>        <!-- int -->
    <printMask>…</printMask>          <!-- int -->
    <customFields>
      <customField_1><L1 langName="…">… int …</L1></customField_1>
      <customField_2><L1 langName="…">… string …</L1></customField_2>
    </customFields>
    <colors>
      <ackTxtColor/>             <ackBgColor/>
      <disabledTxtColor/>        <disabledBgColor/>
      <triggeredTxtColor/>       <triggeredBgColor/>
      <notTriggeredTxtColor/>    <notTriggeredBgColor/>
      <triggeredAckedTxtColor/>  <triggeredAckedBgColor/>
      <triggeredNotAckedTxtColor/> <triggeredNotAckedBgColor/>
      <notTriggeredAckedTxtColor/> <notTriggeredAckedBgColor/>
      <notTriggeredNotAckedTxtColor/> <notTriggeredNotAckedBgColor/>
    </colors>
    <actions>
      <macroAction1>
        <actionFunction/> <actionID/> <actionType/> <supportML/> <parameters/>
      </macroAction1>
    </actions>
    <useractions>
      <macroAction1>… same shape as actions/macroAction1 …</macroAction1>
    </useractions>
    <description><L1 langName="…">… localized message …</L1></description>
    <enableAudit auditBuff="…" subT="…" eventT="…">true|false</enableAudit>
  </alarm>
  …
</alarms>
```

**Per-alarm fields driven by MIAS-IO data:**

| XML field | MIAS-IO source |
|---|---|
| `name` | computed: `signal.tag + "_" + condition` (e.g. `T101_HH`, `T101_L`) |
| `groups` | `signal.alarmGroup` (A/B/C) → JMobile group label (project-level mapping) |
| `source/@index` + content | resolved alarm-GVL var (needs new `iec_alarm_path` field — plugin-pushed, mirrors `iec_path`) |
| `alarmType` | derived from condition: HH/H → `HighLimit`, L/LL → `LowLimit`, discrete → `BitMask`/`Value` |
| `lowLimit`/`highLimit` | `analog_alarm.setpoint` |
| `setPoint`/`deviation` | `analog_alarm.setpoint`/`hysteresis` for deviation alarms |
| `bitMask` | per-condition for discrete alarms |
| `severity`/`priority` | `*_alarm.severity` mapped to JMobile integer scale (range TBD) |
| `description/L1` | `*_alarm.message` |
| `requireAck` etc. | project defaults (project-level settings) |
| Colors, actions, audit | project-level template constants |
| Locked `customField` int | `discrete_alarm.alarm_no` / `analog_alarm.alarm_no` (NEW — locked numbering) |

---

## 2. AlarmsToExorAlarmSettingsTable.xml — runtime alarm-table widget data

Imported into JMobile **AlarmsSettings** + **AlarmsSettingsDiffs** + Project
properties **_TableDataScrWgt_AlarmSettings**.

```
<rows>
  <row>
    <rowType>1</rowType>
    <AlarmName_type>STRING</AlarmName_type>     <!-- typically literal "STRING" -->
    <AlarmName_value>… alarm tag …</AlarmName_value>
    <AlarmType_type>…</AlarmType_type>
    <AlarmType_value>…</AlarmType_value>        <!-- alarm class / type code -->
    <AlarmID_type>…</AlarmID_type>
    <AlarmID_value>…</AlarmID_value>            <!-- locked alarm number -->
  </row>
  …
</rows>
```

Three logical columns — `AlarmName`, `AlarmType`, `AlarmID` — each rendered
with both a `_type` (data binding mode) and `_value`. Values come from the
"AlarmsToExor" sheet columns H + K of the source Excel (per the workflow doc).

---

## 3. AlarmTexter.xml — localized alarm message texts

Imported into JMobile **AlarmSettings** "Alarm Name" → Message text.

```
<TextMessages>
  <MessageDescription index="1" langName="L1">… alarm message text …</MessageDescription>
  <MessageDescription index="2" langName="L1">…</MessageDescription>
  …
</TextMessages>
```

Flat list, indexed sequentially. Each row carries the localized message and a
`langName` attr (`L1`, `L2`, … per JMobile language). Content is the alarm
display message — sourced from `*_alarm.message` for each (signal, condition).

---

## 4. IO_Check.xml — commissioning IO-check rows

Imported into JMobile **IOCheck** datawidget table.

```
<rows>
  <row>
    <rowType>1</rowType>
    <SignalName_type>STRING</SignalName_type>
    <SignalName_value>… human-readable label …</SignalName_value>
    <PLCTag_type>DL</PLCTag_type>
    <PLCTag_value>… PLC tag reference …</PLCTag_value>
    <RowNo_type>…</RowNo_type>
    <RowNo_value>…</RowNo_value>
    <Alarm_type>…</Alarm_type>
    <Alarm_value>… GVL_ALARMS reference …</Alarm_value>
  </row>
  …
</rows>
```

Filtered to `gvl = GVL_Physical` (the hardwired-IO GVL). Workflow doc maps:

| Field | Source column | MIAS-IO equivalent |
|---|---|---|
| `SignalName_value` | clear-text label | `signal.description` or constructed from tag |
| `PLCTag_value` | TAG_NAME from internal IO list | `signal.iec_path` (or its short form) |
| `Alarm_value` | GVL_ALARMS expression | computed alarm-GVL ref (mirrors `iec_alarm_path`) |
| `RowNo_value` | sequential row number | `discrete_alarm.alarm_no`/`analog_alarm.alarm_no` |

Used during commissioning to walk every physical signal, observe its live
value, and confirm the alarm bit toggles correctly.

---

## 5. MIAS_TagsForLogging.xml — trend-logging tag list

Imported into JMobile project property **_TableDataSrcWgt_CurveSelectTagName**.

```
<rows>
  <row>
    <rowType>1</rowType>
    <Label_type>STRING</Label_type>
    <Label_value>… tag clear text …</Label_value>
    <Curve_type>…</Curve_type>
    <Curve_value>…</Curve_value>
    <Index_type>…</Index_type>
    <Index_value>…</Index_value>            <!-- int -->
  </row>
  …
</rows>
```

Filtered to signals with `Logging available = yes` (workflow doc col BK).
Drives the curve/trend selector dropdown in the HMI.

| Field | MIAS-IO source |
|---|---|
| `Label_value` | `signal.description` or `signal.tag` |
| `Curve_value` | reference to the data-collection curve / trend definition |
| `Index_value` | sequential index (TBD: maps to a JMobile curve resource id?) |
| (filter) | `signal.logging_enabled = true` |

---

## Plus: Startup script blob

Not an XML file, but the workflow doc describes a JS snippet copied out of
column CZ of the AlarmsToExor sheet, pasted into JMobile's Startup script
after `//PASTE FROM EXCEL` under `setAlarmTable_Ver2(...)`. Probably a series
of `setAlarmTable_Ver2(name, alarmType, alarmId)` calls building the runtime
alarm map. Need an actual sample to confirm the call signature.

---

## Gaps in MIAS-IO data (today)

1. **`alarm_no` (locked alarm numbering)** — neither `discrete_alarm` nor
   `analog_alarm` carry one. Required by `AlarmID_value`, `RowNo_value`, and
   ExportedAlarms `customField_1`. Migration: add `alarm_no smallint?` +
   project-scoped lock/unlock mutation.
2. **`iec_alarm_path`** — we have `iec_path` (FR-007) for live values; alarms
   need a parallel field pointing at the alarm GVL bit/var. Mirrors the
   raw/scaled split exactly. Plugin would push during codegen (new FR).
3. **JMobile group mapping** — A/B/C → JMobile group strings is project-level.
   Could live in a new `JMobileSettings` table or a JSON column on `Project`.
4. **Severity → priority numeric map** — JMobile expects ints. We have
   `*_alarm.severity` as an enum (CRITICAL/HIGH/MEDIUM/LOW/INFO?). Pick a
   numeric mapping and document it.
5. **Project-level template constants** — colors, audit settings, action
   definitions, eventBuffer, eventType, subType. Either hardcode reasonable
   defaults in the exporter or make them configurable per-project.
6. **`alarmType` mapping** — map MIAS-IO conditions
   (HH/H/L/LL/EQUAL/NOT_EQUAL/…) to JMobile types (`HighLimit`/`LowLimit`/
   `BitMask`/`Value`/`Deviation`). Documented mapping table needed.
7. **Curve / Index references for logging** — what JMobile expects in the
   `Curve_value` / `Index_value` fields. Need a sample export to disambiguate.
8. **JS startup script signature** — what arguments `setAlarmTable_Ver2()`
   takes. Need a sample.

## Approach

A `/api/project/[id]/jmobile-export` endpoint returning a ZIP of the 5 XMLs
plus a `setAlarmTable.js` snippet, plus a JMobile tab on the project showing
the alarm table with current numbering and a Lock/Export button.

The `iec_alarm_path` and JMobile project settings each warrant a separate FR
or migration; everything else can be derived from existing data once the
mapping tables (severity → int, condition → alarmType, group → JMobile-group)
are filled in.
