/**
 * MIAS-IO PLC Code Generator
 * Generates CODESYS / METS_Lib output files for a project (equivalent to Alveli BX–CK columns).
 *
 * Usage: npx tsx src/scripts/generate-plc-exports.ts [projectId]
 *        Defaults to project 1.
 */

import { PrismaClient } from "../../prisma/generated/prisma/client/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });
const PROJECT_ID = Number(process.argv[2] ?? 1);
const OUTPUT_DIR = path.join(process.cwd(), "exports", "PLC");

// ─── EU unit → eUnit enum ───────────────────────────────────────────────────

function euToEnum(unit: string | null | undefined): string {
  if (!unit) return "eUnit.None";
  const u = unit.trim();
  if (u.endsWith("%")) return "eUnit.Percent";
  if (u === "°") return "eUnit.Degrees";
  if (u === "°C") return "eUnit.DegreesC";
  if (u === "A") return "eUnit.Ampere";
  if (u === "A DC") return "eUnit.AmpereDC";
  if (u.endsWith("Bar")) return "eUnit.Bar";
  if (u === "h") return "eUnit.Hours";
  if (u === "Hz") return "eUnit.Hz";
  if (u === "Knots") return "eUnit.Knots";
  if (u === "kW") return "eUnit.kW";
  if (u === "kVA") return "eUnit.kVA";
  if (u === "kVAh") return "eUnit.kVAh";
  if (u === "kVAr") return "eUnit.kVAr";
  if (u === "kVArh") return "eUnit.kVArh";
  if (u === "kWh") return "eUnit.kWh";
  if (u === "L/h") return "eUnit.Lh";
  if (u === "Nm") return "eUnit.Nm";
  if (u === "RPM") return "eUnit.RPM";
  if (u === "V") return "eUnit.Volts";
  if (u === "V AC") return "eUnit.VoltsAC";
  if (u === "V DC" || u.endsWith("VDC")) return "eUnit.VoltsDC";
  if (u === "mm") return "eUnit.mm";
  if (u === "ISO 4406:1999") return "eUnit.ISO_4406_1999";
  return `eUnit.${u}`;
}

// ─── BV: full tag with GVL prefix ───────────────────────────────────────────

function buildBV(gvlName: string | null | undefined, tag: string | null): string {
  if (!gvlName || !tag) return tag ?? "";
  let prefix = gvlName;
  if (prefix === "strStartStopmodes") prefix = "GVL_Settings";
  else prefix = prefix.replace("strSettings", "GVL_Settings.Settings");
  return `${prefix}.${tag}`;
}

// ─── BW: clear text description ─────────────────────────────────────────────

function buildBW(
  systemName: string | null,
  componentTag: string | null,
  description: string | null,
  gvlName: string | null
): string {
  if (!description || !gvlName) return "";
  return [systemName, componentTag ? `${componentTag}:` : null, description]
    .filter(Boolean)
    .join(" ")
    .trim();
}

// ─── Alarm type ──────────────────────────────────────────────────────────────

type AlarmType = "" | "DIG" | "ANA";

function computeAlarmType(
  signalType: string,
  plcDataType: string | null,
  anaToDigAlarm: boolean,
  hasAnyAlarm: boolean
): AlarmType {
  if (!hasAnyAlarm) return "";
  if (plcDataType === "BOOL" || plcDataType === "BIT" || anaToDigAlarm || signalType === "DISCRETE") return "DIG";
  return "ANA";
}

// ─── Gain / Offset ───────────────────────────────────────────────────────────

function computeGain(rawMin: number | null, rawMax: number | null, scaleMin: number | null, scaleMax: number | null): number | null {
  if (rawMin == null || rawMax == null || scaleMin == null || scaleMax == null) return null;
  const range = rawMax - rawMin;
  if (range === 0) return null;
  return (scaleMax - scaleMin) / range;
}

function computeOffset(gain: number | null, rawMin: number | null, scaleMin: number | null): number | null {
  if (gain == null || rawMin == null || scaleMin == null) return null;
  return scaleMin - gain * rawMin;
}

function fmtNum(v: number | null | undefined): string {
  if (v == null) return "0";
  return String(Math.round(v * 1e6) / 1e6);
}

// ─── Tag sanitize (for alarm name: remove . [ ] ) ───────────────────────────

function alarmTagName(tag: string | null): string {
  if (!tag) return "UNNAMED";
  return tag.replace(/\./g, "_").replace(/[\[\]]/g, "");
}

// ─── Modbus address computation ──────────────────────────────────────────────

type CardSlot = {
  id: number;
  slotPosition: number;
  cardType: string; // IoCardType enum
  maxInputChannels: number | null;
  maxOutputChannels: number | null;
};

type ModbusOffsets = {
  inputWordOffset: number; // word offset in BCInputData for this card
  outputWordOffset: number; // word offset in BCOutputData for this card
};

function computeModbusCardOffsets(cards: CardSlot[]): Map<number, ModbusOffsets> {
  const sorted = [...cards].sort((a, b) => a.slotPosition - b.slotPosition);
  const result = new Map<number, ModbusOffsets>();
  let inWord = 0; // cumulative input words used
  let outWord = 0; // cumulative output words used

  for (const card of sorted) {
    result.set(card.id, { inputWordOffset: inWord, outputWordOffset: outWord });
    const inCh = card.maxInputChannels ?? 0;
    const outCh = card.maxOutputChannels ?? 0;
    switch (card.cardType) {
      case "DI":
      case "MIXED":
        inWord += Math.ceil(inCh / 16);
        break;
      case "AI":
        inWord += inCh;
        break;
      case "COUNTER":
        inWord += inCh * 2; // DWord = 2 words each
        break;
    }
    switch (card.cardType) {
      case "DO":
      case "MIXED":
        outWord += Math.ceil(outCh / 16);
        break;
      case "AO":
        outWord += outCh;
        break;
    }
  }
  return result;
}

