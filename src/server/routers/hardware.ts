import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import { CARD_TYPES, BUS_PROTOCOLS, CATALOG_DEVICE_TYPES, DIAGNOSTIC_TYPES } from "@/lib/enums";

const moduleInput = z.object({
  vendorName: z.string().min(1),
  articleNumber: z.string().min(1),
  description: z.string().optional().nullable(),
  cardType: z.enum(CARD_TYPES),
  maxInputChannels: z.coerce.number().int().min(0).optional().nullable(),
  maxOutputChannels: z.coerce.number().int().min(0).optional().nullable(),
  bitResolution: z.coerce.number().int().positive().optional().nullable(),
  supplyVoltageField: z.string().optional().nullable(),
  filterTimeMs: z.coerce.number().optional().nullable(),
  galvanicIsolation: z.boolean().optional().nullable(),
  isolationVoltageV: z.coerce.number().int().optional().nullable(),
  tempMinC: z.coerce.number().int().optional().nullable(),
  tempMaxC: z.coerce.number().int().optional().nullable(),
  maxChannelCurrentMa: z.coerce.number().int().optional().nullable(),
  shortCircuitProtected: z.boolean().default(false),
  providesNetwork: z.boolean().default(false),
  protocols: z.array(z.enum(BUS_PROTOCOLS)).default([]),
  ipRating: z.string().default("IP20"),
  moduleWidthMm: z.coerce.number().int().positive().optional().nullable(),
  signalRange: z.string().optional().nullable(),
  busCurrentConsumptionMa: z.coerce.number().int().optional().nullable(),
  fieldCurrentConsumptionMa: z.coerce.number().int().optional().nullable(),
  approvalIds: z.array(z.number().int()).default([]),
  conversionTimeMs: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  hasDiagnostics: z.boolean().default(false),
  diagnosticType: z.enum(DIAGNOSTIC_TYPES).default("NONE"),
  diagnosticBitsPerChannel: z.coerce.number().int().min(1).optional().nullable(),
});

const deviceInput = z.object({
  vendorName: z.string().min(1),
  articleNumber: z.string().min(1),
  description: z.string().optional().nullable(),
  type: z.enum(CATALOG_DEVICE_TYPES),
  series: z.string().optional().nullable(),
  generation: z.coerce.number().int().optional().nullable(),
  programMemoryKb: z.coerce.number().int().optional().nullable(),
  ramMemoryKb: z.coerce.number().int().optional().nullable(),
  dataMemoryKb: z.coerce.number().int().optional().nullable(),
  eco: z.boolean().default(false),
  maxModules: z.coerce.number().int().optional().nullable(),
  busPowerBudgetMa: z.coerce.number().int().optional().nullable(),
  supplyVoltageMinV: z.coerce.number().int().optional().nullable(),
  supplyVoltageMaxV: z.coerce.number().int().optional().nullable(),
  internalCurrentMa: z.coerce.number().int().optional().nullable(),
  ipRating: z.string().default("IP20"),
  tempMinC: z.coerce.number().int().optional().nullable(),
  tempMaxC: z.coerce.number().int().optional().nullable(),
  extendedTemp: z.boolean().default(false),
  ethernetPorts: z.coerce.number().int().optional().nullable(),
  dataRateMbit: z.coerce.number().int().optional().nullable(),
  hasSDCard: z.boolean().default(false),
  hasMediaRedundancy: z.boolean().default(false),
  widthMm: z.coerce.number().int().optional().nullable(),
  heightMm: z.coerce.number().int().optional().nullable(),
  depthMm: z.coerce.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
  approvalIds: z.array(z.number().int()).default([]),
  protocols: z.array(z.object({
    protocol: z.enum(BUS_PROTOCOLS),
    baudRateMaxKbit: z.coerce.number().int().optional().nullable(),
    nodeAddressMin: z.coerce.number().int().optional().nullable(),
    nodeAddressMax: z.coerce.number().int().optional().nullable(),
  })).default([]),
});

const deviceInclude = {
  protocols: { orderBy: { protocol: "asc" as const } },
  approvals: {
    include: { approval: { select: { id: true, code: true, name: true } } },
  },
};

