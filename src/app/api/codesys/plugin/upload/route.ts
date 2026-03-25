import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "../../_auth";
import { existsSync, mkdirSync, writeFileSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";

const STORAGE_DIR = join(process.cwd(), "storage", "plugin");

/** POST /api/codesys/plugin/upload — requires API key, multipart form with "file" field */
export async function POST(req: NextRequest) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!file.name.startsWith("MIAS-Plugin-Setup-") || !file.name.endsWith(".exe")) {
    return NextResponse.json(
      { error: "Invalid filename — expected MIAS-Plugin-Setup-X.Y.Z.exe" },
      { status: 400 }
    );
  }

  // Ensure storage dir exists
  if (!existsSync(STORAGE_DIR)) {
    mkdirSync(STORAGE_DIR, { recursive: true });
  }

  // Remove old installers (keep only the new one)
  const existing = readdirSync(STORAGE_DIR).filter(
    (f) => f.startsWith("MIAS-Plugin-Setup-") && f.endsWith(".exe")
  );
  for (const old of existing) {
    unlinkSync(join(STORAGE_DIR, old));
  }

  // Write new installer
  const buffer = Buffer.from(await file.arrayBuffer());
  const dest = join(STORAGE_DIR, file.name);
  writeFileSync(dest, buffer);

  return NextResponse.json({
    ok: true,
    filename: file.name,
    size: buffer.length,
  });
}