function computeModbusAddress(
  cardType: string,
  channelPosition: number,
  cardOffset: ModbusOffsets,
  modbusInputBase: number,
  modbusOutputBase: number
): string | null {
  const ch = channelPosition; // 0-based
  switch (cardType) {
    case "DI": {
      const wordIdx = modbusInputBase + cardOffset.inputWordOffset + Math.floor(ch / 16);
      const bit = ch % 16;
      return `[${wordIdx}].${bit}`;
    }
    case "DO": {
      const wordIdx = modbusOutputBase + cardOffset.outputWordOffset + Math.floor(ch / 16);
      const bit = ch % 16;
      return `[${wordIdx}].${bit}`;
    }
    case "AI": {
      const wordIdx = modbusInputBase + cardOffset.inputWordOffset + ch;
      return `[${wordIdx}]`;
    }
    case "AO": {
      const wordIdx = modbusOutputBase + cardOffset.outputWordOffset + ch;
      return `[${wordIdx}]`;
    }
    default:
      return null;
  }
}

// ─── BX: variable FB declaration ────────────────────────────────────────────

function genBX(tag: string, plcDataType: string): string {
  if (!tag) return "";
  const type = plcDataType === "WORD" || plcDataType === "INT" ? "REAL" : plcDataType;
  return `${tag}: ${type};`;
}

// ─── BY: GVL declaration ─────────────────────────────────────────────────────

function genBY(opts: {
  tag: string | null;
  gvlName: string | null;
  plcDataType: string | null;
  ioType: string | null; // AI/AO/DI/DO
  trigger: string | null; // NO/NC
  plcAddress: string | null;
  isRetain: boolean;
  isPersistent: boolean;
  fbNameOverride: string | null;
  cardArticleNumber: string | null;
  plcId: string | null;
  cardId: string | null;
  channelPos: number | null;
  useTankLevel: boolean;
}): string {
  const { tag, gvlName, plcDataType, ioType, trigger, plcAddress, isRetain, isPersistent, fbNameOverride, cardArticleNumber, plcId, cardId, channelPos, useTankLevel } = opts;
  if (!tag || !gvlName || !plcDataType) return "//TBD";
  if (fbNameOverride) return ""; // part of a struct, skip individual decl
  // 750-495 cards in GVL_Physical → skip
  if (gvlName === "GVL_Physical" && cardArticleNumber?.endsWith("495")) return "";

  const retainPrefix = (isRetain || isPersistent)
    ? `END_VAR VAR_GLOBAL ${isPersistent ? "PERSISTENT" : "RETAIN"} `
    : "";
  const retainSuffix = (isRetain || isPersistent) ? " END_VAR VAR_GLOBAL" : "";

  const hwComment = plcId && cardId && channelPos != null
    ? ` (*${plcId}_${cardId}.${channelPos}*)`
    : "";

  const atClause = plcAddress ? ` AT ${plcAddress}` : "";
  const isAnalog = plcDataType === "INT" || plcDataType === "WORD" || plcDataType === "REAL";

  if (gvlName === "GVL_Physical" && isAnalog && (ioType === "AI" || ioType === "AO")) {
    const realDecl = `${tag}: REAL;${hwComment}`;
    const rawDecl = `{attribute 'symbol' := 'none'}${tag}_RAW${atClause}: INT;${hwComment}`;
    const faultDecl = `${tag}_SensorFaultAlarm: BOOL;`;
    const tankDecls = useTankLevel ? `   ${tag}_m3: REAL;          ${tag}_cm: REAL;` : "";
    return `${retainPrefix}${realDecl}          ${rawDecl}          ${faultDecl}${tankDecls ? "          " + tankDecls : ""}${retainSuffix}`;
  }

  // Digital or non-physical analog
  let line = `${tag}${atClause}: ${plcDataType};`;
  if (gvlName === "GVL_Physical") {
    line += ` //${ioType} ${plcId}_${cardId}.${channelPos}`;
    if (trigger === "NC") line += " NC (inverted) signal. Physical LOW = PLC TRUE.";
    else if (trigger === "NO") line += " NO (normal) signal. Physical HIGH = PLC TRUE.";
  }
  return `${retainPrefix}${line}${retainSuffix}`;
}

// ─── CA: GVL_Alarms declaration ──────────────────────────────────────────────

function genCA(opts: { bz: AlarmType; alarmNo: number; tag: string; specialFb: string | null }): string {
  if (!opts.bz) return "";
  const name = `Alarm${String(opts.alarmNo).padStart(3, "0")}_${alarmTagName(opts.tag)}`;
  const fb = opts.specialFb ?? (opts.bz === "DIG" ? "FB_AlarmDigital" : "FB_AlarmAnalogue");
  return `${name}: ${fb};`;
}

// ─── CB/CJ: AlarmINIT / AlarmInitFAT ─────────────────────────────────────────

