import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { db } from "@/lib/db";
import type { SignalOrigin, PlcDataType } from "@prisma/client";
import { BUS_PROTOCOLS, NETWORK_ROLES, SERIAL_PARITY, CAN_MODES, SIGNAL_ORIGINS } from "@/lib/enums";

// ── Shared include shapes ─────────────────────────────────────────────────────

const cardInclude = {
  catalog: {
    select: {
      id: true,
      articleNumber: true,
      vendorName: true,
      cardType: true,
      maxInputChannels: true,
      maxOutputChannels: true,
      providesNetwork: true,
      protocols: { select: { protocol: true } },
      approvals: { select: { approvalId: true } },
    },
  },
};

const carrierInclude = {
  catalog: {
    select: {
      id: true,
      articleNumber: true,
      vendorName: true,
      maxModules: true,
      ethernetPorts: true,
    },
  },
  cards: { include: cardInclude, orderBy: { slotPosition: "asc" as const } },
  ports: { orderBy: { portNumber: "asc" as const } },
};

const networkInclude = {
  carriers: {
    include: carrierInclude,
    orderBy: { name: "asc" as const },
  },
  ioCard: { select: { id: true, name: true, slotPosition: true } },
  plcPorts: { select: { id: true, portNumber: true, label: true } },
  instances: {
    include: {
      component: { select: { id: true, name: true, manufacturer: true, model: true } },
    },
    orderBy: { name: "asc" as const },
  },
};

const plcInclude = {
  catalog: {
    select: {
      id: true,
      articleNumber: true,
      vendorName: true,
      maxModules: true,
      busPowerBudgetMa: true,
      ethernetPorts: true,
      protocols: { select: { protocol: true } },
    },
  },
  networks: { include: networkInclude, orderBy: { protocol: "asc" as const } },
  carriers: {
    where: { plcNetworkId: null },
    include: carrierInclude,
    orderBy: { name: "asc" as const },
  },
  ports: { orderBy: { portNumber: "asc" as const } },
};

// ── Router ────────────────────────────────────────────────────────────────────

