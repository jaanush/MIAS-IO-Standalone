import { NextRequest, NextResponse } from "next/server";

// In-memory flag — lives as long as the old container is running.
// Resets when the new container takes over (fresh process).
let deployPending = false;
let deployMessage = "";
let deployAt: number | null = null;

export function isDeployPending() {
  return { deployPending, deployMessage, deployAt };
}

/** POST /api/deploy/notify — called by deploy script before starting */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (apiKey !== process.env.CODESYS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  deployPending = true;
  deployMessage = body.message ?? "A new version is being deployed. Please save your work.";
  deployAt = Date.now();

  return NextResponse.json({ ok: true });
}

/** DELETE /api/deploy/notify — cancel notification (optional) */
export async function DELETE(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (apiKey !== process.env.CODESYS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  deployPending = false;
  deployMessage = "";
  deployAt = null;

  return NextResponse.json({ ok: true });
}
