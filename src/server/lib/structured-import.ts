/**
 * Generic structured import: read Excel/CSV sheets, extract headers + sample data,
 * and apply column mapping + row filters to produce structured records.
 */

export interface SheetInfo {
  name: string;
  rowCount: number;
  headers: string[];
  sampleRows: string[][]; // first 5 data rows
}

export interface ColumnMapping {
  /** Source column header from the Excel sheet */
  sourceColumn: string;
  /** Target field name in the import schema */
  targetField: string;
}

export interface RowFilter {
  column: string;
  operator: "==" | "!=";
  value: string;
}

export interface MappedRow {
  [targetField: string]: string;
}

/**
 * Read an Excel file and return sheet info with headers and sample data.
 */
export async function readExcelSheets(fileBase64: string): Promise<SheetInfo[]> {
  const XLSX = await import("xlsx");
  const buf = Buffer.from(fileBase64, "base64");
  const wb = XLSX.read(buf, { type: "buffer" });

  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];

    // Find header row: first row with 3+ non-empty cells
    let headerIdx = 0;
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const nonEmpty = rows[i].filter((c: any) => String(c ?? "").trim()).length;
      if (nonEmpty >= 3) {
        headerIdx = i;
        break;
      }
    }

    const headers = rows[headerIdx]?.map((c: any) => String(c ?? "").trim()) ?? [];
    const dataRows = rows.slice(headerIdx + 1);
    const sampleRows = dataRows
      .filter((r) => r.some((c: any) => String(c ?? "").trim()))
      .slice(0, 5)
      .map((r) => r.map((c: any) => String(c ?? "").trim()));

    return {
      name,
      rowCount: dataRows.filter((r) => r.some((c: any) => String(c ?? "").trim())).length,
      headers: headers.filter(Boolean),
      sampleRows,
    };
  });
}

/**
 * Get unique values for a specific column in a sheet (for filter autocomplete).
 */
export async function getColumnValues(
  fileBase64: string,
  sheetName: string,
  columnHeader: string,
  limit: number = 50,
): Promise<string[]> {
  const XLSX = await import("xlsx");
  const buf = Buffer.from(fileBase64, "base64");
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];

  // Find header row
  let headerIdx = 0;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const nonEmpty = rows[i].filter((c: any) => String(c ?? "").trim()).length;
    if (nonEmpty >= 3) { headerIdx = i; break; }
  }

  const headers = rows[headerIdx]?.map((c: any) => String(c ?? "").trim()) ?? [];
  const colIdx = headers.indexOf(columnHeader);
  if (colIdx < 0) return [];

  const values = new Set<string>();
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const val = String(rows[i][colIdx] ?? "").trim();
    if (val) values.add(val);
    if (values.size >= limit) break;
  }

  return [...values].sort();
}

/**
 * Apply column mapping and row filters to extract structured records.
 */
export async function extractMappedRows(
  fileBase64: string,
  sheetName: string,
  mappings: ColumnMapping[],
  filters: RowFilter[],
  filterLogic: "AND" | "OR" = "AND",
): Promise<{ rows: MappedRow[]; totalRows: number; filteredOut: number }> {
  const XLSX = await import("xlsx");
  const buf = Buffer.from(fileBase64, "base64");
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[sheetName];
  if (!ws) return { rows: [], totalRows: 0, filteredOut: 0 };

  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];

  // Find header row
  let headerIdx = 0;
  for (let i = 0; i < Math.min(10, rawRows.length); i++) {
    const nonEmpty = rawRows[i].filter((c: any) => String(c ?? "").trim()).length;
    if (nonEmpty >= 3) { headerIdx = i; break; }
  }

  const headers = rawRows[headerIdx]?.map((c: any) => String(c ?? "").trim()) ?? [];

  // Build column index map for source columns
  const sourceIdxMap = new Map<string, number>();
  for (let i = 0; i < headers.length; i++) {
    if (headers[i]) sourceIdxMap.set(headers[i], i);
  }

  // Build filter column indices
  const filterSpecs = filters.map((f) => ({
    colIdx: sourceIdxMap.get(f.column) ?? -1,
    operator: f.operator,
    value: f.value,
  }));

  const dataRows = rawRows.slice(headerIdx + 1);
  let totalRows = 0;
  let filteredOut = 0;
  const result: MappedRow[] = [];

  for (const row of dataRows) {
    // Skip empty rows
    if (!row.some((c: any) => String(c ?? "").trim())) continue;
    totalRows++;

    // Apply filters with AND/OR logic
    const activeFilters = filterSpecs.filter((f) => f.colIdx >= 0);
    let pass: boolean;
    if (activeFilters.length === 0) {
      pass = true;
    } else if (filterLogic === "AND") {
      pass = activeFilters.every((f) => {
        const val = String(row[f.colIdx] ?? "").trim();
        return f.operator === "==" ? val === f.value : val !== f.value;
      });
    } else {
      pass = activeFilters.some((f) => {
        const val = String(row[f.colIdx] ?? "").trim();
        return f.operator === "==" ? val === f.value : val !== f.value;
      });
    }
    if (!pass) { filteredOut++; continue; }

    // Map columns
    const mapped: MappedRow = {};
    for (const m of mappings) {
      const idx = sourceIdxMap.get(m.sourceColumn);
      if (idx != null) {
        mapped[m.targetField] = String(row[idx] ?? "").trim();
      }
    }
    result.push(mapped);
  }

  return { rows: result, totalRows, filteredOut };
}
