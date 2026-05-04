import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "../../../../_auth";

/**
 * PATCH /api/codesys/projects/{id}/can-buses/{busId}
 *
 * Partial update of CAN-bus configuration values that the plugin owns.
 * Today supports `cyclicCallIntervalMs` (FR-019), `canRole` (FR-019
 * follow-up), and `processImageBytes` (FR-020). Each field is optional;
 * absent = no change. At least one supported field must be present.
 *
 * Body:
 *   {
 *     "cyclicCallIntervalMs": number | null,    // null clears the override
 *     "canRole":              "PT_CAN" | "P_CAN_DEBUG" | "GENERIC" | null,
 *     "processImageBytes":    number | null     // null leaves EEPROM as-is
 *   }
 *
 * Validation:
 *   - cyclicCallIntervalMs: null OR integer in [10, 200] AND multiple of 10
 *   - canRole:              null OR one of the enum values (case-insensitive accepted; stored uppercase)
 *   - processImageBytes:    null OR one of {8, 12, 16, 20, 24, 32, 40, 48}
 *
 * Verifies the busId belongs to the named project and that the bus is
 * actually CAN-protocol. Refuses otherwise.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; busId: string }> },
) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  const { id, busId } = await params;
  const projectId = Number(id);
  const busIdNum = Number(busId);
  if (!Number.isFinite(projectId) || !Number.isFinite(busIdNum)) {
    return NextResponse.json({ error: "Invalid project id or bus id" }, { status: 400 });
  }

  let body: {
    cyclicCallIntervalMs?: unknown;
    canRole?: unknown;
    processImageBytes?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hasCci = "cyclicCallIntervalMs" in body;
  const hasRole = "canRole" in body;
  const hasPi = "processImageBytes" in body;
  if (!hasCci && !hasRole && !hasPi) {
    return NextResponse.json(
      { error: "Body must contain at least one of: cyclicCallIntervalMs, canRole, processImageBytes" },
      { status: 400 },
    );
  }

  // ── Validate cyclicCallIntervalMs ──────────────────────────────────
  let cciValue: number | null | undefined = undefined;
  if (hasCci) {
    const v = body.cyclicCallIntervalMs;
    if (v === null) {
      cciValue = null;
    } else if (typeof v !== "number" || !Number.isInteger(v)) {
      return NextResponse.json(
        { error: "'cyclicCallIntervalMs' must be an integer or null" },
        { status: 400 },
      );
    } else if (v < 10 || v > 200) {
      return NextResponse.json(
        { error: "'cyclicCallIntervalMs' must be in range 10..200" },
        { status: 400 },
      );
    } else if (v % 10 !== 0) {
      return NextResponse.json(
        { error: "'cyclicCallIntervalMs' must be a multiple of 10 (CAN_Task cycle)" },
        { status: 400 },
      );
    } else {
      cciValue = v;
    }
  }

  // ── Validate canRole ───────────────────────────────────────────────
  const VALID_ROLES = ["PT_CAN", "P_CAN_DEBUG", "GENERIC"] as const;
  type CanRoleValue = (typeof VALID_ROLES)[number];
  let roleValue: CanRoleValue | null | undefined = undefined;
  if (hasRole) {
    const v = body.canRole;
    if (v === null) {
      roleValue = null;
    } else if (typeof v !== "string") {
      return NextResponse.json({ error: "'canRole' must be a string or null" }, { status: 400 });
    } else {
      const upper = v.toUpperCase();
      if (!(VALID_ROLES as readonly string[]).includes(upper)) {
        return NextResponse.json(
          { error: `'canRole' must be one of ${VALID_ROLES.join(" | ")} or null` },
          { status: 400 },
        );
      }
      roleValue = upper as CanRoleValue;
    }
  }

  // ── Validate processImageBytes ─────────────────────────────────────
  const VALID_PI = [8, 12, 16, 20, 24, 32, 40, 48];
  let piValue: number | null | undefined = undefined;
  if (hasPi) {
    const v = body.processImageBytes;
    if (v === null) {
      piValue = null;
    } else if (typeof v !== "number" || !Number.isInteger(v)) {
      return NextResponse.json(
        { error: "'processImageBytes' must be an integer or null" },
        { status: 400 },
      );
    } else if (!VALID_PI.includes(v)) {
      return NextResponse.json(
        { error: `'processImageBytes' must be one of ${VALID_PI.join(", ")} or null` },
        { status: 400 },
      );
    } else {
      piValue = v;
    }
  }

  // ── Authorize: bus belongs to project, CAN protocol ───────────────
  const bus = await db.bus.findUnique({
    where: { id: busIdNum },
    select: { id: true, projectId: true, protocol: true },
  });
  if (!bus) return NextResponse.json({ error: `Bus ${busIdNum} not found` }, { status: 404 });
  if (bus.projectId !== projectId) {
    return NextResponse.json(
      { error: `Bus ${busIdNum} does not belong to project ${projectId}` },
      { status: 400 },
    );
  }
  const canProtocols = ["CANBUS", "CANOPEN", "J1939", "DEVICENET"];
  if (!canProtocols.includes(bus.protocol)) {
    return NextResponse.json(
      { error: `Bus ${busIdNum} protocol ${bus.protocol} is not CAN` },
      { status: 400 },
    );
  }

  // ── Apply ──────────────────────────────────────────────────────────
  const data: Record<string, unknown> = {};
  if (cciValue !== undefined) data.cyclicCallIntervalMs = cciValue;
  if (roleValue !== undefined) data.canRole = roleValue;
  if (piValue !== undefined) data.processImageBytes = piValue;

  const updated = await db.bus.update({
    where: { id: busIdNum },
    data,
    select: {
      id: true,
      protocol: true,
      cyclicCallIntervalMs: true,
      canRole: true,
      processImageBytes: true,
    },
  });

  return NextResponse.json({
    accepted: true,
    bus: {
      id: updated.id,
      protocol: updated.protocol,
      cyclicCallIntervalMs: updated.cyclicCallIntervalMs,
      canRole: updated.canRole,
      processImageBytes: updated.processImageBytes,
    },
  });
}
