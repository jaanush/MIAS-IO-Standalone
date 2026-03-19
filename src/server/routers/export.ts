import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { generateLegacyExport } from "../lib/generate-legacy-export";

export const exportRouter = createTRPCRouter({
  legacyFiles: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .query(async ({ input }) => {
      const files = await generateLegacyExport(input.projectId);
      return Array.from(files.entries()).map(([name, content]) => ({
        name,
        size: content.length,
        lines: content.split("\n").length - 1,
      }));
    }),

  legacyFileContent: protectedProcedure
    .input(z.object({ projectId: z.number().int(), filename: z.string() }))
    .query(async ({ input }) => {
      const files = await generateLegacyExport(input.projectId);
      const content = files.get(input.filename);
      if (!content) return null;
      return content;
    }),

  legacyAllFiles: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .query(async ({ input }) => {
      const files = await generateLegacyExport(input.projectId);
      return Array.from(files.entries()).map(([name, content]) => ({ name, content }));
    }),
});
