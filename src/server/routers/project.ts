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
      // Delete in dependency order: signals → component instances → components → PLCs (cascades carriers/cards/networks)
      const signals = await db.signal.deleteMany({ where: { projectId } });
      const instances = await db.componentInstance.deleteMany({ where: { projectId } });
      const components = await db.hardwareComponent.deleteMany({ where: { projectId } });
      const imports = await db.codesysImport.deleteMany({ where: { projectId } });
      const recipes = await db.wiringRecipe.deleteMany({ where: { projectId } });
      const plcs = await db.plc.deleteMany({ where: { projectId } });
      return {
        signals: signals.count,
        instances: instances.count,
        components: components.count,
        imports: imports.count,
        recipes: recipes.count,
        plcs: plcs.count,
      };
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
