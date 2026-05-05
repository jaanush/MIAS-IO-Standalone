/**
 * JMobile (Exor SCADA HMI) alarm-import file renderer.
 *
 * Produces the 3 critical files the legacy IO-list workflow imports:
 *   - ExportedAlarms.xml — alarm-definition table (one row per discrete alarm,
 *     5 rows per analog signal for LL/L/H/HH/SF levels)
 *   - AlarmTexter.xml — per-alarm message text indexed sequentially
 *   - setAlarmTable.js — JS startup snippet: aT(...) calls binding the runtime alarm map
 *
 * Reference: docs/jmobile-export-schema.md and data/codegen-analysis/03-jmobile-alarm-export.md.
 * The shape mirrors the legacy AlarmsToExor Excel macro output verbatim — JMobile project
 * templates expect this exact schema.
 *
 * Source array convention (must match what the plugin emits in GVL_Alarms):
 *   abAlarmDigitalStateHMI[N]    — flattened bool per digital alarm (1 entry / alarmNo)
 *   abAlarmAnalogueStateHMI[N]   — flattened bool per analog level (5 entries / signal)
 *   axAlarmDigitalAcksHMI[N]
 *   axAlarmAnalogueAcksHMI[N]
 *
 * Index per (signal, level):
 *   digital:  index = digSeq − 1                                 (0-based)
 *   analog:   index = (anaSeq − 1) × 5 + {0, 1, 2, 3, 4}          for LL, L, H, HH, SF
 */

// ────────────────────────────────────────────────────────────────────────────
// Input shape (mias-io alarm rows from the API, simplified)
// ────────────────────────────────────────────────────────────────────────────

export type AlarmInput = {
  /** alarm row primary key (id, surfaced via API) */
  id: number;
  /** locked sequential alarmNo from JMobile-tab "Lock numbering"; null = pending (skipped) */
  alarmNo: number | null;
  /** "discrete" | "analog" — which table the row came from */
  kind: "discrete" | "analog";
  /** ON_TRIGGER / OFF_TRIGGER for discrete; HIGH / HIGH_HIGH / LOW / LOW_LOW for analog */
  condition: string;
  /** signal id (used to dedupe analog rows: 5 conditions on same signal → 5 levels of one analog entry) */
  signalId: number;
  /** signal tag (unused for XML body but kept for debugging / future renaming) */
  signalTag: string | null;
  /** A/B/C; null falls back to severity-mapped class */
  alarmGroup: "A" | "B" | "C" | null;
  /** CRITICAL / ALARM / WARNING / INFO */
  severity: "CRITICAL" | "ALARM" | "WARNING" | "INFO";
  /** operator-facing message text */
  message: string | null;
  /** delay seconds before tripping */
  delaySeconds: number;
  /** analog setpoint (null on discrete) */
  setpoint?: string | number | null;
  /** analog hysteresis */
  hysteresis?: string | number | null;
};

export type ProjectExportInput = {
  projectId: number;
  projectName: string;
  alarms: AlarmInput[];
};

// ────────────────────────────────────────────────────────────────────────────
// Mappings
// ────────────────────────────────────────────────────────────────────────────

/** Severity → JMobile group when alarmGroup is null. */
function severityToGroup(s: AlarmInput["severity"]): "A" | "B" | "C" {
  if (s === "CRITICAL") return "A";
  if (s === "ALARM" || s === "WARNING") return "B";
  return "C";
}

/** Group → JMobile severity int (per AlarmsToExor macro: A=5, B=3, C=1). */
function groupToSeverity(g: "A" | "B" | "C"): number {
  return g === "A" ? 5 : g === "B" ? 3 : 1;
}

