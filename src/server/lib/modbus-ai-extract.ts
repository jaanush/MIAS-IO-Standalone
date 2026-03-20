/**
 * AI-powered Modbus register map extraction.
 * Sends a document (PDF/Excel/image) to Claude API and extracts
 * structured register definitions.
 */

export interface ExtractedRegister {
  address: number;
  registerType: "HOLDING_REGISTER" | "INPUT_REGISTER" | "COIL" | "DISCRETE_INPUT";
  dataType: "INT16" | "UINT16" | "INT32" | "UINT32" | "FLOAT32" | "BOOL" | "WORD" | "DWORD";
  name: string;
  description: string;
  unit: string | null;
  scaleFactor: number | null;
  offset: number | null;
  readWrite: "R" | "W" | "RW";
  bitPosition: number | null; // for BOOL within a register
}

export interface ExtractionResult {
  registers: ExtractedRegister[];
  deviceName: string | null;
  protocol: string | null;
  notes: string | null;
}

const EXTRACTION_PROMPT = `You are a Modbus register map parser. Extract ALL registers from the provided document into structured JSON.

For each register, extract:
- address: the Modbus register address (integer)
- registerType: one of HOLDING_REGISTER, INPUT_REGISTER, COIL, DISCRETE_INPUT
- dataType: one of INT16, UINT16, INT32, UINT32, FLOAT32, BOOL, WORD, DWORD
- name: short PLC-safe variable name (no spaces, use underscores)
- description: human-readable description
- unit: engineering unit (°C, bar, RPM, %, V, A, kW, etc.) or null
- scaleFactor: multiply raw value by this to get engineering units, or null
- offset: add this after scaling, or null
- readWrite: R (read-only), W (write-only), or RW (read-write)
- bitPosition: for boolean signals packed in a register (0-15), or null

Also extract:
- deviceName: the device/equipment name if mentioned
- protocol: "MODBUS_RTU" or "MODBUS_TCP" if specified
- notes: any important notes about the register map

Rules:
- If register type is not specified, assume HOLDING_REGISTER for read-write and INPUT_REGISTER for read-only
- If data type is not specified, assume UINT16 for single registers, FLOAT32 for pairs
- For 32-bit values spanning 2 registers, use the first register address
- Convert hex addresses to decimal
- Include ALL registers, don't skip any

Respond with ONLY valid JSON matching this schema:
{
  "registers": [...],
  "deviceName": "...",
  "protocol": "...",
  "notes": "..."
}`;

/**
 * Try to parse a structured Excel Modbus register list directly (no AI needed).
 * Returns null if the file doesn't match the expected column structure.
 */
async function tryDirectExcelParse(fileBase64: string, fileName: string, selectedSheets?: string[]): Promise<ExtractionResult | null> {
  if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) return null;

  const XLSX = await import("xlsx");
  const buf = Buffer.from(fileBase64, "base64");
  const wb = XLSX.read(buf, { type: "buffer" });

  const registers: ExtractedRegister[] = [];
  let deviceName: string | null = null;

  const sheetsToProcess = selectedSheets?.length
    ? wb.SheetNames.filter((n) => selectedSheets.includes(n))
    : wb.SheetNames;

  for (const sheetName of sheetsToProcess) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
    if (rows.length < 2) continue;

    // Look for header row with "Modbus Address" or "Register" columns
    let headerIdx = -1;
    let colMap: Record<string, number> = {};
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const cells = rows[i].map((c: any) => String(c ?? "").toLowerCase().trim());
      const addrCol = cells.findIndex((c: string) => c.includes("modbus address") || c.includes("register address") || c === "address");
      const nameCol = cells.findIndex((c: string) => c.includes("signal name") || c.includes("name") || c.includes("tag"));
      if (addrCol >= 0 && nameCol >= 0) {
        headerIdx = i;
        colMap = {
          address: addrCol,
          regType: cells.findIndex((c: string) => c.includes("register type") || c === "type"),
          bit: cells.findIndex((c: string) => c === "bit" || c.includes("bit pos")),
          name: nameCol,
          description: cells.findIndex((c: string) => c.includes("description") || c.includes("signal description")),
          dataType: cells.findIndex((c: string) => c.includes("data type")),
          access: cells.findIndex((c: string) => c.includes("access") || c === "r/w"),
          unit: cells.findIndex((c: string) => c === "unit" || c.includes("unit")),
          scale: cells.findIndex((c: string) => c.includes("scale")),
        };
        break;
      }
    }

    if (headerIdx < 0) continue;

    // Extract device name from sheet name
    if (!deviceName) deviceName = sheetName.replace(/_?(ReadOnly|ReadWrite|RO|RW)$/i, "").replace(/_/g, " ").trim();

    const get = (row: any[], key: string) => {
      const idx = colMap[key];
      return idx >= 0 ? String(row[idx] ?? "").trim() : "";
    };

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const addrStr = get(row, "address");
      if (!addrStr || !/^\d+$/.test(addrStr)) continue;

      const address = parseInt(addrStr, 10);
      const rawName = get(row, "name");
      if (!rawName) continue;

      const name = rawName.replace(/[^A-Za-z0-9_]/g, "_").substring(0, 100);
      const desc = get(row, "description") || rawName;
      const rawType = get(row, "regType").toLowerCase();
      const rawAccess = get(row, "access").toUpperCase();
      const rawDataType = get(row, "dataType").toUpperCase();
      const bitStr = get(row, "bit");
      const unit = get(row, "unit") || null;
      const scaleStr = get(row, "scale");

      const registerType: ExtractedRegister["registerType"] =
        rawType.includes("holding") ? "HOLDING_REGISTER" :
        rawType.includes("input") ? "INPUT_REGISTER" :
        address >= 40000 ? "HOLDING_REGISTER" :
        address >= 30000 ? "INPUT_REGISTER" :
        address >= 10000 ? "DISCRETE_INPUT" :
        "COIL";

      const readWrite: ExtractedRegister["readWrite"] =
        rawAccess.includes("W") && rawAccess.includes("R") ? "RW" :
        rawAccess.includes("W") ? "W" : "R";

      const bitPosition = bitStr && bitStr !== "--" && bitStr !== "" ? parseInt(bitStr, 10) : null;

      const dataType: ExtractedRegister["dataType"] =
        rawDataType === "BOOL" || bitPosition != null ? "BOOL" :
        rawDataType === "INT" || rawDataType === "INT16" ? "INT16" :
        rawDataType === "UINT" || rawDataType === "UINT16" || rawDataType === "WORD" ? "UINT16" :
        rawDataType === "DINT" || rawDataType === "INT32" ? "INT32" :
        rawDataType === "UDINT" || rawDataType === "UINT32" || rawDataType === "DWORD" ? "UINT32" :
        rawDataType === "REAL" || rawDataType === "FLOAT" || rawDataType === "FLOAT32" ? "FLOAT32" :
        "INT16";

      const scaleFactor = scaleStr && scaleStr !== "1" && scaleStr !== "" ? parseFloat(scaleStr) : null;

      registers.push({
        address,
        registerType,
        dataType,
        name,
        description: desc,
        unit,
        scaleFactor: isNaN(scaleFactor ?? 0) ? null : scaleFactor,
        offset: null,
        readWrite,
        bitPosition: isNaN(bitPosition ?? 0) ? null : bitPosition,
      });
    }
  }

  if (registers.length === 0) return null;

  return {
    registers,
    deviceName,
    protocol: "MODBUS_RTU",
    notes: `Direct parse from ${wb.SheetNames.length} sheets, ${registers.length} registers extracted`,
  };
}