export const projectHardwareRouter = createTRPCRouter({
  // ── Project approvals management ─────────────────────────────────────────
  approvalAdd: protectedProcedure
    .input(z.object({ projectId: z.number().int(), approvalId: z.number().int() }))
    .mutation(({ input }) =>
      db.projectApproval.upsert({
        where: { projectId_approvalId: { projectId: input.projectId, approvalId: input.approvalId } },
        create: input,
        update: {},
      })
    ),

  approvalRemove: protectedProcedure
    .input(z.object({ projectId: z.number().int(), approvalId: z.number().int() }))
    .mutation(({ input }) =>
      db.projectApproval.delete({
        where: { projectId_approvalId: { projectId: input.projectId, approvalId: input.approvalId } },
      })
    ),

  // ── Full hardware tree ────────────────────────────────────────────────────
  getHardware: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .query(({ input }) => {
      return db.plc.findMany({
        where: { projectId: input.projectId },
        include: {
          ...plcInclude,
          networks: {
            include: {
              ...networkInclude,
              carriers: {
                include: {
                  ...carrierInclude,
                  cards: {
                    include: cardInclude,
                    orderBy: { slotPosition: "asc" },
                  },
                },
                orderBy: { name: "asc" },
              },
            },
            orderBy: { protocol: "asc" },
          },
          carriers: {
            where: { plcNetworkId: null },
            include: {
              ...carrierInclude,
              cards: {
                include: cardInclude,
                orderBy: { slotPosition: "asc" },
              },
            },
            orderBy: { name: "asc" },
          },
          ports: { orderBy: { portNumber: "asc" } },
        },
        orderBy: { name: "asc" },
      });
    }),

  // ── Project approvals (for module filter) ────────────────────────────────
  projectApprovals: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .query(({ input }) =>
      db.projectApproval.findMany({
        where: { projectId: input.projectId },
        include: { approval: true },
      })
    ),

  // ── Module catalog filtered by project approvals ───────────────────────
  modulesForProject: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .query(async ({ input }) => {
      const projectApprovals = await db.projectApproval.findMany({
        where: { projectId: input.projectId },
        select: { approvalId: true },
      });

      const requiredIds = projectApprovals.map((pa) => pa.approvalId);

      const modules = await db.moduleCatalog.findMany({
        orderBy: [{ vendorName: "asc" }, { articleNumber: "asc" }],
        include: {
          approvals: { select: { approvalId: true } },
        },
      });

      if (requiredIds.length === 0) return modules;

      // Only include modules that have ALL required approvals
      return modules.filter((m) => {
        const moduleIds = m.approvals.map((a) => a.approvalId);
        return requiredIds.every((id) => moduleIds.includes(id));
      });
    }),

  // ── Coupler catalog for carrier assignment ─────────────────────────────
  couplersForProject: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .query(async ({ input }) => {
      const projectApprovals = await db.projectApproval.findMany({
        where: { projectId: input.projectId },
        select: { approvalId: true },
      });
      const requiredIds = projectApprovals.map((pa) => pa.approvalId);

      const couplers = await db.deviceCatalog.findMany({
        where: { type: "COUPLER" },
        orderBy: [{ vendorName: "asc" }, { articleNumber: "asc" }],
        include: {
          approvals: { select: { approvalId: true } },
          protocols: { select: { protocol: true } },
        },
      });

      if (requiredIds.length === 0) return couplers;
      return couplers.filter((d) => {
        const ids = d.approvals.map((a) => a.approvalId);
        return requiredIds.every((id) => ids.includes(id));
      });
    }),

  // ── PLC CRUD ──────────────────────────────────────────────────────────────
  plcCreate: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        catalogId: z.number().int().optional().nullable(),
        name: z.string().min(1),
        ipAddress: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(({ input }) =>
      db.plc.create({ data: input, include: plcInclude })
    ),

  plcUpdate: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        catalogId: z.number().int().optional(),
        name: z.string().min(1).optional(),
        ipAddress: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return db.plc.update({ where: { id }, data });
    }),

  plcDelete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(({ input }) => db.plc.delete({ where: { id: input.id } })),

  // ── Network CRUD ──────────────────────────────────────────────────────────
  networkCreate: protectedProcedure
    .input(
      z.object({
        plcId: z.number().int(),
        ioCardId: z.number().int().optional().nullable(),
        protocol: z.enum(BUS_PROTOCOLS),
        role: z.enum(NETWORK_ROLES),
        nodeAddress: z.coerce.number().int().optional().nullable(),
        description: z.string().optional().nullable(),
        baudRateKbit: z.coerce.number().int().optional().nullable(),
        baudRateBps: z.coerce.number().int().optional().nullable(),
        serialParity: z.enum(SERIAL_PARITY).optional().nullable(),
        serialStopBits: z.coerce.number().int().optional().nullable(),
        ipAddress: z.string().optional().nullable(),
        ipPort: z.coerce.number().int().optional().nullable(),
        canMode: z.enum(CAN_MODES).optional().nullable(),
        canHeartbeatMs: z.coerce.number().int().optional().nullable(),
        canSyncPeriodMs: z.coerce.number().int().optional().nullable(),
        cyclePeriodMs: z.coerce.number().int().optional().nullable(),
      })
    )
    .mutation(({ input }) => db.plcNetwork.create({ data: input, include: networkInclude })),

  networkUpdate: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        protocol: z.enum(BUS_PROTOCOLS).optional(),
        role: z.enum(NETWORK_ROLES).optional(),
        nodeAddress: z.coerce.number().int().optional().nullable(),
        description: z.string().optional().nullable(),
        baudRateKbit: z.coerce.number().int().optional().nullable(),
        baudRateBps: z.coerce.number().int().optional().nullable(),
        serialParity: z.enum(SERIAL_PARITY).optional().nullable(),
        serialStopBits: z.coerce.number().int().optional().nullable(),
        ipAddress: z.string().optional().nullable(),
        ipPort: z.coerce.number().int().optional().nullable(),
        canMode: z.enum(CAN_MODES).optional().nullable(),
        canHeartbeatMs: z.coerce.number().int().optional().nullable(),
        canSyncPeriodMs: z.coerce.number().int().optional().nullable(),
        cyclePeriodMs: z.coerce.number().int().optional().nullable(),
      })
    )
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return db.plcNetwork.update({ where: { id }, data });
    }),

  networkDelete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(({ input }) => db.plcNetwork.delete({ where: { id: input.id } })),

  // ── Carrier CRUD ──────────────────────────────────────────────────────────
  carrierCreate: protectedProcedure
    .input(
      z.object({
        plcId: z.number().int(),
        catalogId: z.number().int().optional().nullable(),
        plcNetworkId: z.number().int().optional().nullable(),
        name: z.string().min(1),
        ipAddress: z.string().optional().nullable(),
        nodeAddress: z.coerce.number().int().optional().nullable(),
        firmwareVersion: z.string().optional().nullable(),
        modbusInputBase: z.coerce.number().int().optional().nullable(),
        modbusOutputBase: z.coerce.number().int().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(({ input }) =>
      db.ioCarrier.create({ data: input, include: carrierInclude })
    ),

  carrierUpdate: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        catalogId: z.number().int().optional().nullable(),
        plcNetworkId: z.number().int().optional().nullable(),
        name: z.string().min(1).optional(),
        ipAddress: z.string().optional().nullable(),
        nodeAddress: z.coerce.number().int().optional().nullable(),
        firmwareVersion: z.string().optional().nullable(),
        modbusInputBase: z.coerce.number().int().optional().nullable(),
        modbusOutputBase: z.coerce.number().int().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return db.ioCarrier.update({ where: { id }, data });
    }),

  carrierDelete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(({ input }) => db.ioCarrier.delete({ where: { id: input.id } })),

  // ── IoCard (slot) CRUD ────────────────────────────────────────────────────
  cardAssign: protectedProcedure
    .input(
      z.object({
        carrierId: z.number().int(),
        slotPosition: z.number().int(),
        catalogId: z.number().int(),
      })
    )
    .mutation(async ({ input }) => {
      const catalog = await db.moduleCatalog.findUniqueOrThrow({
        where: { id: input.catalogId },
      });
      const cardData = {
        catalogId: input.catalogId,
        cardType: catalog.cardType,
        maxInputChannels: catalog.maxInputChannels,
        maxOutputChannels: catalog.maxOutputChannels,
        bitResolution: catalog.bitResolution,
        providesNetwork: catalog.providesNetwork,
        supplyVoltageField: catalog.supplyVoltageField,
        filterTimeMs: catalog.filterTimeMs,
        galvanicIsolation: catalog.galvanicIsolation,
        isolationVoltageV: catalog.isolationVoltageV,
        tempMinC: catalog.tempMinC,
        tempMaxC: catalog.tempMaxC,
        maxChannelCurrentMa: catalog.maxChannelCurrentMa,
        shortCircuitProtected: catalog.shortCircuitProtected,
        deletedAt: null,
      };
      return db.ioCard.upsert({
        where: { carrierId_slotPosition: { carrierId: input.carrierId, slotPosition: input.slotPosition } },
        create: { carrierId: input.carrierId, slotPosition: input.slotPosition, ...cardData },
        update: cardData,
        include: cardInclude,
      });
    }),

  cardUpdate: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return db.ioCard.update({ where: { id }, data });
    }),

  cardDelete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(({ input }) => db.ioCard.delete({ where: { id: input.id } })),

  // ── Per-port IP / network assignment ──────────────────────────────────────
  plcPortSave: protectedProcedure
    .input(
      z.object({
        plcId: z.number().int(),
        portNumber: z.number().int(),
        label: z.string().optional().nullable(),
        ipAddress: z.string().optional().nullable(),
        plcNetworkId: z.number().int().optional().nullable(),
      })
    )
    .mutation(({ input }) =>
      db.plcPort.upsert({
        where: { plcId_portNumber: { plcId: input.plcId, portNumber: input.portNumber } },
        create: input,
        update: {
          label: input.label,
          ipAddress: input.ipAddress,
          plcNetworkId: input.plcNetworkId,
        },
      })
    ),

  carrierPortSave: protectedProcedure
    .input(
      z.object({
        carrierId: z.number().int(),
        portNumber: z.number().int(),
        label: z.string().optional().nullable(),
        ipAddress: z.string().optional().nullable(),
        plcNetworkId: z.number().int().optional().nullable(),
      })
    )
    .mutation(({ input }) =>
      db.carrierPort.upsert({
        where: { carrierId_portNumber: { carrierId: input.carrierId, portNumber: input.portNumber } },
        create: input,
        update: {
          label: input.label,
          ipAddress: input.ipAddress,
          plcNetworkId: input.plcNetworkId,
        },
      })
    ),

  // ── Component instance management ─────────────────────────────────────────

  // List global components that have at least one bus signal matching the given protocol
  componentsForNetwork: protectedProcedure
    .input(z.object({ protocol: z.string() }))
    .query(async ({ input }) => {
      return db.hardwareComponent.findMany({
        where: {
          projectId: null,
          signals: { some: { origin: { not: "IEC" } } },
        },
        orderBy: { name: "asc" },
        include: {
          _count: { select: { signals: true } },
          signals: {
            where: { origin: { not: "IEC" } },
            select: { origin: true },
            distinct: ["origin"],
          },
        },
      });
    }),

  instanceCreate: protectedProcedure
    .input(z.object({
      projectId: z.number().int(),
      componentId: z.number().int(),
      plcNetworkId: z.number().int(),
      name: z.string().min(1),
      tag: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }))
    .mutation(async ({ input }) => {
      // Load component signals
      const component = await db.hardwareComponent.findUniqueOrThrow({
        where: { id: input.componentId },
        include: {
          signals: {
            where: { active: true },
            orderBy: { channelOffset: "asc" },
            include: { plcDataTypeCatalog: { select: { code: true } } },
          },
        },
      });

      // Get network protocol to use as signal origin
      const network = await db.plcNetwork.findUniqueOrThrow({
        where: { id: input.plcNetworkId },
        select: { protocol: true },
      });

      // Only bus-type SignalOrigins are valid (exclude IEC and INTERNAL)
      const VALID_BUS_ORIGINS = new Set<string>(
        SIGNAL_ORIGINS.filter((o) => o !== "IEC" && o !== "INTERNAL")
      );
      if (!VALID_BUS_ORIGINS.has(network.protocol)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Network protocol ${network.protocol} cannot be used as a signal origin. Only fieldbus protocols that map to SignalOrigin are supported (ETHERCAT is not).`,
        });
      }

      const signalOrigin = network.protocol as string;

      // Auto-increment canIdOffset: count existing instances of same component on same network
      const existingCount = await db.componentInstance.count({
        where: {
          componentId: input.componentId,
          plcNetworkId: input.plcNetworkId,
        },
      });
      const canOffset = (component.minCanIdOffset ?? 0) * existingCount;

      return db.$transaction(async (tx) => {
        // Create the instance with auto-computed canIdOffset
        const instance = await tx.componentInstance.create({
          data: {
            projectId: input.projectId,
            componentId: input.componentId,
            plcNetworkId: input.plcNetworkId,
            name: input.name,
            tag: input.tag ?? null,
            notes: input.notes ?? null,
            canIdOffset: canOffset || null,
          },
        });

        // Create instanceSignal + Signal + BusSignal for each component signal
        for (const cs of component.signals) {
          const isDiscrete = cs.ioType === "DI" || cs.ioType === "DO";
          const csOrigin = (cs.origin as string | null) ?? signalOrigin;

          const instanceSignal = await tx.instanceSignal.create({
            data: {
              instanceId: instance.id,
              componentSignalId: cs.id,
              templateDirty: false,
            },
          });

          await tx.signal.create({
            data: {
              projectId: input.projectId,
              instanceSignalId: instanceSignal.id,
              origin: csOrigin as SignalOrigin,
              signalType: isDiscrete ? "DISCRETE" : "ANALOG",
              tag: cs.tagSuffix,
              description: cs.description,
              busSignal: {
                create: {
                  plcNetworkId: input.plcNetworkId,
                  // Data representation (template overrides defaults)
                  rawDataType: cs.rawDataType ?? (isDiscrete ? "BOOL" : "WORD"),
                  plcDataType: (cs.plcDataTypeCatalog?.code ?? (isDiscrete ? "BOOL" : "INT")) as PlcDataType,
                  byteOrder: cs.byteOrder ?? "BIG_ENDIAN",
                  timeoutMs: cs.timeoutMs,
                  // CAN addressing
                  nodeId: cs.canNodeId,
                  canId: cs.canId != null ? cs.canId + canOffset : null,
                  bitOffset: cs.bitOffset,
                  bitLength: cs.bitLength,
                  isMuxIndicator: cs.isMuxIndicator,
                  muxId: cs.muxId,
                  // CANopen addressing
                  canopenIndex: cs.canopenIndex,
                  canopenSubIndex: cs.canopenSubIndex,
                  // J1939 addressing
                  j1939Pgn: cs.j1939Pgn,
                  j1939Spn: cs.j1939Spn,
                  // Modbus addressing
                  unitId: cs.modbusUnitId,
                  registerType: cs.modbusRegisterType,
                  registerOffset: cs.modbusRegisterOffset,
                },
              },
              // Create child table from template defaults
              ...(isDiscrete ? {
                discreteSignal: {
                  create: {
                    trigger: cs.defaultTrigger ?? "NO",
                    filterTimeMs: cs.defaultFilterTimeMs ?? null,
                    switchingType: cs.defaultSwitchingType ?? null,
                  },
                },
              } : {
                analogSignal: {
                  create: {
                    inputTypeId: cs.defaultInputTypeId ?? null,
                    wireConfig: cs.defaultWireConfig ?? null,
                    scaleMin: cs.defaultScaleMin ?? null,
                    scaleMax: cs.defaultScaleMax ?? null,
                    engineeringUnitId: cs.defaultEuId ?? null,
                  },
                },
              }),
            },
          });
        }

        return instance;
      });
    }),

  instanceUpdate: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      name: z.string().min(1),
      tag: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      canIdOffset: z.number().int().optional().nullable(),
      functionBlockOverride: z.string().max(100).optional().nullable(),
    }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return db.componentInstance.update({ where: { id }, data });
    }),

  // Returns per-instance CAN ID data for span calculation
  networkCanIds: protectedProcedure
    .input(z.object({ networkId: z.number().int() }))
    .query(({ input }) =>
      db.componentInstance.findMany({
        where: { plcNetworkId: input.networkId },
        select: {
          id: true,
          name: true,
          canIdOffset: true,
          component: {
            select: {
              minCanIdOffset: true,
              signals: {
                where: { canId: { not: null }, active: true },
                select: { id: true, canId: true, tagSuffix: true },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      })
    ),

  instanceDelete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      // Signal.instanceSignalId has no cascade — delete signals explicitly first
      const instanceSignals = await db.instanceSignal.findMany({
        where: { instanceId: input.id },
        select: { id: true },
      });
      const instanceSignalIds = instanceSignals.map((is) => is.id);
      await db.signal.deleteMany({ where: { instanceSignalId: { in: instanceSignalIds } } });
      // InstanceSignal rows cascade-delete with the instance
      await db.componentInstance.delete({ where: { id: input.id } });
    }),
});
