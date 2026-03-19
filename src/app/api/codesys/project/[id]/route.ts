import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "../../_auth";
import { computeCarrierAddresses, type AddressOffsets } from "../../_address";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  const { id } = await params;
  const projectId = Number(id);
  if (isNaN(projectId)) return NextResponse.json({ error: "Invalid project id" }, { status: 400 });

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      status: true,
      codesysSettings: {
        select: {
          fbAlarmDigital: true,
          fbAlarmAnalogue: true,
          fbAnalogScaling: true,
          fbTankLevel: true,
        },
      },
      plcs: {
        select: {
          id: true,
          name: true,
          ipAddress: true,
          notes: true,
          catalog: {
            select: { articleNumber: true, vendorName: true, description: true, codesysDeviceId: true },
          },
          networks: {
            select: {
              id: true,
              protocol: true,
              role: true,
              nodeAddress: true,
              description: true,
              ipAddress: true,
              ipPort: true,
              baudRateKbit: true,
              baudRateBps: true,
              serialParity: true,
              serialStopBits: true,
              canMode: true,
              canHeartbeatMs: true,
              canSyncPeriodMs: true,
              cyclePeriodMs: true,
              ioCardId: true,
            },
          },
          carriers: {
            select: {
              id: true,
              name: true,
              plcNetworkId: true,
              ipAddress: true,
              nodeAddress: true,
              modbusInputBase: true,
              modbusOutputBase: true,
              isLocalBus: true,
              codesysDeviceId: true,
              catalog: {
                select: { articleNumber: true, vendorName: true },
              },
              cards: {
                select: {
                  id: true,
                  slotPosition: true,
                  cardType: true,
                  maxInputChannels: true,
                  maxOutputChannels: true,
                  catalog: {
                    select: { articleNumber: true, vendorName: true, codesysModuleId: true },
                  },
                },
                orderBy: { slotPosition: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Fetch GVLs referenced by this project's signals
  const gvls = await db.globalVariableList.findMany({
    where: { signals: { some: { projectId } } },
    select: { id: true, name: true, description: true, generationMode: true },
    orderBy: { name: "asc" },
  });

  // Fetch all signals with sub-models
  const signals = await db.signal.findMany({
    where: { projectId },
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
      systemId: true,
      componentTag: true,
      drawingRef: true,
      cabinetLocation: true,
      // Alarm config
      alarmGroup: true,
      alarmBlockMask: true,
      commBlockMask: true,
      fatBlock: true,
      suppressionSt: true,
      specialAlarmFb: true,
      specialAlarmInput: true,
      anaToDigAlarm: true,
      // Code gen flags
      isRetain: true,
      isPersistent: true,
      loggingEnabled: true,
      fbNameOverride: true,
      useShortName: true,
      // Sub-models
      ioCard: {
        select: {
          id: true,
          slotPosition: true,
          cardType: true,
          carrierId: true,
          carrier: { select: { id: true, name: true, plcId: true, plc: { select: { name: true } } } },
        },
      },
      analogSignal: {
        select: {
          inputType: { select: { code: true, name: true } },
          wireConfig: true,
          rawMin: true,
          rawMax: true,
          rawZero: true,
          scaleMin: true,
          scaleMax: true,
          clampLow: true,
          clampHigh: true,
          deadband: true,
          deadbandRawMin: true,
          deadbandRawZero: true,
          deadbandRawMax: true,
          engineeringUnit: { select: { symbol: true } },
          plcDataTypeCatalog: { select: { code: true } },
          detectWireBreak: true,
          detectShortCircuit: true,
          detectOutOfRange: true,
          namurNe43: true,
          useTankLevel: true,
          scalingFbOverride: true,
          sensorFailRaw: true,
          sensorFailMargin: true,
          sensorFailBehavior: true,
          sensorFailDelayMs: true,
          alarms: {
            select: {
              condition: true,
              setpoint: true,
              hysteresis: true,
              severity: true,
              alarmGroup: true,
              delaySeconds: true,
              message: true,
            },
            orderBy: { condition: "asc" },
          },
        },
      },
      discreteSignal: {
        select: {
          trigger: true,
          filterTimeMs: true,
          switchingType: true,
          signalVoltage: true,
          plcDataType: { select: { code: true } },
          alarms: {
            select: {
              condition: true,
              severity: true,
              alarmGroup: true,
              delaySeconds: true,
              message: true,
            },
            orderBy: { condition: "asc" },
          },
        },
      },
      busSignal: {
        select: {
          plcNetworkId: true,
          plcNetwork: { select: { protocol: true } },
          unitId: true,
          registerType: true,
          registerOffset: true,
          nodeId: true,
          canId: true,
          bitOffset: true,
          bitLength: true,
          isMuxIndicator: true,
          muxId: true,
          canopenIndex: true,
          canopenSubIndex: true,
          j1939Pgn: true,
          j1939Spn: true,
          rawDataType: true,
          plcDataType: true,
          byteOrder: true,
          timeoutMs: true,
        },
      },
      instanceSignal: {
        select: {
          id: true,
          instance: {
            select: {
              id: true,
              tag: true,
              name: true,
              componentId: true,
              component: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // Compute IEC addresses per carrier — accumulate offsets globally within each PLC
  const addressMap = new Map<number, string | null>();
  for (const plc of project.plcs) {
    let globalOffsets: AddressOffsets = { di: 0, do: 0, ai: 0, ao: 0 };
    // Sort carriers by first card slot position (local bus first, then remote)
    const sortedCarriers = [...plc.carriers].sort((a, b) => {
      const aMin = a.cards.length > 0 ? Math.min(...a.cards.map((c) => c.slotPosition)) : Infinity;
      const bMin = b.cards.length > 0 ? Math.min(...b.cards.map((c) => c.slotPosition)) : Infinity;
      return aMin - bMin;
    });
    for (const carrier of sortedCarriers) {
      const carriersignals = signals.filter((s) => s.ioCard?.carrierId === carrier.id);
      const { addresses, nextOffsets } = computeCarrierAddresses(carrier.cards, carriersignals, globalOffsets);
      globalOffsets = nextOffsets;
      for (const [sigId, addr] of addresses) addressMap.set(sigId, addr);
    }
  }

  // Build response
  const codesysSettings = project.codesysSettings ?? {
    fbAlarmDigital: "FB_AlarmDigital",
    fbAlarmAnalogue: "FB_AlarmAnalogue",
    fbAnalogScaling: "FB_AnalogueIn_DeadBand_rev3",
    fbTankLevel: "FB_TankLevel",
  };

  const signalPayload = signals.map((s) => {
    const plcAddress = s.origin === "IEC" ? (addressMap.get(s.id) ?? null) : null;
    const ioCard = s.ioCard
      ? {
          id: s.ioCard.id,
          slotPosition: s.ioCard.slotPosition,
          cardType: s.ioCard.cardType,
          carrierId: s.ioCard.carrierId,
          carrierName: s.ioCard.carrier.name,
          plcName: s.ioCard.carrier.plc.name,
        }
      : null;

    // Effective alarm FB
    let alarmFb: string | null = null;
    if (s.specialAlarmFb) {
      alarmFb = s.specialAlarmFb;
    } else if (s.anaToDigAlarm || s.signalType === "DISCRETE") {
      alarmFb = codesysSettings.fbAlarmDigital;
    } else if (s.signalType === "ANALOG") {
      alarmFb = codesysSettings.fbAlarmAnalogue;
    }

    // Effective scaling FB (analog only)
    let scalingFb: string | null = null;
    if (s.analogSignal) {
      if (s.analogSignal.useTankLevel) {
        scalingFb = codesysSettings.fbTankLevel;
      } else if (s.analogSignal.scalingFbOverride) {
        scalingFb = s.analogSignal.scalingFbOverride;
      } else {
        scalingFb = codesysSettings.fbAnalogScaling;
      }
    }

    const instance = s.instanceSignal
      ? {
          id: s.instanceSignal.instance.id,
          tag: s.instanceSignal.instance.tag,
          name: s.instanceSignal.instance.name,
          componentId: s.instanceSignal.instance.componentId,
          componentName: s.instanceSignal.instance.component.name,
        }
      : null;

    return {
      id: s.id,
      tag: s.tag,
      description: s.description,
      signalType: s.signalType,
      origin: s.origin,
      direction: s.direction,
      gvlId: s.gvlId,
      gvlName: s.gvl?.name ?? null,
      systemId: s.systemId,
      componentTag: s.componentTag,
      drawingRef: s.drawingRef,
      cabinetLocation: s.cabinetLocation,
      ioCard,
      instance,
      channelPosition: s.channelPosition,
      plcAddress,
      // Code gen
      fbNameOverride: s.fbNameOverride,
      useShortName: s.useShortName,
      isRetain: s.isRetain,
      isPersistent: s.isPersistent,
      loggingEnabled: s.loggingEnabled,
      // Alarm config
      alarmGroup: s.alarmGroup,
      alarmBlockMask: s.alarmBlockMask,
      commBlockMask: s.commBlockMask,
      fatBlock: s.fatBlock,
      suppressionSt: s.suppressionSt,
      alarmFb,
      specialAlarmInput: s.specialAlarmInput,
      anaToDigAlarm: s.anaToDigAlarm,
      // Resolved sub-models
      analogSignal: s.analogSignal
        ? {
            inputType: s.analogSignal.inputType?.code ?? null,
            wireConfig: s.analogSignal.wireConfig,
            rawMin: s.analogSignal.rawMin,
            rawMax: s.analogSignal.rawMax,
            rawZero: s.analogSignal.rawZero,
            scaleMin: s.analogSignal.scaleMin,
            scaleMax: s.analogSignal.scaleMax,
            clampLow: s.analogSignal.clampLow,
            clampHigh: s.analogSignal.clampHigh,
            deadband: s.analogSignal.deadband,
            deadbandRawMin: s.analogSignal.deadbandRawMin,
            deadbandRawZero: s.analogSignal.deadbandRawZero,
            deadbandRawMax: s.analogSignal.deadbandRawMax,
            engineeringUnit: s.analogSignal.engineeringUnit?.symbol ?? null,
            plcDataType: s.analogSignal.plcDataTypeCatalog?.code ?? "INT",
            detectWireBreak: s.analogSignal.detectWireBreak,
            detectShortCircuit: s.analogSignal.detectShortCircuit,
            detectOutOfRange: s.analogSignal.detectOutOfRange,
            namurNe43: s.analogSignal.namurNe43,
            scalingFb,
            sensorFailRaw: s.analogSignal.sensorFailRaw,
            sensorFailMargin: s.analogSignal.sensorFailMargin,
            sensorFailBehavior: s.analogSignal.sensorFailBehavior,
            sensorFailDelayMs: s.analogSignal.sensorFailDelayMs,
            alarms: s.analogSignal.alarms.map((a) => ({
              type: "ANALOG" as const,
              condition: a.condition,
              setpoint: a.setpoint,
              hysteresis: a.hysteresis,
              severity: a.severity,
              alarmGroup: a.alarmGroup ?? s.alarmGroup,
              delaySeconds: a.delaySeconds,
              message: a.message,
            })),
          }
        : null,
      discreteSignal: s.discreteSignal
        ? {
            trigger: s.discreteSignal.trigger,
            filterTimeMs: s.discreteSignal.filterTimeMs,
            switchingType: s.discreteSignal.switchingType,
            signalVoltage: s.discreteSignal.signalVoltage,
            plcDataType: s.discreteSignal.plcDataType?.code ?? "BOOL",
            alarms: s.discreteSignal.alarms.map((a) => ({
              type: "DISCRETE" as const,
              condition: a.condition,
              severity: a.severity,
              alarmGroup: a.alarmGroup ?? s.alarmGroup,
              delaySeconds: a.delaySeconds,
              message: a.message,
            })),
          }
        : null,
      busSignal: s.busSignal
        ? {
            networkId: s.busSignal.plcNetworkId,
            networkProtocol: s.busSignal.plcNetwork?.protocol ?? null,
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
          }
        : null,
    };
  });

  return NextResponse.json({
    project: { id: project.id, name: project.name, status: project.status },
    codesysSettings,
    plcs: project.plcs.map((plc) => ({
      id: plc.id,
      name: plc.name,
      ipAddress: plc.ipAddress,
      notes: plc.notes,
      catalog: plc.catalog
        ? { articleNumber: plc.catalog.articleNumber, manufacturer: plc.catalog.vendorName, description: plc.catalog.description, codesysDeviceId: plc.catalog.codesysDeviceId }
        : null,
      networks: plc.networks.map((n) => ({
        id: n.id,
        protocol: n.protocol,
        role: n.role,
        nodeAddress: n.nodeAddress,
        description: n.description,
        ipAddress: n.ipAddress,
        ipPort: n.ipPort,
        baudRateKbit: n.baudRateKbit,
        baudRateBps: n.baudRateBps,
        serialParity: n.serialParity,
        serialStopBits: n.serialStopBits,
        canMode: n.canMode,
        canHeartbeatMs: n.canHeartbeatMs,
        canSyncPeriodMs: n.canSyncPeriodMs,
        cyclePeriodMs: n.cyclePeriodMs,
        hostedByCardId: n.ioCardId,
      })),
      carriers: plc.carriers.map((c) => ({
        id: c.id,
        name: c.name,
        networkId: c.plcNetworkId,
        ipAddress: c.ipAddress,
        nodeAddress: c.nodeAddress,
        modbusInputBase: c.modbusInputBase,
        modbusOutputBase: c.modbusOutputBase,
        isLocalBus: c.isLocalBus,
        codesysDeviceId: c.codesysDeviceId,
        catalog: c.catalog ? { articleNumber: c.catalog.articleNumber, manufacturer: c.catalog.vendorName } : null,
        cards: c.cards.map((card) => ({
          id: card.id,
          slotPosition: card.slotPosition,
          cardType: card.cardType,
          maxInputChannels: card.maxInputChannels,
          maxOutputChannels: card.maxOutputChannels,
          catalog: card.catalog ? { articleNumber: card.catalog.articleNumber, manufacturer: card.catalog.vendorName, codesysModuleId: card.catalog.codesysModuleId } : null,
        })),
      })),
    })),
    gvls,
    signals: signalPayload,
  });
}