export const hardwareRouter = createTRPCRouter({
  // ── Approval lookup ─────────────────────────────────────────────
  approvalList: protectedProcedure.query(() =>
    db.approval.findMany({ orderBy: { code: "asc" } })
  ),

  approvalUpsert: protectedProcedure
    .input(z.object({ code: z.string().min(1), name: z.string().min(1) }))
    .mutation(({ input }) =>
      db.approval.upsert({
        where: { code: input.code },
        create: input,
        update: { name: input.name },
      })
    ),

  approvalDelete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(({ input }) => db.approval.delete({ where: { id: input.id } })),

  // ── Module catalog ────────────────────────────────────────────────
  moduleList: protectedProcedure.query(() =>
    db.moduleCatalog.findMany({
      orderBy: [{ vendorName: "asc" }, { articleNumber: "asc" }],
      include: {
        approvals: {
          include: { approval: { select: { id: true, code: true } } },
        },
        protocols: { orderBy: { protocol: "asc" } },
      },
    })
  ),

  moduleById: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(({ input }) =>
      db.moduleCatalog.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          approvals: {
            include: { approval: { select: { id: true, code: true, name: true } } },
          },
          protocols: { orderBy: { protocol: "asc" } },
        },
      })
    ),

  moduleCreate: protectedProcedure
    .input(moduleInput)
    .mutation(({ input }) => {
      const { approvalIds, protocols, ...data } = input;
      return db.moduleCatalog.create({
        data: {
          ...data,
          approvals: {
            create: approvalIds.map((approvalId) => ({ approvalId })),
          },
          protocols: {
            create: protocols.map((protocol) => ({ protocol })),
          },
        },
      });
    }),

  moduleUpdate: protectedProcedure
    .input(moduleInput.extend({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const { id, approvalIds, protocols, ...data } = input;
      return db.$transaction(async (tx) => {
        await tx.moduleCatalogApproval.deleteMany({ where: { moduleCatalogId: id } });
        await tx.moduleCatalogProtocol.deleteMany({ where: { moduleCatalogId: id } });
        return tx.moduleCatalog.update({
          where: { id },
          data: {
            ...data,
            approvals: {
              create: approvalIds.map((approvalId) => ({ approvalId })),
            },
            protocols: {
              create: protocols.map((protocol) => ({ protocol })),
            },
          },
        });
      });
    }),

  moduleDelete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(({ input }) => db.moduleCatalog.delete({ where: { id: input.id } })),

  // ── Device catalog — PLCs ─────────────────────────────────────────
  plcCatalogList: protectedProcedure.query(() =>
    db.deviceCatalog.findMany({
      where: { type: "PLC" },
      orderBy: [{ vendorName: "asc" }, { articleNumber: "asc" }],
      include: deviceInclude,
    })
  ),

  plcCatalogById: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(({ input }) =>
      db.deviceCatalog.findUniqueOrThrow({
        where: { id: input.id },
        include: deviceInclude,
      })
    ),

  plcCatalogCreate: protectedProcedure
    .input(deviceInput)
    .mutation(({ input }) => {
      const { approvalIds, protocols, ...data } = input;
      return db.deviceCatalog.create({
        data: {
          ...data,
          type: "PLC",
          approvals: {
            create: approvalIds.map((approvalId) => ({ approvalId })),
          },
          protocols: { create: protocols },
        },
        include: deviceInclude,
      });
    }),

  plcCatalogUpdate: protectedProcedure
    .input(deviceInput.extend({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const { id, approvalIds, protocols, ...data } = input;
      return db.$transaction(async (tx) => {
        await tx.deviceCatalogApproval.deleteMany({ where: { deviceCatalogId: id } });
        await tx.deviceCatalogProtocol.deleteMany({ where: { deviceCatalogId: id } });
        return tx.deviceCatalog.update({
          where: { id },
          data: {
            ...data,
            approvals: {
              create: approvalIds.map((approvalId) => ({ approvalId })),
            },
            protocols: { create: protocols.map((p) => ({ ...p, deviceCatalogId: undefined })) },
          },
          include: deviceInclude,
        });
      });
    }),

  plcCatalogDelete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(({ input }) => db.deviceCatalog.delete({ where: { id: input.id } })),

  // ── Device catalog — Couplers ─────────────────────────────────────
  couplerCatalogList: protectedProcedure.query(() =>
    db.deviceCatalog.findMany({
      where: { type: "COUPLER" },
      orderBy: [{ vendorName: "asc" }, { articleNumber: "asc" }],
      include: deviceInclude,
    })
  ),

  couplerCatalogById: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(({ input }) =>
      db.deviceCatalog.findUniqueOrThrow({
        where: { id: input.id },
        include: deviceInclude,
      })
    ),

  couplerCatalogCreate: protectedProcedure
    .input(deviceInput)
    .mutation(({ input }) => {
      const { approvalIds, protocols, ...data } = input;
      return db.deviceCatalog.create({
        data: {
          ...data,
          type: "COUPLER",
          approvals: {
            create: approvalIds.map((approvalId) => ({ approvalId })),
          },
          protocols: { create: protocols },
        },
        include: deviceInclude,
      });
    }),

  couplerCatalogUpdate: protectedProcedure
    .input(deviceInput.extend({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const { id, approvalIds, protocols, ...data } = input;
      return db.$transaction(async (tx) => {
        await tx.deviceCatalogApproval.deleteMany({ where: { deviceCatalogId: id } });
        await tx.deviceCatalogProtocol.deleteMany({ where: { deviceCatalogId: id } });
        return tx.deviceCatalog.update({
          where: { id },
          data: {
            ...data,
            approvals: {
              create: approvalIds.map((approvalId) => ({ approvalId })),
            },
            protocols: { create: protocols.map((p) => ({ ...p, deviceCatalogId: undefined })) },
          },
          include: deviceInclude,
        });
      });
    }),

  couplerCatalogDelete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(({ input }) => db.deviceCatalog.delete({ where: { id: input.id } })),

  // ── Module Type Codes ───────────────────────────────────────────
  moduleTypeCodeList: protectedProcedure.query(() =>
    db.moduleTypeCode.findMany({ orderBy: [{ cardType: "asc" }, { code: "asc" }] })
  ),

  moduleTypeCodeUpsert: protectedProcedure
    .input(z.object({
      id: z.number().int().optional(),
      cardType: z.enum(CARD_TYPES),
      code: z.string().length(1),
      groupName: z.string().min(1),
      description: z.string().optional().nullable(),
    }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      if (id) return db.moduleTypeCode.update({ where: { id }, data });
      return db.moduleTypeCode.create({ data });
    }),

  moduleTypeCodeDelete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(({ input }) => db.moduleTypeCode.delete({ where: { id: input.id } })),
});
