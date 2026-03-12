import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { USER_ROLES } from "@/lib/enums";

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  // passwordHash is intentionally excluded from all list/query responses
} as const;

export const userRouter = createTRPCRouter({
  list: protectedProcedure.query(() =>
    db.user.findMany({ select: userSelect, orderBy: { createdAt: "asc" } })
  ),

  create: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().min(1).optional(),
        role: z.enum(USER_ROLES).default("ENGINEER"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      })
    )
    .mutation(async ({ input }) => {
      const passwordHash = await hashPassword(input.password);
      return db.user.create({
        data: { email: input.email, name: input.name, role: input.role, passwordHash },
        select: userSelect,
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        role: z.enum(USER_ROLES).optional(),
        password: z.string().min(8, "Password must be at least 8 characters").optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, password, ...rest } = input;
      const data: Record<string, unknown> = { ...rest };
      if (password) data.passwordHash = await hashPassword(password);
      return db.user.update({ where: { id }, data, select: userSelect });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ input }) => db.user.delete({ where: { id: input.id } })),
});
