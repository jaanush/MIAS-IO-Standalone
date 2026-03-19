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

  // Update session with heartbeat + project state + optional metadata
  const updateData: Record<string, unknown> = {
    lastHeartbeatAt: new Date(),
    projectOpen: body.projectOpen ?? false,
    projectPath: body.projectPath ?? null,
    miasProjectId: body.miasProjectId ?? null,
  };
  // Only update metadata when provided (most heartbeats omit it)
  if (body.metadata) {
    updateData.metadata = body.metadata;
  }

  const session = await db.codesysSession.update({
    where: { id: sessionId },
    data: updateData,
  }).catch(() => null);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Claim queued tasks belonging to this session's user only
  const tasks = session.userId
    ? await db.$queryRaw<
        { id: string; project_id: number; type: string; params: unknown }[]
      >`
        UPDATE codesys_task
        SET status = 'CLAIMED'::"codesys_task_status",
            claimed_at = now(),
            updated_at = now()
        WHERE status = 'QUEUED'::"codesys_task_status"
          AND created_by = ${session.userId}::uuid
        RETURNING id, project_id, type, params
      `
    : [];

  // Check for plugin update
  let updateAvailable = false;
  let latestVersion: string | null = null;
  try {
    const { readFileSync, existsSync } = await import("fs");
    const { join } = await import("path");
    const versionFile = join(process.cwd(), "..", "MIAS-Plugin", "VERSION");
    if (existsSync(versionFile)) {
      latestVersion = readFileSync(versionFile, "utf-8").trim();
      if (latestVersion && session.pluginVersion && latestVersion !== session.pluginVersion) {
        updateAvailable = true;
      }
    }
  } catch {}

  return NextResponse.json({
    status: "ok",
    tasks: (tasks as any[]).map((t) => ({
      id: t.id,
      projectId: t.project_id,
      type: t.type,
      params: t.params ?? {},
    })),
    ...(latestVersion ? { latestVersion, updateAvailable } : {}),
  });
}
