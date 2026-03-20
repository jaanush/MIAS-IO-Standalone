import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { readExcelSheets, getColumnValues, extractMappedRows } from "../lib/structured-import";

export const importRouter = createTRPCRouter({
  /** Read Excel file and return sheet info with headers + sample data */
  readSheets: protectedProcedure
    .input(z.object({ fileBase64: z.string() }))
    .mutation(({ input }) => readExcelSheets(input.fileBase64)),

  /** Get unique values for a column (for filter autocomplete) */
  columnValues: protectedProcedure
    .input(z.object({
      fileBase64: z.string(),
      sheetName: z.string(),
      columnHeader: z.string(),
    }))
    .mutation(({ input }) => getColumnValues(input.fileBase64, input.sheetName, input.columnHeader)),

  /** Extract rows with column mapping + filters applied */
  extractRows: protectedProcedure
    .input(z.object({
      fileBase64: z.string(),
      sheetNames: z.array(z.string()).min(1),
      mappings: z.array(z.object({
        sourceColumn: z.string(),
        targetField: z.string(),
      })),
      filters: z.array(z.object({
        column: z.string(),
        operator: z.enum(["==", "!="]),
        value: z.string(),
      })),
      filterLogic: z.enum(["AND", "OR"]).default("AND"),
    }))
    .mutation(async ({ input }) => {
      // Extract from all selected sheets and combine
      let allRows: Record<string, string>[] = [];
      let totalRows = 0;
      let filteredOut = 0;
      for (const sheetName of input.sheetNames) {
        const result = await extractMappedRows(
          input.fileBase64, sheetName, input.mappings, input.filters, input.filterLogic
        );
        allRows.push(...result.rows);
        totalRows += result.totalRows;
        filteredOut += result.filteredOut;
      }
      return { rows: allRows, totalRows, filteredOut };
    }),
});
