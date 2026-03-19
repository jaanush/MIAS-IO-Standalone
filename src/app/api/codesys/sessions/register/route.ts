import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "../../_auth";

export async function POST(req: NextRequest) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  const body = await req.json();
  const { email, hostname, pluginVersion } = body;

  if (!email || !hostname || !pluginVersion) {
    return NextResponse.json(
      { error: "Missing required fields: email, hostname, pluginVersion" },
      { status: 400 }
    );
  }

  // Try to match email to a MIAS-IO user
  const user = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });

  // Expire any existing sessions from this hostname
  await db.codesysSession.updateMany({
    where: { hostname, disconnectedAt: null },
    data: { disconnectedAt: new Date() },
  });

  const session = await db.codesysSession.create({
    data: {
      userId: user?.id ?? null,
      email,
      hostname,
      pluginVersion,
      pollInterval: 10,
    },
  });

  return NextResponse.json({
    sessionId: session.id,
    userId: user?.id ?? null,
    pollInterval: session.pollInterval,
  });
}