/** Analog conditions in canonical level order. Index in this array is the level offset. */
const ANALOG_LEVELS = ["LOW_LOW", "LOW", "HIGH", "HIGH_HIGH"] as const;
const ANALOG_LEVEL_SUFFIX: Record<string, string> = {
  LOW_LOW: "_LL",
  LOW: "_L",
  HIGH: "_H",
  HIGH_HIGH: "_HH",
  SF: "_SF",
};
/** Description suffix per Älvelie convention (col J prefix in the AlarmsToExor macro). */
const ANALOG_LEVEL_LABEL: Record<string, string> = {
  LOW_LOW: "Critically low",
  LOW: "Low",
  HIGH: "High",
  HIGH_HIGH: "Critically high",
  SF: "Sensor Fault",
};
/** Per-level letter in the description prefix (A=LL, B=L, C=H, D=HH, E=SF). */
const ANALOG_LEVEL_LETTER: Record<string, string> = {
  LOW_LOW: "A",
  LOW: "B",
  HIGH: "C",
  HIGH_HIGH: "D",
  SF: "E",
};
/** Offset within analog block of 5 (LL=0, L=1, H=2, HH=3, SF=4). */
const ANALOG_LEVEL_OFFSET: Record<string, number> = {
  LOW_LOW: 0,
  LOW: 1,
  HIGH: 2,
  HIGH_HIGH: 3,
  SF: 4,
};

/** Pad alarm number for the JMobile alarm name (Alarm001..Alarm999). */
function alarmName(no: number): string {
  return `Alarm${String(no).padStart(3, "0")}`;
}

/**
 * Strip per-condition level wording from a message so the JMobile description
 * doesn't duplicate it. mias-io tends to append " (H)", " - HIGH_HIGH", etc.
 * to per-row alarm messages; the renderer adds its own level suffix.
 */
function stripLevelSuffix(s: string): string {
  return s
    .replace(/\s*\((HH|H|LL|L|SF)\)\s*$/i, "")
    .replace(/\s*-\s*(High[\s-]?High|HighHigh|Low[\s-]?Low|LowLow|High|Low|Sensor[\s-]?Fault|SF|HH|LL)\s*$/i, "")
    .replace(/\s+_(HH|H|LL|L|SF)\s*$/i, "")
    .trim();
}

