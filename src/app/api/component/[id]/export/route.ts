import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/component/{id}/export
 *
 * Exports a component template as JSON including signals, alarms,
 * PDO configs, wiring recipes, and children.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const componentId = Number(id);
  if (isNaN(componentId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const comp = await db.hardwareComponent.findUnique({
    where: { id: componentId },
    include: {
      signals: {
        orderBy: { channelOffset: "asc" },
        include: {
          discreteAlarms: true,
          analogAlarms: true,
          defaultEu: { select: { symbol: true } },
          defaultInputType: { select: { code: true } },
          plcDataTypeCatalog: { select: { code: true } },
          pdoConfig: { select: { direction: true, pdoNumber: true } },
        },
      },
      pdoConfigs: {
        orderBy: [{ direction: "asc" }, { pdoNumber: "asc" }],
        include: {
          signals: { select: { channelOffset: true }, orderBy: { bitOffset: "asc" } },
        },
      },
      wiringRecipes: {
        orderBy: { sortOrder: "asc" },
        include: { params: { orderBy: { sortOrder: "asc" } } },
      },
      children: {
        select: { id: true, name: true, manufacturer: true, model: true },
        orderBy: { name: "asc" },
      },
      parent: { select: { name: true, manufacturer: true, model: true } },
    },
  });

  if (!comp) return NextResponse.json({ error: "Component not found" }, { status: 404 });

  // Build export payload — strip internal IDs, use natural keys
  const payload = {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    type: "component" as const,
    component: {
      name: comp.name,
      manufacturer: comp.manufacturer,
      model: comp.model,
      version: comp.version,
      functionBlock: comp.functionBlock,
      busProtocol: comp.busProtocol,
      minCanIdOffset: comp.minCanIdOffset,
      status: comp.status,
      description: comp.description,
      parentRef: comp.parent ? { name: comp.parent.name, manufacturer: comp.parent.manufacturer, model: comp.parent.model } : null,
    },
    signals: comp.signals.map((s) => ({
      channelOffset: s.channelOffset,
      ioType: s.ioType,
      origin: s.origin,
      tagSuffix: s.tagSuffix,
      description: s.description,
      plcDataTypeCode: s.plcDataTypeCatalog?.code ?? null,
      rawDataType: s.rawDataType,
      byteOrder: s.byteOrder,
      canNodeId: s.canNodeId,
      canId: s.canId,
      bitOffset: s.bitOffset,
      bitLength: s.bitLength,
      isMuxIndicator: s.isMuxIndicator,
      muxId: s.muxId,
      canopenIndex: s.canopenIndex,
      canopenSubIndex: s.canopenSubIndex,
      j1939Pgn: s.j1939Pgn,
      j1939Spn: s.j1939Spn,
      modbusUnitId: s.modbusUnitId,
      modbusRegisterType: s.modbusRegisterType,
      modbusRegisterOffset: s.modbusRegisterOffset,
      timeoutMs: s.timeoutMs,
      active: s.active,
      defaultTrigger: s.defaultTrigger,
      defaultFilterTimeMs: s.defaultFilterTimeMs ? Number(s.defaultFilterTimeMs) : null,
      defaultSwitchingType: s.defaultSwitchingType,
      defaultSignalVoltage: s.defaultSignalVoltage,
      defaultInputTypeCode: s.defaultInputType?.code ?? null,
      defaultEuSymbol: s.defaultEu?.symbol ?? null,
      defaultScaleMin: s.defaultScaleMin ? Number(s.defaultScaleMin) : null,
      defaultScaleMax: s.defaultScaleMax ? Number(s.defaultScaleMax) : null,
      defaultRawMin: s.defaultRawMin,
      defaultRawMax: s.defaultRawMax,
      defaultRawZero: s.defaultRawZero,
      defaultClampLow: s.defaultClampLow ? Number(s.defaultClampLow) : null,
      defaultClampHigh: s.defaultClampHigh ? Number(s.defaultClampHigh) : null,
      defaultDeadband: s.defaultDeadband ? Number(s.defaultDeadband) : null,
      defaultWireConfig: s.defaultWireConfig,
      defaultDetectWireBreak: s.defaultDetectWireBreak,
      defaultDetectShortCircuit: s.defaultDetectShortCircuit,
      defaultDetectOutOfRange: s.defaultDetectOutOfRange,
      defaultNamurNe43: s.defaultNamurNe43,
      defaultSensorFailRaw: s.defaultSensorFailRaw,
      defaultSensorFailMargin: s.defaultSensorFailMargin ? Number(s.defaultSensorFailMargin) : null,
      defaultSensorFailBehavior: s.defaultSensorFailBehavior,
      defaultSensorFailDelayMs: s.defaultSensorFailDelayMs,
      defaultUseTankLevel: s.defaultUseTankLevel,
      defaultScalingFbOverride: s.defaultScalingFbOverride,
      defaultAlarmGroup: s.defaultAlarmGroup,
      defaultAlarmBlockMask: s.defaultAlarmBlockMask,
      defaultCommBlockMask: s.defaultCommBlockMask,
      defaultFatBlock: s.defaultFatBlock,
      defaultSuppressionSt: s.defaultSuppressionSt,
      defaultSpecialAlarmFb: s.defaultSpecialAlarmFb,
      defaultSpecialAlarmInput: s.defaultSpecialAlarmInput,
      defaultAnaToDigAlarm: s.defaultAnaToDigAlarm,
      defaultIsRetain: s.defaultIsRetain,
      defaultIsPersistent: s.defaultIsPersistent,
      defaultLoggingEnabled: s.defaultLoggingEnabled,
      defaultFbNameOverride: s.defaultFbNameOverride,
      defaultUseShortName: s.defaultUseShortName,
      pdoRef: s.pdoConfig ? { direction: s.pdoConfig.direction, pdoNumber: s.pdoConfig.pdoNumber } : null,
      discreteAlarms: s.discreteAlarms.map((a) => ({
        condition: a.condition,
        severity: a.severity,
        delaySeconds: a.delaySeconds,
        message: a.message,
      })),
      analogAlarms: s.analogAlarms.map((a) => ({
        condition: a.condition,
        setpoint: Number(a.setpoint),
        hysteresis: Number(a.hysteresis),
        severity: a.severity,
        delaySeconds: a.delaySeconds,
        message: a.message,
      })),
    })),
    pdoConfigs: comp.pdoConfigs.map((p) => ({
      direction: p.direction,
      pdoNumber: p.pdoNumber,
      cobId: p.cobId,
      transmissionType: p.transmissionType,
      eventTimerMs: p.eventTimerMs,
      inhibitTimeUs: p.inhibitTimeUs,
      syncWindowUs: p.syncWindowUs,
      timeoutMs: p.timeoutMs,
      nodeId: p.nodeId,
      description: p.description,
      signalRefs: p.signals.map((s) => s.channelOffset),
    })),
    wiringRecipes: comp.wiringRecipes.map((r) => ({
      fbName: r.fbName,
      targetGvl: r.targetGvl,
      instanceNamePattern: r.instanceNamePattern,
      description: r.description,
      sortOrder: r.sortOrder,
      params: r.params.map((p) => ({
        parameterName: p.parameterName,
        direction: p.direction,
        sourceType: p.sourceType,
        channelOffset: p.channelOffset,
        signalTag: p.signalTag,
        literalValue: p.literalValue,
        expression: p.expression,
        sortOrder: p.sortOrder,
      })),
    })),
    children: comp.children.map((c) => ({
      name: c.name,
      manufacturer: c.manufacturer,
      model: c.model,
    })),
  };

  return NextResponse.json(payload);
}
