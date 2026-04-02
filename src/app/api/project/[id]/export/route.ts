// @ts-nocheck — data transfer utility, complex Prisma include types
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/project/{id}/export
 *
 * Exports a full project as JSON: hardware topology, signals, instances,
 * buses, networks, CODESYS settings. Uses natural keys for catalog references.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = Number(id);
  if (isNaN(projectId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const project: any = await db.project.findUnique({
    where: { id: projectId },
    include: {
      codesysSettings: true,
      approvals: { include: { approval: { select: { name: true } } } },
      ipNetworks: true,
      buses: {
        include: {
          nodes: true,
          ipNetwork: true,
        },
      },
      plcs: {
        include: {
          catalog: { select: { articleNumber: true } },
          ports: {
            include: { ipNetwork: { select: { name: true } } },
          },
          carriers: {
            include: {
              catalog: { select: { articleNumber: true } },
              cards: {
                orderBy: { slotPosition: "asc" },
                include: {
                  catalog: { select: { articleNumber: true } },
                },
              },
              ports: {
                include: { ipNetwork: { select: { name: true } } },
              },
            },
          },
        },
      },
      componentInstances: {
        include: {
          component: { select: { name: true, manufacturer: true, model: true } },
          bus: { select: { id: true, description: true } },
          signals: {
            include: {
              componentSignal: { select: { channelOffset: true } },
              signals: {
                include: {
                  discreteSignal: { include: { alarms: true } },
                  analogSignal: {
                    include: {
                      alarms: true,
                      engineeringUnit: { select: { symbol: true } },
                      inputType: { select: { code: true } },
                    },
                  },
                  busSignal: true,
                  gvl: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Also get standalone signals (not linked to any instance)
  const standaloneSignals = await db.signal.findMany({
    where: { projectId, instanceSignalId: null },
    include: {
      discreteSignal: { include: { alarms: true } },
      analogSignal: {
        include: {
          alarms: true,
          engineeringUnit: { select: { symbol: true } },
          inputType: { select: { code: true } },
        },
      },
      busSignal: true,
      ioCard: { select: { slotPosition: true, carrier: { select: { name: true } } } },
      gvl: { select: { name: true } },
    },
  });

  const payload = {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    type: "project" as const,
    project: {
      name: project.name,
      projectNumber: project.projectNumber,
      client: project.client,
      location: project.location,
      status: project.status,
      description: project.description,
      dataVersion: project.dataVersion,
      approvals: project.approvals.map((a) => a.approval.name),
    },
    codesysSettings: project.codesysSettings ? {
      fbAlarmDigital: project.codesysSettings.fbAlarmDigital,
      fbAlarmAnalogue: project.codesysSettings.fbAlarmAnalogue,
      fbAnalogScaling: project.codesysSettings.fbAnalogScaling,
      fbTankLevel: project.codesysSettings.fbTankLevel,
    } : null,
    ipNetworks: project.ipNetworks.map((n) => ({
      name: n.name,
      subnet: n.subnet,
      gateway: n.gateway,
      description: n.description,
    })),
    buses: project.buses.map((b) => ({
      _exportId: b.id,
      protocol: b.protocol,
      role: b.role,
      nodeAddress: b.nodeAddress,
      description: b.description,
      baudRateKbit: b.baudRateKbit,
      baudRateBps: b.baudRateBps,
      serialParity: b.serialParity,
      serialStopBits: b.serialStopBits,
      heartbeatMs: b.heartbeatMs,
      syncPeriodMs: b.syncPeriodMs,
      ipNetworkRef: b.ipNetwork?.name ?? null,
    })),
    plcs: project.plcs.map((plc) => ({
      name: plc.name,
      catalogArticle: plc.catalog?.articleNumber ?? null,
      ipAddress: plc.ipAddress,
      notes: plc.notes,
      ports: plc.plcPorts.map((p) => ({
        portIndex: p.portIndex,
        ipAddress: p.ipAddress,
        busRef: p.bus ? p.bus.id : null,
      })),
      carriers: plc.carriers.map((c) => ({
        name: c.name,
        catalogArticle: c.catalog?.articleNumber ?? null,
        cabinetNumber: c.cabinetNumber,
        carrierNumber: c.carrierNumber,
        ipAddress: c.ipAddress,
        ports: c.carrierPorts.map((p) => ({
          portIndex: p.portIndex,
          ipAddress: p.ipAddress,
          busRef: p.bus ? p.bus.id : null,
        })),
        cards: c.cards.map((card) => ({
          slotPosition: card.slotPosition,
          catalogArticle: card.catalog?.articleNumber ?? null,
          typeCode: card.typeCode,
          instanceNumber: card.instanceNumber,
        })),
      })),
    })),
    componentInstances: project.componentInstances.map((inst) => ({
      componentRef: inst.component.name,
      componentManufacturer: inst.component.manufacturer,
      name: inst.name,
      tag: inst.tag,
      busRef: inst.bus ? inst.bus.id : null,
      nodeRole: inst.nodeRole,
      nodeAddress: inst.nodeAddress,
      byteOrder: inst.byteOrder,
      canIdOffset: inst.canIdOffset,
      functionBlockOverride: inst.functionBlockOverride,
      notes: inst.notes,
      instanceSignals: inst.signals.map((is) => ({
        componentChannelOffset: is.componentSignal.channelOffset,
        templateDirty: is.templateDirty,
        signals: is.signals.map((s) => exportSignal(s)),
      })),
    })),
    standaloneSignals: standaloneSignals.map((s) => exportSignal(s)),
  };

  return NextResponse.json(payload);
}

function exportSignal(s: any) {
  return {
    tag: s.tag,
    description: s.description,
    signalType: s.signalType,
    origin: s.origin,
    direction: s.direction,
    gvlRef: s.gvl?.name ?? null,
    channelPosition: s.channelPosition,
    hwCabinet: s.hwCabinet,
    hwCarrier: s.hwCarrier,
    hwTypeCode: s.hwTypeCode,
    hwInstance: s.hwInstance,
    ioCardRef: s.ioCard ? { slotPosition: s.ioCard.slotPosition, carrierName: s.ioCard.carrier?.name } : null,
    alarmGroup: s.alarmGroup,
    alarmBlockMask: s.alarmBlockMask,
    commBlockMask: s.commBlockMask,
    fatBlock: s.fatBlock,
    suppressionSt: s.suppressionSt,
    specialAlarmFb: s.specialAlarmFb,
    specialAlarmInput: s.specialAlarmInput,
    anaToDigAlarm: s.anaToDigAlarm,
    isRetain: s.isRetain,
    isPersistent: s.isPersistent,
    loggingEnabled: s.loggingEnabled,
    fbNameOverride: s.fbNameOverride,
    useShortName: s.useShortName,
    discreteSignal: s.discreteSignal ? {
      trigger: s.discreteSignal.trigger,
      filterTimeMs: s.discreteSignal.filterTimeMs ? Number(s.discreteSignal.filterTimeMs) : null,
      switchingType: s.discreteSignal.switchingType,
      signalVoltage: s.discreteSignal.signalVoltage,
      alarms: s.discreteSignal.alarms.map((a: any) => ({
        condition: a.condition, severity: a.severity, delaySeconds: a.delaySeconds, message: a.message,
      })),
    } : null,
    analogSignal: s.analogSignal ? {
      inputTypeCode: s.analogSignal.inputType?.code ?? null,
      euSymbol: s.analogSignal.engineeringUnit?.symbol ?? null,
      scaleMin: s.analogSignal.scaleMin ? Number(s.analogSignal.scaleMin) : null,
      scaleMax: s.analogSignal.scaleMax ? Number(s.analogSignal.scaleMax) : null,
      rawMin: s.analogSignal.rawMin,
      rawMax: s.analogSignal.rawMax,
      rawZero: s.analogSignal.rawZero,
      clampLow: s.analogSignal.clampLow ? Number(s.analogSignal.clampLow) : null,
      clampHigh: s.analogSignal.clampHigh ? Number(s.analogSignal.clampHigh) : null,
      deadband: s.analogSignal.deadband ? Number(s.analogSignal.deadband) : null,
      wireConfig: s.analogSignal.wireConfig,
      detectWireBreak: s.analogSignal.detectWireBreak,
      detectShortCircuit: s.analogSignal.detectShortCircuit,
      detectOutOfRange: s.analogSignal.detectOutOfRange,
      namurNe43: s.analogSignal.namurNe43,
      scalingFb: s.analogSignal.scalingFb,
      alarms: s.analogSignal.alarms.map((a: any) => ({
        condition: a.condition, setpoint: Number(a.setpoint), hysteresis: Number(a.hysteresis),
        severity: a.severity, delaySeconds: a.delaySeconds, message: a.message,
      })),
    } : null,
    busSignal: s.busSignal ? {
      unitId: s.busSignal.unitId,
      registerType: s.busSignal.registerType,
      registerOffset: s.busSignal.registerOffset,
      nodeId: s.busSignal.nodeId,
      canId: s.busSignal.canId,
      bitOffset: s.busSignal.bitOffset,
      bitLength: s.busSignal.bitLength,
      isMuxIndicator: s.busSignal.isMuxIndicator,
      muxId: s.busSignal.muxId,
      canopenIndex: s.busSignal.canopenIndex,
      canopenSubIndex: s.busSignal.canopenSubIndex,
      j1939Pgn: s.busSignal.j1939Pgn,
      j1939Spn: s.busSignal.j1939Spn,
      rawDataType: s.busSignal.rawDataType,
      plcDataType: s.busSignal.plcDataType,
      byteOrder: s.busSignal.byteOrder,
      timeoutMs: s.busSignal.timeoutMs,
    } : null,
  };
}
