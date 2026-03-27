import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "../../_auth";
import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { createHash } from "crypto";
import { join, relative } from "path";

const PLUGIN_ROOT = join(process.cwd(), "..", "MIAS-Plugin");
const MANAGED_DIRS = ["lib", "scripts", "staging"];
// Individual root-level files to include in the manifest
const MANAGED_FILES = ["VERSION", "MetsPlugin.Views.dll"];

function getPluginVersion(): string {
  // Try VERSION file first
  const versionFile = join(PLUGIN_ROOT, "VERSION");
  if (existsSync(versionFile)) {
    return readFileSync(versionFile, "utf-8").trim();
  }
  return "0.0.0";
}

function collectFiles(dir: string, base: string): { path: string; sha256: string; size: number }[] {
  const results: { path: string; sha256: string; size: number }[] = [];
  if (!existsSync(dir)) return results;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__pycache__" || entry.name === ".git") continue;
      results.push(...collectFiles(fullPath, base));
    } else if (entry.isFile()) {
      const content = readFileSync(fullPath);
      const sha256 = createHash("sha256").update(content).digest("hex");
      const relPath = relative(base, fullPath).replace(/\\/g, "/");
      results.push({ path: relPath, sha256, size: content.length });
    }
  }
  return results;
}

export async function GET(req: NextRequest) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  if (!existsSync(PLUGIN_ROOT)) {
    return NextResponse.json(
      { error: "MIAS-Plugin repo not found at " + PLUGIN_ROOT },
      { status: 503 }
    );
  }

  const version = getPluginVersion();
  const files: { path: string; sha256: string; size: number }[] = [];

  for (const dir of MANAGED_DIRS) {
    files.push(...collectFiles(join(PLUGIN_ROOT, dir), PLUGIN_ROOT));
  }

  // Add individual root-level managed files
  for (const fname of MANAGED_FILES) {
    const fullPath = join(PLUGIN_ROOT, fname);
    if (existsSync(fullPath) && statSync(fullPath).isFile()) {
      const content = readFileSync(fullPath);
      const sha256 = createHash("sha256").update(content).digest("hex");
      files.push({ path: fname, sha256, size: content.length });
    }
  }

  files.sort((a, b) => a.path.localeCompare(b.path));

  return NextResponse.json({ version, files });
}
