/**
 * FR-007 — Plugin pushes batches of live readings (typically 1×/second).
 *
 * Body:
 *   { tsBatch: ISO, readings: [{ signalId, value, valueStr, iecType,
 *                                state, errorMsg?, tsPlugin: ISO }] }
 *
 * Server upserts each reading into signal_reading_live keyed by signalId.
 * One bad entry doesn't reject the batch — log it, persist the rest.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "../../../../_auth";

type IncomingReading = {
  signalId: number;
  /** "SCALED" (default — DAO output) or "RAW" (HAL input). Plugins not
   *  yet aware of the split may omit this; it falls back to SCALED. */
  mode?: "SCALED" | "RAW";
  value: unknown;
  valueStr?: string;
  iecType?: string;
  state: string;
  errorMsg?: string | null;
  tsPlugin: string;
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  const { id } = await params;
  const projectId = Number(id);
  if (Number.isNaN(projectId)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  let body: { tsBatch?: string; readings?: IncomingReading[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const readings = body.readings;
  if (!Array.isArray(readings)) {
    return NextResponse.json({ error: "Body must contain `readings` array" }, { status: 400 });
  }

  // Validate signals belong to this project once
  const ids = readings.map((r) => r.signalId).filter((n) => Number.isFinite(n));
  const validSignals = await db.signal.findMany({
    where: { id: { in: ids }, projectId },
    select: { id: true },
  });
  const validSet = new Set(validSignals.map((s) => s.id));

  let received = 0;
  const errors: Array<{ signalId: number; reason: string }> = [];
  for (const r of readings) {
    if (!validSet.has(r.signalId)) {
      errors.push({ signalId: r.signalId, reason: "Signal not in project" });
      continue;
    }
    let tsPlugin: Date;
    try {
      tsPlugin = new Date(r.tsPlugin);
      if (Number.isNaN(tsPlugin.getTime())) throw new Error("Invalid tsPlugin");
    } catch {
      errors.push({ signalId: r.signalId, reason: "Invalid tsPlugin" });
      continue;
    }
    try {
      // Cast value through JSON.parse(JSON.stringify(...)) to satisfy Prisma's
      // InputJsonValue type while preserving the runtime shape.
      const jsonValue = r.value === undefined ? null : JSON.parse(JSON.stringify(r.value));
      const mode = r.mode === "RAW" ? "RAW" : "SCALED";
      await db.signalReadingLive.upsert({
        where: { signalId_mode: { signalId: r.signalId, mode } },
        create: {
          signalId: r.signalId,
          mode,
          value: jsonValue,
          valueStr: String(r.valueStr ?? ""),
          iecType: r.iecType ?? "",
          state: r.state,
          errorMsg: r.errorMsg ?? null,
          tsPlugin,
        },
        update: {
          value: jsonValue,
          valueStr: String(r.valueStr ?? ""),
          iecType: r.iecType ?? "",
          state: r.state,
          errorMsg: r.errorMsg ?? null,
          tsPlugin,
        },
      });
      received++;
    } catch (e) {
      errors.push({ signalId: r.signalId, reason: e instanceof Error ? e.message : "Upsert failed" });
    }
  }

  return NextResponse.json({ ok: true, received, errors });
}
