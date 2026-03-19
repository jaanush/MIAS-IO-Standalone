import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";

export const codesysRouter = createTRPCRouter({
  taskEnqueue: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        type: z.string().min(1).max(50),
        params: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return db.codesysTask.create({
        data: {
          projectId: input.projectId,
          type: input.type,
          params: (input.params ?? {}) as object,
          createdBy: ctx.session.userId,
        },
      });
    }),

  taskList: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      return db.codesysTask.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          type: true,
          status: true,
          params: true,
          resultLog: true,
          resultError: true,
          claimedAt: true,
          completedAt: true,
          createdAt: true,
        },
      });
    }),

  taskCancel: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const task = await db.codesysTask.findUnique({ where: { id: input.id } });
      if (!task) throw new Error("Task not found");
      if (task.status !== "QUEUED") throw new Error("Only QUEUED tasks can be cancelled");
      return db.codesysTask.delete({ where: { id: input.id } });
    }),

  settingsGet: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .query(async ({ input }) => {
      const settings = await db.codesysSettings.findUnique({ where: { projectId: input.projectId } });
      // Return defaults if no record exists yet
      return settings ?? {
        projectId: input.projectId,
        fbAlarmDigital: "FB_AlarmDigital",
        fbAlarmAnalogue: "FB_AlarmAnalogue",
        fbAnalogScaling: "FB_AnalogueIn_DeadBand_rev3",
        fbTankLevel: "FB_TankLevel",
      };
    }),

  settingsSave: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        fbAlarmDigital: z.string().min(1).max(100),
        fbAlarmAnalogue: z.string().min(1).max(100),
        fbAnalogScaling: z.string().min(1).max(100),
        fbTankLevel: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ input }) => {
      return db.codesysSettings.upsert({
        where: { projectId: input.projectId },
        create: input,
        update: {
          fbAlarmDigital: input.fbAlarmDigital,
          fbAlarmAnalogue: input.fbAlarmAnalogue,
          fbAnalogScaling: input.fbAnalogScaling,
          fbTankLevel: input.fbTankLevel,
        },
      });
    }),

  // ── Sessions ────────────────────────────────────────────────────────
  activeSessions: protectedProcedure
    .input(z.object({ projectId: z.number().int().optional() }).optional())
    .query(async ({ input }) => {
      // Sessions with heartbeat within last 30 seconds are considered active
      const cutoff = new Date(Date.now() - 30_000);
      return db.codesysSession.findMany({
        where: {
          disconnectedAt: null,
          lastHeartbeatAt: { gte: cutoff },
          // No project filter — sessions are global; user ensures matching projects
        },
        select: {
          id: true,
          email: true,
          hostname: true,
          pluginVersion: true,
          miasProjectId: true,
          projectOpen: true,
          lastHeartbeatAt: true,
        },
        orderBy: { lastHeartbeatAt: "desc" },
      });
    }),
});