export async function extractModbusRegisters(
  fileBase64: string,
  fileName: string,
  mimeType: string,
  selectedSheets?: string[],
): Promise<ExtractionResult> {
  // Try direct Excel parsing first (faster, free, handles large files)
  const directResult = await tryDirectExcelParse(fileBase64, fileName, selectedSheets);
  if (directResult) return directResult;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured. Add it to your environment variables.");
  }

  // Build the message content based on file type
  const content: any[] = [
    { type: "text", text: EXTRACTION_PROMPT },
  ];

  if (mimeType.startsWith("image/") || mimeType === "application/pdf") {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mimeType,
        data: fileBase64,
      },
    });
  } else if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    fileName.endsWith(".xlsx") ||
    fileName.endsWith(".xls")
  ) {
    // Excel files: parse server-side with xlsx, convert to readable text for the AI
    const XLSX = await import("xlsx");
    const buf = Buffer.from(fileBase64, "base64");
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheets: string[] = [];
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
      const lines = rows.map((r) => r.map((c: any) => String(c ?? "")).join("\t")).join("\n");
      sheets.push(`=== Sheet: ${name} ===\n${lines}`);
    }
    const text = sheets.join("\n\n");
    // Claude's context can handle ~200K chars; use more for large register maps
    content.push({
      type: "text",
      text: `\n\n--- DOCUMENT CONTENT (${fileName}) ---\n${text.substring(0, 200000)}`,
    });
  } else {
    // CSV/text files — decode as UTF-8
    const text = Buffer.from(fileBase64, "base64").toString("utf-8");
    content.push({
      type: "text",
      text: `\n\n--- DOCUMENT CONTENT (${fileName}) ---\n${text.substring(0, 100000)}`,
    });
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error (${response.status}): ${err.substring(0, 300)}`);
  }

  const result = await response.json();
  const text = result.content?.[0]?.text ?? "";

  // Extract JSON from response (may be wrapped in ```json blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse AI response as JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]) as ExtractionResult;

  // Validate and sanitize
  if (!Array.isArray(parsed.registers)) {
    throw new Error("AI response missing registers array");
  }

  for (const reg of parsed.registers) {
    // Ensure valid register types
    if (!["HOLDING_REGISTER", "INPUT_REGISTER", "COIL", "DISCRETE_INPUT"].includes(reg.registerType)) {
      reg.registerType = "HOLDING_REGISTER";
    }
    if (!["INT16", "UINT16", "INT32", "UINT32", "FLOAT32", "BOOL", "WORD", "DWORD"].includes(reg.dataType)) {
      reg.dataType = "UINT16";
    }
    if (!["R", "W", "RW"].includes(reg.readWrite)) {
      reg.readWrite = "R";
    }
    // Sanitize name to be PLC-safe
    reg.name = reg.name.replace(/[^A-Za-z0-9_]/g, "_").substring(0, 100);
  }

  return parsed;
}
