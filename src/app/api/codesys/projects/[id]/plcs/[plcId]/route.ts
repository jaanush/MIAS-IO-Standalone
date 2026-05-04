import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "../../../../_auth";

/**
 * PATCH /api/codesys/projects/{id}/plcs/{plcId}  (FR-021)
 *
 * Partial update of PLC configuration values that the plugin owns.
 * Today only `kbusCycleTimeMs` — the PFC200 K-bus device parameter
 * Id=128. More fields can be added here as plugin needs grow.
 *
 * Body:
 *   { "kbusCycleTimeMs": number | null }     // null = use device default (10 ms)
 *
 * Validation:
 *   - null is allowed (clears the override; renderer leaves the device default in place)
 *   - integer in [1, 50] (per WAGO Kbus device parameter limits)
 *
 * Verifies the plcId belongs to the named project.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; plcId: string }> },
) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  const { id, plcId } = await params;
  const projectId = Number(id);
  const plcIdNum = Number(plcId);
  if (!Number.isFinite(projectId) || !Number.isFinite(plcIdNum)) {
    return NextResponse.json({ error: "Invalid project id or PLC id" }, { status: 400 });
  }

  let body: { kbusCycleTimeMs?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!("kbusCycleTimeMs" in body)) {
    return NextResponse.json(
      { error: "Body must contain 'kbusCycleTimeMs' (number | null)" },
      { status: 400 },
    );
  }

  const v = body.kbusCycleTimeMs;
  if (v !== null) {
    if (typeof v !== "number" || !Number.isInteger(v)) {
      return NextResponse.json(
        { error: "'kbusCycleTimeMs' must be an integer or null" },
        { status: 400 },
      );
    }
    if (v < 1 || v > 50) {
      return NextResponse.json(
        { error: "'kbusCycleTimeMs' must be in range 1..50" },
        { status: 400 },
      );
    }
  }

  const plc = await db.plc.findUnique({
    where: { id: plcIdNum },
    select: { id: true, projectId: true },
  });
  if (!plc) return NextResponse.json({ error: `PLC ${plcIdNum} not found` }, { status: 404 });
  if (plc.projectId !== projectId) {
    return NextResponse.json(
      { error: `PLC ${plcIdNum} does not belong to project ${projectId}` },
      { status: 400 },
    );
  }

  const updated = await db.plc.update({
    where: { id: plcIdNum },
    data: { kbusCycleTimeMs: v as number | null },
    select: { id: true, name: true, kbusCycleTimeMs: true },
  });

  return NextResponse.json({
    accepted: true,
    plc: {
      id: updated.id,
      name: updated.name,
      kbusCycleTimeMs: updated.kbusCycleTimeMs,
    },
  });
}
