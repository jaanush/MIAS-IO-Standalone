import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "../../_auth";
import { computeCarrierAddresses, type AddressOffsets } from "../../_address";
import { renderCommissioningBlock } from "../../_commissioning";

/**
 * FR-012: derive an IEC-clean systemGroup string for grouping signals into
 * per-system POUs on the plugin side. Strategy:
 *   1. If signal_system.code is already an IEC-clean identifier-style
 *      string (no spaces, no punctuation), use it verbatim.
 *   2. Otherwise normalize signal_system.name: drop "(...)" and " - ..."
 *      sub-classifiers, split on non-alphanumeric, PascalCase each word
 *      except short (≤3 char) all-caps acronyms which stay all-caps,
 *      then append the numeric code if present and not already there.
 *
 * Returns null when no system is set so callers can apply their own
 * fallback (instance-name pattern, "System_Wide", etc.).
 */
function toSystemGroup(systemName: string | null | undefined, systemCode: string | null | undefined): string | null {
  if (systemCode && /^[A-Za-z_][A-Za-z0-9_]*$/.test(systemCode)) {
    return systemCode;
  }
  if (!systemName) return null;
  let base = systemName.replace(/\([^)]*\)/g, "");
  const dashIdx = base.indexOf(" - ");
  if (dashIdx > 0) base = base.slice(0, dashIdx);
  const words = base.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (words.length === 0) return null;
  const normalized = words
    .map((w) => {
      if (/^\d+$/.test(w)) return w;
      if (w.length <= 3 && w === w.toUpperCase()) return w;
      return w[0].toUpperCase() + w.slice(1).toLowerCase();
    })
    .join("_");
  if (systemCode && /^\d+$/.test(systemCode) && !normalized.includes(systemCode)) {
    return `${normalized}_${systemCode}`;
  }
  return normalized || null;
}

/**
 * FR-012: when signal_system is unset, fall back to the component
 * instance name. Covers the LasseMaja BMS case where Kreisel CAN
 * signals don't have signal_system rows but the component instance
 * names ("FWD BMS", "AFT SC01", "Genset", ...) carry enough info.
 */
