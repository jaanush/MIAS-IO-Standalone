import { NextResponse } from "next/server";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { STORAGE_DIR } from "../_storage";

// Check both persistent storage and local dev path
const LOCAL_BUILD = join(process.cwd(), "..", "MIAS-Plugin", "build");

// Match both .package (CODESYS Package Manager) and .exe (legacy installer)
const PATTERNS = [
  { prefix: "MIAS-IO-Plugin-", ext: ".package" },
  { prefix: "MIAS-Plugin-Setup-", ext: ".exe" },
];

function findLatestInstaller(): { path: string; name: string } | null {
  for (const dir of [STORAGE_DIR, LOCAL_BUILD]) {
    if (!existsSync(dir)) continue;
    const entries = readdirSync(dir);
    for (const { prefix, ext } of PATTERNS) {
      const files = entries
        .filter((f) => f.startsWith(prefix) && f.endsWith(ext))
        .sort()
        .reverse();
      if (files.length > 0) return { path: join(dir, files[0]), name: files[0] };
    }
  }
  return null;
}

/** GET /api/codesys/plugin/download — public, no auth */
export async function GET() {
  const installer = findLatestInstaller();
  if (!installer) {
    return NextResponse.json(
      { error: "No installer available" },
      { status: 404 }
    );
  }

  const content = readFileSync(installer.path);
  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${installer.name}"`,
      "Content-Length": String(content.length),
    },
  });
}
