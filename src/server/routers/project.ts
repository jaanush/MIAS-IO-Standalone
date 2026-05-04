import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import { PROJECT_STATUS, MEMBER_ROLES } from "@/lib/enums";

export const projectRouter = createTRPCRouter({
  byId: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(({ input }) =>
      db.project.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          members: {
            include: { user: { select: { id: true, email: true, name: true } } },
          },
          _count: { select: { signals: true } },
        },
      })
    ),

  list: protectedProcedure.query(() =>
    db.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
    })
  ),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        projectNumber: z.string().optional(),
        client: z.string().optional(),
        location: z.string().optional(),
        status: z.enum(PROJECT_STATUS).default("ACTIVE"),
      })
    )
    .mutation(({ input }) => db.project.create({ data: input })),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string().min(1).optional(),
        projectNumber: z.string().optional().nullable(),
        client: z.string().optional(),
        location: z.string().optional(),
        status: z.enum(PROJECT_STATUS).optional(),
        // FR-022: hardware commissioning policy
        commissioningPolicy: z.enum(["AUTO", "MANUAL_ONLY", "DISABLED"]).optional(),
        commissioningInitialXLocalCommReq: z.boolean().optional(),
        commissioningInitialXRunPlaybook: z.boolean().optional(),
        commissioningRebootStrategy: z.enum(["BATCH_LAST_STEP", "PER_SLOT"]).optional(),
      })
    )
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return db.project.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(({ input }) => db.project.delete({ where: { id: input.id } })),

  purgeData: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .mutation(async ({ input }) => {
      const { projectId } = input;
      return db.$transaction(async (tx) => {
        // Delete in dependency order:
        // 1. Signals (cascades: discrete/analog signal, alarms, bus signal)
        const signals = await tx.signal.deleteMany({ where: { projectId } });
        // 2. Instance signals + component instances
        const instanceSignals = await tx.instanceSignal.deleteMany({
          where: { instance: { projectId } },
        });
        const instances = await tx.componentInstance.deleteMany({ where: { projectId } });
        // 3. Components (cascades: component signals, alarms, PDO configs)
        const components = await tx.hardwareComponent.deleteMany({ where: { projectId } });
        // 4. CODESYS data
        const imports = await tx.codesysImport.deleteMany({ where: { projectId } });
        const recipes = await tx.wiringRecipe.deleteMany({ where: { projectId } });
        // 5. Buses (cascades: bus nodes) — project-level, not under PLCs
        const buses = await tx.bus.deleteMany({ where: { projectId } });
        // 6. IP Networks — project-level
        const ipNetworks = await tx.ipNetwork.deleteMany({ where: { projectId } });
        // 7. PLCs (cascades: carriers → cards, ports)
        const plcs = await tx.plc.deleteMany({ where: { projectId } });

        return {
          signals: signals.count,
          instanceSignals: instanceSignals.count,
          instances: instances.count,
          components: components.count,
          imports: imports.count,
          recipes: recipes.count,
          buses: buses.count,
          ipNetworks: ipNetworks.count,
          plcs: plcs.count,
        };
      });
    }),

  // ── Member management ────────────────────────────────────────────────────

  addMember: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        userId: z.string().uuid(),
        role: z.enum(MEMBER_ROLES).default("MEMBER"),
      })
    )
    .mutation(({ input }) =>
      db.projectMember.upsert({
        where: { projectId_userId: { projectId: input.projectId, userId: input.userId } },
        create: { projectId: input.projectId, userId: input.userId, role: input.role },
        update: { role: input.role },
      })
    ),

  removeMember: protectedProcedure
    .input(z.object({ projectId: z.number().int(), userId: z.string().uuid() }))
    .mutation(({ input }) =>
      db.projectMember.delete({
        where: { projectId_userId: { projectId: input.projectId, userId: input.userId } },
      })
    ),
});