/** XML-escape text content (description, message). */
function xesc(s: string | null | undefined): string {
  if (s == null) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ────────────────────────────────────────────────────────────────────────────
// XML rendering
// ────────────────────────────────────────────────────────────────────────────

/** Common color block — fixed scheme matching the legacy Älvelie template. */
const COLOR_BLOCK = `\t\t<colors>
\t\t\t<ackTxtColor>#ff0000</ackTxtColor>
\t\t\t<ackBgColor>#ffff00</ackBgColor>
\t\t\t<disabledTxtColor>#000000</disabledTxtColor>
\t\t\t<disabledBgColor>#999999</disabledBgColor>
\t\t\t<triggeredTxtColor>#000000</triggeredTxtColor>
\t\t\t<triggeredBgColor>#f14216</triggeredBgColor>
\t\t\t<notTriggeredTxtColor>#000000</notTriggeredTxtColor>
\t\t\t<notTriggeredBgColor>#ffffff</notTriggeredBgColor>
\t\t\t<triggeredAckedTxtColor>#000000</triggeredAckedTxtColor>
\t\t\t<triggeredAckedBgColor>#e6e600</triggeredAckedBgColor>
\t\t\t<triggeredNotAckedTxtColor>#000000</triggeredNotAckedTxtColor>
\t\t\t<triggeredNotAckedBgColor>#f14216</triggeredNotAckedBgColor>
\t\t\t<notTriggeredAckedTxtColor>#000000</notTriggeredAckedTxtColor>
\t\t\t<notTriggeredAckedBgColor>#ffffff</notTriggeredAckedBgColor>
\t\t\t<notTriggeredNotAckedTxtColor>#000000</notTriggeredNotAckedTxtColor>
\t\t\t<notTriggeredNotAckedBgColor>#74d900</notTriggeredNotAckedBgColor>
\t\t</colors>`;

const ACTIONS_BLOCK = `\t\t<actions><macroAction1/></actions>
\t\t<useractions><macroAction1/></useractions>`;

/** Render a single ExportedAlarms.xml `<alarm>` element. */
function renderAlarmElement(args: {
  name: string;
  group: "A" | "B" | "C";
  sourceArray: string;       // abAlarmDigitalStateHMI / abAlarmAnalogueStateHMI
  ackArray: string;           // axAlarmDigitalAcksHMI / axAlarmAnalogueAcksHMI
  sourceIndex: number;
  customField2: "DIG" | "ANA";
  alarmNo: number;
  description: string;
  enabled: boolean;
}): string {
  const { name, group, sourceArray, ackArray, sourceIndex, customField2, alarmNo, description, enabled } = args;
  const sev = groupToSeverity(group);
  return `\t<alarm eventBuffer="AlarmBuffer1" logToEventArchive="true" eventType="14" subType="1" storeAlarmInfo="true">
\t\t<name>${xesc(name)}</name>
\t\t<groups>${group}</groups>
\t\t<source index="${sourceIndex}" arrayType="true">${sourceArray}</source>
\t\t<alarmType>bitMaskAlarm</alarmType>
\t\t<bitMask>2</bitMask>
\t\t<remoteAck index="${sourceIndex}" arrayType="true">${ackArray}</remoteAck>
\t\t<ackNotify/>
\t\t<enabled>${enabled ? "true" : "false"}</enabled>
\t\t<requireAck>true</requireAck>
\t\t<blinkTxt>false</blinkTxt>
\t\t<requireReset>false</requireReset>
\t\t<severity>${sev}</severity>
\t\t<priority>3</priority>
\t\t<logMask>76</logMask>
\t\t<notifyMask>76</notifyMask>
\t\t<actionMask>1</actionMask>
\t\t<printMask>1</printMask>
\t\t<customFields>
\t\t\t<customField_1><L1 langName="Lang1">${alarmNo}</L1></customField_1>
\t\t\t<customField_2><L1 langName="Lang1">${customField2}</L1></customField_2>
\t\t</customFields>
${COLOR_BLOCK}
${ACTIONS_BLOCK}
\t\t<description><L1 langName="Lang1">${xesc(description)}</L1></description>
\t\t<enableAudit subT="1" eventT="18">false</enableAudit>
\t</alarm>`;
}

/** Placeholder n/a entry that the legacy template starts with. */
const PLACEHOLDER_ALARM = `\t<alarm eventBuffer="n/a" logToEventArchive="true" eventType="0" subType="0" storeAlarmInfo="false">
\t\t<name>n/a</name>
\t\t<groups>n/a</groups>
\t\t<source>n/a</source>
\t\t<alarmType>n/a</alarmType>
\t\t<lowLimit>0</lowLimit>
\t\t<highLimit>1000</highLimit>
\t\t<value>0</value>
\t\t<bitMask>1</bitMask>
\t\t<deviation>50</deviation>
\t\t<setPoint>20</setPoint>
\t\t<enableTag>n/a</enableTag>
\t\t<remoteAck>n/a</remoteAck>
\t\t<ackNotify>n/a</ackNotify>
\t\t<enabled>true</enabled>
\t\t<requireAck>false</requireAck>
\t\t<blinkTxt>false</blinkTxt>
\t\t<requireReset>false</requireReset>
\t\t<severity>1</severity>
\t\t<priority>3</priority>
\t\t<logMask>76</logMask>
\t\t<notifyMask>76</notifyMask>
\t\t<actionMask>1</actionMask>
\t\t<printMask>1</printMask>
\t\t<customFields><customField_1/><customField_2/></customFields>
${COLOR_BLOCK}
${ACTIONS_BLOCK}
\t\t<description><L1 langName="Lang1">n/a</L1></description>
\t\t<enableAudit subT="1" eventT="18">false</enableAudit>
\t</alarm>`;

// ────────────────────────────────────────────────────────────────────────────
// Pipeline: alarms → ordered render list
// ────────────────────────────────────────────────────────────────────────────

type RenderEntry = {
  name: string;                    // "Alarm001" or "Alarm042_LL"
  group: "A" | "B" | "C";
  sourceArray: "abAlarmDigitalStateHMI" | "abAlarmAnalogueStateHMI";
  ackArray: "axAlarmDigitalAcksHMI" | "axAlarmAnalogueAcksHMI";
  sourceIndex: number;
  customField2: "DIG" | "ANA";
  alarmNo: number;                 // master alarm-no (same for all 5 levels of an analog signal)
  description: string;
  enabled: boolean;
  /** for setAlarmTable.js — track signal master + level */
  signalId: number;
  level: "MASTER" | "LOW_LOW" | "LOW" | "HIGH" | "HIGH_HIGH" | "SF";
};

/**
 * Build the render entries. Walks alarms in alarmNo order, separating
 * digital and analog kinds. Pending alarms (alarmNo=null) are skipped.
 */
function buildEntries(alarms: AlarmInput[]): RenderEntry[] {
  const out: RenderEntry[] = [];
  const usable = alarms.filter((a) => a.alarmNo != null) as (AlarmInput & { alarmNo: number })[];

  // Discrete: 1 entry per alarm row.
  const discrete = usable.filter((a) => a.kind === "discrete").sort((a, b) => a.alarmNo - b.alarmNo);
  discrete.forEach((a, i) => {
    const group = a.alarmGroup ?? severityToGroup(a.severity);
    out.push({
      name: alarmName(a.alarmNo),
      group,
      sourceArray: "abAlarmDigitalStateHMI",
      ackArray: "axAlarmDigitalAcksHMI",
      sourceIndex: i,
      customField2: "DIG",
      alarmNo: a.alarmNo,
      description: `${a.alarmNo}. ${a.message ?? ""}`.trim(),
      enabled: true,
      signalId: a.signalId,
      level: "MASTER",
    });
  });

  // Analog: dedupe by signalId, ordered by min alarmNo across that signal's rows.
  // For each analog signal, emit 5 rows (LL, L, H, HH, SF).
  const analog = usable.filter((a) => a.kind === "analog");
  const bySignal = new Map<number, (AlarmInput & { alarmNo: number })[]>();
  for (const a of analog) {
    const arr = bySignal.get(a.signalId) ?? [];
    arr.push(a);
    bySignal.set(a.signalId, arr);
  }
  const analogSignalsOrdered = [...bySignal.entries()]
    .map(([sigId, rows]) => ({ sigId, rows, minAlarmNo: Math.min(...rows.map((r) => r.alarmNo)) }))
    .sort((a, b) => a.minAlarmNo - b.minAlarmNo);

  analogSignalsOrdered.forEach((sig, anaIdx) => {
    // Pick the master alarm-no — use min(alarmNo) of this signal's rows so the
    // JMobile customField_1 has a single locked id per signal.
    const masterNo = sig.minAlarmNo;
    const masterGroup =
      (sig.rows[0].alarmGroup as "A" | "B" | "C" | null) ?? severityToGroup(sig.rows[0].severity);
    // Source description: strip per-condition suffix (e.g. " - HighHigh", "(H)")
    // that the operator adds in mias-io for HMI clarity. The JMobile description
    // already gets a level letter prefix + level label, so a re-suffixed source
    // double-tags. Älvelie convention: "<sigDescription>" without level wording.
    const masterMessage = sig.rows[0].message ?? `Analog signal ${sig.sigId}`;
    const baseDescription = stripLevelSuffix(masterMessage);

    // Älvelie convention: only emit XML rows for conditions actually defined
    // in the DB. Indexing reserves 5 slots per analog signal regardless (so
    // `abAlarmAnalogueStateHMI[anaIdx*5+0..4]` is allocated by the PLC), but
    // the JMobile XML stays terse.
    for (const level of [...ANALOG_LEVELS, "SF"] as const) {
      const matching = sig.rows.find((r) => r.condition === level);
      if (!matching) continue;  // skip levels with no DB row

      const offset = ANALOG_LEVEL_OFFSET[level];
      const letter = ANALOG_LEVEL_LETTER[level];
      const description = `${masterNo}${letter}. ${baseDescription} - ${ANALOG_LEVEL_LABEL[level]}`;
      out.push({
        name: `${alarmName(masterNo)}${ANALOG_LEVEL_SUFFIX[level]}`,
        group: matching.alarmGroup ?? masterGroup,
        sourceArray: "abAlarmAnalogueStateHMI",
        ackArray: "axAlarmAnalogueAcksHMI",
        sourceIndex: anaIdx * 5 + offset,
        customField2: "ANA",
        alarmNo: masterNo,
        description,
        enabled: true,
        signalId: sig.sigId,
        level,
      });
    }
  });

  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// File renderers
// ────────────────────────────────────────────────────────────────────────────

export function renderExportedAlarmsXml(input: ProjectExportInput): string {
  const entries = buildEntries(input.alarms);
  const body = entries
    .map((e) =>
      renderAlarmElement({
        name: e.name,
        group: e.group,
        sourceArray: e.sourceArray,
        ackArray: e.ackArray,
        sourceIndex: e.sourceIndex,
        customField2: e.customField2,
        alarmNo: e.alarmNo,
        description: e.description,
        enabled: e.enabled,
      }),
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<alarms xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
${PLACEHOLDER_ALARM}
${body}
</alarms>
`;
}

export function renderAlarmTexterXml(input: ProjectExportInput): string {
  const entries = buildEntries(input.alarms);
  const messages = entries
    .map((e, i) => `\t<MessageDescription index="${i + 1}" langName="L1">${xesc(e.description)}</MessageDescription>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<TextMessages xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
${messages}
</TextMessages>
`;
}

export function renderSetAlarmTableJs(input: ProjectExportInput): string {
  // aT(pos, posNoTxt, alarmNo, masterName, lLName, lName, hName, hhName, sfName)
  // For digitals: only masterName populated (others empty strings).
  // For analog signals: masterName = AlarmNNN, others = AlarmNNN_LL etc.
  const entries = buildEntries(input.alarms);
  // Group analog 5-rows back into one aT call per master, plus one aT per discrete.
  const lines: string[] = [];
  let pos = 1;
  // Walk in alarmNo order — but entries are already digital-first then analog-grouped.
  // For digitals, each entry = one aT. For analog, the 5 entries belonging to one signal
  // produce one aT call.
  const seenAnalog = new Set<number>();
  for (const e of entries) {
    if (e.customField2 === "DIG") {
      lines.push(`aT(${pos++},"${e.alarmNo}",${e.alarmNo},"${e.name}","","","","","");`);
    } else if (!seenAnalog.has(e.signalId)) {
      seenAnalog.add(e.signalId);
      // Each level may or may not exist in the entries (renderer skips
      // levels with no DB row). Fall back to "" — matches Älvelie's JS
      // table convention for absent levels.
      const lookup = (lvl: string) =>
        entries.find((x) => x.signalId === e.signalId && x.level === lvl)?.name ?? "";
      lines.push(
        `aT(${pos++},"${e.alarmNo}",${e.alarmNo},"${alarmName(e.alarmNo)}","${lookup("LOW_LOW")}","${lookup("LOW")}","${lookup("HIGH")}","${lookup("HIGH_HIGH")}","${lookup("SF")}");`,
      );
    }
  }
  return `// Auto-generated by mias-io for project ${input.projectId} (${input.projectName}).
// Paste into JMobile's Startup script after the //PASTE FROM EXCEL marker
// inside the setAlarmTable_Ver2(...) handler.
${lines.join("\n")}
`;
}

/** Convenience — render all three files as in-memory strings. */
export function renderAllJmobileFiles(input: ProjectExportInput): {
  "ExportedAlarms.xml": string;
  "AlarmTexter.xml": string;
  "setAlarmTable.js": string;
} {
  return {
    "ExportedAlarms.xml": renderExportedAlarmsXml(input),
    "AlarmTexter.xml": renderAlarmTexterXml(input),
    "setAlarmTable.js": renderSetAlarmTableJs(input),
  };
}
