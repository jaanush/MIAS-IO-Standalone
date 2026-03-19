/**
 * MIAS Legacy Export — generates CODESYS / METS_Lib output files.
 * Extracted from src/scripts/generate-plc-exports.ts for use from tRPC.
 * Returns a Map<filename, content> instead of writing to disk.
 */
import { db } from "@/lib/db";
import { computeCarrierAddresses } from "@/app/api/codesys/_address";

export async function generateLegacyExport(projectId: number): Promise<Map<string, string>> {
  // Inline all helpers from generate-plc-exports.ts
  // (kept in this file to avoid import issues with the CLI script)

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

  function buildBV(gvlName: string | null | undefined, tag: string | null): string {
    if (!gvlName || !tag) return tag ?? "";
    let prefix = gvlName;
    if (prefix === "strStartStopmodes") prefix = "GVL_Settings";
    else prefix = prefix.replace("strSettings", "GVL_Settings.Settings");
    return `${prefix}.${tag}`;
  }

  function buildBW(systemName: string | null, componentTag: string | null, description: string | null, gvlName: string | null): string {
    if (!description || !gvlName) return "";
    return [systemName, componentTag ? `${componentTag}:` : null, description].filter(Boolean).join(" ").trim();
  }

  type AlarmType = "" | "DIG" | "ANA";
  function computeAlarmType(signalType: string, plcDataType: string | null, anaToDigAlarm: boolean, hasAnyAlarm: boolean): AlarmType {
    if (!hasAnyAlarm) return "";
    if (plcDataType === "BOOL" || plcDataType === "BIT" || anaToDigAlarm || signalType === "DISCRETE") return "DIG";
    return "ANA";
  }

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

  function alarmTagName(tag: string | null): string {
    if (!tag) return "UNNAMED";
    return tag.replace(/\./g, "_").replace(/[\[\]]/g, "");
  }

  // ── Modbus address computation ──
  type CardSlot = { id: number; slotPosition: number; cardType: string; maxInputChannels: number | null; maxOutputChannels: number | null };
  type ModbusOffsets = { inputWordOffset: number; outputWordOffset: number };

  function computeModbusCardOffsets(cards: CardSlot[]): Map<number, ModbusOffsets> {
    const sorted = [...cards].sort((a, b) => a.slotPosition - b.slotPosition);
    const result = new Map<number, ModbusOffsets>();
    let inWord = 0, outWord = 0;
    for (const card of sorted) {
      result.set(card.id, { inputWordOffset: inWord, outputWordOffset: outWord });
      const inCh = card.maxInputChannels ?? 0;
      const outCh = card.maxOutputChannels ?? 0;
      if (card.cardType === "DI" || card.cardType === "MIXED") inWord += Math.ceil(inCh / 16);
      else if (card.cardType === "AI") inWord += inCh;
      else if (card.cardType === "COUNTER") inWord += inCh * 2;
      if (card.cardType === "DO" || card.cardType === "MIXED") outWord += Math.ceil(outCh / 16);
      else if (card.cardType === "AO") outWord += outCh;
    }
    return result;
  }

  function computeModbusAddress(cardType: string, channelPosition: number, cardOffset: ModbusOffsets, modbusInputBase: number, modbusOutputBase: number): string | null {
    const ch = channelPosition;
    switch (cardType) {
      case "DI": return `[${modbusInputBase + cardOffset.inputWordOffset + Math.floor(ch / 16)}].${ch % 16}`;
      case "DO": return `[${modbusOutputBase + cardOffset.outputWordOffset + Math.floor(ch / 16)}].${ch % 16}`;
      case "AI": return `[${modbusInputBase + cardOffset.inputWordOffset + ch}]`;
      case "AO": return `[${modbusOutputBase + cardOffset.outputWordOffset + ch}]`;
      default: return null;
    }
  }

  // ── Import gen functions from the script inline (simplified) ──
  // These are copied from generate-plc-exports.ts to avoid coupling

  function genBX(tag: string, plcDataType: string): string {
    const stType = plcDataType === "BOOL" ? "BOOL" : plcDataType === "BIT" ? "BOOL" : plcDataType;
    return `${tag}: ${stType};`;
  }

  function genBY(opts: { tag: string; gvlName: string; plcDataType: string | null; ioType: string | null; trigger: string | null; plcAddress: string | null; isRetain: boolean; isPersistent: boolean; fbNameOverride: string | null; cardArticleNumber: string | null; plcId: string | null; cardId: string | null; channelPos: number | null; useTankLevel: boolean }): string | null {
    const { tag, gvlName, plcDataType, ioType, trigger, plcAddress, isRetain, isPersistent, cardArticleNumber, plcId, cardId, channelPos } = opts;
    if (!tag || !gvlName || !plcDataType) return null;
    const stType = plcDataType === "BIT" ? "BOOL" : plcDataType;
    const atClause = plcAddress ? ` AT ${plcAddress}` : "";
    const comment = [ioType, plcId && cardId ? `${plcId}_${cardId}.${(channelPos ?? 0) + 1}` : null].filter(Boolean).join(" ");
    const triggerNote = trigger === "NC" ? " NC (inverted) signal. Physical LOW = PLC TRUE." : "";
    return `${tag}${atClause}: ${stType}; //${comment}${triggerNote}`;
  }

  function genCA(opts: { bz: AlarmType; alarmNo: number; tag: string; specialFb: string | null }): string | null {
    if (!opts.bz) return null;
    const fbType = opts.specialFb ?? (opts.bz === "DIG" ? "FB_AlarmDigital" : "FB_AlarmAnalogue");
    return `Alarm${String(opts.alarmNo).padStart(3, "0")}_${alarmTagName(opts.tag)}: ${fbType};`;
  }

  function genAlarmInit(opts: { bz: AlarmType; alarmNo: number; digIdx: number | null; anaIdx: number | null; tag: string; bw: string; alarmIdentifier: string; blockMask: string | null; alarmGroup: string | null; noNc: string | null; gvlName: string | null; delaySeconds: number; llSetpoint: number | null; llDelay: number; lSetpoint: number | null; lDelay: number; hSetpoint: number | null; hDelay: number; hhSetpoint: number | null; hhDelay: number; unit: string | null; fatMode: boolean }): string | null {
    if (!opts.bz) return null;
    const prefix = `GVL_Alarms.Alarm${String(opts.alarmNo).padStart(3, "0")}_${alarmTagName(opts.tag)}`;
    if (opts.bz === "DIG") {
      const idx = opts.digIdx ?? 0;
      const block = opts.fatMode ? "10" : (opts.blockMask?.charAt(0) ?? "0");
      const group = opts.alarmGroup ?? "B";
      const delay = opts.delaySeconds;
      return `METS_Lib.AssignSettingsDig(AlarmSettingsDigital:=GVL_AlarmSettings.AlarmSettingsDigital[${idx}],AlarmText:='${opts.bw}',AlarmBlock:=BOOL#${block === "1" ? "TRUE" : "FALSE"},AlarmClass:='${group}',DelaySeconds:=${delay});`;
    }
    // ANA
    const idx = opts.anaIdx ?? 0;
    const group = opts.alarmGroup ?? "B";
    const unitEnum = euToEnum(opts.unit);
    return `METS_Lib.AssignSettingsAna(AlarmSettingsAnalogue:=GVL_AlarmSettings.AlarmSettingsAnalogue[${idx}],AlarmText:='${opts.bw}',AlarmClass:='${group}',LL:=${fmtNum(opts.llSetpoint)},L:=${fmtNum(opts.lSetpoint)},H:=${fmtNum(opts.hSetpoint)},HH:=${fmtNum(opts.hhSetpoint)},AlarmIdentifier:='${opts.alarmIdentifier}',Unit:=${unitEnum});`;
  }

  function genCC(opts: { bz: AlarmType; alarmNo: number; tag: string; bv: string; digIdx: number | null; anaIdx: number | null; plcDataType: string | null; gvlName: string | null; specialFb: string | null; specialInput: string | null; anaToDigAlarm: boolean }): string | null {
    if (!opts.bz) return null;
    const prefix = `GVL_Alarms.Alarm${String(opts.alarmNo).padStart(3, "0")}_${alarmTagName(opts.tag)}`;
    if (opts.bz === "DIG") {
      const idx = opts.digIdx ?? 0;
      const input = opts.specialInput ?? `Input:=${opts.bv}`;
      return `${prefix}(${input},AlarmSettings:=GVL_AlarmSettings.AlarmSettingsDigital[${idx}],AlarmDigNo:=${idx});`;
    }
    const idx = opts.anaIdx ?? 0;
    return `${prefix}(Input:=${opts.bv},SensorFault:=${opts.bv}_SensorFaultAlarm,AlarmSettings:=GVL_AlarmSettings.AlarmSettingsAnalogue[${idx}],AlarmAnaNo:=${idx});`;
  }

  function genCD(alarmNo: number, tag: string, suppressionSt: string | null): string | null {
    if (!suppressionSt) return null;
    return `GVL_Alarms.Alarm${String(alarmNo).padStart(3, "0")}_${alarmTagName(tag)}.Suppression:=${suppressionSt};`;
  }

  function genCE(opts: { seqNo: number; tag: string; bw: string; ioType: string | null; plcDataType: string | null; gvlName: string | null; cardArticleNumber: string | null; useTankLevel: boolean; rawZero: number | null; scalingFbOverride: string | null; sfRaw: number | null; sfMargin: number | null; sfBehavior: string | null; sfDelay: number | null; dbMin: number | null; dbZero: number | null; dbMax: number | null }): string | null {
    if (opts.ioType !== "AI" && opts.ioType !== "AO") return null;
    if (!opts.plcDataType || opts.plcDataType === "BOOL") return null;
    const fbType = opts.scalingFbOverride ?? (opts.useTankLevel ? "FB_TankLevel" : (opts.ioType === "AO" ? "FB_AnalogueOut" : "FB_AnalogueIn"));
    return `FB_${opts.ioType === "AO" ? "AnalogueOut" : "AnalogueIn"}_${opts.seqNo}: ${fbType}; //${opts.bw}`;
  }

  function genCF(opts: { seqNo: number; tag: string; ioType: string | null; plcDataType: string | null; gvlName: string | null; cardArticleNumber: string | null; useTankLevel: boolean; rawZero: number | null; scalingFbOverride: string | null; rawMin: number | null; rawMax: number | null; scaleMin: number | null; scaleMax: number | null; gain: number | null; offset: number | null; inputTypeCode: string | null; tankScalingRef: string }): string | null {
    if (opts.ioType !== "AI" && opts.ioType !== "AO") return null;
    if (!opts.plcDataType || opts.plcDataType === "BOOL") return null;
    const gvl = opts.gvlName ?? "GVL_Physical";
    if (opts.ioType === "AO") {
      return `GVL_AnalogScaling.FB_AnalogueOut_${opts.seqNo}(Input:=${gvl}.${opts.tag},AnalogueType:='${opts.cardArticleNumber ?? ""}',Minimum:=${fmtNum(opts.scaleMin)},Maximum:=${fmtNum(opts.scaleMax)},Gain:=${fmtNum(opts.gain)},Offset:=${fmtNum(opts.offset)},OutputRAW=>${gvl}.${opts.tag}_RAW);`;
    }
    const parts = [
      `RawInput:=${gvl}.${opts.tag}_RAW`,
      `AnalogueType:='${opts.cardArticleNumber ?? ""}'`,
      `Gain:=${fmtNum(opts.gain)}`,
      `Offset:=${fmtNum(opts.offset)}`,
      `FilterTime:=0`,
      `RawLimitLow:=${fmtNum(opts.rawMin)}`,
      `RawLimitHigh:=${fmtNum(opts.rawMax)}`,
      `OutputLimitLow:=${fmtNum(opts.scaleMin)}`,
      `OutputLimitHigh:=${fmtNum(opts.scaleMax)}`,
      `SensorFailure=>${gvl}.${opts.tag}_SensorFaultAlarm`,
      `Output=>${gvl}.${opts.tag}`,
    ];
    if (opts.useTankLevel) {
      parts.push(`TankPoints:=GVL_Settings.Settings.TankScaling.${opts.tankScalingRef}`);
      parts.push(`ScaledValue_m3=>${gvl}.${opts.tag}_m3`);
      parts.push(`ScaledValue_cm=>${gvl}.${opts.tag}_cm`);
    }
    return `GVL_AnalogScaling.FB_AnalogueIn_${opts.seqNo}(${parts.join(",")});`;
  }

  function genCH(opts: { tag: string; ioType: string | null; plcDataType: string | null; gvlName: string | null; modbusAddr: string | null }): string | null {
    if (!opts.modbusAddr || (opts.ioType !== "DI" && opts.ioType !== "AI")) return null;
    const gvl = opts.gvlName ?? "GVL_Physical";
    if (opts.ioType === "DI") return `${gvl}.${opts.tag}:=BCInputData${opts.modbusAddr};`;
    return `${gvl}.${opts.tag}_RAW:=BCInputData${opts.modbusAddr};`;
  }

  function genCI(opts: { tag: string; ioType: string | null; plcDataType: string | null; gvlName: string | null; modbusAddr: string | null }): string | null {
    if (!opts.modbusAddr || (opts.ioType !== "DO" && opts.ioType !== "AO")) return null;
    const gvl = opts.gvlName ?? "GVL_Physical";
    if (opts.ioType === "DO") return `BCOutputData${opts.modbusAddr}:=${gvl}.${opts.tag};`;
    return `BCOutputData${opts.modbusAddr}:=${gvl}.${opts.tag}_RAW;`;
  }

  function genCK(opts: { tag: string; gvlName: string | null; plcId: string | null; loggingIdx: number; loggingEnabled: boolean }): string | null {
    if (!opts.loggingEnabled || opts.loggingIdx === 0) return null;
    const gvl = opts.gvlName ?? "GVL_Physical";
    return `METS_Lib.AnyConversion(Value:=${gvl}.${opts.tag},Idx:=${opts.loggingIdx});`;
  }

  // ── Query data ──
  const project = await db.project.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      name: true,
      plcs: {
        select: {
          id: true, name: true,
          carriers: {
            select: {
              id: true, name: true, modbusInputBase: true, modbusOutputBase: true,
              cards: {
                select: { id: true, slotPosition: true, cardType: true, maxInputChannels: true, maxOutputChannels: true, catalog: { select: { articleNumber: true } } },
                orderBy: { slotPosition: "asc" },
              },
            },
          },
        },
      },
    },
  });

  const signals = await db.signal.findMany({
    where: { projectId },
    orderBy: [{ gvlId: "asc" }, { tag: "asc" }],
    select: {
      id: true, tag: true, description: true, signalType: true, origin: true, direction: true,
      gvlId: true, gvl: { select: { name: true } }, ioCardId: true, channelPosition: true,
      systemId: true, componentTag: true, system: { select: { name: true } },
      ioCard: {
        select: {
          id: true, slotPosition: true, cardType: true, carrierId: true, maxInputChannels: true, maxOutputChannels: true,
          catalog: { select: { articleNumber: true } },
          carrier: { select: { id: true, name: true, modbusInputBase: true, modbusOutputBase: true, plcId: true, plc: { select: { name: true } } } },
        },
      },
      alarmGroup: true, alarmBlockMask: true, suppressionSt: true, specialAlarmFb: true, specialAlarmInput: true,
      anaToDigAlarm: true, fatBlock: true, isRetain: true, isPersistent: true, loggingEnabled: true, fbNameOverride: true,
      analogSignal: {
        select: {
          rawMin: true, rawMax: true, rawZero: true, scaleMin: true, scaleMax: true,
          deadbandRawMin: true, deadbandRawZero: true, deadbandRawMax: true,
          engineeringUnit: { select: { symbol: true } },
          plcDataTypeCatalog: { select: { code: true } },
          useTankLevel: true, scalingFbOverride: true,
          sensorFailRaw: true, sensorFailMargin: true, sensorFailBehavior: true, sensorFailDelayMs: true,
          inputType: { select: { code: true } },
          alarms: { select: { condition: true, setpoint: true, delaySeconds: true, alarmGroup: true }, orderBy: { condition: "asc" } },
        },
      },
      discreteSignal: {
        select: {
          trigger: true, plcDataType: { select: { code: true } },
          alarms: { select: { condition: true, delaySeconds: true, alarmGroup: true }, orderBy: { condition: "asc" } },
        },
      },
    },
  });

  // Build Modbus offset maps
  const modbusOffsetMap = new Map<number, Map<number, ModbusOffsets>>();
  for (const plc of project.plcs) {
    for (const carrier of plc.carriers) {
      modbusOffsetMap.set(carrier.id, computeModbusCardOffsets(
        carrier.cards.map((c) => ({ id: c.id, slotPosition: c.slotPosition, cardType: c.cardType, maxInputChannels: c.maxInputChannels, maxOutputChannels: c.maxOutputChannels }))
      ));
    }
  }

  // Build AT address map
  type Offsets = { di: number; do: number; ai: number; ao: number };
  const atAddressMap = new Map<number, string | null>();
  for (const plc of project.plcs) {
    let globalOffsets: Offsets = { di: 0, do: 0, ai: 0, ao: 0 };
    for (const carrier of plc.carriers) {
      const carrierSignals = signals.filter((s) => s.ioCard?.carrierId === carrier.id);
      const { addresses, nextOffsets } = computeCarrierAddresses(
        carrier.cards.map((c) => ({ id: c.id, slotPosition: c.slotPosition, cardType: c.cardType, maxInputChannels: c.maxInputChannels, maxOutputChannels: c.maxOutputChannels })),
        carrierSignals.map((s) => ({ id: s.id, ioCardId: s.ioCardId, channelPosition: s.channelPosition, direction: s.direction, origin: s.origin })),
        globalOffsets
      );
      globalOffsets = nextOffsets;
      for (const [sigId, addr] of addresses) atAddressMap.set(sigId, addr);
    }
  }

  // ── Accumulate output buffers ──
  const bxLines: string[] = [];
  const byByGvl = new Map<string, string[]>();
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

  let bo = 0, bp = 0, bq = 0, br = 0, cl = 0;

  for (const sig of signals) {
    const tag = sig.tag;
    if (!tag) continue;

    const gvlName = sig.gvl?.name ?? null;
    const plcDataType = sig.analogSignal?.plcDataTypeCatalog?.code ?? sig.discreteSignal?.plcDataType?.code ?? null;
    let ioType: string | null = null;
    if (sig.signalType === "ANALOG") ioType = sig.direction === "OUTPUT" ? "AO" : "AI";
    else if (sig.signalType === "DISCRETE") ioType = sig.direction === "OUTPUT" ? "DO" : "DI";

    const trigger = sig.discreteSignal?.trigger ?? null;
    const cardArticleNumber = sig.ioCard?.catalog?.articleNumber ?? null;
    const plcId = sig.ioCard?.carrier?.plc?.name ?? null;
    const cardSlotId = sig.ioCard ? `${sig.ioCard.carrierId}_${sig.ioCard.slotPosition}` : null;
    const channelPos = sig.channelPosition;
    const atAddress = atAddressMap.get(sig.id) ?? null;

    let modbusAddr: string | null = null;
    if (sig.ioCardId && sig.channelPosition != null && sig.ioCard) {
      const cardOffsets = modbusOffsetMap.get(sig.ioCard.carrierId)?.get(sig.ioCardId);
      if (cardOffsets) modbusAddr = computeModbusAddress(sig.ioCard.cardType, sig.channelPosition, cardOffsets, sig.ioCard.carrier.modbusInputBase ?? 0, sig.ioCard.carrier.modbusOutputBase ?? 0);
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

    const hasAnyAlarm = (ana?.alarms?.length ?? 0) > 0 || (disc?.alarms?.length ?? 0) > 0;
    const bz = computeAlarmType(sig.signalType, plcDataType, sig.anaToDigAlarm, hasAnyAlarm);

    bo++;
    let thisBp: number | null = null, thisBq: number | null = null, thisBr: number | null = null;
    if (bz) { bp++; thisBp = bp; if (bz === "DIG") { bq++; thisBq = bq; } if (bz === "ANA") { br++; thisBr = br; } }
    let thisCl: number | null = null;
    if (sig.loggingEnabled) { cl++; thisCl = cl; }

    const llAlarm = ana?.alarms.find((a) => a.condition === "LOW_LOW");
    const lAlarm = ana?.alarms.find((a) => a.condition === "LOW");
    const hAlarm = ana?.alarms.find((a) => a.condition === "HIGH");
    const hhAlarm = ana?.alarms.find((a) => a.condition === "HIGH_HIGH");
    const alarmIdentifier = [llAlarm ? "LL" : null, lAlarm ? "L" : null, hAlarm ? "H" : null, hhAlarm ? "HH" : null].filter(Boolean).join(",");

    const alarmInitOpts = {
      bz, alarmNo: thisBp ?? 0, digIdx: thisBq, anaIdx: thisBr, tag, bw, alarmIdentifier,
      blockMask: sig.alarmBlockMask, alarmGroup: sig.alarmGroup, noNc: trigger, gvlName,
      delaySeconds: disc?.alarms[0]?.delaySeconds ?? 0,
      llSetpoint: llAlarm ? Number(llAlarm.setpoint) : null, llDelay: llAlarm?.delaySeconds ?? 0,
      lSetpoint: lAlarm ? Number(lAlarm.setpoint) : null, lDelay: lAlarm?.delaySeconds ?? 0,
      hSetpoint: hAlarm ? Number(hAlarm.setpoint) : null, hDelay: hAlarm?.delaySeconds ?? 0,
      hhSetpoint: hhAlarm ? Number(hhAlarm.setpoint) : null, hhDelay: hhAlarm?.delaySeconds ?? 0,
      unit, fatMode: false,
    };

    if (plcDataType) { const l = genBX(tag, plcDataType); if (l) bxLines.push(l); }
    if (gvlName) {
      const l = genBY({ tag, gvlName, plcDataType, ioType, trigger, plcAddress: atAddress, isRetain: sig.isRetain, isPersistent: sig.isPersistent, fbNameOverride: sig.fbNameOverride, cardArticleNumber, plcId, cardId: cardSlotId, channelPos, useTankLevel: ana?.useTankLevel ?? false });
      if (l) { if (!byByGvl.has(gvlName)) byByGvl.set(gvlName, []); byByGvl.get(gvlName)!.push(l); }
    }
    { const l = genCA({ bz, alarmNo: thisBp ?? 0, tag, specialFb: sig.specialAlarmFb }); if (l) caLines.push(l); }
    { const l = genAlarmInit({ ...alarmInitOpts, fatMode: false }); if (l) cbLines.push(l); }
    { const l = genCC({ bz, alarmNo: thisBp ?? 0, tag, bv, digIdx: thisBq, anaIdx: thisBr, plcDataType, gvlName, specialFb: sig.specialAlarmFb, specialInput: sig.specialAlarmInput, anaToDigAlarm: sig.anaToDigAlarm }); if (l) ccLines.push(l); }
    { const l = genCD(thisBp ?? 0, tag, sig.suppressionSt); if (l) cdLines.push(l); }
    { const l = genCE({ seqNo: bo, tag, bw, ioType, plcDataType, gvlName, cardArticleNumber, useTankLevel: ana?.useTankLevel ?? false, rawZero, scalingFbOverride: ana?.scalingFbOverride ?? null, sfRaw: ana?.sensorFailRaw != null ? Number(ana.sensorFailRaw) : null, sfMargin: ana?.sensorFailMargin != null ? Number(ana.sensorFailMargin) : null, sfBehavior: ana?.sensorFailBehavior ?? null, sfDelay: ana?.sensorFailDelayMs ?? null, dbMin: ana?.deadbandRawMin != null ? Number(ana.deadbandRawMin) : null, dbZero: ana?.deadbandRawZero != null ? Number(ana.deadbandRawZero) : null, dbMax: ana?.deadbandRawMax != null ? Number(ana.deadbandRawMax) : null }); if (l) ceLines.push(l); }
    { const l = genCF({ seqNo: bo, tag, ioType, plcDataType, gvlName, cardArticleNumber, useTankLevel: ana?.useTankLevel ?? false, rawZero, scalingFbOverride: ana?.scalingFbOverride ?? null, rawMin, rawMax, scaleMin, scaleMax, gain, offset, inputTypeCode: ana?.inputType?.code ?? null, tankScalingRef: tag }); if (l) cfLines.push(l); }
    { const l = genCH({ tag, ioType, plcDataType, gvlName, modbusAddr }); if (l) chLines.push(l); }
    { const l = genCI({ tag, ioType, plcDataType, gvlName, modbusAddr }); if (l) ciLines.push(l); }
    { const l = genAlarmInit({ ...alarmInitOpts, fatMode: true }); if (l) cjLines.push(l); }
    { const l = genCK({ tag, gvlName, plcId, loggingIdx: thisCl ?? 0, loggingEnabled: sig.loggingEnabled }); if (l) ckLines.push(l); }
  }

  // ── Build file map ──
  const files = new Map<string, string>();
  const add = (name: string, lines: string[]) => { if (lines.length > 0) files.set(name, lines.join("\n") + "\n"); };

  add("wago_variable_fb.txt", bxLines);
  for (const [gvlName, lines] of byByGvl) {
    add(`gvl_${gvlName.replace(/[^a-zA-Z0-9_]/g, "_")}.gvl`, lines);
  }
  add("gvl_alarms.gvl", caLines);
  add("alarm_init.st", cbLines);
  add("alarm_handling.st", ccLines);
  add("alarm_suppression.st", cdLines);
  add("gvl_analog_scaling.gvl", ceLines);
  add("analog_scaling_body.st", cfLines);
  add("modbus_io_input.st", chLines);
  add("modbus_io_output.st", ciLines);
  add("alarm_init_fat.st", cjLines);
  add("logging.st", ckLines);

  return files;
}
