/**
 * FR-007 — Plugin pulls active monitoring subscriptions every ~10 s and
 * reconciles its internal poll list. Skip subscriptions whose mode-specific
 * iec_path is NULL (codegen hasn't produced it yet).
 *
 * One entry per (signalId, mode) pair. SCALED resolves to signal.iecPath;
 * RAW resolves to signal.iecPathRaw.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "../../../../_auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  const { id } = await params;
  const projectId = Number(id);
  if (Number.isNaN(projectId)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  const subs = await db.signalMonitoring.findMany({
    where: { projectId, enabled: true },
    include: {
      signal: { select: { id: true, iecPath: true, iecPathRaw: true } },
    },
    orderBy: [{ signalId: "asc" }, { mode: "asc" }],
  });

  const subscriptions = subs
    .map((s) => {
      const iecPath = s.mode === "RAW" ? s.signal.iecPathRaw : s.signal.iecPath;
      if (!iecPath) return null;
      return {
        signalId: s.signalId,
        mode: s.mode,
        iecPath,
        intervalMs: s.intervalMs,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return NextResponse.json({
    projectId,
    fetchedAt: new Date().toISOString(),
    subscriptions,
  });
}
