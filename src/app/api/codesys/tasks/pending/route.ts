import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "../../_auth";

export async function GET(req: NextRequest) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  // Atomically claim all QUEUED tasks — single round-trip, no race condition
  const tasks = await db.$queryRaw<
    { id: string; project_id: number; type: string; params: unknown; created_at: Date }[]
  >`
    UPDATE codesys_task
    SET status = 'CLAIMED'::"codesys_task_status",
        claimed_at = now(),
        updated_at = now()
    WHERE status = 'QUEUED'::"codesys_task_status"
    RETURNING id, project_id, type, params, created_at
  `;

  const body = tasks.map((t) => ({
    id: t.id,
    projectId: t.project_id,
    type: t.type,
    params: t.params ?? {},
    createdAt: t.created_at,
  }));

  return NextResponse.json(body);
}
