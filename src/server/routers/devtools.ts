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

  /** Create a new IO-check session */
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
});
