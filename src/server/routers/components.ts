import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import { extractModbusRegisters, type ExtractedRegister } from "../lib/modbus-ai-extract";
import { getEffectiveSignals, syncNewSignalToInstances, removeSignalFromInstances } from "../lib/component-signals";
import { SIGNAL_ORIGINS, IO_TYPES, RAW_DATA_TYPES, BYTE_ORDERS, MODBUS_REGISTER_TYPES, TRIGGER_TYPES, SWITCHING_TYPES, WIRE_CONFIGS, DISCRETE_ALARM_CONDITIONS, ANALOG_ALARM_CONDITIONS, ALARM_SEVERITIES, COMPONENT_STATUS, BUS_PROTOCOLS } from "@/lib/enums";

/** Recompute minCanIdOffset = max(canId) - min(canId) + 1 across active signals */
async function refreshMinCanIdOffset(componentId: number) {
  const agg = await db.componentSignal.aggregate({
    where: { componentId, active: true, canId: { not: null } },
    _min: { canId: true },
    _max: { canId: true },
  });
  const span =
    agg._min.canId != null && agg._max.canId != null
      ? agg._max.canId - agg._min.canId + 1
      : null;
  await db.hardwareComponent.update({
    where: { id: componentId },
    data: { minCanIdOffset: span },
  });
}

const discreteAlarmInput = z.object({
  condition: z.enum(DISCRETE_ALARM_CONDITIONS),
  severity: z.enum(ALARM_SEVERITIES).default("ALARM"),
  delaySeconds: z.coerce.number().int().min(0).default(0),
  message: z.string().optional().nullable(),
});

const analogAlarmInput = z.object({
  condition: z.enum(ANALOG_ALARM_CONDITIONS),
  setpoint: z.coerce.number(),
  hysteresis: z.coerce.number().min(0).default(0),
  severity: z.enum(ALARM_SEVERITIES).default("ALARM"),
  delaySeconds: z.coerce.number().int().min(0).default(0),
  message: z.string().optional().nullable(),
});

const signalInput = z.object({
  componentId: z.number().int(),
  channelOffset: z.coerce.number().int().min(0),
  ioType: z.enum(IO_TYPES),
  origin: z.enum(SIGNAL_ORIGINS).optional().nullable(),
  tagSuffix: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  // PLC data type
  plcDataTypeId: z.number().int().optional().nullable(),
  // Bus data representation
  rawDataType: z.enum(RAW_DATA_TYPES).optional().nullable(),
  byteOrder: z.enum(BYTE_ORDERS).optional().nullable(),
  // CAN addressing
  canNodeId: z.coerce.number().int().optional().nullable(),
  canId: z.coerce.number().int().optional().nullable(),
  bitOffset: z.coerce.number().int().optional().nullable(),
  bitLength: z.coerce.number().int().optional().nullable(),
  isMuxIndicator: z.boolean().default(false),
  muxId: z.coerce.number().int().optional().nullable(),
  // CANopen addressing
  canopenIndex: z.coerce.number().int().optional().nullable(),
  canopenSubIndex: z.coerce.number().int().optional().nullable(),
  // J1939 addressing
  j1939Pgn: z.coerce.number().int().optional().nullable(),
  j1939Spn: z.coerce.number().int().optional().nullable(),
  // Modbus addressing
  modbusUnitId: z.coerce.number().int().optional().nullable(),
  modbusRegisterType: z.enum(MODBUS_REGISTER_TYPES).optional().nullable(),
  modbusRegisterOffset: z.coerce.number().int().optional().nullable(),
  // Bus communication timeout
  timeoutMs: z.number().int().optional().nullable(),
  // Whether this signal is active/used in the component
  active: z.boolean().default(true),
  // Discrete defaults
  defaultTrigger: z.enum(TRIGGER_TYPES).optional().nullable(),
  defaultFilterTimeMs: z.coerce.number().optional().nullable(),
  defaultSwitchingType: z.enum(SWITCHING_TYPES).optional().nullable(),
  // Analog defaults
  defaultInputTypeId: z.number().int().optional().nullable(),
  defaultWireConfig: z.enum(WIRE_CONFIGS).optional().nullable(),
  defaultScaleMin: z.coerce.number().optional().nullable(),
  defaultScaleMax: z.coerce.number().optional().nullable(),
  defaultEuId: z.number().int().optional().nullable(),
  // Alarms
  discreteAlarms: z.array(discreteAlarmInput).default([]),
  analogAlarms: z.array(analogAlarmInput).default([]),
});

