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

export async function extractModbusRegisters(
  fileBase64: string,
  fileName: string,
  mimeType: string,
): Promise<ExtractionResult> {
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
    content.push({
      type: "text",
      text: `\n\n--- DOCUMENT CONTENT (${fileName}) ---\n${text.substring(0, 100000)}`,
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
