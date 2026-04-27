/**
 * FR-007 / FR-011 — Plugin pushes resolved IEC paths after each codegen run.
 *
 * Body accepts a mixed `paths` array of two entry kinds:
 *
 *   Signal entry (FR-007):
 *     { signalId, iecPath: string|null, iecPathRaw?: string|null }
 *
 *   Alarm entry (FR-011, Option A):
 *     { alarmId, alarmKind: "discrete"|"analog", iecAlarmPath: string|null }
 *
 * Each entry upserts the matching column. Per-entry errors don't reject
 * the batch — invalid signalIds / alarmIds are reported in `errors[]` and
 * the rest proceed. NULL clears a previously-resolved path.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "../../../_auth";

type SignalEntry = {
  signalId: number;
  iecPath?: string | null;
  iecPathRaw?: string | null;
};

type AlarmEntry = {
  alarmId: number;
  alarmKind: "discrete" | "analog";
  iecAlarmPath?: string | null;
};

type Entry = SignalEntry | AlarmEntry;

function isAlarm(e: Entry): e is AlarmEntry {
  return typeof (e as AlarmEntry).alarmId === "number";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  const { id } = await params;
  const projectId = Number(id);
  if (Number.isNaN(projectId)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  let body: { paths?: Entry[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const paths = body.paths;
  if (!Array.isArray(paths)) {
    return NextResponse.json({ error: "Body must contain `paths` array" }, { status: 400 });
  }

  // Pre-validate signal ids and alarm ids in this project so per-entry
  // membership checks are O(1).
  const signalIds = paths
    .filter((e): e is SignalEntry => !isAlarm(e))
    .map((e) => e.signalId)
    .filter((n) => Number.isFinite(n));
  const discreteAlarmIds = paths
    .filter((e): e is AlarmEntry => isAlarm(e) && e.alarmKind === "discrete")
    .map((e) => e.alarmId)
    .filter((n) => Number.isFinite(n));
  const analogAlarmIds = paths
    .filter((e): e is AlarmEntry => isAlarm(e) && e.alarmKind === "analog")
    .map((e) => e.alarmId)
    .filter((n) => Number.isFinite(n));

  const [validSignals, validDiscreteAlarms, validAnalogAlarms] = await Promise.all([
    signalIds.length === 0
      ? []
      : db.signal.findMany({
          where: { id: { in: signalIds }, projectId },
          select: { id: true },
        }),
    discreteAlarmIds.length === 0
      ? []
      : db.discreteAlarm.findMany({
          where: { id: { in: discreteAlarmIds }, signal: { signal: { projectId } } },
          select: { id: true },
        }),
    analogAlarmIds.length === 0
      ? []
      : db.analogAlarm.findMany({
          where: { id: { in: analogAlarmIds }, signal: { signal: { projectId } } },
          select: { id: true },
        }),
  ]);
  const signalSet = new Set(validSignals.map((s) => s.id));
  const discreteSet = new Set(validDiscreteAlarms.map((a) => a.id));
  const analogSet = new Set(validAnalogAlarms.map((a) => a.id));

  let updatedSignals = 0;
  let updatedAlarms = 0;
  const errors: Array<{
    signalId?: number;
    alarmId?: number;
    alarmKind?: "discrete" | "analog";
    reason: string;
  }> = [];

  for (const entry of paths) {
    if (isAlarm(entry)) {
      const set = entry.alarmKind === "discrete" ? discreteSet : analogSet;
      if (!set.has(entry.alarmId)) {
        errors.push({
          alarmId: entry.alarmId,
          alarmKind: entry.alarmKind,
          reason: "Alarm not in project or does not exist",
        });
        continue;
      }
      try {
        const data: { iecAlarmPath?: string | null } = {};
        if ("iecAlarmPath" in entry) data.iecAlarmPath = entry.iecAlarmPath ?? null;
        if (entry.alarmKind === "discrete") {
          await db.discreteAlarm.update({ where: { id: entry.alarmId }, data });
        } else {
          await db.analogAlarm.update({ where: { id: entry.alarmId }, data });
        }
        updatedAlarms++;
      } catch (e) {
        errors.push({
          alarmId: entry.alarmId,
          alarmKind: entry.alarmKind,
          reason: e instanceof Error ? e.message : "Update failed",
        });
      }
    } else {
      if (!signalSet.has(entry.signalId)) {
        errors.push({
          signalId: entry.signalId,
          reason: "Signal not in project or does not exist",
        });
        continue;
      }
      try {
        const data: { iecPath?: string | null; iecPathRaw?: string | null } = {};
        if ("iecPath" in entry) data.iecPath = entry.iecPath ?? null;
        if ("iecPathRaw" in entry) data.iecPathRaw = entry.iecPathRaw ?? null;
        await db.signal.update({ where: { id: entry.signalId }, data });
        updatedSignals++;
      } catch (e) {
        errors.push({
          signalId: entry.signalId,
          reason: e instanceof Error ? e.message : "Update failed",
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    updated: updatedSignals + updatedAlarms,
    updatedSignals,
    updatedAlarms,
    errors,
  });
}
