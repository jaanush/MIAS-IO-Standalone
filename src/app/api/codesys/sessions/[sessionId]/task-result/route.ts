import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "../../../_auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  const { sessionId } = await params;
  const body = await req.json();
  const { taskId, status, log, error, data } = body;

  if (!taskId || !status) {
    return NextResponse.json({ error: "Missing taskId or status" }, { status: 400 });
  }

  // Verify session exists
  const session = await db.codesysSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Map plugin status to DB enum
  const dbStatus = status === "SUCCESS" ? "SUCCESS" : "FAILURE";

  await db.codesysTask.update({
    where: { id: taskId },
    data: {
      status: dbStatus,
      completedAt: new Date(),
      resultLog: Array.isArray(log) ? log : [],
      resultError: error ?? null,
      resultData: data ?? null,
    },
  });

  return NextResponse.json({ status: "ok" });
}
