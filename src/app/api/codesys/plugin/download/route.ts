import { NextResponse } from "next/server";
import { existsSync, readdirSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";

// Check both local dev path and persistent storage
const LOCAL_BUILD = join(process.cwd(), "..", "MIAS-Plugin", "build");
const STORAGE_DIR = join(process.cwd(), "storage", "plugin");

function findLatestInstaller(): { path: string; name: string } | null {
  for (const dir of [STORAGE_DIR, LOCAL_BUILD]) {
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir)
      .filter((f) => f.startsWith("MIAS-Plugin-Setup-") && f.endsWith(".exe"))
      .sort()
      .reverse();
    if (files.length > 0) return { path: join(dir, files[0]), name: files[0] };
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
