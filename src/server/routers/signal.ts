import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import type { PlcDataType } from "../../../prisma/generated/prisma/client/client";
import { SIGNAL_ORIGINS, SIGNAL_TYPES, SIGNAL_DIRECTIONS, TRIGGER_TYPES, SWITCHING_TYPES, WIRE_CONFIGS, RAW_DATA_TYPES, PLC_DATA_TYPES, BYTE_ORDERS, MODBUS_REGISTER_TYPES, DISCRETE_ALARM_CONDITIONS, ANALOG_ALARM_CONDITIONS, ALARM_SEVERITIES, BUS_PROTOCOLS, type SignalOrigin } from "@/lib/enums";

const signalInclude = {
  discreteSignal: { include: { alarms: true } },
  analogSignal: { include: { engineeringUnit: { include: { plcDataTypeCatalog: true } }, inputType: true, plcDataTypeCatalog: true, alarms: true } },
  busSignal: {
    include: {
      plcNetwork: { select: { id: true, protocol: true, description: true, plc: { select: { name: true } } } },
    },
  },
  ioCard: {
    include: {
      catalog: { select: { articleNumber: true, cardType: true } },
      carrier: { include: { plc: { select: { id: true, name: true } } } },
    },
  },
  system: true,
  gvl: true,
  instanceSignal: {
    select: {
      id: true,
      templateDirty: true,
      componentSignal: {
        select: {
          canId: true,
          canNodeId: true,
          bitOffset: true,
          bitLength: true,
          isMuxIndicator: true,
          muxId: true,
        },
      },
      instance: {
        select: {
          id: true,
          name: true,
          componentId: true,
          canIdOffset: true,
          functionBlockOverride: true,
          plcNetworkId: true,
          network: { select: { id: true, protocol: true, description: true, plc: { select: { name: true } } } },
          component: {
            select: { id: true, name: true, functionBlock: true, minCanIdOffset: true, busProtocol: true },
          },
        },
      },
    },
  },
} as const;

// Lighter include for table list view — drops alarm details and deep nesting
const signalListInclude = {
  discreteSignal: { include: { alarms: true, plcDataType: { select: { code: true } } } },
  analogSignal: { include: {
    engineeringUnit: { include: { plcDataTypeCatalog: true } },
    inputType: true, plcDataTypeCatalog: true, alarms: true,
  } },
  busSignal: {
    include: {
      plcNetwork: { select: { id: true, protocol: true, description: true, plc: { select: { name: true } } } },
    },
  },
  ioCard: {
    select: {
      id: true, slotPosition: true, cardType: true,
      catalog: { select: { articleNumber: true, cardType: true } },
      carrier: { select: { id: true, name: true, plc: { select: { id: true, name: true } } } },
    },
  },
  system: { select: { id: true, name: true } },
  gvl: { select: { id: true, name: true } },
  instanceSignal: {
    select: {
      id: true, templateDirty: true,
      componentSignal: { select: { canId: true } },
      instance: { select: { id: true, name: true, canIdOffset: true, componentId: true } },
    },
  },
} as const;

const signalCreateInput = z.object({
  projectId: z.number().int(),
  signalType: z.enum(SIGNAL_TYPES),
  origin: z.enum(SIGNAL_ORIGINS),
  tag: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  ioCardId: z.number().int().optional().nullable(),
  channelPosition: z.number().int().optional().nullable(),
  direction: z.enum(SIGNAL_DIRECTIONS).optional().nullable(),
  systemId: z.number().int().optional().nullable(),
  componentTag: z.string().optional().nullable(),
  drawingRef: z.string().optional().nullable(),
  cabinetLocation: z.string().optional().nullable(),
  gvlId: z.number().int().optional().nullable(),
  // Alarm configuration
  alarmGroup: z.string().max(1).optional().nullable(),
  alarmBlockMask: z.string().max(5).optional().nullable(),
  commBlockMask: z.string().max(5).optional().nullable(),
  fatBlock: z.boolean().optional().default(false),
  suppressionSt: z.string().optional().nullable(),
  specialAlarmFb: z.string().max(100).optional().nullable(),
  specialAlarmInput: z.string().max(255).optional().nullable(),
  anaToDigAlarm: z.boolean().optional().default(false),
  // Code generation flags
  isRetain: z.boolean().optional().default(false),
  isPersistent: z.boolean().optional().default(false),
  loggingEnabled: z.boolean().optional().default(false),
  fbNameOverride: z.string().max(255).optional().nullable(),
  useShortName: z.boolean().optional().default(false),
  // ISA instrument identification
  instrumentTag: z.string().max(50).optional().nullable(),
  signalClassification: z.string().max(10).optional().nullable(),
  subsystem: z.string().max(255).optional().nullable(),
  element: z.string().max(255).optional().nullable(),
  signalFunction: z.string().max(100).optional().nullable(),
  supplierName: z.string().max(255).optional().nullable(),
  supplierSensorType: z.string().max(255).optional().nullable(),
  normalValue: z.string().max(100).optional().nullable(),
  // Discrete
  trigger: z.enum(TRIGGER_TYPES).optional().default("NO"),
  filterTimeMs: z.number().optional().nullable(),
  switchingType: z.enum(SWITCHING_TYPES).optional().nullable(),
  signalVoltage: z.string().optional().nullable(),
  // Analog
  inputTypeId: z.number().int().optional().nullable(),
  wireConfig: z.enum(WIRE_CONFIGS).optional().nullable(),
  scaleMin: z.number().optional().nullable(),
  scaleMax: z.number().optional().nullable(),
  rawMin: z.number().optional().nullable(),
  rawMax: z.number().optional().nullable(),
  rawZero: z.number().optional().nullable(),
  clampLow: z.number().optional().nullable(),
  clampHigh: z.number().optional().nullable(),
  deadband: z.number().optional().nullable(),
  engineeringUnitId: z.number().int().optional().nullable(),
  plcDataTypeId: z.number().int().optional().nullable(),
  useTankLevel: z.boolean().optional().default(false),
  scalingFbOverride: z.string().max(100).optional().nullable(),
  deadbandRawMin: z.number().optional().nullable(),
  deadbandRawZero: z.number().optional().nullable(),
  deadbandRawMax: z.number().optional().nullable(),
  sensorFailRaw: z.number().optional().nullable(),
  sensorFailMargin: z.number().optional().nullable(),
  sensorFailBehavior: z.string().max(50).optional().nullable(),
  sensorFailDelayMs: z.number().int().optional().nullable(),
});

