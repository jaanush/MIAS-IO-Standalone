/**
 * Thin wrapper around ExcelJS for reading spreadsheet files.
 * Replaces the `xlsx` (SheetJS) package which has unfixed vulnerabilities.
 *
 * Provides the same operations the codebase needs:
 * - Read a workbook from a buffer or ArrayBuffer
 * - List sheet names
 * - Convert a sheet to a 2D array of values (rows × columns)
 * - Read individual cell values by row/col index
 */
import ExcelJS from "exceljs";

export type Workbook = {
  sheetNames: string[];
  /** Get a sheet by name. Returns undefined if not found. */
  getSheet(name: string): Sheet | undefined;
};

export type Sheet = {
  /** Total number of rows (1-based, so row count = rowCount) */
  rowCount: number;
  /** Total number of columns */
  columnCount: number;
  /** Get string value at (row, col), both 0-based */
  cellString(row: number, col: number): string;
  /** Get numeric value at (row, col), both 0-based. Returns null if not a number. */
  cellNumber(row: number, col: number): number | null;
  /** Get raw cell value at (row, col), both 0-based */
  cellValue(row: number, col: number): unknown;
  /** Convert entire sheet to 2D array of strings (like XLSX.utils.sheet_to_json with header:1) */
  toRows(): string[][];
};

function wrapWorksheet(ws: ExcelJS.Worksheet): Sheet {
  return {
    rowCount: ws.rowCount,
    columnCount: ws.columnCount,

    cellString(row: number, col: number): string {
      // ExcelJS is 1-based, our API is 0-based
      const cell = ws.getCell(row + 1, col + 1);
      const v = cell.value;
      if (v == null) return "";
      // Handle rich text
      if (typeof v === "object" && "richText" in (v as object)) {
        return ((v as { richText: { text: string }[] }).richText ?? []).map((r) => r.text).join("");
      }
      // Handle formula results
      if (typeof v === "object" && "result" in (v as object)) {
        return String((v as { result: unknown }).result ?? "");
      }
      return String(v).trim();
    },

    cellNumber(row: number, col: number): number | null {
      const cell = ws.getCell(row + 1, col + 1);
      let v = cell.value;
      if (v == null) return null;
      // Handle formula results
      if (typeof v === "object" && "result" in (v as object)) {
        const result = (v as { result: unknown }).result;
        const n = Number(result);
        return isNaN(n) ? null : n;
      }
      const n = Number(v);
      return isNaN(n) ? null : n;
    },

    cellValue(row: number, col: number): unknown {
      const cell = ws.getCell(row + 1, col + 1);
      return cell.value;
    },

    toRows(): string[][] {
      const rows: string[][] = [];
      ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        // Pad rows array to handle gaps
        while (rows.length < rowNumber) rows.push([]);
        const vals: string[] = [];
        for (let c = 1; c <= ws.columnCount; c++) {
          const cell = row.getCell(c);
          const v = cell.value;
          if (v == null) {
            vals.push("");
          } else if (typeof v === "object" && "richText" in (v as object)) {
            vals.push(((v as { richText: { text: string }[] }).richText ?? []).map((r) => r.text).join(""));
          } else if (typeof v === "object" && "result" in (v as object)) {
            vals.push(String((v as { result: unknown }).result ?? ""));
          } else {
            vals.push(String(v));
          }
        }
        rows[rowNumber - 1] = vals;
      });
      return rows;
    },
  };
}

/** Read a workbook from a Node.js Buffer (server-side) */
export async function readBuffer(buf: Buffer | ArrayBuffer): Promise<Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as ArrayBuffer);
  return {
    sheetNames: wb.worksheets.map((ws) => ws.name),
    getSheet(name: string) {
      const ws = wb.getWorksheet(name);
      return ws ? wrapWorksheet(ws) : undefined;
    },
  };
}

/** Read a workbook from an ArrayBuffer (client-side, from FileReader) */
export async function readArrayBuffer(data: ArrayBuffer): Promise<Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  return {
    sheetNames: wb.worksheets.map((ws) => ws.name),
    getSheet(name: string) {
      const ws = wb.getWorksheet(name);
      return ws ? wrapWorksheet(ws) : undefined;
    },
  };
}
