import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { STORAGE_DIR } from "../_storage";
import { requireApiKeyOrSession } from "../../_auth";

const LOCAL_BUILD = join(process.cwd(), "..", "MIAS-Plugin");
const README_NAME = "README.md";

/** GET /api/codesys/plugin/readme — returns the plugin README markdown */
export async function GET() {
  // Check storage first, then local dev build
  for (const dir of [STORAGE_DIR, LOCAL_BUILD]) {
    const path = join(dir, README_NAME);
    if (existsSync(path)) {
      const content = readFileSync(path, "utf-8");
      return new NextResponse(content, {
        headers: { "Content-Type": "text/markdown; charset=utf-8" },
      });
    }
  }

  return NextResponse.json({ error: "No README found" }, { status: 404 });
}

/** POST /api/codesys/plugin/readme — upload a README.md (multipart form or raw text) */
export async function POST(req: NextRequest) {
  const authError = await requireApiKeyOrSession(req);
  if (authError) return authError;

  try {
    let content: string;
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      content = await file.text();
    } else {
      content = await req.text();
    }

    if (!content.trim()) {
      return NextResponse.json({ error: "Empty content" }, { status: 400 });
    }

    writeFileSync(join(STORAGE_DIR, README_NAME), content, "utf-8");
    return NextResponse.json({ ok: true, size: content.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Upload failed" }, { status: 500 });
  }
}
