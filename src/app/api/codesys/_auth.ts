import { NextRequest, NextResponse } from "next/server";

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