const componentInclude = {
  signals: {
    orderBy: { channelOffset: "asc" as const },
    include: {
      discreteAlarms: true,
      analogAlarms: true,
      defaultEu: { select: { id: true, symbol: true } },
      defaultInputType: { select: { id: true, code: true, name: true } },
      plcDataTypeCatalog: { select: { id: true, code: true } },
    },
  },
  parent: { select: { id: true, name: true } },
  children: { select: { id: true, name: true, status: true, _count: { select: { signals: true, instances: true } } }, orderBy: { name: "asc" as const } },
};

export const componentsRouter = createTRPCRouter({
  // ── Component (HardwareTemplate) ─────────────────────────────────
  componentList: protectedProcedure.query(() =>
    db.hardwareComponent.findMany({
      where: { projectId: null },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { signals: true, children: true } },
        parent: { select: { id: true, name: true } },
      },
    })
  ),

  effectiveSignals: protectedProcedure
    .input(z.object({ componentId: z.number().int() }))
    .query(({ input }) => getEffectiveSignals(input.componentId)),

  projectComponentList: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .query(({ input }) =>
      db.hardwareComponent.findMany({
        where: { projectId: input.projectId },
        orderBy: { name: "asc" },
        include: {
          _count: { select: { signals: true, instances: true, children: true } },
          instances: { select: { id: true, name: true } },
          parent: { select: { id: true, name: true } },
        },
      })
    ),

  componentById: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(({ input }) =>
      db.hardwareComponent.findUniqueOrThrow({
        where: { id: input.id },
        include: componentInclude,
      })
    ),

  componentCreate: protectedProcedure
    .input(z.object({
      projectId: z.number().int().optional().nullable(),
      parentId: z.number().int().optional().nullable(),
      name: z.string().min(1),
      manufacturer: z.string().optional().nullable(),
      model: z.string().optional().nullable(),
      version: z.string().optional().nullable(),
      functionBlock: z.string().max(100).optional().nullable(),
      busProtocol: z.enum(BUS_PROTOCOLS).optional().nullable(),
      status: z.enum(COMPONENT_STATUS).default("DRAFT"),
      description: z.string().optional().nullable(),
    }))
    .mutation(({ input }) =>
      db.hardwareComponent.create({
        data: { ...input, projectId: input.projectId ?? null, parentId: input.parentId ?? null },
        include: componentInclude,
      })
    ),

  componentUpdate: protectedProcedure
    .input(z.object({
      id: z.number().int(),
      parentId: z.number().int().optional().nullable(),
      name: z.string().min(1),
      manufacturer: z.string().optional().nullable(),
      model: z.string().optional().nullable(),
      version: z.string().optional().nullable(),
      functionBlock: z.string().max(100).optional().nullable(),
      busProtocol: z.enum(BUS_PROTOCOLS).optional().nullable(),
      status: z.enum(COMPONENT_STATUS).default("DRAFT"),
      description: z.string().optional().nullable(),
    }))
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return db.hardwareComponent.update({ where: { id }, data });
    }),

  componentDelete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(({ input }) => db.hardwareComponent.delete({ where: { id: input.id } })),

  // ── AI Modbus extraction ────────────────────────────────────────────
  modbusListSheets: protectedProcedure
    .input(z.object({
      fileBase64: z.string(),
      fileName: z.string(),
    }))
    .mutation(async ({ input }) => {
      if (!input.fileName.endsWith(".xlsx") && !input.fileName.endsWith(".xls")) {
        return { sheets: [] };
      }
      const XLSX = await import("xlsx");
      const buf = Buffer.from(input.fileBase64, "base64");
      const wb = XLSX.read(buf, { type: "buffer" });
      const sheets = wb.SheetNames.map((name) => {
        const ws = wb.Sheets[name];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
        return { name, rowCount: rows.length };
      });
      return { sheets };
    }),

  modbusExtract: protectedProcedure
    .input(z.object({
      fileBase64: z.string(),
      fileName: z.string(),
      mimeType: z.string(),
      selectedSheets: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      return extractModbusRegisters(input.fileBase64, input.fileName, input.mimeType, input.selectedSheets);
    }),

  modbusImport: protectedProcedure
    .input(z.object({
      componentId: z.number().int(),
      registers: z.array(z.object({
        address: z.number().int(),
        registerType: z.enum(["HOLDING_REGISTER", "INPUT_REGISTER", "COIL", "DISCRETE_INPUT"]),
        dataType: z.enum(["INT16", "UINT16", "INT32", "UINT32", "FLOAT32", "BOOL", "WORD", "DWORD"]),
        name: z.string(),
        description: z.string(),
        unit: z.string().nullable(),
        scaleFactor: z.number().nullable(),
        offset: z.number().nullable(),
        readWrite: z.enum(["R", "W", "RW"]),
        bitPosition: z.number().int().nullable(),
      })),
    }))
    .mutation(async ({ input }) => {
      const { componentId, registers } = input;

      // Find the next available channelOffset
      const maxOffset = await db.componentSignal.aggregate({
        where: { componentId },
        _max: { channelOffset: true },
      });
      const startOffset = (maxOffset._max.channelOffset ?? -1) + 1;

      // Map extracted registers to ComponentSignals
      let created = 0;
      for (let i = 0; i < registers.length; i++) {
        const reg = registers[i];

        // Determine IO type from register type + read/write
        const isInput = reg.registerType === "INPUT_REGISTER" || reg.registerType === "DISCRETE_INPUT" || reg.readWrite === "R";
        const isDiscrete = reg.dataType === "BOOL" || reg.registerType === "COIL" || reg.registerType === "DISCRETE_INPUT";
        const ioType = isDiscrete
          ? (isInput ? "DI" : "DO")
          : (isInput ? "AI" : "AO");

        // Map extracted data types to BusRawDataType enum values
        const rawDataTypeMap: Record<string, string> = {
          INT16: "INT", UINT16: "UINT", INT32: "DINT", UINT32: "UDINT",
          FLOAT32: "REAL", BOOL: "BOOL", WORD: "WORD", DWORD: "DWORD",
        };

        const modbusRegTypeMap: Record<string, string> = {
          HOLDING_REGISTER: "HOLDING_REGISTER",
          INPUT_REGISTER: "INPUT_REGISTER",
          COIL: "COIL",
          DISCRETE_INPUT: "DISCRETE_INPUT",
        };

        const newSig = await db.componentSignal.create({
          data: {
            componentId,
            channelOffset: startOffset + i,
            ioType: ioType as any,
            tagSuffix: reg.name,
            description: reg.description,
            modbusRegisterType: modbusRegTypeMap[reg.registerType] as any,
            modbusRegisterOffset: reg.address,
            rawDataType: rawDataTypeMap[reg.dataType] as any,
            bitOffset: reg.bitPosition,
            bitLength: reg.dataType === "BOOL" ? 1 : null,
            active: true,
          },
        });
        await syncNewSignalToInstances(newSig.id);
        created++;
      }

      return { created };
    }),

  // ── Template signals ──────────────────────────────────────────────
  signalUpsert: protectedProcedure
    .input(signalInput.extend({ id: z.number().int().optional() }))
    .mutation(async ({ input }) => {
      const { id, discreteAlarms, analogAlarms, ...data } = input;

      let signal;
      if (id) {
        // Check if active flag is changing (need old value for comparison)
        const oldSignal = await db.componentSignal.findUniqueOrThrow({
          where: { id },
          select: { active: true },
        });

        // Clear existing alarms before replacing
        await db.componentDiscreteAlarm.deleteMany({ where: { componentSignalId: id } });
        await db.componentAnalogAlarm.deleteMany({ where: { componentSignalId: id } });
        signal = await db.componentSignal.update({
          where: { id },
          data: {
            ...data,
            discreteAlarms: { create: discreteAlarms },
            analogAlarms: { create: analogAlarms },
          },
          include: {
            discreteAlarms: true,
            analogAlarms: true,
            defaultEu: { select: { id: true, symbol: true } },
            defaultInputType: { select: { id: true, code: true, name: true } },
          },
        });

        // Handle active flag changes — sync to instances
        if (oldSignal.active && !data.active) {
          // Deactivated — remove from all instances
          await removeSignalFromInstances(id);
        } else if (!oldSignal.active && data.active) {
          // Re-activated — add to all instances
          await syncNewSignalToInstances(id);
        }

        // Propagate default changes to bound non-dirty project signals
        const boundInstanceSignals = await db.instanceSignal.findMany({
          where: { componentSignalId: id, templateDirty: false },
          include: {
            signals: { select: { id: true, signalType: true, busSignal: { select: { signalId: true } } } },
            instance: { select: { canIdOffset: true } },
          },
        });

        const signalType: "DISCRETE" | "ANALOG" =
          (data.ioType === "DI" || data.ioType === "DO") ? "DISCRETE" : "ANALOG";

        for (const ins of boundInstanceSignals) {
          const canIdOffset = ins.instance?.canIdOffset ?? 0;
          for (const sig of ins.signals) {
            if (signalType === "DISCRETE") {
              const discreteFields = {
                ...(data.defaultTrigger !== undefined ? { trigger: data.defaultTrigger ?? "NO" } : {}),
                ...(data.defaultFilterTimeMs !== undefined ? { filterTimeMs: data.defaultFilterTimeMs ?? null } : {}),
                ...(data.defaultSwitchingType !== undefined ? { switchingType: data.defaultSwitchingType ?? null } : {}),
              };
              if (Object.keys(discreteFields).length > 0) {
                await db.discreteSignal.upsert({
                  where: { signalId: sig.id },
                  create: { signalId: sig.id, trigger: data.defaultTrigger ?? "NO", ...discreteFields },
                  update: discreteFields,
                });
              }
            } else {
              const analogFields = {
                ...(data.defaultInputTypeId !== undefined ? { inputTypeId: data.defaultInputTypeId ?? null } : {}),
                ...(data.defaultWireConfig !== undefined ? { wireConfig: data.defaultWireConfig ?? null } : {}),
                ...(data.defaultScaleMin !== undefined ? { scaleMin: data.defaultScaleMin ?? null } : {}),
                ...(data.defaultScaleMax !== undefined ? { scaleMax: data.defaultScaleMax ?? null } : {}),
                ...(data.defaultEuId !== undefined ? { engineeringUnitId: data.defaultEuId ?? null } : {}),
                ...(data.plcDataTypeId !== undefined ? { plcDataTypeId: data.plcDataTypeId ?? null } : {}),
              };
              if (Object.keys(analogFields).length > 0) {
                await db.analogSignal.upsert({
                  where: { signalId: sig.id },
                  create: { signalId: sig.id, ...analogFields },
                  update: analogFields,
                });
              }
            }
            // Propagate base signal fields
            await db.signal.update({
              where: { id: sig.id },
              data: {
                ...(data.tagSuffix !== undefined ? { tag: data.tagSuffix ?? null } : {}),
                ...(data.description !== undefined ? { description: data.description ?? null } : {}),
                ...(data.origin !== undefined && data.origin !== null ? { origin: data.origin } : {}),
              },
            });
            // Propagate bus signal addressing fields
            if (sig.busSignal) {
              const busFields: Record<string, unknown> = {};
              if (data.rawDataType !== undefined) busFields.rawDataType = data.rawDataType ?? (signalType === "DISCRETE" ? "BOOL" : "WORD");
              if (data.byteOrder !== undefined) busFields.byteOrder = data.byteOrder ?? "BIG_ENDIAN";
              if (data.timeoutMs !== undefined) busFields.timeoutMs = data.timeoutMs ?? null;
              if (data.canNodeId !== undefined) busFields.nodeId = data.canNodeId ?? null;
              if (data.canId !== undefined) busFields.canId = data.canId != null ? data.canId + canIdOffset : null;
              if (data.bitOffset !== undefined) busFields.bitOffset = data.bitOffset ?? null;
              if (data.bitLength !== undefined) busFields.bitLength = data.bitLength ?? null;
              if (data.isMuxIndicator !== undefined) busFields.isMuxIndicator = data.isMuxIndicator ?? false;
              if (data.muxId !== undefined) busFields.muxId = data.muxId ?? null;
              if (data.canopenIndex !== undefined) busFields.canopenIndex = data.canopenIndex ?? null;
              if (data.canopenSubIndex !== undefined) busFields.canopenSubIndex = data.canopenSubIndex ?? null;
              if (data.j1939Pgn !== undefined) busFields.j1939Pgn = data.j1939Pgn ?? null;
              if (data.j1939Spn !== undefined) busFields.j1939Spn = data.j1939Spn ?? null;
              if (data.modbusUnitId !== undefined) busFields.unitId = data.modbusUnitId ?? null;
              if (data.modbusRegisterType !== undefined) busFields.registerType = data.modbusRegisterType ?? null;
              if (data.modbusRegisterOffset !== undefined) busFields.registerOffset = data.modbusRegisterOffset ?? null;
              if (Object.keys(busFields).length > 0) {
                await db.busSignal.update({
                  where: { signalId: sig.id },
                  data: busFields,
                });
              }
            }
          }
        }
      } else {
        signal = await db.componentSignal.create({
          data: {
            ...data,
            discreteAlarms: { create: discreteAlarms },
            analogAlarms: { create: analogAlarms },
          },
          include: {
            discreteAlarms: true,
            analogAlarms: true,
            defaultEu: { select: { id: true, symbol: true } },
            defaultInputType: { select: { id: true, code: true, name: true } },
          },
        });

        // Sync new signal to all existing component instances
        if (data.active !== false) {
          await syncNewSignalToInstances(signal.id);
        }
      }

      // Refresh min CAN ID offset when canId may have changed
      if (data.canId !== undefined || !id) {
        await refreshMinCanIdOffset(data.componentId);
      }

      return signal;
    }),

  signalDelete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const sig = await db.componentSignal.findUniqueOrThrow({
        where: { id: input.id },
        select: { componentId: true, canId: true },
      });
      // Remove from all component instances first (clears FK constraint)
      await removeSignalFromInstances(input.id);
      // Delete component-level alarms
      await db.componentDiscreteAlarm.deleteMany({ where: { componentSignalId: input.id } });
      await db.componentAnalogAlarm.deleteMany({ where: { componentSignalId: input.id } });
      await db.componentSignal.delete({ where: { id: input.id } });
      if (sig.canId != null) {
        await refreshMinCanIdOffset(sig.componentId);
      }
      return sig;
    }),

  signalPurge: protectedProcedure
    .input(z.object({ componentId: z.number().int() }))
    .mutation(async ({ input }) => {
      // Remove all signals from instances first
      const componentSignals = await db.componentSignal.findMany({
        where: { componentId: input.componentId },
        select: { id: true },
      });
      for (const cs of componentSignals) {
        await removeSignalFromInstances(cs.id);
      }
      // Delete component-level alarms, then signals
      await db.componentDiscreteAlarm.deleteMany({
        where: { componentSignal: { componentId: input.componentId } },
      });
      await db.componentAnalogAlarm.deleteMany({
        where: { componentSignal: { componentId: input.componentId } },
      });
      const result = await db.componentSignal.deleteMany({
        where: { componentId: input.componentId },
      });
      return { count: result.count };
    }),

  /** Bulk-patch a set of component signals with the same partial update. */
  signalBulkPatch: protectedProcedure
    .input(z.object({
      ids: z.array(z.number().int()).min(1),
      data: z.object({
        ioType: z.enum(IO_TYPES).optional(),
        origin: z.enum(SIGNAL_ORIGINS).optional().nullable(),
        tagSuffix: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        active: z.boolean().optional(),
        plcDataTypeId: z.number().int().optional().nullable(),
        rawDataType: z.enum(RAW_DATA_TYPES).optional().nullable(),
        byteOrder: z.enum(BYTE_ORDERS).optional().nullable(),
        canNodeId: z.number().int().optional().nullable(),
        canId: z.number().int().optional().nullable(),
        bitOffset: z.number().int().optional().nullable(),
        bitLength: z.number().int().optional().nullable(),
        isMuxIndicator: z.boolean().optional(),
        muxId: z.number().int().optional().nullable(),
        canopenIndex: z.number().int().optional().nullable(),
        canopenSubIndex: z.number().int().optional().nullable(),
        j1939Pgn: z.number().int().optional().nullable(),
        j1939Spn: z.number().int().optional().nullable(),
        modbusUnitId: z.number().int().optional().nullable(),
        modbusRegisterType: z.enum(MODBUS_REGISTER_TYPES).optional().nullable(),
        modbusRegisterOffset: z.number().int().optional().nullable(),
        timeoutMs: z.number().int().optional().nullable(),
        defaultTrigger: z.enum(TRIGGER_TYPES).optional().nullable(),
        defaultFilterTimeMs: z.number().optional().nullable(),
        defaultSwitchingType: z.enum(SWITCHING_TYPES).optional().nullable(),
        defaultInputTypeId: z.number().int().optional().nullable(),
        defaultWireConfig: z.enum(WIRE_CONFIGS).optional().nullable(),
        defaultScaleMin: z.number().optional().nullable(),
        defaultScaleMax: z.number().optional().nullable(),
        defaultEuId: z.number().int().optional().nullable(),
      }),
    }))
    .mutation(async ({ input }) => {
      const { ids, data } = input;

      // Build update payload — only include provided (non-undefined) fields
      const updateData: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined) updateData[k] = v;
      }
      if (Object.keys(updateData).length === 0) return { updated: 0 };

      // Check for active flag changes before applying
      let wasActive: Map<number, boolean> | null = null;
      if (data.active !== undefined) {
        const existing = await db.componentSignal.findMany({
          where: { id: { in: ids } },
          select: { id: true, active: true },
        });
        wasActive = new Map(existing.map((s) => [s.id, s.active]));
      }

      // Bulk update all component signals
      await db.componentSignal.updateMany({
        where: { id: { in: ids } },
        data: updateData,
      });

      // Handle active flag changes — sync instances
      if (data.active !== undefined && wasActive) {
        for (const id of ids) {
          const prev = wasActive.get(id) ?? true;
          if (prev && !data.active) {
            await removeSignalFromInstances(id);
          } else if (!prev && data.active) {
            await syncNewSignalToInstances(id);
          }
        }
      }

      // Propagate to non-dirty instance signals
      if (data.active !== false) {
        const boundInstanceSignals = await db.instanceSignal.findMany({
          where: { componentSignalId: { in: ids }, templateDirty: false },
          include: {
            signals: { select: { id: true, signalType: true, busSignal: { select: { signalId: true } } } },
            instance: { select: { canIdOffset: true } },
          },
        });

        for (const ins of boundInstanceSignals) {
          const canIdOffset = ins.instance?.canIdOffset ?? 0;
          for (const sig of ins.signals) {
            // Base signal fields
            const sigUpdate: Record<string, unknown> = {};
            if (data.tagSuffix !== undefined) sigUpdate.tag = data.tagSuffix;
            if (data.description !== undefined) sigUpdate.description = data.description;
            if (data.origin !== undefined && data.origin !== null) sigUpdate.origin = data.origin;
            if (Object.keys(sigUpdate).length > 0) {
              await db.signal.update({ where: { id: sig.id }, data: sigUpdate });
            }

            // Bus signal fields
            if (sig.busSignal) {
              const busFields: Record<string, unknown> = {};
              if (data.rawDataType !== undefined) busFields.rawDataType = data.rawDataType ?? "WORD";
              if (data.byteOrder !== undefined) busFields.byteOrder = data.byteOrder ?? "BIG_ENDIAN";
              if (data.timeoutMs !== undefined) busFields.timeoutMs = data.timeoutMs;
              if (data.canNodeId !== undefined) busFields.nodeId = data.canNodeId;
              if (data.canId !== undefined) busFields.canId = data.canId != null ? data.canId + canIdOffset : null;
              if (data.bitOffset !== undefined) busFields.bitOffset = data.bitOffset;
              if (data.bitLength !== undefined) busFields.bitLength = data.bitLength;
              if (data.isMuxIndicator !== undefined) busFields.isMuxIndicator = data.isMuxIndicator;
              if (data.muxId !== undefined) busFields.muxId = data.muxId;
              if (data.canopenIndex !== undefined) busFields.canopenIndex = data.canopenIndex;
              if (data.canopenSubIndex !== undefined) busFields.canopenSubIndex = data.canopenSubIndex;
              if (data.j1939Pgn !== undefined) busFields.j1939Pgn = data.j1939Pgn;
              if (data.j1939Spn !== undefined) busFields.j1939Spn = data.j1939Spn;
              if (data.modbusUnitId !== undefined) busFields.unitId = data.modbusUnitId;
              if (data.modbusRegisterType !== undefined) busFields.registerType = data.modbusRegisterType;
              if (data.modbusRegisterOffset !== undefined) busFields.registerOffset = data.modbusRegisterOffset;
              if (Object.keys(busFields).length > 0) {
                await db.busSignal.update({ where: { signalId: sig.id }, data: busFields });
              }
            }

            // Discrete/analog defaults
            const isDisc = sig.signalType === "DISCRETE";
            if (isDisc) {
              const disc: Record<string, unknown> = {};
              if (data.defaultTrigger !== undefined) disc.trigger = data.defaultTrigger ?? "NO";
              if (data.defaultFilterTimeMs !== undefined) disc.filterTimeMs = data.defaultFilterTimeMs;
              if (data.defaultSwitchingType !== undefined) disc.switchingType = data.defaultSwitchingType;
              if (Object.keys(disc).length > 0) {
                await db.discreteSignal.upsert({
                  where: { signalId: sig.id },
                  create: { signalId: sig.id, trigger: data.defaultTrigger ?? "NO", ...disc },
                  update: disc,
                });
              }
            } else {
              const ana: Record<string, unknown> = {};
              if (data.defaultInputTypeId !== undefined) ana.inputTypeId = data.defaultInputTypeId;
              if (data.defaultWireConfig !== undefined) ana.wireConfig = data.defaultWireConfig;
              if (data.defaultScaleMin !== undefined) ana.scaleMin = data.defaultScaleMin;
              if (data.defaultScaleMax !== undefined) ana.scaleMax = data.defaultScaleMax;
              if (data.defaultEuId !== undefined) ana.engineeringUnitId = data.defaultEuId;
              if (Object.keys(ana).length > 0) {
                await db.analogSignal.upsert({
                  where: { signalId: sig.id },
                  create: { signalId: sig.id, ...ana },
                  update: ana,
                });
              }
            }
          }
        }
      }

      // Refresh CAN offset if canId changed
      if (data.canId !== undefined && ids.length > 0) {
        const first = await db.componentSignal.findFirst({
          where: { id: { in: ids } },
          select: { componentId: true },
        });
        if (first) await refreshMinCanIdOffset(first.componentId);
      }

      return { updated: ids.length };
    }),

  // ── Create component from selected project signals ────────────────
  createFromSignals: protectedProcedure
    .input(z.object({
      projectId: z.number().int(),
      scope: z.enum(["global", "project"]).default("global"),
      name: z.string().min(1),
      manufacturer: z.string().optional().nullable(),
      model: z.string().optional().nullable(),
      version: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      signalIds: z.array(z.number().int()).min(1),
    }))
    .mutation(async ({ input }) => {
      const { projectId, scope, signalIds, ...componentData } = input;

      // Fetch the project signals
      const projectSignals = await db.signal.findMany({
        where: { id: { in: signalIds }, projectId },
      });

      if (projectSignals.length === 0) throw new Error("No matching signals found");

      // Derive ioType from signalType + direction
      function deriveIoType(signalType: string, direction: string | null): "DI" | "DO" | "AI" | "AO" {
        if (signalType === "DISCRETE") return direction === "OUTPUT" ? "DO" : "DI";
        return direction === "OUTPUT" ? "AO" : "AI";
      }

      return db.$transaction(async (tx) => {
        // Create component
        const component = await tx.hardwareComponent.create({
          data: { ...componentData, projectId: scope === "project" ? projectId : null },
        });

        // Create component signals (one per project signal, ordered by id)
        const sortedSignals = [...projectSignals].sort((a, b) => a.id - b.id);
        const componentSignals = await Promise.all(
          sortedSignals.map((s, i) =>
            tx.componentSignal.create({
              data: {
                componentId: component.id,
                channelOffset: i,
                ioType: deriveIoType(s.signalType, s.direction),
                origin: s.origin,
                description: s.description,
              },
            })
          )
        );

        // Create component instance
        const instance = await tx.componentInstance.create({
          data: {
            componentId: component.id,
            projectId,
            name: componentData.name,
          },
        });

        // Create instance signals and bind project signals
        for (let i = 0; i < sortedSignals.length; i++) {
          const instanceSignal = await tx.instanceSignal.create({
            data: {
              instanceId: instance.id,
              componentSignalId: componentSignals[i].id,
              templateDirty: false,
            },
          });
          await tx.signal.update({
            where: { id: sortedSignals[i].id },
            data: { instanceSignalId: instanceSignal.id },
          });
        }

        return { componentId: component.id, instanceId: instance.id };
      });
    }),

  // ── Engineering units (for analog defaults) ───────────────────────
  euList: protectedProcedure.query(() =>
    db.engineeringUnit.findMany({ orderBy: { symbol: "asc" } })
  ),
});
