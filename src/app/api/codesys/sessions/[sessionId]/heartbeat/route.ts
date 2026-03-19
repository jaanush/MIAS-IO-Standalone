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

  // Update session with heartbeat + project state
  const session = await db.codesysSession.update({
    where: { id: sessionId },
    data: {
      lastHeartbeatAt: new Date(),
      projectOpen: body.projectOpen ?? false,
      projectPath: body.projectPath ?? null,
      miasProjectId: body.miasProjectId ?? null,
    },
  }).catch(() => null);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Fetch pending tasks for this session's project
  const tasks = session.miasProjectId
    ? await db.$queryRaw<
        { id: string; project_id: number; type: string; params: unknown }[]
      >`
        UPDATE codesys_task
        SET status = 'CLAIMED'::"codesys_task_status",
            claimed_at = now(),
            updated_at = now()
        WHERE status = 'QUEUED'::"codesys_task_status"
          AND project_id = ${session.miasProjectId}
        RETURNING id, project_id, type, params
      `
    : [];

  return NextResponse.json({
    status: "ok",
    tasks: (tasks as any[]).map((t) => ({
      id: t.id,
      projectId: t.project_id,
      type: t.type,
      params: t.params ?? {},
    })),
  });
}
