import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import { connectionManager } from "../lib/opcua/connection-manager";
import { buildNodeId } from "../lib/opcua/node-id";

export const devtoolsRouter = createTRPCRouter({
  /** Get OPC UA connection status for a PLC */
  plcStatus: protectedProcedure
    .input(z.object({ plcId: z.number() }))
    .query(({ input }) => {
      return connectionManager.getStatus(input.plcId);
    }),

  /** Get all PLC connection statuses */
  allStatuses: protectedProcedure.query(() => {
    const statuses = connectionManager.getAllStatuses();
    return Object.fromEntries(statuses);
  }),

  /** Connect to a PLC's OPC UA server */
  plcConnect: protectedProcedure
    .input(z.object({ plcId: z.number() }))
    .mutation(async ({ input }) => {
      const plc = await db.plc.findUnique({
        where: { id: input.plcId },
        select: { ipAddress: true, name: true },
      });
      if (!plc?.ipAddress) {
        throw new Error(`PLC ${input.plcId} has no IP address configured`);
      }
      const endpoint = `opc.tcp://${plc.ipAddress}:4840`;
      await connectionManager.connect(input.plcId, endpoint);
      return { success: true, endpoint };
    }),

  /** Disconnect from a PLC */
  plcDisconnect: protectedProcedure
    .input(z.object({ plcId: z.number() }))
    .mutation(async ({ input }) => {
      await connectionManager.disconnect(input.plcId);
      return { success: true };
    }),

  /** Get signals for a PLC with computed OPC UA node IDs */
  plcSignals: protectedProcedure
    .input(z.object({ plcId: z.number() }))
    .query(async ({ input }) => {
      // Get all carriers under this PLC, then all cards, then all signals
      const plc = await db.plc.findUnique({
        where: { id: input.plcId },
        include: {
          carriers: {
            include: {
              cards: {
                orderBy: { slotPosition: "asc" },
                include: {
                  catalog: { select: { articleNumber: true, description: true } },
                  signals: {
                    include: {
                      gvl: { select: { name: true } },
                      discreteSignal: true,
                      analogSignal: {
                        include: {
                          engineeringUnit: { select: { symbol: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!plc) return [];

      const result: {
        signalId: number;
        tag: string;
        description: string | null;
        signalType: string | null;
        direction: string | null;
        nodeId: string | null;
        unit: string | null;
        carrierName: string;
        cardArticle: string | null;
        slotPosition: number;
        channelPosition: number | null;
      }[] = [];

      for (const carrier of plc.carriers) {
        for (const card of carrier.cards) {
          for (const signal of card.signals) {
            const nodeId =
              signal.tag && signal.gvl?.name
                ? buildNodeId(signal.gvl.name, signal.tag)
                : null;

            result.push({
              signalId: signal.id,
              tag: signal.tag ?? "",
              description: signal.description,
              signalType: signal.signalType,
              direction: signal.direction,
              nodeId,
              unit: signal.analogSignal?.engineeringUnit?.symbol ?? null,
              carrierName: carrier.name,
              cardArticle: card.catalog?.articleNumber ?? null,
              slotPosition: card.slotPosition,
              channelPosition: signal.channelPosition,
            });
          }
        }
      }

      return result;
    }),

  // --- IO-Check Session Management ---

  /** Create a new IO-check session.
   *  Also auto-enables SCALED monitoring on every selected signal at 1s
   *  intervals so the wizard can pull live values via FR-007 (replaces the
   *  partly-broken OPC UA WS path). Idempotent on the monitoring side. */
  ioCheckCreate: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        plcId: z.number(),
        operatorName: z.string().optional(),
        signalIds: z.array(z.number()),
      }),
    )
    .mutation(async ({ input }) => {
      const session = await db.ioCheckSession.create({
        data: {
          projectId: input.projectId,
          plcId: input.plcId,
          operatorName: input.operatorName,
          results: {
            create: input.signalIds.map((signalId) => ({
              signalId,
              status: "PENDING",
            })),
          },
        },
        include: { results: true },
      });

      // Auto-subscribe — one row per (signal, SCALED). Use createMany with
      // skipDuplicates so re-runs don't fail on the (signal_id, mode) unique.
      if (input.signalIds.length > 0) {
        await db.signalMonitoring.createMany({
          data: input.signalIds.map((signalId) => ({
            signalId,
            mode: "SCALED" as const,
            projectId: input.projectId,
            intervalMs: 1000,
            enabled: true,
          })),
          skipDuplicates: true,
        });
        // For pre-existing rows, make sure they're enabled + interval=1s.
        await db.signalMonitoring.updateMany({
          where: {
            signalId: { in: input.signalIds },
            mode: "SCALED",
          },
          data: { enabled: true, intervalMs: 1000 },
        });
      }

      return session;
    }),

  /** Update a single IO-check result */
  ioCheckUpdate: protectedProcedure
    .input(
      z.object({
        resultId: z.number(),
        status: z.enum(["PENDING", "PASS", "FAIL", "SKIPPED"]),
        measuredValue: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return db.ioCheckResult.update({
        where: { id: input.resultId },
        data: {
          status: input.status,
          measuredValue: input.measuredValue,
          notes: input.notes,
          checkedAt: input.status !== "PENDING" ? new Date() : null,
        },
      });
    }),

  /** Complete an IO-check session */
  ioCheckComplete: protectedProcedure
    .input(
      z.object({
        sessionId: z.number(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return db.ioCheckSession.update({
        where: { id: input.sessionId },
        data: {
          completedAt: new Date(),
          notes: input.notes,
        },
      });
    }),

  /** Get an IO-check session with all results */
  ioCheckGet: protectedProcedure
    .input(z.object({ sessionId: z.number() }))
    .query(async ({ input }) => {
      return db.ioCheckSession.findUnique({
        where: { id: input.sessionId },
        include: {
          results: {
            include: {
              signal: {
                select: {
                  id: true,
                  tag: true,
                  description: true,
                  signalType: true,
                  direction: true,
                  gvl: { select: { name: true } },
                  // ioCard surfaces the carrier+slot so the wizard can
                  // group results by module and offer "skip to next module".
                  ioCard: {
                    select: {
                      id: true,
                      slotPosition: true,
                      cardType: true,
                      carrier: { select: { id: true, name: true } },
                    },
                  },
                  analogSignal: {
                    include: {
                      engineeringUnit: { select: { symbol: true } },
                    },
                  },
                },
              },
            },
            orderBy: { id: "asc" },
          },
          plc: { select: { name: true, ipAddress: true } },
          project: { select: { name: true } },
        },
      });
    }),

  /** List IO-check sessions for a PLC */
  ioCheckList: protectedProcedure
    .input(z.object({ plcId: z.number() }))
    .query(async ({ input }) => {
      return db.ioCheckSession.findMany({
        where: { plcId: input.plcId },
        include: {
          _count: { select: { results: true } },
          results: {
            select: { status: true },
          },
        },
        orderBy: { startedAt: "desc" },
      });
    }),

  /** Project-level: every IO-check session across PLCs with summary counts. */
  ioCheckListForProject: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const sessions = await db.ioCheckSession.findMany({
        where: { projectId: input.projectId },
        include: {
          plc: { select: { id: true, name: true } },
          results: { select: { status: true } },
        },
        orderBy: { startedAt: "desc" },
      });
      return sessions.map((s) => {
        const counts = { PENDING: 0, PASS: 0, FAIL: 0, SKIPPED: 0 };
        for (const r of s.results) counts[r.status]++;
        return {
          id: s.id,
          plcId: s.plcId,
          plcName: s.plc.name,
          operatorName: s.operatorName,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
          notes: s.notes,
          total: s.results.length,
          ...counts,
        };
      });
    }),

  /** Cross-tab summary: every signal that has appeared in at least one
   *  session × every session, with each cell's status. Used by the
   *  matrix view. Returns a sparse map keyed (signalId, sessionId). */
  ioCheckMatrix: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const sessions = await db.ioCheckSession.findMany({
        where: { projectId: input.projectId },
        select: {
          id: true,
          plcId: true,
          plc: { select: { name: true } },
          operatorName: true,
          startedAt: true,
          completedAt: true,
        },
        orderBy: { startedAt: "asc" },
      });
      const sessionIds = sessions.map((s) => s.id);
      const results = sessionIds.length === 0 ? [] : await db.ioCheckResult.findMany({
        where: { sessionId: { in: sessionIds } },
        select: {
          sessionId: true,
          signalId: true,
          status: true,
          checkedAt: true,
          signal: {
            select: {
              id: true,
              tag: true,
              description: true,
              signalType: true,
              direction: true,
              ioCard: { select: { slotPosition: true, carrier: { select: { name: true } } } },
            },
          },
        },
      });

      // Collect distinct signals across all sessions.
      const signalMap = new Map<number, typeof results[0]["signal"]>();
      for (const r of results) signalMap.set(r.signalId, r.signal);
      const signals = [...signalMap.values()].sort((a, b) => {
        // Order by carrier → slot → tag for grouping.
        const ca = a.ioCard?.carrier.name ?? "";
        const cb = b.ioCard?.carrier.name ?? "";
        if (ca !== cb) return ca.localeCompare(cb);
        const sa = a.ioCard?.slotPosition ?? 0;
        const sb = b.ioCard?.slotPosition ?? 0;
        if (sa !== sb) return sa - sb;
        return (a.tag ?? "").localeCompare(b.tag ?? "");
      });

      // Cell map: "signalId:sessionId" → { status, checkedAt }
      const cells: Record<string, { status: string; checkedAt: Date | null }> = {};
      for (const r of results) {
        cells[`${r.signalId}:${r.sessionId}`] = {
          status: r.status,
          checkedAt: r.checkedAt,
        };
      }

      return { sessions, signals, cells };
    }),

  /** Bulk-fetch latest live readings for a list of signals (per mode).
   *  Used by the wizard to show live values for the current signal +
   *  optionally adjacent ones. Plugin pushes via /readings; this just
   *  reads the cached row. */
  signalLiveReadingsByIds: protectedProcedure
    .input(z.object({
      signalIds: z.array(z.number().int()),
      mode: z.enum(["SCALED", "RAW"]).default("SCALED"),
    }))
    .query(async ({ input }) => {
      if (input.signalIds.length === 0) return [];
      return db.signalReadingLive.findMany({
        where: { signalId: { in: input.signalIds }, mode: input.mode },
        select: {
          signalId: true,
          mode: true,
          value: true,
          valueStr: true,
          state: true,
          tsPlugin: true,
          errorMsg: true,
        },
      });
    }),
});
