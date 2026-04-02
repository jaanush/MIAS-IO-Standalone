import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

/** Require API key only — used for plugin-only endpoints */
export function requireApiKey(req: NextRequest): NextResponse | null {
  const expected = process.env.CODESYS_API_KEY;
  if (!expected || expected === "change-me") {
    return NextResponse.json({ error: "Server misconfiguration: CODESYS_API_KEY not set" }, { status: 500 });
  }
  const provided = req.headers.get("x-api-key");
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** Accept either API key (plugin) OR session cookie (web UI) */
export async function requireApiKeyOrSession(req: NextRequest): Promise<NextResponse | null> {
  // Try API key first
  const apiKey = req.headers.get("x-api-key");
  const expected = process.env.CODESYS_API_KEY;
  if (apiKey && expected && expected !== "change-me" && apiKey === expected) {
    return null; // API key valid
  }

  // Fall back to session cookie
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    const session = await verifySessionToken(token);
    if (session) return null; // Session valid
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
