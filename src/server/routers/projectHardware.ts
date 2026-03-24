import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { db } from "@/lib/db";
import type { SignalOrigin, PlcDataType } from "../../../prisma/generated/prisma/client/client";
import { BUS_PROTOCOLS, NETWORK_ROLES, NETWORK_NODE_ROLES, SERIAL_PARITY, CAN_MODES, SIGNAL_ORIGINS } from "@/lib/enums";

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
      busCurrentConsumptionMa: true,
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

const busInclude = {
  carriers: {
    include: carrierInclude,
    orderBy: { name: "asc" as const },
  },
  ioCard: { select: { id: true, name: true, slotPosition: true } },
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
  busNodes: {
    include: {
      bus: { include: busInclude },
    },
    orderBy: { createdAt: "asc" as const },
  },
  carriers: {
    where: { busId: null },
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
    .query(async ({ input }) => {
      const fullBusInclude = {
        ...busInclude,
        nodes: {
          include: {
            plc: { select: { id: true, name: true } },
            carrier: { select: { id: true, name: true, cabinetNumber: true, carrierNumber: true } },
          },
          orderBy: { createdAt: "asc" as const },
        },
        carriers: {
          include: {
            ...carrierInclude,
            cards: {
              include: cardInclude,
              orderBy: { slotPosition: "asc" as const },
            },
          },
          orderBy: { name: "asc" as const },
        },
      };

      const [rawPlcs, standaloneBuses] = await Promise.all([
        db.plc.findMany({
          where: { projectId: input.projectId },
          include: {
            ...plcInclude,
            carriers: {
              where: { busId: null },
              include: {
                ...carrierInclude,
                cards: { include: cardInclude, orderBy: { slotPosition: "asc" } },
              },
              orderBy: { name: "asc" },
            },
            ports: { orderBy: { portNumber: "asc" } },
          },
          orderBy: { name: "asc" },
        }),
        // Standalone buses (no BusNode connections to any PLC)
        db.bus.findMany({
          where: {
            projectId: input.projectId,
            nodes: { none: { plcId: { not: null } } },
          },
          include: fullBusInclude,
          orderBy: { protocol: "asc" },
        }),
      ]);

      // Build PLC → bus mapping from BusNodes (both direct PLC nodes and carrier nodes)
      // A bus belongs to a PLC if: BusNode.plcId = PLC, OR BusNode.carrierId → carrier.plcId = PLC
      const allBusNodes = await db.busNode.findMany({
        where: {
          bus: { projectId: input.projectId },
        },
        select: {
          busId: true,
          plcId: true,
          carrierId: true,
          carrier: { select: { plcId: true } },
        },
      });

      // Map busId → Set of plcIds (direct + via carrier)
      const busToPlcIds = new Map<number, Set<number>>();
      for (const bn of allBusNodes) {
        const plcId = bn.plcId ?? bn.carrier?.plcId;
        if (!plcId) continue;
        let set = busToPlcIds.get(bn.busId);
        if (!set) { set = new Set(); busToPlcIds.set(bn.busId, set); }
        set.add(plcId);
      }

      // Collect all bus IDs connected to any PLC
      const allConnectedBusIds = [...busToPlcIds.keys()];
      const connectedBuses = allConnectedBusIds.length > 0
        ? await db.bus.findMany({
            where: { id: { in: allConnectedBusIds } },
            include: fullBusInclude,
          })
        : [];
      const busMap = new Map(connectedBuses.map((b) => [b.id, b]));

      const plcsWithBuses = rawPlcs.map((plc) => {
        const { busNodes, ...rest } = plc;
        // Find buses connected to this PLC (direct or via carrier)
        const plcBusIds = [...busToPlcIds.entries()]
          .filter(([, plcIds]) => plcIds.has(plc.id))
          .map(([busId]) => busId);
        const buses = plcBusIds
          .map((id) => busMap.get(id))
          .filter((b): b is NonNullable<typeof b> => b != null);
        return { ...rest, buses };
      });

      // Standalone = buses with no PLC connections at all
      const connectedBusIdSet = new Set(allConnectedBusIds);
      const actualStandalone = standaloneBuses.filter((b) => !connectedBusIdSet.has(b.id));

      return { plcs: plcsWithBuses, networks: actualStandalone };
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
    .mutation(async ({ input }) => {
      const plc = await db.plc.create({ data: input, include: plcInclude });
      // Auto-create a local carrier for the PLC's own IO bus
      await db.ioCarrier.create({
        data: {
          plcId: plc.id,
          name: `${input.name}-LOCAL`,
          catalogId: input.catalogId ?? null,
        },
      });
      // Re-fetch to include the new carrier
      return db.plc.findUniqueOrThrow({ where: { id: plc.id }, include: plcInclude });
    }),

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
  busCreate: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        plcId: z.number().int().optional().nullable(),
        ioCardId: z.number().int().optional().nullable(),
        ipNetworkId: z.number().int().optional().nullable(),
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
    .mutation(({ input }) => db.bus.create({ data: input, include: busInclude })),

  busUpdate: protectedProcedure
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
        ipNetworkId: z.number().int().optional().nullable(),
        ioCardId: z.number().int().optional().nullable(),
      })
    )
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return db.bus.update({ where: { id }, data });
    }),

  busDelete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(({ input }) => db.bus.delete({ where: { id: input.id } })),

  // ── Network node (device ↔ network membership) ─────────────────────────────
  busNodeUpsert: protectedProcedure
    .input(z.object({
      busId: z.number().int(),
      plcId: z.number().int().optional().nullable(),
      carrierId: z.number().int().optional().nullable(),
      role: z.enum(NETWORK_NODE_ROLES).default("CLIENT"),
      nodeAddress: z.coerce.number().int().optional().nullable(),
      ipAddress: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
    }))
    .mutation(async ({ input }) => {
      const data = { role: input.role, nodeAddress: input.nodeAddress, ipAddress: input.ipAddress, description: input.description };
      if (input.plcId) {
        return db.busNode.upsert({
          where: { busId_plcId: { busId: input.busId, plcId: input.plcId } },
          create: { busId: input.busId, plcId: input.plcId, ...data },
          update: data,
        });
      }
      if (input.carrierId) {
        return db.busNode.upsert({
          where: { busId_carrierId: { busId: input.busId, carrierId: input.carrierId } },
          create: { busId: input.busId, carrierId: input.carrierId, ...data },
          update: data,
        });
      }
      throw new TRPCError({ code: "BAD_REQUEST", message: "Either plcId or carrierId is required" });
    }),

  busNodeDelete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(({ input }) => db.busNode.delete({ where: { id: input.id } })),

  busNodes: protectedProcedure
    .input(z.object({ busId: z.number().int() }))
    .query(({ input }) =>
      db.busNode.findMany({
        where: { busId: input.busId },
        include: {
          plc: { select: { id: true, name: true } },
          carrier: { select: { id: true, name: true, cabinetNumber: true, carrierNumber: true } },
        },
        orderBy: { createdAt: "asc" },
      })
    ),

  // ── Carrier CRUD ──────────────────────────────────────────────────────────
  carrierCreate: protectedProcedure
    .input(
      z.object({
        plcId: z.number().int(),
        catalogId: z.number().int().optional().nullable(),
        busId: z.number().int().optional().nullable(),
        name: z.string().min(1),
        ipAddress: z.string().optional().nullable(),
        nodeAddress: z.coerce.number().int().optional().nullable(),
        firmwareVersion: z.string().optional().nullable(),
        modbusInputBase: z.coerce.number().int().optional().nullable(),
        modbusOutputBase: z.coerce.number().int().optional().nullable(),
        cabinetNumber: z.coerce.number().int().min(1).max(9).optional().nullable(),
        carrierNumber: z.coerce.number().int().min(1).max(99).optional().nullable(),
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
        busId: z.number().int().optional().nullable(),
        name: z.string().min(1).optional(),
        ipAddress: z.string().optional().nullable(),
        nodeAddress: z.coerce.number().int().optional().nullable(),
        firmwareVersion: z.string().optional().nullable(),
        modbusInputBase: z.coerce.number().int().optional().nullable(),
        modbusOutputBase: z.coerce.number().int().optional().nullable(),
        cabinetNumber: z.coerce.number().int().min(1).max(9).optional().nullable(),
        carrierNumber: z.coerce.number().int().min(1).max(99).optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const carrier = await db.ioCarrier.update({ where: { id }, data });

      // Cascade cabinetNumber/carrierNumber changes to bound signals
      if (data.cabinetNumber !== undefined || data.carrierNumber !== undefined) {
        const cardIds = (await db.ioCard.findMany({ where: { carrierId: id }, select: { id: true } })).map((c) => c.id);
        if (cardIds.length > 0) {
          const sigUpdate: Record<string, unknown> = {};
          if (data.cabinetNumber !== undefined) sigUpdate.hwCabinet = data.cabinetNumber;
          if (data.carrierNumber !== undefined) sigUpdate.hwCarrier = data.carrierNumber;
          await db.signal.updateMany({
            where: { ioCardId: { in: cardIds }, hwCabinet: { not: null } },
            data: sigUpdate,
          });
        }
      }

      return carrier;
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
        subgroup: z.string().length(1).optional().nullable(),
        typeCode: z.string().length(1).optional().nullable(),
        instanceNumber: z.coerce.number().int().min(1).max(99).optional().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const catalog = await db.moduleCatalog.findUniqueOrThrow({
        where: { id: input.catalogId },
      });

      const subgroup = input.subgroup ?? "A";

      // Use explicit typeCode/instanceNumber if provided, otherwise auto-assign from ModuleTypeCode
      let typeCode = input.typeCode ?? null;
      let instanceNumber = input.instanceNumber ?? null;

      if (!typeCode) {
        const typeCodes = await db.moduleTypeCode.findMany({
          where: { cardType: catalog.cardType },
          orderBy: { code: "asc" },
          select: { code: true },
        });
        if (typeCodes.length > 0) typeCode = typeCodes[0].code;
      }

      if (typeCode && !instanceNumber) {
        const existingCards = await db.ioCard.findMany({
          where: { carrierId: input.carrierId, subgroup, typeCode },
          select: { instanceNumber: true },
        });
        const usedInstances = existingCards.map((c) => c.instanceNumber ?? 0);
        instanceNumber = usedInstances.length > 0 ? Math.max(...usedInstances) + 1 : 1;
      }

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
        subgroup,
        typeCode,
        instanceNumber,
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
        subgroup: z.string().length(1).optional().nullable(),
        typeCode: z.string().length(1).optional().nullable(),
        instanceNumber: z.coerce.number().int().min(1).max(99).optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;

      // If typeCode is changing, validate it belongs to the same cardType group
      if (data.typeCode !== undefined && data.typeCode !== null) {
        const card = await db.ioCard.findUniqueOrThrow({ where: { id }, select: { cardType: true } });
        const valid = await db.moduleTypeCode.findUnique({
          where: { cardType_code: { cardType: card.cardType, code: data.typeCode } },
        });
        if (!valid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Type code '${data.typeCode}' is not valid for card type ${card.cardType}`,
          });
        }
      }

      const updated = await db.ioCard.update({ where: { id }, data });

      // Cascade subgroup/typeCode/instanceNumber changes to bound signals
      const needsCascade = data.subgroup !== undefined || data.typeCode !== undefined || data.instanceNumber !== undefined;
      if (needsCascade) {
        const card = await db.ioCard.findUniqueOrThrow({ where: { id }, select: { subgroup: true, typeCode: true, instanceNumber: true } });
        const hwTypeCode = card.typeCode ? `${card.subgroup ?? "A"}${card.typeCode}` : null;
        await db.signal.updateMany({
          where: { ioCardId: id, hwTypeCode: { not: null } },
          data: { hwTypeCode, hwInstance: card.instanceNumber },
        });
      }

      return updated;
    }),

  cardReorder: protectedProcedure
    .input(z.object({
      carrierId: z.number().int(),
      cardOrder: z.array(z.object({ id: z.number().int(), slotPosition: z.number().int() })),
    }))
    .mutation(async ({ input }) => {
      // Temporarily set all to negative to avoid unique constraint conflicts during reorder
      await db.$transaction(async (tx) => {
        for (const { id, slotPosition } of input.cardOrder) {
          await tx.ioCard.update({ where: { id }, data: { slotPosition: -(slotPosition + 1000) } });
        }
        for (const { id, slotPosition } of input.cardOrder) {
          await tx.ioCard.update({ where: { id }, data: { slotPosition } });
        }
      });
      return { reordered: input.cardOrder.length };
    }),

  /** Move a card to a different subgroup — reassigns instance numbers in both source and target */
  cardMoveSubgroup: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      targetSubgroup: z.string().length(1),
    }))
    .mutation(async ({ input }) => {
      const card = await db.ioCard.findUniqueOrThrow({
        where: { id: input.id },
        select: { id: true, carrierId: true, subgroup: true, typeCode: true, cardType: true },
      });
      const fromSg = card.subgroup ?? "A";
      const toSg = input.targetSubgroup;
      if (fromSg === toSg) return card;

      const tc = card.typeCode;

      await db.$transaction(async (tx) => {
        // 1. Assign next available instance number in target subgroup
        let newInstance: number | null = null;
        if (tc) {
          const existing = await tx.ioCard.findMany({
            where: { carrierId: card.carrierId, subgroup: toSg, typeCode: tc },
            select: { instanceNumber: true },
          });
          const used = existing.map((c) => c.instanceNumber ?? 0);
          newInstance = used.length > 0 ? Math.max(...used) + 1 : 1;
        }

        // 2. Move card to target subgroup
        await tx.ioCard.update({
          where: { id: card.id },
          data: { subgroup: toSg, instanceNumber: newInstance },
        });

        // 3. Repack instance numbers in source subgroup (close gaps)
        if (tc) {
          const sourceCards = await tx.ioCard.findMany({
            where: { carrierId: card.carrierId, subgroup: fromSg, typeCode: tc, id: { not: card.id } },
            orderBy: { instanceNumber: "asc" },
            select: { id: true },
          });
          for (let i = 0; i < sourceCards.length; i++) {
            await tx.ioCard.update({ where: { id: sourceCards[i].id }, data: { instanceNumber: i + 1 } });
          }

          // 4. Cascade hw* fields to signals on all affected cards
          const allAffected = [...sourceCards.map((c) => c.id), card.id];
          for (const cardId of allAffected) {
            const c = await tx.ioCard.findUnique({ where: { id: cardId }, select: { subgroup: true, typeCode: true, instanceNumber: true } });
            if (!c?.typeCode) continue;
            const hwTypeCode = `${c.subgroup ?? "A"}${c.typeCode}`;
            await tx.signal.updateMany({
              where: { ioCardId: cardId, hwTypeCode: { not: null } },
              data: { hwTypeCode, hwInstance: c.instanceNumber },
            });
          }
        }
      });

      return { moved: true };
    }),

  cardDelete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(({ input }) => db.ioCard.delete({ where: { id: input.id } })),

  // ── Per-port IP / network assignment ──────────────────────────────────────
  // ── IP Network CRUD ──────────────────────────────────────────────────────
  ipNetworkCreate: protectedProcedure
    .input(z.object({
      projectId: z.number().int(),
      name: z.string().optional().nullable(),
      subnet: z.string().optional().nullable(),
      gateway: z.string().optional().nullable(),
      dns: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
    }))
    .mutation(({ input }) => db.ipNetwork.create({ data: input })),

  ipNetworkUpdate: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      name: z.string().optional().nullable(),
      subnet: z.string().optional().nullable(),
      gateway: z.string().optional().nullable(),
      dns: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
    }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return db.ipNetwork.update({ where: { id }, data });
    }),

  ipNetworkDelete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(({ input }) => db.ipNetwork.delete({ where: { id: input.id } })),

  ipNetworkList: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .query(({ input }) =>
      db.ipNetwork.findMany({
        where: { projectId: input.projectId },
        include: { buses: { select: { id: true, protocol: true, description: true } } },
        orderBy: { name: "asc" },
      })
    ),

  // ── Per-port IP / network assignment ──────────────────────────────────────
  plcPortSave: protectedProcedure
    .input(
      z.object({
        plcId: z.number().int(),
        portNumber: z.number().int(),
        label: z.string().optional().nullable(),
        ipAddress: z.string().optional().nullable(),
        ipNetworkId: z.number().int().optional().nullable(),
      })
    )
    .mutation(({ input }) =>
      db.plcPort.upsert({
        where: { plcId_portNumber: { plcId: input.plcId, portNumber: input.portNumber } },
        create: input,
        update: {
          label: input.label,
          ipAddress: input.ipAddress,
          ipNetworkId: input.ipNetworkId,
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
        ipNetworkId: z.number().int().optional().nullable(),
      })
    )
    .mutation(({ input }) =>
      db.carrierPort.upsert({
        where: { carrierId_portNumber: { carrierId: input.carrierId, portNumber: input.portNumber } },
        create: input,
        update: {
          label: input.label,
          ipAddress: input.ipAddress,
          ipNetworkId: input.ipNetworkId,
        },
      })
    ),

  // ── Component instance management ─────────────────────────────────────────

  // List global components that have at least one bus signal matching the given protocol
  componentsForNetwork: protectedProcedure
    .input(z.object({ protocol: z.string(), projectId: z.number().int().optional() }))
    .query(async ({ input }) => {
      return db.hardwareComponent.findMany({
        where: {
          OR: [
            { projectId: null },
            ...(input.projectId ? [{ projectId: input.projectId }] : []),
          ],
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
      busId: z.number().int(),
      name: z.string().min(1),
      tag: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }))
    .mutation(async ({ input }) => {
      // Load component with its own signals + effective signals (includes inherited from parent chain)
      const component = await db.hardwareComponent.findUniqueOrThrow({
        where: { id: input.componentId },
        select: { id: true, minCanIdOffset: true },
      });

      // Get effective signals (own + inherited from parent chain)
      const { getEffectiveSignals } = await import("@/server/lib/component-signals");
      const effectiveSignals = await getEffectiveSignals(input.componentId);

      // Load full signal data for each effective signal (need plcDataTypeCatalog etc.)
      const signalIds = effectiveSignals.map((s) => s.id);
      const fullSignals = await db.componentSignal.findMany({
        where: { id: { in: signalIds }, active: true },
        orderBy: { channelOffset: "asc" },
        include: { plcDataTypeCatalog: { select: { code: true } } },
      });

      // Get network protocol to use as signal origin
      const network = await db.bus.findUniqueOrThrow({
        where: { id: input.busId },
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
          busId: input.busId,
        },
      });
      const canOffset = (component.minCanIdOffset ?? 0) * existingCount;

      return db.$transaction(async (tx) => {
        // Create the instance with auto-computed canIdOffset
        const instance = await tx.componentInstance.create({
          data: {
            projectId: input.projectId,
            componentId: input.componentId,
            busId: input.busId,
            name: input.name,
            tag: input.tag ?? null,
            notes: input.notes ?? null,
            canIdOffset: canOffset || null,
          },
        });

        // Create instanceSignal + Signal + BusSignal for each effective signal (own + inherited)
        for (const cs of fullSignals) {
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
                  busId: input.busId,
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
              // Alarm config defaults
              alarmGroup: cs.defaultAlarmGroup ?? null,
              alarmBlockMask: cs.defaultAlarmBlockMask ?? null,
              commBlockMask: cs.defaultCommBlockMask ?? null,
              fatBlock: cs.defaultFatBlock ?? false,
              suppressionSt: cs.defaultSuppressionSt ?? null,
              specialAlarmFb: cs.defaultSpecialAlarmFb ?? null,
              specialAlarmInput: cs.defaultSpecialAlarmInput ?? null,
              anaToDigAlarm: cs.defaultAnaToDigAlarm ?? false,
              // Code gen defaults
              isRetain: cs.defaultIsRetain ?? false,
              isPersistent: cs.defaultIsPersistent ?? false,
              loggingEnabled: cs.defaultLoggingEnabled ?? false,
              fbNameOverride: cs.defaultFbNameOverride ?? null,
              useShortName: cs.defaultUseShortName ?? false,
              // Child table from template defaults
              ...(isDiscrete ? {
                discreteSignal: {
                  create: {
                    trigger: cs.defaultTrigger ?? "NO",
                    filterTimeMs: cs.defaultFilterTimeMs ?? null,
                    switchingType: cs.defaultSwitchingType ?? null,
                    signalVoltage: cs.defaultSignalVoltage ?? null,
                  },
                },
              } : {
                analogSignal: {
                  create: {
                    inputTypeId: cs.defaultInputTypeId ?? null,
                    wireConfig: cs.defaultWireConfig ?? null,
                    scaleMin: cs.defaultScaleMin ?? null,
                    scaleMax: cs.defaultScaleMax ?? null,
                    rawMin: cs.defaultRawMin ?? null,
                    rawMax: cs.defaultRawMax ?? null,
                    rawZero: cs.defaultRawZero ?? null,
                    clampLow: cs.defaultClampLow ?? null,
                    clampHigh: cs.defaultClampHigh ?? null,
                    deadband: cs.defaultDeadband ?? null,
                    engineeringUnitId: cs.defaultEuId ?? null,
                    detectWireBreak: cs.defaultDetectWireBreak ?? false,
                    detectShortCircuit: cs.defaultDetectShortCircuit ?? false,
                    detectOutOfRange: cs.defaultDetectOutOfRange ?? false,
                    namurNe43: cs.defaultNamurNe43 ?? false,
                    useTankLevel: cs.defaultUseTankLevel ?? false,
                    scalingFbOverride: cs.defaultScalingFbOverride ?? null,
                    deadbandRawMin: cs.defaultDeadbandRawMin ?? null,
                    deadbandRawZero: cs.defaultDeadbandRawZero ?? null,
                    deadbandRawMax: cs.defaultDeadbandRawMax ?? null,
                    sensorFailRaw: cs.defaultSensorFailRaw ?? null,
                    sensorFailMargin: cs.defaultSensorFailMargin ?? null,
                    sensorFailBehavior: cs.defaultSensorFailBehavior ?? null,
                    sensorFailDelayMs: cs.defaultSensorFailDelayMs ?? null,
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
      nodeRole: z.enum(NETWORK_NODE_ROLES).optional().nullable(),
      nodeAddress: z.coerce.number().int().optional().nullable(),
      canIdOffset: z.number().int().optional().nullable(),
      functionBlockOverride: z.string().max(100).optional().nullable(),
    }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return db.componentInstance.update({ where: { id }, data });
    }),

  // Returns per-instance CAN ID data for span calculation
  busCanIds: protectedProcedure
    .input(z.object({ busId: z.number().int() }))
    .query(({ input }) =>
      db.componentInstance.findMany({
        where: { busId: input.busId },
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
      await db.$transaction(async (tx) => {
        // Signal.instanceSignalId has no cascade — delete signals explicitly first
        const instanceSignals = await tx.instanceSignal.findMany({
          where: { instanceId: input.id },
          select: { id: true },
        });
        const instanceSignalIds = instanceSignals.map((is) => is.id);
        await tx.signal.deleteMany({ where: { instanceSignalId: { in: instanceSignalIds } } });
        // InstanceSignal rows cascade-delete with the instance
        await tx.componentInstance.delete({ where: { id: input.id } });
      });
    }),

  // ── Hardware identifier rebinding ───────────────────────────────────────
  /** Match unbound signals (ioCardId=NULL but hw* fields set) to existing hardware */
  rebindSignals: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .mutation(async ({ input }) => {
      // Find unbound signals that have hw identifier fields
      const unbound = await db.signal.findMany({
        where: {
          projectId: input.projectId,
          ioCardId: null,
          hwCabinet: { not: null },
          hwCarrier: { not: null },
          hwTypeCode: { not: null },
          hwInstance: { not: null },
        },
        select: { id: true, hwCabinet: true, hwCarrier: true, hwTypeCode: true, hwInstance: true },
      });

      if (unbound.length === 0) return { rebound: 0, unmatched: [] as string[] };

      // Build carrier lookup: projectId → plcId → carrier(cabinetNumber, carrierNumber)
      const carriers = await db.ioCarrier.findMany({
        where: { plc: { projectId: input.projectId }, cabinetNumber: { not: null }, carrierNumber: { not: null } },
        select: { id: true, cabinetNumber: true, carrierNumber: true, cards: { select: { id: true, subgroup: true, typeCode: true, instanceNumber: true } } },
      });

      // Map: "cabinet:carrier:hwTypeCode:instance" → ioCardId (hwTypeCode = subgroup+typeCode)
      const cardLookup = new Map<string, number>();
      for (const c of carriers) {
        for (const card of c.cards) {
          const tc = card.typeCode ? `${card.subgroup ?? "A"}${card.typeCode}` : null;
          if (tc && card.instanceNumber != null) {
            cardLookup.set(`${c.cabinetNumber}:${c.carrierNumber}:${tc}:${card.instanceNumber}`, card.id);
          }
        }
      }

      let rebound = 0;
      const unmatched: string[] = [];
      for (const sig of unbound) {
        const key = `${sig.hwCabinet}:${sig.hwCarrier}:${sig.hwTypeCode}:${sig.hwInstance}`;
        const cardId = cardLookup.get(key);
        if (cardId) {
          await db.signal.update({ where: { id: sig.id }, data: { ioCardId: cardId } });
          rebound++;
        } else {
          const hwId = `N${sig.hwCabinet}:D${String(sig.hwCarrier).padStart(2, "0")}:${sig.hwTypeCode}${String(sig.hwInstance).padStart(2, "0")}`;
          if (!unmatched.includes(hwId)) unmatched.push(hwId);
        }
      }

      return { rebound, unmatched };
    }),
});