function genAlarmInit(opts: {
  bz: AlarmType;
  alarmNo: number;
  digIdx: number | null;
  anaIdx: number | null;
  tag: string;
  bw: string;
  alarmIdentifier: string; // e.g. "LL,L,H,HH"
  blockMask: string | null; // alarmBlockMask 5-char
  alarmGroup: string | null;
  noNc: string | null; // "NO" or "NC"
  gvlName: string | null;
  delaySeconds: number;
  // Analog alarm setpoints
  llSetpoint: number | null; llDelay: number;
  lSetpoint: number | null; lDelay: number;
  hSetpoint: number | null; hDelay: number;
  hhSetpoint: number | null; hhDelay: number;
  unit: string | null;
  fatMode: boolean; // true = CJ (force all enables, sensitivity=5)
}): string {
  if (!opts.bz) return "";
  const mask = opts.blockMask ?? "";
  const groupNum = opts.alarmGroup === "A" ? 0 : opts.alarmGroup === "B" ? 1 : opts.alarmGroup === "C" ? 2 : 0;

  if (opts.bz === "DIG") {
    const blockAll = opts.fatMode ? "TRUE" : (mask[0] === "1" ? "TRUE" : "FALSE");
    // NO/NC resolution: NC in GVL_Physical → TRUE, NC elsewhere → FALSE, NO → TRUE
    let noNcVal = "TRUE";
    if (opts.noNc === "NC" && opts.gvlName !== "GVL_Physical") noNcVal = "FALSE";
    else if (opts.noNc === "NC") noNcVal = "TRUE";
    const delay = opts.delaySeconds ?? 0;
    return (
      `METS_Lib.AlarmSettings.AssignSettingsDig(GVL_AlarmSettings.FactoryAlarmSettingsDigital[${opts.digIdx}],` +
      `${opts.alarmNo},${blockAll},${noNcVal},${delay},${groupNum}); //${opts.bw}`
    );
  }

  // ANA
  const sens = opts.fatMode ? "5" : "0";

  function enableFlag(maskPos: number, setpoint: number | null): string {
    if (opts.fatMode) return "TRUE";
    if (mask[maskPos] === "1") return "TRUE";
    if (setpoint == null || setpoint === 0) return "TRUE";
    return "FALSE";
  }
  function sp(v: number | null): string { return v == null || v === 0 ? "0" : String(v); }
  function dl(v: number): string { return String(v); }

  const llEn = enableFlag(4, opts.llSetpoint);
  const lEn  = enableFlag(3, opts.lSetpoint);
  const hEn  = enableFlag(2, opts.hSetpoint);
  const hhEn = enableFlag(1, opts.hhSetpoint);
  const sfEn = opts.fatMode ? "TRUE" : (mask[0] === "1" ? "TRUE" : "FALSE");

  const hasLL = !opts.alarmIdentifier.includes("LL") ? "TRUE" : "FALSE";
  const hasL  = !opts.alarmIdentifier.includes("L") || opts.alarmIdentifier.includes("LL") ? "TRUE" : "FALSE";
  const hasH  = !opts.alarmIdentifier.includes("H") || opts.alarmIdentifier.includes("HH") ? "TRUE" : "FALSE";
  const hasHH = !opts.alarmIdentifier.includes("HH") ? "TRUE" : "FALSE";
  const notPhysical = opts.gvlName === "GVL_Physical" ? "FALSE" : "TRUE";

  return (
    `METS_Lib.AlarmSettings.AssignSettingsAna(GVL_AlarmSettings.FactoryAlarmSettingsAnalogue[${opts.anaIdx}],` +
    `${opts.alarmNo},` +
    `${llEn},${sp(opts.llSetpoint)},${dl(opts.llDelay)},` +
    `${lEn},${sp(opts.lSetpoint)},${dl(opts.lDelay)},` +
    `${hEn},${sp(opts.hSetpoint)},${dl(opts.hDelay)},` +
    `${hhEn},${sp(opts.hhSetpoint)},${dl(opts.hhDelay)},` +
    `${sfEn},${sens},` +
    `${hasLL},${hasL},${hasH},${hasHH},${notPhysical},` +
    `${euToEnum(opts.unit)}); //${opts.bw} (${opts.alarmIdentifier})`
  );
}

// ─── CC: alarm handling ───────────────────────────────────────────────────────

function genCC(opts: {
  bz: AlarmType;
  alarmNo: number;
  tag: string;
  bv: string;
  digIdx: number | null;
  anaIdx: number | null;
  plcDataType: string | null;
  gvlName: string | null;
  specialFb: string | null;
  specialInput: string | null;
  anaToDigAlarm: boolean;
}): string {
  if (!opts.bz) return "";
  const name = `GVL_Alarms.Alarm${String(opts.alarmNo).padStart(3, "0")}_${alarmTagName(opts.tag)}`;

  if (opts.bz === "DIG") {
    let line = `${name}(Input:=${opts.bv}`;
    if (opts.anaToDigAlarm) line += ` ${opts.anaToDigAlarm}`;
    line += `,AlarmSettings:=GVL_AlarmSettings.AlarmSettingsDigital[${opts.digIdx}],AlarmDigNo:=${opts.digIdx}`;
    if (opts.specialFb === "FB_Alarm_FollowSetpoint" && opts.specialInput) line += `,SetpointPos:=${opts.specialInput}`;
    if (opts.specialFb === "FB_AlarmAnalogue_LubrPress" && opts.specialInput) line += `,RPM:=${opts.specialInput}`;
    return line + ");";
  }

  // ANA
  const cast = opts.plcDataType === "UDINT" ? "UDINT_TO_REAL(" : "";
  const castClose = opts.plcDataType === "UDINT" ? ")" : "";
  let line = `${name}(Input:=${cast}${opts.bv}${castClose}`;
  line += `,AlarmSettings:=GVL_AlarmSettings.AlarmSettingsAnalogue[${opts.anaIdx}],AlarmAnaNo:=${opts.anaIdx}`;
  if (opts.gvlName === "GVL_Physical") line += `,SensorFault:=${opts.gvlName}.${opts.tag}_SensorFaultAlarm`;
  return line + ");";
}

