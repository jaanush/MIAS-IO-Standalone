import { NextRequest, NextResponse } from "next/server";
import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

const LOCAL_BUILD = join(process.cwd(), "..", "MIAS-Plugin", "build");
const STORAGE_DIR = join(process.cwd(), "storage", "plugin");

function extractVersion(filename: string): string | null {
  // MIAS-IO-Plugin-1.2.3.package or MIAS-Plugin-Setup-1.2.3.exe
  const m = filename.match(/(\d+\.\d+\.\d+)/);
  return m ? m[1] : null;
}

type PackageInfo = {
  filename: string;
  version: string;
  size: number;
  downloadUrl: string;
};

function findPackages(baseUrl: string): PackageInfo[] {
  const results: PackageInfo[] = [];
  for (const dir of [STORAGE_DIR, LOCAL_BUILD]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.startsWith("MIAS-IO-Plugin-") && !f.startsWith("MIAS-Plugin-Setup-")) continue;
      if (!f.endsWith(".package") && !f.endsWith(".exe")) continue;
      const version = extractVersion(f);
      if (!version) continue;
      // Skip if we already have this version (storage takes priority over local)
      if (results.some((r) => r.version === version)) continue;
      const stat = statSync(join(dir, f));
      results.push({
        filename: f,
        version,
        size: stat.size,
        downloadUrl: `${baseUrl}/api/codesys/plugin/download`,
      });
    }
  }
  return results.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
}

/** GET /api/codesys/plugin/repository — public, no auth
 *  Returns available plugin packages. Can be used by CODESYS Package Manager
 *  or the MIAS-IO web UI to check for updates.
 */
export async function GET(req: NextRequest) {
  const baseUrl = req.headers.get("x-forwarded-proto") && req.headers.get("host")
    ? `${req.headers.get("x-forwarded-proto")}://${req.headers.get("host")}`
    : req.nextUrl.origin;

  const packages = findPackages(baseUrl);
  const latest = packages[0] ?? null;

  return NextResponse.json({
    latest: latest ? { version: latest.version, filename: latest.filename, size: latest.size, downloadUrl: latest.downloadUrl } : null,
    packages,
  });
}
