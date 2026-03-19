import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "../../_auth";
import { readFileSync, existsSync } from "fs";
import { join, normalize, relative } from "path";

const PLUGIN_ROOT = join(process.cwd(), "..", "MIAS-Plugin");
const MANAGED_DIRS = ["lib", "scripts"];

export async function GET(req: NextRequest) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  const filePath = req.nextUrl.searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }

  // Security: ensure path is within managed dirs and doesn't escape
  const normalized = normalize(filePath).replace(/\\/g, "/");
  const isManaged = MANAGED_DIRS.some((d) => normalized.startsWith(d + "/"));
  if (!isManaged || normalized.includes("..")) {
    return NextResponse.json({ error: "Path not in managed directories" }, { status: 400 });
  }

  const fullPath = join(PLUGIN_ROOT, normalized);

  // Double-check resolved path is still under PLUGIN_ROOT
  const resolved = normalize(fullPath);
  if (!resolved.startsWith(normalize(PLUGIN_ROOT))) {
    return NextResponse.json({ error: "Path traversal detected" }, { status: 400 });
  }

  if (!existsSync(fullPath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const content = readFileSync(fullPath);
  return new NextResponse(content, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${normalized.split("/").pop()}"`,
    },
  });
}