// ─── CD: alarm suppression ────────────────────────────────────────────────────

function genCD(alarmNo: number, tag: string, suppressionSt: string | null): string {
  if (!suppressionSt) return "";
  return `GVL_Alarms.Alarm${String(alarmNo).padStart(3, "0")}_${alarmTagName(tag)}.Suppression := ${suppressionSt};`;
}

// ─── CE: GVL_AnalogScaling declaration ───────────────────────────────────────

function genCE(opts: {
  seqNo: number;
  tag: string;
  bw: string;
  ioType: string | null;
  plcDataType: string | null;
  gvlName: string | null;
  cardArticleNumber: string | null;
  useTankLevel: boolean;
  rawZero: number | null; // S: deadband trigger
  scalingFbOverride: string | null; // Z
  // sensor fail overrides
  sfRaw: number | null; sfMargin: number | null; sfBehavior: string | null; sfDelay: number | null;
  // deadband overrides
  dbMin: number | null; dbZero: number | null; dbMax: number | null;
}): string {
  const { seqNo, tag, bw, ioType, plcDataType, gvlName, cardArticleNumber, useTankLevel, rawZero, scalingFbOverride } = opts;
  const isAnalog = plcDataType === "INT" || plcDataType === "WORD" || plcDataType === "REAL";
  if (!isAnalog) return "";
  if (gvlName !== "GVL_Physical") return "";
  if (!cardArticleNumber) return "";
  if (cardArticleNumber.endsWith("652") || cardArticleNumber.endsWith("495")) return "";

  const n = seqNo;
  const comment = ` //${bw}`;

  if (ioType === "AI" && useTankLevel) {
    return `FB_TankLevel_${n}: FB_TankLevel;${comment}`;
  }

  if (ioType === "AI" && rawZero != null) {
    // DeadBand FB
    const fb = scalingFbOverride ?? "FB_AnalogueIn_DeadBand_rev3";
    const overrides = buildSFOverrides(opts);
    return `FB_AnalogueLeverIn_${n}: ${fb}${overrides};${comment}`;
  }

  if (ioType === "AI") {
    const fb = scalingFbOverride ?? "FB_AnalogueIn";
    const overrides = buildSFOverrides(opts, false);
    return `FB_AnalogueIn_${n}: ${fb}${overrides};${comment}`;
  }

  if (ioType === "AO") {
    const fb = scalingFbOverride ?? "FB_AnalogueOut";
    return `FB_AnalogueOut_${n}: ${fb};${comment}`;
  }

  return "";
}

function buildSFOverrides(opts: { sfRaw: number | null; sfMargin: number | null; sfBehavior: string | null; sfDelay: number | null; dbMin: number | null; dbZero: number | null; dbMax: number | null }, includeDeadband = true): string {
  const parts: string[] = [];
  if (opts.sfRaw != null) parts.push(`RawValueSensorFailBehavior:=${opts.sfRaw}`);
  if (opts.sfMargin != null) parts.push(`RawValueSensorFailMargin:=${opts.sfMargin}`);
  if (opts.sfBehavior) parts.push(`SensorFailBehavior:=${opts.sfBehavior}`);
  if (opts.sfDelay != null) parts.push(`SensorFailDelay:=${opts.sfDelay}`);
  if (includeDeadband) {
    if (opts.dbMin != null) parts.push(`DeadBand_Min:=${opts.dbMin}`);
    if (opts.dbZero != null) { parts.push(`DeadBand_Zero_to_Pos:=${opts.dbZero}`); parts.push(`DeadBand_Zero_to_Neg:=${opts.dbZero}`); }
    if (opts.dbMax != null) parts.push(`DeadBand_Max:=${opts.dbMax}`);
  }
  if (parts.length === 0) return "";
  return ` := (${parts.join(",")})`;
}

// ─── CF: analog scaling body ─────────────────────────────────────────────────