function instanceNameToSystemGroup(instanceName: string | null | undefined): string | null {
  if (!instanceName) return null;
  const trimmed = instanceName.trim();
  if (/^FWD\b/i.test(trimmed)) return "Battery_866_C01";
  if (/^AFT\b/i.test(trimmed)) return "Battery_866_C02";
  if (/^Genset\b/i.test(trimmed)) return "Genset_861";
  return null;
}

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
      // FR-022: project-level commissioning policy
      commissioningPolicy: true,
      commissioningInitialXLocalCommReq: true,
      commissioningInitialXRunPlaybook: true,
      commissioningRebootStrategy: true,
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
          codesysDeviceName: true,
          kbusCycleTimeMs: true,
          commissioning: {
            select: { name: true, value: true, notes: true },
            orderBy: { name: "asc" },
          },
          catalog: {
            select: { articleNumber: true, vendorName: true, description: true, codesysDeviceId: true, commissioningData: true },
          },
          busNodes: {
            select: {
              bus: {
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
                  canFrameFormat: true,
                  canFramingMode: true,
                  canFramingDiscoveredAt: true,
                  canHeartbeatMs: true,
                  canSyncPeriodMs: true,
                  cyclePeriodMs: true,
                  cyclicCallIntervalMs: true,
                  canRole: true,
                  processImageBytes: true,
                  ioCardId: true,
                },
              },
            },
          },
          carriers: {
            select: {
              id: true,
              name: true,
              busId: true,
              ipAddress: true,
              nodeAddress: true,
              modbusInputBase: true,
              modbusOutputBase: true,
              isLocalBus: true,
              codesysDeviceId: true,
              cabinetNumber: true,
              carrierNumber: true,
              catalog: {
                select: { articleNumber: true, vendorName: true },
              },
              cards: {
                select: {
                  id: true,
                  slotPosition: true,
                  cardType: true,
                  subgroup: true,
                  typeCode: true,
                  instanceNumber: true,
                  maxInputChannels: true,
                  maxOutputChannels: true,
                  hasDiagnostics: true,
                  diagnosticType: true,
                  diagnosticBitsPerChannel: true,
                  commissioning: {
                    select: { name: true, value: true, notes: true },
                    orderBy: { name: "asc" },
                  },
                  catalog: {
                    select: { articleNumber: true, vendorName: true, codesysModuleId: true, kbusImageSize: true, commissioningData: true },
                  },
                  hostedBuses: {
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
                      canFrameFormat: true,
                      canFramingMode: true,
                      canFramingDiscoveredAt: true,
                      canHeartbeatMs: true,
                      canSyncPeriodMs: true,
                      cyclePeriodMs: true,
                      cyclicCallIntervalMs: true,
                      canRole: true,
                      processImageBytes: true,
                      ioCardId: true,
                    },
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
      hwCabinet: true,
      hwCarrier: true,
      hwTypeCode: true,
      hwInstance: true,
      systemId: true,
      system: { select: { code: true, name: true } },
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
      // Diagnostics
      isDiagnostic: true,
      diagnosticParentId: true,
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
          busId: true,
          bus: { select: { protocol: true } },
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
          // FR-010: channel index within the card (0-based) — plugin uses
          // this for bit-packed Modbus TCP slave channel binding. Keeping
          // the top-level `channelPosition` too for backwards compat.
          channelPosition: s.channelPosition,
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

    // Hardware identifier string (stable across card deletion)
    const hwId = s.hwCabinet != null && s.hwCarrier != null && s.hwTypeCode && s.hwInstance != null
      ? `N${s.hwCabinet}:D${String(s.hwCarrier).padStart(2, "0")}:${s.hwTypeCode}${String(s.hwInstance).padStart(2, "0")}`
      : null;

    // FR-012: stable systemGroup for per-system POU bucketing on plugin
    // side. signal_system → instance-name fallback → System_Wide.
    const systemGroup =
      toSystemGroup(s.system?.name, s.system?.code) ??
      instanceNameToSystemGroup(s.instanceSignal?.instance.name) ??
      "System_Wide";

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
      systemGroup,
      componentTag: s.componentTag,
      drawingRef: s.drawingRef,
      cabinetLocation: s.cabinetLocation,
      hwId,
      ioCard,
      instance,
      channelPosition: s.channelPosition,
      plcAddress,
      // Diagnostics
      isDiagnostic: s.isDiagnostic,
      diagnosticParentId: s.diagnosticParentId,
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
            networkId: s.busSignal.busId,
            networkProtocol: s.busSignal.bus?.protocol ?? null,
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
    // FR-022: project-level hardware commissioning policy. Plugin codegen
    // reads `policy` to decide whether to emit the playbook + Commissioning_Task,
    // and `initialXLocalCommReq` / `initialXRunPlaybook` for the GVL inits.
    // `rebootStrategy` decides SAVE_FLASH placement. `catalogVersion` is a
    // string the plugin can log for traceability — we don't currently track
    // a hash, just the date the seed was last run.
    commissioning: {
      policy: project.commissioningPolicy,
      initialXLocalCommReq: project.commissioningInitialXLocalCommReq,
      initialXRunPlaybook: project.commissioningInitialXRunPlaybook,
      rebootStrategy: project.commissioningRebootStrategy,
      catalogVersion: "data/commissioning/wago_module_commissioning.json (seed via prisma/seed_commissioning_catalog.ts)",
    },
    plcs: project.plcs.map((plc) => ({
      id: plc.id,
      name: plc.name,
      ipAddress: plc.ipAddress,
      notes: plc.notes,
      codesysDeviceName: plc.codesysDeviceName,
      // FR-021: PFC200 K-bus device parameter Id=128. null = use device default (10 ms).
      kbusCycleTimeMs: (plc as any).kbusCycleTimeMs ?? null,
      // Hardware commissioning project overrides on this PLC. Each entry's
      // `name` matches a `commissioning_settings[].name` in the catalog
      // entry pinned to plc.catalog (mirrored at MIAS-ref/docs/databases/
      // wago/module_commissioning.json). When the plugin's commissioning
      // function runs, the effective value resolves as: this list (project
      // override) → catalog `mias_convention_value` → catalog `default_value`
      // → null. Empty list = no overrides; use catalog defaults verbatim.
      commissioningOverrides: plc.commissioning,
      // FR-022 Path A: joined catalog + project commissioning block. Plugin
      // codegen consumes this directly to emit the IEC playbook. null when
      // the controller catalog has no commissioning data (older catalog rows).
      commissioning: renderCommissioningBlock({
        partId: plc.catalog ? `${plc.catalog.vendorName.toLowerCase()}:${plc.catalog.articleNumber}` : null,
        catalogData: (plc.catalog?.commissioningData as never) ?? null,
        slotPosition: null, // controllers don't have a K-bus slot
        overrides: plc.commissioning,
      }),
      catalog: plc.catalog
        ? { articleNumber: plc.catalog.articleNumber, manufacturer: plc.catalog.vendorName, description: plc.catalog.description, codesysDeviceId: plc.catalog.codesysDeviceId }
        : null,
      networks: (() => {
        const viaNodes = plc.busNodes.map((bn) => bn.bus).filter(Boolean);
        const viaCards = plc.carriers.flatMap((c) => c.cards.flatMap((card) => card.hostedBuses));
        const seen = new Set<number>();
        return [...viaNodes, ...viaCards]
          .filter((n) => { if (seen.has(n.id)) return false; seen.add(n.id); return true; })
          .map((n) => ({
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
            // FR-015 (plugin): per-bus framing. Raw enum + boolean alias for codegen.
            canFrameFormat: (n as any).canFrameFormat ?? null,
            use29Bit: (n as any).canFrameFormat === "EXTENDED" ? true
                    : (n as any).canFrameFormat === "STANDARD" ? false
                    : null,
            // FR-016 (plugin): FIXED = config authoritative; AUTO = bus is in
            // discovery mode and the plugin will write back via /discovered.
            canFramingMode: (n as any).canFramingMode ?? null,
            canFramingDiscoveredAt: (n as any).canFramingDiscoveredAt ?? null,
            canHeartbeatMs: n.canHeartbeatMs,
            canSyncPeriodMs: n.canSyncPeriodMs,
            cyclePeriodMs: n.cyclePeriodMs,
            // FR-019: per-iface CAN_Task cadence override. null = default (10 ms).
            cyclicCallIntervalMs: n.cyclicCallIntervalMs ?? null,
            // FR-019 follow-up: structured CAN role for the renderer +
            // Kreisel auto-wiring. null ≡ GENERIC.
            canRole: (n as any).canRole ?? null,
            // FR-020: WAGO 750-658 K-bus PI size, bytes per direction.
            // null = leave module's EEPROM-saved value alone.
            processImageBytes: (n as any).processImageBytes ?? null,
            hostedByCardId: n.ioCardId,
          }));
      })(),
      carriers: plc.carriers.map((c) => ({
        id: c.id,
        name: c.name,
        networkId: c.busId,
        ipAddress: c.ipAddress,
        nodeAddress: c.nodeAddress,
        modbusInputBase: c.modbusInputBase,
        modbusOutputBase: c.modbusOutputBase,
        isLocalBus: c.isLocalBus,
        codesysDeviceId: c.codesysDeviceId,
        cabinetNumber: c.cabinetNumber,
        carrierNumber: c.carrierNumber,
        catalog: c.catalog ? { articleNumber: c.catalog.articleNumber, manufacturer: c.catalog.vendorName } : null,
        cards: c.cards.map((card) => ({
          id: card.id,
          name: `${card.catalog?.articleNumber ?? "Module"}_S${String(card.slotPosition).padStart(2, "0")}`,
          slotPosition: card.slotPosition,
          cardType: card.cardType,
          subgroup: card.subgroup,
          typeCode: card.typeCode,
          instanceNumber: card.instanceNumber,
          maxInputChannels: card.maxInputChannels,
          maxOutputChannels: card.maxOutputChannels,
          hasDiagnostics: card.hasDiagnostics,
          diagnosticType: card.diagnosticType,
          diagnosticBitsPerChannel: card.diagnosticBitsPerChannel,
          // Hardware commissioning project overrides on this IO card. See
          // notes on plc.commissioningOverrides above for resolution order.
          commissioningOverrides: card.commissioning,
          // FR-022 Path A: joined catalog + project commissioning block.
          commissioning: renderCommissioningBlock({
            partId: card.catalog ? `${card.catalog.vendorName.toLowerCase()}:${card.catalog.articleNumber}` : null,
            catalogData: (card.catalog?.commissioningData as never) ?? null,
            slotPosition: card.slotPosition,
            overrides: card.commissioning,
          }),
          catalog: card.catalog ? { articleNumber: card.catalog.articleNumber, manufacturer: card.catalog.vendorName, codesysModuleId: card.catalog.codesysModuleId, kbusImageSize: card.catalog.kbusImageSize } : null,
        })),
      })),
    })),
    gvls,
    signals: signalPayload,
  });
}