export const signalRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .query(({ input }) =>
      db.signal.findMany({
        where: { projectId: input.projectId },
        include: signalListInclude,
        orderBy: [{ tag: "asc" }, { id: "asc" }],
      })
    ),

  create: protectedProcedure.input(signalCreateInput).mutation(({ input }) => {
    const {
      projectId,
      signalType,
      origin,
      tag,
      description,
      notes,
      ioCardId,
      channelPosition,
      direction,
      systemId,
      componentTag,
      drawingRef,
      cabinetLocation,
      gvlId,
      // alarm config
      alarmGroup,
      alarmBlockMask,
      commBlockMask,
      fatBlock,
      suppressionSt,
      specialAlarmFb,
      specialAlarmInput,
      anaToDigAlarm,
      // code gen flags
      isRetain,
      isPersistent,
      loggingEnabled,
      fbNameOverride,
      useShortName,
      // ISA identification
      instrumentTag,
      signalClassification,
      subsystem,
      element,
      signalFunction,
      supplierName,
      supplierSensorType,
      normalValue,
      // discrete
      trigger,
      filterTimeMs,
      switchingType,
      signalVoltage,
      // analog
      inputTypeId,
      wireConfig,
      scaleMin,
      scaleMax,
      rawMin,
      rawMax,
      rawZero,
      clampLow,
      clampHigh,
      deadband,
      engineeringUnitId,
      plcDataTypeId,
      useTankLevel,
      scalingFbOverride,
      deadbandRawMin,
      deadbandRawZero,
      deadbandRawMax,
      sensorFailRaw,
      sensorFailMargin,
      sensorFailBehavior,
      sensorFailDelayMs,
    } = input;

    return db.signal.create({
      data: {
        projectId,
        signalType,
        origin,
        tag: tag ?? null,
        description: description ?? null,
        notes: notes ?? null,
        ioCardId: ioCardId ?? null,
        channelPosition: channelPosition ?? null,
        direction: direction ?? null,
        systemId: systemId ?? null,
        componentTag: componentTag ?? null,
        drawingRef: drawingRef ?? null,
        cabinetLocation: cabinetLocation ?? null,
        gvlId: gvlId ?? null,
        alarmGroup: alarmGroup ?? null,
        alarmBlockMask: alarmBlockMask ?? null,
        commBlockMask: commBlockMask ?? null,
        fatBlock: fatBlock ?? false,
        suppressionSt: suppressionSt ?? null,
        specialAlarmFb: specialAlarmFb ?? null,
        specialAlarmInput: specialAlarmInput ?? null,
        anaToDigAlarm: anaToDigAlarm ?? false,
        isRetain: isRetain ?? false,
        isPersistent: isPersistent ?? false,
        loggingEnabled: loggingEnabled ?? false,
        fbNameOverride: fbNameOverride ?? null,
        useShortName: useShortName ?? false,
        instrumentTag: instrumentTag ?? null,
        signalClassification: signalClassification ?? null,
        subsystem: subsystem ?? null,
        element: element ?? null,
        signalFunction: signalFunction ?? null,
        supplierName: supplierName ?? null,
        supplierSensorType: supplierSensorType ?? null,
        normalValue: normalValue ?? null,
        ...(signalType === "DISCRETE"
          ? {
              discreteSignal: {
                create: {
                  trigger: trigger ?? "NO",
                  filterTimeMs: filterTimeMs ?? null,
                  switchingType: switchingType ?? null,
                  signalVoltage: signalVoltage ?? null,
                },
              },
            }
          : {
              analogSignal: {
                create: {
                  inputTypeId: inputTypeId ?? null,
                  wireConfig: wireConfig ?? null,
                  scaleMin: scaleMin ?? null,
                  scaleMax: scaleMax ?? null,
                  rawMin: rawMin ?? null,
                  rawMax: rawMax ?? null,
                  rawZero: rawZero ?? null,
                  clampLow: clampLow ?? null,
                  clampHigh: clampHigh ?? null,
                  deadband: deadband ?? null,
                  engineeringUnitId: engineeringUnitId ?? null,
                  plcDataTypeId: plcDataTypeId ?? null,
                  useTankLevel: useTankLevel ?? false,
                  scalingFbOverride: scalingFbOverride ?? null,
                  deadbandRawMin: deadbandRawMin ?? null,
                  deadbandRawZero: deadbandRawZero ?? null,
                  deadbandRawMax: deadbandRawMax ?? null,
                  sensorFailRaw: sensorFailRaw ?? null,
                  sensorFailMargin: sensorFailMargin ?? null,
                  sensorFailBehavior: sensorFailBehavior ?? null,
                  sensorFailDelayMs: sensorFailDelayMs ?? null,
                },
              },
            }),
      },
      include: signalInclude,
    });
  }),

  update: protectedProcedure
    .input(signalCreateInput.partial().extend({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const {
        id,
        signalType,
        projectId: _projectId,
        origin,
        tag,
        description,
        notes,
        ioCardId,
        channelPosition,
        direction,
        systemId,
        componentTag,
        drawingRef,
        cabinetLocation,
        gvlId,
        // alarm config
        alarmGroup,
        alarmBlockMask,
        commBlockMask,
        fatBlock,
        suppressionSt,
        specialAlarmFb,
        specialAlarmInput,
        anaToDigAlarm,
        // code gen flags
        isRetain,
        isPersistent,
        loggingEnabled,
        fbNameOverride,
        useShortName,
        // discrete
        trigger,
        filterTimeMs,
        switchingType,
        signalVoltage,
        // analog
        inputTypeId,
        wireConfig,
        scaleMin,
        scaleMax,
        rawMin,
        rawMax,
        rawZero,
        clampLow,
        clampHigh,
        deadband,
        engineeringUnitId,
        plcDataTypeId,
        useTankLevel,
        scalingFbOverride,
        deadbandRawMin,
        deadbandRawZero,
        deadbandRawMax,
        sensorFailRaw,
        sensorFailMargin,
        sensorFailBehavior,
        sensorFailDelayMs,
      } = input;

      // Resolve actual signalType from DB when not provided
      const resolvedType =
        signalType ??
        (await db.signal.findUniqueOrThrow({ where: { id }, select: { signalType: true } }))
          .signalType;

      const discreteFields = {
        ...(trigger !== undefined ? { trigger } : {}),
        ...(filterTimeMs !== undefined ? { filterTimeMs: filterTimeMs ?? null } : {}),
        ...(switchingType !== undefined ? { switchingType: switchingType ?? null } : {}),
        ...(signalVoltage !== undefined ? { signalVoltage: signalVoltage ?? null } : {}),
      };
      const discreteUpdate =
        resolvedType === "DISCRETE"
          ? { discreteSignal: { upsert: { create: discreteFields, update: discreteFields } } }
          : {};

      const analogFields = {
        ...(inputTypeId !== undefined ? { inputTypeId: inputTypeId ?? null } : {}),
        ...(wireConfig !== undefined ? { wireConfig: wireConfig ?? null } : {}),
        ...(scaleMin !== undefined ? { scaleMin: scaleMin ?? null } : {}),
        ...(scaleMax !== undefined ? { scaleMax: scaleMax ?? null } : {}),
        ...(rawMin !== undefined ? { rawMin: rawMin ?? null } : {}),
        ...(rawMax !== undefined ? { rawMax: rawMax ?? null } : {}),
        ...(rawZero !== undefined ? { rawZero: rawZero ?? null } : {}),
        ...(clampLow !== undefined ? { clampLow: clampLow ?? null } : {}),
        ...(clampHigh !== undefined ? { clampHigh: clampHigh ?? null } : {}),
        ...(deadband !== undefined ? { deadband: deadband ?? null } : {}),
        ...(engineeringUnitId !== undefined ? { engineeringUnitId: engineeringUnitId ?? null } : {}),
        ...(plcDataTypeId !== undefined ? { plcDataTypeId: plcDataTypeId ?? null } : {}),
        ...(useTankLevel !== undefined ? { useTankLevel: useTankLevel ?? false } : {}),
        ...(scalingFbOverride !== undefined ? { scalingFbOverride: scalingFbOverride ?? null } : {}),
        ...(deadbandRawMin !== undefined ? { deadbandRawMin: deadbandRawMin ?? null } : {}),
        ...(deadbandRawZero !== undefined ? { deadbandRawZero: deadbandRawZero ?? null } : {}),
        ...(deadbandRawMax !== undefined ? { deadbandRawMax: deadbandRawMax ?? null } : {}),
        ...(sensorFailRaw !== undefined ? { sensorFailRaw: sensorFailRaw ?? null } : {}),
        ...(sensorFailMargin !== undefined ? { sensorFailMargin: sensorFailMargin ?? null } : {}),
        ...(sensorFailBehavior !== undefined ? { sensorFailBehavior: sensorFailBehavior ?? null } : {}),
        ...(sensorFailDelayMs !== undefined ? { sensorFailDelayMs: sensorFailDelayMs ?? null } : {}),
      };
      const analogUpdate =
        resolvedType === "ANALOG"
          ? { analogSignal: { upsert: { create: analogFields, update: analogFields } } }
          : {};

      const updated = await db.signal.update({
        where: { id },
        data: {
          ...(origin !== undefined ? { origin } : {}),
          ...(tag !== undefined ? { tag: tag ?? null } : {}),
          ...(description !== undefined ? { description: description ?? null } : {}),
          ...(notes !== undefined ? { notes: notes ?? null } : {}),
          ...(ioCardId !== undefined ? { ioCardId: ioCardId ?? null } : {}),
          ...(channelPosition !== undefined ? { channelPosition: channelPosition ?? null } : {}),
          ...(direction !== undefined ? { direction: direction ?? null } : {}),
          ...(systemId !== undefined ? { systemId: systemId ?? null } : {}),
          ...(componentTag !== undefined ? { componentTag: componentTag ?? null } : {}),
          ...(drawingRef !== undefined ? { drawingRef: drawingRef ?? null } : {}),
          ...(cabinetLocation !== undefined ? { cabinetLocation: cabinetLocation ?? null } : {}),
          ...(gvlId !== undefined ? { gvlId: gvlId ?? null } : {}),
          ...(alarmGroup !== undefined ? { alarmGroup: alarmGroup ?? null } : {}),
          ...(alarmBlockMask !== undefined ? { alarmBlockMask: alarmBlockMask ?? null } : {}),
          ...(commBlockMask !== undefined ? { commBlockMask: commBlockMask ?? null } : {}),
          ...(fatBlock !== undefined ? { fatBlock: fatBlock ?? false } : {}),
          ...(suppressionSt !== undefined ? { suppressionSt: suppressionSt ?? null } : {}),
          ...(specialAlarmFb !== undefined ? { specialAlarmFb: specialAlarmFb ?? null } : {}),
          ...(specialAlarmInput !== undefined ? { specialAlarmInput: specialAlarmInput ?? null } : {}),
          ...(anaToDigAlarm !== undefined ? { anaToDigAlarm: anaToDigAlarm ?? false } : {}),
          ...(isRetain !== undefined ? { isRetain: isRetain ?? false } : {}),
          ...(isPersistent !== undefined ? { isPersistent: isPersistent ?? false } : {}),
          ...(loggingEnabled !== undefined ? { loggingEnabled: loggingEnabled ?? false } : {}),
          ...(fbNameOverride !== undefined ? { fbNameOverride: fbNameOverride ?? null } : {}),
          ...(useShortName !== undefined ? { useShortName: useShortName ?? false } : {}),
          ...discreteUpdate,
          ...analogUpdate,
        },
        include: signalInclude,
      });

      // Mark InstanceSignal as dirty when user edits a component-bound signal
      if (updated.instanceSignalId) {
        await db.instanceSignal.update({
          where: { id: updated.instanceSignalId },
          data: { templateDirty: true },
        });
      }

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(({ input }) => db.signal.delete({ where: { id: input.id } })),

  // ── Bulk operations ─────────────────────────────────────────────────────────

  bulkDelete: protectedProcedure
    .input(z.object({ ids: z.array(z.number().int()).min(1) }))
    .mutation(async ({ input }) => {
      // Delete child tables first (Prisma doesn't cascade deleteMany through relations)
      await db.discreteAlarm.deleteMany({ where: { signal: { signalId: { in: input.ids } } } });
      await db.analogAlarm.deleteMany({ where: { signal: { signalId: { in: input.ids } } } });
      await db.discreteSignal.deleteMany({ where: { signalId: { in: input.ids } } });
      await db.analogSignal.deleteMany({ where: { signalId: { in: input.ids } } });
      await db.busSignal.deleteMany({ where: { signalId: { in: input.ids } } });
      const result = await db.signal.deleteMany({ where: { id: { in: input.ids } } });
      return { count: result.count };
    }),

  bulkUpdate: protectedProcedure
    .input(z.object({
      ids: z.array(z.number().int()).min(1),
      // Only fields that make sense to apply uniformly across selected signals
      data: z.object({
        direction: z.enum(SIGNAL_DIRECTIONS).optional().nullable(),
        systemId: z.number().int().optional().nullable(),
        componentTag: z.string().optional().nullable(),
        drawingRef: z.string().optional().nullable(),
        cabinetLocation: z.string().optional().nullable(),
        gvlId: z.number().int().optional().nullable(),
        origin: z.enum(SIGNAL_ORIGINS).optional(),
        alarmGroup: z.string().max(1).optional().nullable(),
        // Discrete
        trigger: z.enum(TRIGGER_TYPES).optional(),
        // Analog
        inputTypeId: z.number().int().optional().nullable(),
        wireConfig: z.enum(WIRE_CONFIGS).optional().nullable(),
        engineeringUnitId: z.number().int().optional().nullable(),
        plcDataTypeId: z.number().int().optional().nullable(),
      }).partial(),
    }))
    .mutation(async ({ input }) => {
      const { ids, data } = input;

      // Build signal-level update (only include provided fields)
      const signalData: Record<string, unknown> = {};
      if (data.direction !== undefined) signalData.direction = data.direction;
      if (data.systemId !== undefined) signalData.systemId = data.systemId;
      if (data.componentTag !== undefined) signalData.componentTag = data.componentTag;
      if (data.drawingRef !== undefined) signalData.drawingRef = data.drawingRef;
      if (data.cabinetLocation !== undefined) signalData.cabinetLocation = data.cabinetLocation;
      if (data.gvlId !== undefined) signalData.gvlId = data.gvlId;
      if (data.origin !== undefined) signalData.origin = data.origin;
      if (data.alarmGroup !== undefined) signalData.alarmGroup = data.alarmGroup;

      if (Object.keys(signalData).length > 0) {
        await db.signal.updateMany({ where: { id: { in: ids } }, data: signalData });
      }

      // Discrete child update
      if (data.trigger !== undefined) {
        await db.discreteSignal.updateMany({
          where: { signalId: { in: ids } },
          data: { trigger: data.trigger },
        });
      }

      // Analog child updates
      const analogData: Record<string, unknown> = {};
      if (data.inputTypeId !== undefined) analogData.inputTypeId = data.inputTypeId;
      if (data.wireConfig !== undefined) analogData.wireConfig = data.wireConfig;
      if (data.engineeringUnitId !== undefined) analogData.engineeringUnitId = data.engineeringUnitId;
      if (data.plcDataTypeId !== undefined) analogData.plcDataTypeId = data.plcDataTypeId;
      if (Object.keys(analogData).length > 0) {
        await db.analogSignal.updateMany({
          where: { signalId: { in: ids } },
          data: analogData,
        });
      }

      // Mark instance signals as dirty
      await db.instanceSignal.updateMany({
        where: { signals: { some: { id: { in: ids } } } },
        data: { templateDirty: true },
      });

      return { count: ids.length };
    }),

  bulkCreate: protectedProcedure
    .input(z.object({
      projectId: z.number().int(),
      signals: z.array(signalCreateInput.omit({ projectId: true })).min(1),
    }))
    .mutation(async ({ input }) => {
      const { projectId, signals: rows } = input;
      let created = 0;

      // Process in chunks of 50 to avoid query size limits
      const CHUNK = 50;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        await db.$transaction(async (tx) => {
          for (const row of chunk) {
            const {
              signalType, origin, tag, description, notes, ioCardId, channelPosition,
              direction, systemId, componentTag, drawingRef, cabinetLocation, gvlId,
              alarmGroup, alarmBlockMask, commBlockMask, fatBlock, suppressionSt,
              specialAlarmFb, specialAlarmInput, anaToDigAlarm,
              isRetain, isPersistent, loggingEnabled, fbNameOverride, useShortName,
              instrumentTag, signalClassification, subsystem, element,
              signalFunction, supplierName, supplierSensorType, normalValue,
              trigger, filterTimeMs, switchingType, signalVoltage,
              inputTypeId, wireConfig, scaleMin, scaleMax, rawMin, rawMax, rawZero,
              clampLow, clampHigh, deadband, engineeringUnitId, plcDataTypeId,
              useTankLevel, scalingFbOverride,
              deadbandRawMin, deadbandRawZero, deadbandRawMax,
              sensorFailRaw, sensorFailMargin, sensorFailBehavior, sensorFailDelayMs,
            } = row;

            await tx.signal.create({
              data: {
                projectId, signalType, origin,
                tag: tag ?? null, description: description ?? null, notes: notes ?? null,
                ioCardId: ioCardId ?? null, channelPosition: channelPosition ?? null,
                direction: direction ?? null, systemId: systemId ?? null,
                componentTag: componentTag ?? null, drawingRef: drawingRef ?? null,
                cabinetLocation: cabinetLocation ?? null, gvlId: gvlId ?? null,
                alarmGroup: alarmGroup ?? null, alarmBlockMask: alarmBlockMask ?? null,
                commBlockMask: commBlockMask ?? null, fatBlock: fatBlock ?? false,
                suppressionSt: suppressionSt ?? null, specialAlarmFb: specialAlarmFb ?? null,
                specialAlarmInput: specialAlarmInput ?? null, anaToDigAlarm: anaToDigAlarm ?? false,
                isRetain: isRetain ?? false, isPersistent: isPersistent ?? false,
                loggingEnabled: loggingEnabled ?? false, fbNameOverride: fbNameOverride ?? null,
                useShortName: useShortName ?? false,
                instrumentTag: instrumentTag ?? null, signalClassification: signalClassification ?? null,
                subsystem: subsystem ?? null, element: element ?? null,
                signalFunction: signalFunction ?? null, supplierName: supplierName ?? null,
                supplierSensorType: supplierSensorType ?? null, normalValue: normalValue ?? null,
                ...(signalType === "DISCRETE"
                  ? { discreteSignal: { create: { trigger: trigger ?? "NO", filterTimeMs: filterTimeMs ?? null, switchingType: switchingType ?? null, signalVoltage: signalVoltage ?? null } } }
                  : { analogSignal: { create: {
                      inputTypeId: inputTypeId ?? null, wireConfig: wireConfig ?? null,
                      scaleMin: scaleMin ?? null, scaleMax: scaleMax ?? null,
                      rawMin: rawMin ?? null, rawMax: rawMax ?? null, rawZero: rawZero ?? null,
                      clampLow: clampLow ?? null, clampHigh: clampHigh ?? null, deadband: deadband ?? null,
                      engineeringUnitId: engineeringUnitId ?? null, plcDataTypeId: plcDataTypeId ?? null,
                      useTankLevel: useTankLevel ?? false, scalingFbOverride: scalingFbOverride ?? null,
                      deadbandRawMin: deadbandRawMin ?? null, deadbandRawZero: deadbandRawZero ?? null, deadbandRawMax: deadbandRawMax ?? null,
                      sensorFailRaw: sensorFailRaw ?? null, sensorFailMargin: sensorFailMargin ?? null,
                      sensorFailBehavior: sensorFailBehavior ?? null, sensorFailDelayMs: sensorFailDelayMs ?? null,
                    } } }),
              },
            });
            created++;
          }
        });
      }
      return { count: created };
    }),

  engineeringUnits: protectedProcedure.query(() =>
    db.engineeringUnit.findMany({ orderBy: { symbol: "asc" }, include: { plcDataTypeCatalog: true } })
  ),

  plcDataTypeList: protectedProcedure.query(() =>
    db.plcDataTypeCatalog.findMany({ orderBy: { sortOrder: "asc" } })
  ),

  engineeringUnitUpsert: protectedProcedure
    .input(z.object({
      symbol: z.string().min(1),
      description: z.string().optional().nullable(),
      plcDataTypeId: z.number().int().optional().nullable(),
    }))
    .mutation(({ input }) =>
      db.engineeringUnit.upsert({
        where: { symbol: input.symbol },
        create: input,
        update: { description: input.description, plcDataTypeId: input.plcDataTypeId },
      })
    ),

  analogInputTypes: protectedProcedure.query(() =>
    db.analogInputType.findMany({ orderBy: { sortOrder: "asc" } })
  ),

  analogInputTypeUpsert: protectedProcedure
    .input(z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      sortOrder: z.number().int().default(0),
    }))
    .mutation(({ input }) =>
      db.analogInputType.upsert({
        where: { code: input.code },
        create: input,
        update: { name: input.name, sortOrder: input.sortOrder },
      })
    ),

  plcDataTypeUpsert: protectedProcedure
    .input(z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      sortOrder: z.number().int().default(0),
    }))
    .mutation(({ input }) =>
      db.plcDataTypeCatalog.upsert({
        where: { code: input.code },
        create: input,
        update: { name: input.name, sortOrder: input.sortOrder },
      })
    ),

  systemList: protectedProcedure.query(() =>
    db.signalSystem.findMany({ orderBy: { code: "asc" } })
  ),

  systemUpsert: protectedProcedure
    .input(z.object({ code: z.string().min(1), name: z.string().min(1), description: z.string().optional().nullable() }))
    .mutation(({ input }) =>
      db.signalSystem.upsert({
        where: { code: input.code },
        create: input,
        update: { name: input.name, description: input.description },
      })
    ),

  gvlList: protectedProcedure.query(() =>
    db.globalVariableList.findMany({ orderBy: { name: "asc" } })
  ),

  gvlUpsert: protectedProcedure
    .input(z.object({ name: z.string().min(1), description: z.string().optional().nullable() }))
    .mutation(({ input }) =>
      db.globalVariableList.upsert({
        where: { name: input.name },
        create: input,
        update: { description: input.description },
      })
    ),

  cardsForProject: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .query(async ({ input }) => {
      const plcs = await db.plc.findMany({
        where: { projectId: input.projectId, deletedAt: null },
        include: {
          carriers: {
            where: { deletedAt: null },
            include: {
              cards: {
                where: { deletedAt: null },
                include: {
                  catalog: {
                    select: {
                      articleNumber: true,
                      description: true,
                      cardType: true,
                      maxInputChannels: true,
                      maxOutputChannels: true,
                      filterTimeMs: true,
                      supplyVoltageField: true,
                    },
                  },
                },
                orderBy: { slotPosition: "asc" },
              },
            },
            orderBy: { name: "asc" },
          },
        },
        orderBy: { name: "asc" },
      });

      return plcs.flatMap((plc) =>
        plc.carriers.flatMap((carrier) =>
          carrier.cards.map((card) => ({
            id: card.id,
            cardType: card.cardType,
            maxInputChannels: card.catalog?.maxInputChannels ?? card.maxInputChannels ?? null,
            maxOutputChannels: card.catalog?.maxOutputChannels ?? card.maxOutputChannels ?? null,
            articleNumber: card.catalog?.articleNumber ?? null,
            description: card.catalog?.description ?? null,
            filterTimeMs: card.filterTimeMs ?? card.catalog?.filterTimeMs ?? null,
            supplyVoltageField: card.supplyVoltageField ?? card.catalog?.supplyVoltageField ?? null,
            path: `${plc.name} / ${carrier.name} / Slot ${card.slotPosition + 1}`,
          }))
        )
      );
    }),

  componentList: protectedProcedure.query(() =>
    db.hardwareComponent.findMany({
      where: { projectId: null, status: { not: "DEPRECATED" } },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { signals: true } },
      },
    })
  ),

  componentSignals: protectedProcedure
    .input(z.object({ componentId: z.number().int() }))
    .query(({ input }) =>
      db.componentSignal.findMany({
        where: { componentId: input.componentId },
        orderBy: { channelOffset: "asc" },
        include: {
          defaultEu: { select: { id: true, symbol: true } },
          defaultInputType: { select: { id: true, code: true, name: true } },
          plcDataTypeCatalog: { select: { id: true, code: true } },
        },
      })
    ),

  networksForProject: protectedProcedure
    .input(z.object({
      projectId: z.number().int(),
      protocol: z.enum(BUS_PROTOCOLS).optional(),
    }))
    .query(({ input }) =>
      db.plcNetwork.findMany({
        where: {
          plc: { projectId: input.projectId, deletedAt: null },
          ...(input.protocol ? { protocol: input.protocol } : {}),
        },
        select: { id: true, protocol: true, description: true, plc: { select: { name: true } } },
        orderBy: [{ plc: { name: "asc" } }, { protocol: "asc" }],
      })
    ),

  instanceNetworkUpdate: protectedProcedure
    .input(z.object({
      instanceId: z.number().int(),
      plcNetworkId: z.number().int().nullable(),
    }))
    .mutation(async ({ input }) => {
      const { instanceId, plcNetworkId } = input;

      return db.$transaction(async (tx) => {
        // Load instance with component and all signals
        const instance = await tx.componentInstance.findUniqueOrThrow({
          where: { id: instanceId },
          include: {
            component: { select: { busProtocol: true } },
            signals: {
              include: {
                signals: {
                  select: { id: true, origin: true, busSignal: { select: { signalId: true } } },
                },
              },
            },
          },
        });

        // Validate protocol match if network is set
        if (plcNetworkId != null) {
          const network = await tx.plcNetwork.findUniqueOrThrow({
            where: { id: plcNetworkId },
            select: { protocol: true },
          });
          if (instance.component.busProtocol && network.protocol !== instance.component.busProtocol) {
            throw new Error(`Network protocol ${network.protocol} does not match component bus protocol ${instance.component.busProtocol}`);
          }
        }

        // Update instance network
        await tx.componentInstance.update({
          where: { id: instanceId },
          data: { plcNetworkId },
        });

        // Load network protocol for origin update
        let networkProtocol: string | null = null;
        if (plcNetworkId != null) {
          const net = await tx.plcNetwork.findUniqueOrThrow({
            where: { id: plcNetworkId },
            select: { protocol: true },
          });
          networkProtocol = net.protocol;
        }

        // Update all signals in the instance
        for (const is of instance.signals) {
          for (const sig of is.signals) {
            if (sig.origin === "INTERNAL") continue;

            // Update origin if network set
            if (networkProtocol) {
              await tx.signal.update({
                where: { id: sig.id },
                data: { origin: networkProtocol as SignalOrigin },
              });
            }

            // Update BusSignal.plcNetworkId
            if (sig.busSignal) {
              await tx.busSignal.update({
                where: { signalId: sig.id },
                data: { plcNetworkId },
              });
            }
          }
        }

        return { ok: true };
      });
    }),

  busSignalSave: protectedProcedure
    .input(z.object({
      signalId: z.number().int(),
      plcNetworkId: z.number().int().optional().nullable(),
      rawDataType: z.enum(RAW_DATA_TYPES),
      plcDataType: z.enum(PLC_DATA_TYPES),
      byteOrder: z.enum(BYTE_ORDERS),
      unitId: z.number().int().optional().nullable(),
      registerType: z.enum(MODBUS_REGISTER_TYPES).optional().nullable(),
      registerOffset: z.number().int().optional().nullable(),
      nodeId: z.number().int().optional().nullable(),
      canId: z.number().int().optional().nullable(),
      bitOffset: z.number().int().optional().nullable(),
      bitLength: z.number().int().optional().nullable(),
      canopenIndex: z.number().int().optional().nullable(),
      canopenSubIndex: z.number().int().optional().nullable(),
      j1939Pgn: z.number().int().optional().nullable(),
      j1939Spn: z.number().int().optional().nullable(),
      timeoutMs: z.number().int().optional().nullable(),
    }))
    .mutation(async ({ input }) => {
      const { signalId, ...data } = input;
      const result = await db.busSignal.upsert({
        where: { signalId },
        create: { signalId, ...data },
        update: data,
      });
      // Mark instance signal dirty if bound to a component
      const sig = await db.signal.findUnique({ where: { id: signalId }, select: { instanceSignalId: true } });
      if (sig?.instanceSignalId) {
        await db.instanceSignal.update({ where: { id: sig.instanceSignalId }, data: { templateDirty: true } });
      }
      return result;
    }),

  busSignalDelete: protectedProcedure
    .input(z.object({ signalId: z.number().int() }))
    .mutation(({ input }) =>
      db.busSignal.delete({ where: { signalId: input.signalId } })
    ),

  componentInstanceUpdate: protectedProcedure
    .input(z.object({
      instanceId: z.number().int(),
      name: z.string().min(1).max(255).optional(),
      canIdOffset: z.number().int().nullable().optional(),
      functionBlockOverride: z.string().max(100).nullable().optional(),
    }))
    .mutation(({ input }) => {
      const { instanceId, ...data } = input;
      return db.componentInstance.update({
        where: { id: instanceId },
        data,
        select: { id: true, name: true, canIdOffset: true, functionBlockOverride: true },
      });
    }),

  // Revert a single signal back to its component template defaults + instance offsets
  signalRevert: protectedProcedure
    .input(z.object({ signalId: z.number().int() }))
    .mutation(async ({ input }) => {
      const signal = await db.signal.findUniqueOrThrow({
        where: { id: input.signalId },
        select: {
          id: true, signalType: true, instanceSignalId: true,
          instanceSignal: {
            select: {
              id: true,
              componentSignal: {
                include: { plcDataTypeCatalog: { select: { code: true } } },
              },
              instance: { select: { canIdOffset: true } },
            },
          },
        },
      });
      if (!signal.instanceSignal) throw new Error("Signal is not bound to a component instance");

      const cs = signal.instanceSignal.componentSignal;
      const canIdOffset = signal.instanceSignal.instance.canIdOffset ?? 0;

      // Reset Signal base fields from component template
      await db.signal.update({
        where: { id: signal.id },
        data: {
          tag: cs.tagSuffix,
          description: cs.description,
          origin: cs.origin ?? undefined,
        },
      });

      // Reset child table from template defaults
      if (signal.signalType === "DISCRETE") {
        await db.discreteSignal.update({
          where: { signalId: signal.id },
          data: {
            trigger: cs.defaultTrigger ?? "NO",
            filterTimeMs: cs.defaultFilterTimeMs ?? null,
            switchingType: cs.defaultSwitchingType ?? null,
          },
        });
      } else if (signal.signalType === "ANALOG") {
        await db.analogSignal.update({
          where: { signalId: signal.id },
          data: {
            inputTypeId: cs.defaultInputTypeId ?? null,
            wireConfig: cs.defaultWireConfig ?? null,
            scaleMin: cs.defaultScaleMin ?? null,
            scaleMax: cs.defaultScaleMax ?? null,
            engineeringUnitId: cs.defaultEuId ?? null,
          },
        });
      }

      // Reset all bus signal fields from component template
      const busSignal = await db.busSignal.findUnique({ where: { signalId: signal.id } });
      if (busSignal) {
        const isDiscrete = signal.signalType === "DISCRETE";
        await db.busSignal.update({
          where: { signalId: signal.id },
          data: {
            // Data representation
            rawDataType: cs.rawDataType ?? (isDiscrete ? "BOOL" : "WORD"),
            plcDataType: (cs.plcDataTypeCatalog?.code ?? (isDiscrete ? "BOOL" : "INT")) as PlcDataType,
            byteOrder: cs.byteOrder ?? "BIG_ENDIAN",
            timeoutMs: cs.timeoutMs,
            // CAN addressing
            nodeId: cs.canNodeId,
            canId: cs.canId != null ? cs.canId + canIdOffset : null,
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
        });
      }

      // Mark as clean
      await db.instanceSignal.update({
        where: { id: signal.instanceSignal.id },
        data: { templateDirty: false },
      });

      return db.signal.findUniqueOrThrow({ where: { id: signal.id }, include: signalInclude });
    }),

  // Revert all signals in a component instance back to template defaults
  instanceRevert: protectedProcedure
    .input(z.object({ instanceId: z.number().int() }))
    .mutation(async ({ input }) => {
      const instanceSignals = await db.instanceSignal.findMany({
        where: { instanceId: input.instanceId, templateDirty: true },
        select: { signals: { select: { id: true } } },
      });

      // Revert each bound signal by calling the same logic
      for (const is of instanceSignals) {
        for (const sig of is.signals) {
          // Re-use signalRevert logic inline (avoiding circular call)
          const signal = await db.signal.findUniqueOrThrow({
            where: { id: sig.id },
            select: {
              id: true, signalType: true, instanceSignalId: true,
              instanceSignal: {
                select: {
                  id: true,
                  componentSignal: true,
                  instance: { select: { canIdOffset: true } },
                },
              },
            },
          });
          if (!signal.instanceSignal) continue;

          const cs = signal.instanceSignal.componentSignal;
          const canIdOffset = signal.instanceSignal.instance.canIdOffset ?? 0;

          await db.signal.update({
            where: { id: signal.id },
            data: { tag: cs.tagSuffix, description: cs.description, origin: cs.origin ?? undefined },
          });

          if (signal.signalType === "DISCRETE") {
            await db.discreteSignal.update({
              where: { signalId: signal.id },
              data: {
                trigger: cs.defaultTrigger ?? "NO",
                filterTimeMs: cs.defaultFilterTimeMs ?? null,
                switchingType: cs.defaultSwitchingType ?? null,
              },
            });
          } else if (signal.signalType === "ANALOG") {
            await db.analogSignal.update({
              where: { signalId: signal.id },
              data: {
                inputTypeId: cs.defaultInputTypeId ?? null,
                wireConfig: cs.defaultWireConfig ?? null,
                scaleMin: cs.defaultScaleMin ?? null,
                scaleMax: cs.defaultScaleMax ?? null,
                engineeringUnitId: cs.defaultEuId ?? null,
              },
            });
          }

          if (cs.canId != null) {
            const busSignal = await db.busSignal.findUnique({ where: { signalId: signal.id } });
            if (busSignal) {
              await db.busSignal.update({
                where: { signalId: signal.id },
                data: { canId: cs.canId + canIdOffset },
              });
            }
          }

          await db.instanceSignal.update({
            where: { id: signal.instanceSignal.id },
            data: { templateDirty: false },
          });
        }
      }

      return { ok: true };
    }),

  componentInstanceDelete: protectedProcedure
    .input(z.object({ instanceId: z.number().int() }))
    .mutation(async ({ input }) => {
      // Null out instanceSignalId on all signals bound to this instance's InstanceSignals
      await db.signal.updateMany({
        where: { instanceSignal: { instanceId: input.instanceId } },
        data: { instanceSignalId: null },
      });
      // Delete InstanceSignal rows, then the ComponentInstance (cascade not guaranteed)
      await db.instanceSignal.deleteMany({ where: { instanceId: input.instanceId } });
      await db.componentInstance.delete({ where: { id: input.instanceId } });
      return { ok: true };
    }),

  signalAlarmUpsert: protectedProcedure
    .input(z.object({
      signalId: z.number().int(),
      discreteAlarms: z.array(z.object({
        condition: z.enum(DISCRETE_ALARM_CONDITIONS),
        severity: z.enum(ALARM_SEVERITIES).default("ALARM"),
        alarmGroup: z.string().max(1).optional().nullable(),
        delaySeconds: z.coerce.number().int().min(0).default(0),
        message: z.string().optional().nullable(),
      })).default([]),
      analogAlarms: z.array(z.object({
        condition: z.enum(ANALOG_ALARM_CONDITIONS),
        setpoint: z.coerce.number(),
        hysteresis: z.coerce.number().min(0).default(0),
        severity: z.enum(ALARM_SEVERITIES).default("ALARM"),
        alarmGroup: z.string().max(1).optional().nullable(),
        delaySeconds: z.coerce.number().int().min(0).default(0),
        message: z.string().optional().nullable(),
      })).default([]),
    }))
    .mutation(async ({ input }) => {
      const { signalId, discreteAlarms, analogAlarms } = input;
      return db.$transaction(async (tx) => {
        await tx.discreteAlarm.deleteMany({ where: { signalId } });
        await tx.analogAlarm.deleteMany({ where: { signalId } });
        if (discreteAlarms.length > 0) {
          await tx.discreteAlarm.createMany({
            data: discreteAlarms.map((a) => ({ signalId, ...a })),
          });
        }
        if (analogAlarms.length > 0) {
          await tx.analogAlarm.createMany({
            data: analogAlarms.map((a) => ({ signalId, ...a })),
          });
        }
        return tx.signal.findUniqueOrThrow({
          where: { id: signalId },
          include: signalInclude,
        });
      });
    }),

  addFromComponent: protectedProcedure
    .input(z.object({
      projectId: z.number().int(),
      componentId: z.number().int(),
      componentTag: z.string().optional().nullable(),
      selectedOffsets: z.array(z.number().int()),
      // Default origin applied to signals that have no origin set on the component signal
      defaultOrigin: z.enum(SIGNAL_ORIGINS).default("CANBUS"),
    }))
    .mutation(async ({ input }) => {
      const { projectId, componentId, componentTag, selectedOffsets, defaultOrigin } = input;

      const componentSignals = await db.componentSignal.findMany({
        where: { componentId, channelOffset: { in: selectedOffsets }, active: true },
        orderBy: { channelOffset: "asc" },
        include: { plcDataTypeCatalog: { select: { code: true } } },
      });

      return db.$transaction(async (tx) => {
        const component = await tx.hardwareComponent.findUniqueOrThrow({
          where: { id: componentId },
          select: { name: true, busProtocol: true },
        });

        // Create one ComponentInstance for this batch of signals
        const instance = await tx.componentInstance.create({
          data: {
            projectId,
            componentId,
            name: componentTag?.trim() || component.name,
          },
        });

        const created = [];
        for (const cs of componentSignals) {
          const signalType: "DISCRETE" | "ANALOG" =
            (cs.ioType === "DI" || cs.ioType === "DO") ? "DISCRETE" : "ANALOG";
          const direction: "INPUT" | "OUTPUT" =
            (cs.ioType === "DO" || cs.ioType === "AO") ? "OUTPUT" : "INPUT";
          const finalOrigin = (cs.origin ?? component.busProtocol ?? defaultOrigin) as SignalOrigin;
          const needsBusSignal = finalOrigin !== "IEC" && finalOrigin !== "INTERNAL";

          // Create InstanceSignal linking the component signal to this instance
          const instanceSignal = await tx.instanceSignal.create({
            data: {
              instanceId: instance.id,
              componentSignalId: cs.id,
              templateDirty: false,
            },
          });

          // Create project signal, seeded from component signal defaults, bound to instance
          const signal = await tx.signal.create({
            data: {
              projectId,
              signalType,
              direction,
              origin: finalOrigin,
              tag: cs.tagSuffix ?? null,
              description: cs.description ?? null,
              componentTag: componentTag ?? null,
              instanceSignalId: instanceSignal.id,
              ...(signalType === "DISCRETE"
                ? {
                    discreteSignal: {
                      create: {
                        trigger: cs.defaultTrigger ?? "NO",
                        filterTimeMs: cs.defaultFilterTimeMs ?? null,
                        switchingType: cs.defaultSwitchingType ?? null,
                      },
                    },
                  }
                : {
                    analogSignal: {
                      create: {
                        inputTypeId: cs.defaultInputTypeId ?? null,
                        wireConfig: cs.defaultWireConfig ?? null,
                        scaleMin: cs.defaultScaleMin ?? null,
                        scaleMax: cs.defaultScaleMax ?? null,
                        engineeringUnitId: cs.defaultEuId ?? null,
                        plcDataTypeId: cs.plcDataTypeId ?? null,
                      },
                    },
                  }),
              ...(needsBusSignal ? {
                busSignal: {
                  create: {
                    nodeId: cs.canNodeId,
                    canId: cs.canId,
                    bitOffset: cs.bitOffset,
                    bitLength: cs.bitLength,
                    isMuxIndicator: cs.isMuxIndicator,
                    muxId: cs.muxId,
                    unitId: cs.modbusUnitId,
                    registerType: cs.modbusRegisterType,
                    registerOffset: cs.modbusRegisterOffset,
                    timeoutMs: cs.timeoutMs,
                    rawDataType: cs.rawDataType ?? (signalType === "DISCRETE" ? "BOOL" : "WORD"),
                    plcDataType: (cs.plcDataTypeCatalog?.code ?? (signalType === "DISCRETE" ? "BOOL" : "INT")) as
                      "BOOL" | "BYTE" | "WORD" | "DWORD" | "LWORD" | "SINT" | "INT" | "DINT" | "LINT" | "USINT" | "UINT" | "UDINT" | "ULINT" | "REAL" | "LREAL" | "TIME" | "DATE" | "TOD" | "DT" | "STRING" | "WSTRING" | "SAFEBOOL" | "SAFEINT" | "SAFEDINT" | "SAFETIME" | "SAFEWORD",
                    byteOrder: cs.byteOrder ?? "BIG_ENDIAN",
                  },
                },
              } : {}),
            },
            include: signalInclude,
          });
          created.push(signal);
        }

        return created;
      });
    }),
});