function genCF(opts: {
  seqNo: number;
  tag: string;
  ioType: string | null;
  plcDataType: string | null;
  gvlName: string | null;
  cardArticleNumber: string | null;
  useTankLevel: boolean;
  rawZero: number | null;
  scalingFbOverride: string | null;
  rawMin: number | null; rawMax: number | null;
  scaleMin: number | null; scaleMax: number | null;
  gain: number | null; offset: number | null;
  inputTypeCode: string | null; // for potentiometer detection
  tankScalingRef: string | null; // Y: tank scaling name (from tag for now)
}): string {
  const { seqNo, tag, ioType, plcDataType, gvlName, cardArticleNumber, useTankLevel, rawZero, scalingFbOverride, rawMin, rawMax, scaleMin, scaleMax, gain, offset } = opts;
  const isAnalog = plcDataType === "INT" || plcDataType === "WORD" || plcDataType === "REAL";
  if (!isAnalog) return "";
  if (gvlName !== "GVL_Physical") return "";
  if (!cardArticleNumber) return "";
  if (cardArticleNumber.endsWith("652") || cardArticleNumber.endsWith("495")) return "";

  const n = seqNo;
  const raw = `GVL_Physical.${tag}_RAW`;
  const out = `GVL_Physical.${tag}`;
  const sf = `GVL_Physical.${tag}_SensorFaultAlarm`;
  const analogueType = cardArticleNumber.slice(-3);
  const gainStr = fmtNum(gain);
  const offsetStr = fmtNum(offset);

  const isPot = opts.inputTypeCode?.toLowerCase().includes("pot");
  const sensorTypeParam = cardArticleNumber === "750-451" && isPot
    ? ",SensorType:=eAnalogInSensorType.Resistance_5kOhm"
    : "";

  if (ioType === "AI" && useTankLevel) {
    const tankRef = opts.tankScalingRef ?? tag;
    return (
      `GVL_AnalogScaling.FB_TankLevel_${n}(RawInput:=${raw},AnalogueType:='${analogueType}',` +
      `Gain:=${gainStr},Offset:=${offsetStr},FilterTime:=2000,` +
      `RawLimitLow:=${fmtNum(rawMin)},RawLimitHigh:=${fmtNum(rawMax)},` +
      `OutputLimitLow:=${fmtNum(scaleMin)},OutputLimitHigh:=${fmtNum(scaleMax)},` +
      `SensorFailure=>${sf},Output=>${out},` +
      `TankPoints:=GVL_Settings.Settings.TankScaling.${tankRef},` +
      `ScaledValue_m3=>GVL_Physical.${tag}_m3,ScaledValue_cm=>GVL_Physical.${tag}_cm);`
    );
  }

  if (ioType === "AI" && rawZero != null) {
    const fb = scalingFbOverride ?? "FB_AnalogueLeverIn";
    return (
      `GVL_AnalogScaling.${fb}_${n}(RawInput:=${raw},AnalogueType:='${analogueType}',` +
      `Gain:=${gainStr},Offset:=${offsetStr},FilterTime:=0,` +
      `RawLimitLow:=${Math.ceil(rawMin ?? 0)},RawValueZero:=${fmtNum(rawZero)},RawLimitHigh:=${Math.floor(rawMax ?? 0)},` +
      `OutputLimitLow:=${fmtNum(scaleMin)},OutputLimitHigh:=${fmtNum(scaleMax)},` +
      `SensorFailure=>${sf},Output=>${out}${sensorTypeParam});`
    );
  }

  if (ioType === "AI") {
    const fb = scalingFbOverride ?? "FB_AnalogueIn";
    return (
      `GVL_AnalogScaling.${fb}_${n}(RawInput:=${raw},AnalogueType:='${analogueType}',` +
      `Gain:=${gainStr},Offset:=${offsetStr},FilterTime:=0,` +
      `RawLimitLow:=${Math.ceil(rawMin ?? 0)},RawLimitHigh:=${Math.floor(rawMax ?? 0)},` +
      `OutputLimitLow:=${fmtNum(scaleMin)},OutputLimitHigh:=${fmtNum(scaleMax)},` +
      `SensorFailure=>${sf},Output=>${out}${sensorTypeParam});`
    );
  }

  if (ioType === "AO") {
    const fb = scalingFbOverride ?? "FB_AnalogueOut";
    return (
      `GVL_AnalogScaling.${fb}_${n}(Input:=${out},AnalogueType:='${analogueType}',` +
      `Minimum:=${fmtNum(scaleMin)},Maximum:=${fmtNum(scaleMax)},` +
      `Gain:=${gainStr},Offset:=${offsetStr},OutputRAW=>${raw});`
    );
  }

  return "";
}

// ─── CH: Modbus IO input ──────────────────────────────────────────────────────

function genCH(opts: { tag: string; ioType: string | null; plcDataType: string | null; gvlName: string | null; modbusAddr: string | null }): string {
  if (opts.gvlName !== "GVL_Physical") return "";
  if (!opts.modbusAddr) return "";
  const { tag, ioType, plcDataType, modbusAddr } = opts;

  if (ioType === "AI") {
    const cast = plcDataType === "DINT" ? "DINT" : plcDataType === "UINT" ? "UINT" : plcDataType ?? "INT";
    return `GVL_Physical.${tag}_RAW := WORD_TO_${cast}(BCInputData${modbusAddr});`;
  }
  if (ioType === "DI") {
    const inv = false; // NC inversion is handled at PLC level via trigger
    return `GVL_Physical.${tag} := BCInputData${modbusAddr};`;
  }
  return "";
}

// ─── CI: Modbus IO output ─────────────────────────────────────────────────────

function genCI(opts: { tag: string; ioType: string | null; plcDataType: string | null; gvlName: string | null; modbusAddr: string | null }): string {
  if (opts.gvlName !== "GVL_Physical") return "";
  if (!opts.modbusAddr) return "";
  const { tag, ioType, plcDataType, modbusAddr } = opts;

  if (ioType === "AO") {
    const cast = plcDataType ?? "INT";
    return `BCOutputData${modbusAddr} := ${cast}_TO_WORD(GVL_Physical.${tag}_RAW);`;
  }
  if (ioType === "DO") {
    return `BCOutputData${modbusAddr} := GVL_Physical.${tag};`;
  }
  return "";
}

