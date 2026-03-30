import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "../../_auth";
import { writeFileSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { STORAGE_DIR } from "../_storage";

const VALID_PATTERNS = [
  { prefix: "MIAS-IO-Plugin-", ext: ".package" },
  { prefix: "MIAS-Plugin-Setup-", ext: ".exe" },
];

function isValidFilename(name: string): boolean {
  return VALID_PATTERNS.some((p) => name.startsWith(p.prefix) && name.endsWith(p.ext));
}

/** POST /api/codesys/plugin/upload — requires API key, multipart form with "file" field */
export async function POST(req: NextRequest) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!isValidFilename(file.name)) {
      return NextResponse.json(
        { error: `Invalid filename "${file.name}" — expected MIAS-IO-Plugin-*.package or MIAS-Plugin-Setup-*.exe` },
        { status: 400 }
      );
    }

    // Remove old installers of the same type (keep only the new one)
    const pattern = VALID_PATTERNS.find((p) => file.name.startsWith(p.prefix))!;
    const existing = readdirSync(STORAGE_DIR).filter(
      (f) => f.startsWith(pattern.prefix) && f.endsWith(pattern.ext)
    );
    for (const old of existing) {
      unlinkSync(join(STORAGE_DIR, old));
    }

    // Write new installer
    const buffer = Buffer.from(await file.arrayBuffer());
    writeFileSync(join(STORAGE_DIR, file.name), buffer);

    return NextResponse.json({
      ok: true,
      filename: file.name,
      size: buffer.length,
    });
  } catch (err: any) {
    console.error("plugin upload error:", err);
    return NextResponse.json(
      { error: err.message ?? "Upload failed", storageDir: STORAGE_DIR },
      { status: 500 }
    );
  }
}
