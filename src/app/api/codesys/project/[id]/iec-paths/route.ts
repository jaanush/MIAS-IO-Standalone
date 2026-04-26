/**
 * FR-007 — Plugin pushes resolved IEC paths after each codegen run.
 *
 * Body:
 *   { paths: [{ signalId: number, iecPath: string | null }, ...] }
 *
 * Each entry upserts signal.iec_path. One bad entry doesn't reject the batch
 * — invalid signalIds (not in this project) are skipped and reported as
 * `errors`. NULL clears a previously-resolved path so the signal drops out
 * of monitoring subscriptions.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "../../../_auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  const { id } = await params;
  const projectId = Number(id);
  if (Number.isNaN(projectId)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  let body: {
    paths?: Array<{
      signalId: number;
      iecPath: string | null;
      iecPathRaw?: string | null;
    }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const paths = body.paths;
  if (!Array.isArray(paths)) {
    return NextResponse.json({ error: "Body must contain `paths` array" }, { status: 400 });
  }

  // Restrict updates to signals that actually belong to this project
  const ids = paths.map((p) => p.signalId).filter((n) => Number.isFinite(n));
  const validSignals = await db.signal.findMany({
    where: { id: { in: ids }, projectId },
    select: { id: true },
  });
  const validSet = new Set(validSignals.map((s) => s.id));

  let updated = 0;
  const errors: Array<{ signalId: number; reason: string }> = [];
  for (const entry of paths) {
    if (!validSet.has(entry.signalId)) {
      errors.push({ signalId: entry.signalId, reason: "Signal not in project or does not exist" });
      continue;
    }
    try {
      // Only touch fields present in the entry; missing keys leave the
      // existing path alone (so plugins can update one mode at a time).
      const data: { iecPath?: string | null; iecPathRaw?: string | null } = {};
      if ("iecPath" in entry) data.iecPath = entry.iecPath ?? null;
      if ("iecPathRaw" in entry) data.iecPathRaw = entry.iecPathRaw ?? null;
      await db.signal.update({ where: { id: entry.signalId }, data });
      updated++;
    } catch (e) {
      errors.push({ signalId: entry.signalId, reason: e instanceof Error ? e.message : "Update failed" });
    }
  }

  return NextResponse.json({ ok: true, updated, errors });
}