// ─── CK: logging ─────────────────────────────────────────────────────────────

function genCK(opts: { tag: string; gvlName: string | null; plcId: string | null; loggingIdx: number; loggingEnabled: boolean }): string {
  if (!opts.loggingEnabled) return "";
  const ref = opts.gvlName === "GVL_Physical" && opts.plcId === "D01"
    ? `GVL_Physical_Transfer.${opts.tag}`
    : `${opts.gvlName}.${opts.tag}`;
  return `AnyConversion(${ref},${opts.loggingIdx});`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Query all project signals with full details
  const project = await db.project.findUniqueOrThrow({
    where: { id: PROJECT_ID },
    select: {
      name: true,
      plcs: {
        select: {
          id: true,
          name: true,
          carriers: {
            select: {
              id: true,
              name: true,
              modbusInputBase: true,
              modbusOutputBase: true,
              cards: {
                select: {
                  id: true,
                  slotPosition: true,
                  cardType: true,
                  maxInputChannels: true,
                  maxOutputChannels: true,
                  hasDiagnostics: true,
                  diagnosticType: true,
                  catalog: { select: { articleNumber: true } },
                },
                orderBy: { slotPosition: "asc" },
              },
            },
          },
        },
      },
    },
  });

  const signals = await db.signal.findMany({
    where: { projectId: PROJECT_ID },
    orderBy: [{ gvlId: "asc" }, { tag: "asc" }],
    select: {
      id: true,
      tag: true,
      description: true,
      signalType: true,
      origin: true,
      direction: true,
      gvlId: true,
      gvl: { select: { name: true } },
      ioCardId: true,
      channelPosition: true,
      isDiagnostic: true,
      diagnosticParentId: true,
      systemId: true,
      componentTag: true,
      system: { select: { name: true } },
      ioCard: {
        select: {
          id: true,
          slotPosition: true,
          cardType: true,
          carrierId: true,
          maxInputChannels: true,
          maxOutputChannels: true,
          catalog: { select: { articleNumber: true } },
          carrier: {
            select: {
              id: true,
              name: true,
              modbusInputBase: true,
              modbusOutputBase: true,
              plcId: true,
              plc: { select: { name: true } },
            },
          },
        },
      },
      alarmGroup: true,
      alarmBlockMask: true,
      suppressionSt: true,
      specialAlarmFb: true,
      specialAlarmInput: true,
      anaToDigAlarm: true,
      fatBlock: true,
      isRetain: true,
      isPersistent: true,
      loggingEnabled: true,
      fbNameOverride: true,
      analogSignal: {
        select: {
          rawMin: true, rawMax: true, rawZero: true,
          scaleMin: true, scaleMax: true,
          deadbandRawMin: true, deadbandRawZero: true, deadbandRawMax: true,
          engineeringUnit: { select: { symbol: true } },
          plcDataTypeCatalog: { select: { code: true } },
          useTankLevel: true,
          scalingFbOverride: true,
          sensorFailRaw: true, sensorFailMargin: true,
          sensorFailBehavior: true, sensorFailDelayMs: true,
          inputType: { select: { code: true } },
          alarms: {
            select: { condition: true, setpoint: true, delaySeconds: true, alarmGroup: true },
            orderBy: { condition: "asc" },
          },
        },
      },
      discreteSignal: {
        select: {
          trigger: true,
          plcDataType: { select: { code: true } },
          alarms: {
            select: { condition: true, delaySeconds: true, alarmGroup: true },
            orderBy: { condition: "asc" },
          },
        },
      },
    },
  });

  // Build Modbus offset maps per carrier
  const modbusOffsetMap = new Map<number, Map<number, ModbusOffsets>>(); // carrierId → cardId → offsets
  for (const plc of project.plcs) {
    for (const carrier of plc.carriers) {
      const offsetMap = computeModbusCardOffsets(
        carrier.cards.map((c) => ({
          id: c.id,
          slotPosition: c.slotPosition,
          cardType: c.cardType,
          maxInputChannels: c.maxInputChannels,
          maxOutputChannels: c.maxOutputChannels,
        }))
      );
      modbusOffsetMap.set(carrier.id, offsetMap);
    }
  }

  // Also build AT address map (reuse existing logic)
  const { computeCarrierAddresses } = await import("../app/api/codesys/_address");
  type Offsets = { di: number; do: number; ai: number; ao: number };
  const atAddressMap = new Map<number, string | null>();
  for (const plc of project.plcs) {
    let globalOffsets: Offsets = { di: 0, do: 0, ai: 0, ao: 0 };
    for (const carrier of plc.carriers) {
      const carrierSignals = signals.filter((s) => s.ioCard?.carrierId === carrier.id);
      const { addresses, nextOffsets } = computeCarrierAddresses(
        carrier.cards.map((c) => ({ id: c.id, slotPosition: c.slotPosition, cardType: c.cardType, maxInputChannels: c.maxInputChannels, maxOutputChannels: c.maxOutputChannels, hasDiagnostics: c.hasDiagnostics, diagnosticType: c.diagnosticType })),
        carrierSignals.map((s) => ({ id: s.id, ioCardId: s.ioCardId, channelPosition: s.channelPosition, direction: s.direction, origin: s.origin, isDiagnostic: s.isDiagnostic })),
        globalOffsets
      );
      globalOffsets = nextOffsets;
      for (const [sigId, addr] of addresses) atAddressMap.set(sigId, addr);
    }
  }

  // ── Accumulate output buffers ──────────────────────────────────────────────
  const bxLines: string[] = [];
  const byByGvl = new Map<string, string[]>(); // gvlName → lines
  const caLines: string[] = [];
  const cbLines: string[] = [];
  const ccLines: string[] = [];
  const cdLines: string[] = [];
  const ceLines: string[] = [];
  const cfLines: string[] = [];
  const chLines: string[] = [];
  const ciLines: string[] = [];
  const cjLines: string[] = [];
  const ckLines: string[] = [];

  // Sequential counters
  let bo = 0; // all signals with tag
  let bp = 0; // all alarmed signals
  let bq = 0; // DIG alarms
  let br = 0; // ANA alarms
  let cl = 0; // logged signals

  for (const sig of signals) {
    const tag = sig.tag;
    if (!tag) continue;

    const gvlName = sig.gvl?.name ?? null;
    const plcDataType =
      sig.analogSignal?.plcDataTypeCatalog?.code ??
      sig.discreteSignal?.plcDataType?.code ??
      null;

    // J: IO type
    let ioType: string | null = null;
    if (sig.signalType === "ANALOG") ioType = sig.direction === "OUTPUT" ? "AO" : "AI";
    else if (sig.signalType === "DISCRETE") ioType = sig.direction === "OUTPUT" ? "DO" : "DI";

    const trigger = sig.discreteSignal?.trigger ?? null;
    const cardArticleNumber = sig.ioCard?.catalog?.articleNumber ?? null;
    const plcId = sig.ioCard?.carrier?.plc?.name ?? null;
    const cardSlotId = sig.ioCard ? `${sig.ioCard.carrierId}_${sig.ioCard.slotPosition}` : null;
    const channelPos = sig.channelPosition;
    const atAddress = atAddressMap.get(sig.id) ?? null;

    // Modbus address
    let modbusAddr: string | null = null;
    if (sig.ioCardId && sig.channelPosition != null && sig.ioCard) {
      const carrierId = sig.ioCard.carrierId;
      const cardId = sig.ioCardId;
      const cardOffsets = modbusOffsetMap.get(carrierId)?.get(cardId);
      if (cardOffsets) {
        modbusAddr = computeModbusAddress(
          sig.ioCard.cardType,
          sig.channelPosition,
          cardOffsets,
          sig.ioCard.carrier.modbusInputBase ?? 0,
          sig.ioCard.carrier.modbusOutputBase ?? 0
        );
      }
    }

    const ana = sig.analogSignal;
    const disc = sig.discreteSignal;

    const rawMin = ana?.rawMin != null ? Number(ana.rawMin) : null;
    const rawMax = ana?.rawMax != null ? Number(ana.rawMax) : null;
    const rawZero = ana?.rawZero != null ? Number(ana.rawZero) : null;
    const scaleMin = ana?.scaleMin != null ? Number(ana.scaleMin) : null;
    const scaleMax = ana?.scaleMax != null ? Number(ana.scaleMax) : null;
    const gain = computeGain(rawMin, rawMax, scaleMin, scaleMax);
    const offset = computeOffset(gain, rawMin, scaleMin);
    const unit = ana?.engineeringUnit?.symbol ?? null;

    const bw = buildBW(sig.system?.name ?? null, sig.componentTag, sig.description, gvlName);
    const bv = buildBV(gvlName, tag);

    // BZ
    const hasAnyAlarm = (ana?.alarms?.length ?? 0) > 0 || (disc?.alarms?.length ?? 0) > 0;
    const bz = computeAlarmType(sig.signalType, plcDataType, sig.anaToDigAlarm, hasAnyAlarm);

    // Sequential counters
    bo++;
    let thisBp: number | null = null;
    let thisBq: number | null = null;
    let thisBr: number | null = null;

    if (bz) {
      bp++;
      thisBp = bp;
      if (bz === "DIG") { bq++; thisBq = bq; }
      if (bz === "ANA") { br++; thisBr = br; }
    }

    let thisCl: number | null = null;
    if (sig.loggingEnabled) { cl++; thisCl = cl; }

    // Alarm setpoints
    const llAlarm = ana?.alarms.find((a) => a.condition === "LOW_LOW");
    const lAlarm  = ana?.alarms.find((a) => a.condition === "LOW");
    const hAlarm  = ana?.alarms.find((a) => a.condition === "HIGH");
    const hhAlarm = ana?.alarms.find((a) => a.condition === "HIGH_HIGH");

    const alarmIdentifier = [
      llAlarm ? "LL" : null, lAlarm ? "L" : null,
      hAlarm ? "H" : null, hhAlarm ? "HH" : null,
    ].filter(Boolean).join(",");

    const alarmInitOpts = {
      bz,
      alarmNo: thisBp ?? 0,
      digIdx: thisBq,
      anaIdx: thisBr,
      tag,
      bw,
      alarmIdentifier,
      blockMask: sig.alarmBlockMask,
      alarmGroup: sig.alarmGroup,
      noNc: trigger,
      gvlName,
      delaySeconds: disc?.alarms[0]?.delaySeconds ?? 0,
      llSetpoint: llAlarm ? Number(llAlarm.setpoint) : null,
      llDelay: llAlarm?.delaySeconds ?? 0,
      lSetpoint: lAlarm ? Number(lAlarm.setpoint) : null,
      lDelay: lAlarm?.delaySeconds ?? 0,
      hSetpoint: hAlarm ? Number(hAlarm.setpoint) : null,
      hDelay: hAlarm?.delaySeconds ?? 0,
      hhSetpoint: hhAlarm ? Number(hhAlarm.setpoint) : null,
      hhDelay: hhAlarm?.delaySeconds ?? 0,
      unit,
      fatMode: false,
    };

    // ── BX
    if (plcDataType) {
      const bxLine = genBX(tag, plcDataType);
      if (bxLine) bxLines.push(bxLine);
    }

    // ── BY (grouped by GVL)
    if (gvlName) {
      const byLine = genBY({
        tag, gvlName, plcDataType,
        ioType, trigger, plcAddress: atAddress,
        isRetain: sig.isRetain, isPersistent: sig.isPersistent,
        fbNameOverride: sig.fbNameOverride,
        cardArticleNumber,
        plcId, cardId: cardSlotId, channelPos,
        useTankLevel: ana?.useTankLevel ?? false,
      });
      if (byLine) {
        if (!byByGvl.has(gvlName)) byByGvl.set(gvlName, []);
        byByGvl.get(gvlName)!.push(byLine);
      }
    }

    // ── CA
    const caLine = genCA({ bz, alarmNo: thisBp ?? 0, tag, specialFb: sig.specialAlarmFb });
    if (caLine) caLines.push(caLine);

    // ── CB
    const cbLine = genAlarmInit({ ...alarmInitOpts, fatMode: false });
    if (cbLine) cbLines.push(cbLine);

    // ── CC
    const ccLine = genCC({ bz, alarmNo: thisBp ?? 0, tag, bv, digIdx: thisBq, anaIdx: thisBr, plcDataType, gvlName, specialFb: sig.specialAlarmFb, specialInput: sig.specialAlarmInput, anaToDigAlarm: sig.anaToDigAlarm });
    if (ccLine) ccLines.push(ccLine);

    // ── CD
    const cdLine = genCD(thisBp ?? 0, tag, sig.suppressionSt);
    if (cdLine) cdLines.push(cdLine);

    // ── CE
    const ceLine = genCE({ seqNo: bo, tag, bw, ioType, plcDataType, gvlName, cardArticleNumber, useTankLevel: ana?.useTankLevel ?? false, rawZero, scalingFbOverride: ana?.scalingFbOverride ?? null, sfRaw: ana?.sensorFailRaw != null ? Number(ana.sensorFailRaw) : null, sfMargin: ana?.sensorFailMargin != null ? Number(ana.sensorFailMargin) : null, sfBehavior: ana?.sensorFailBehavior ?? null, sfDelay: ana?.sensorFailDelayMs ?? null, dbMin: ana?.deadbandRawMin != null ? Number(ana.deadbandRawMin) : null, dbZero: ana?.deadbandRawZero != null ? Number(ana.deadbandRawZero) : null, dbMax: ana?.deadbandRawMax != null ? Number(ana.deadbandRawMax) : null });
    if (ceLine) ceLines.push(ceLine);

    // ── CF
    const cfLine = genCF({ seqNo: bo, tag, ioType, plcDataType, gvlName, cardArticleNumber, useTankLevel: ana?.useTankLevel ?? false, rawZero, scalingFbOverride: ana?.scalingFbOverride ?? null, rawMin, rawMax, scaleMin, scaleMax, gain, offset, inputTypeCode: ana?.inputType?.code ?? null, tankScalingRef: tag });
    if (cfLine) cfLines.push(cfLine);

    // ── CH/CI
    const chLine = genCH({ tag, ioType, plcDataType, gvlName, modbusAddr });
    if (chLine) chLines.push(chLine);
    const ciLine = genCI({ tag, ioType, plcDataType, gvlName, modbusAddr });
    if (ciLine) ciLines.push(ciLine);

    // ── CJ (FAT version)
    const cjLine = genAlarmInit({ ...alarmInitOpts, fatMode: true });
    if (cjLine) cjLines.push(cjLine);

    // ── CK
    const ckLine = genCK({ tag, gvlName, plcId, loggingIdx: thisCl ?? 0, loggingEnabled: sig.loggingEnabled });
    if (ckLine) ckLines.push(ckLine);
  }

  // ── Write output files ─────────────────────────────────────────────────────

  const write = (name: string, lines: string[]) => {
    const file = path.join(OUTPUT_DIR, name);
    fs.writeFileSync(file, lines.join("\n") + "\n", "utf-8");
    console.log(`  ${name} (${lines.length} lines)`);
  };

  console.log(`\nProject: ${project.name} (${signals.length} signals)\nOutput: ${OUTPUT_DIR}\n`);

  write("wago_variable_fb.txt", bxLines);

  for (const [gvlName, lines] of byByGvl) {
    const safe = gvlName.replace(/[^a-zA-Z0-9_]/g, "_");
    write(`gvl_${safe}.gvl`, lines);
  }

  write("gvl_alarms.gvl", caLines);
  write("alarm_init.st", cbLines);
  write("alarm_handling.st", ccLines);
  write("alarm_suppression.st", cdLines);
  write("gvl_analog_scaling.gvl", ceLines);
  write("analog_scaling_body.st", cfLines);
  write("modbus_io_input.st", chLines);
  write("modbus_io_output.st", ciLines);
  write("alarm_init_fat.st", cjLines);
  write("logging.st", ckLines);

  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
