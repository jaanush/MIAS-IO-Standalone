import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "../../../../../_auth";

/**
 * POST /api/codesys/projects/{id}/can-buses/{busId}/discovered  (FR-016)
 *
 * The plugin's autobaud scout writes back the framing combination it found
 * after a successful scan. This endpoint records the values on the bus and
 * stamps the discovery time so the UI can prompt the operator to confirm /
 * promote AUTO → FIXED.
 *
 * Body: { use29Bit: boolean, baudKbps: number, discoveredAt?: ISO-8601 string }
 *
 * Behaviour:
 *   - Sets `bus.canFrameFormat` from `use29Bit` (true → EXTENDED, false → STANDARD).
 *   - Sets `bus.baudRateKbit = baudKbps`.
 *   - Stamps `bus.canFramingDiscoveredAt`.
 *   - Does NOT flip `canFramingMode` — the mode is the operator's intent;
 *     promotion to FIXED happens via UI confirmation, not by the plugin.
 *
 * Verifies that the busId belongs to the named project and that the bus
 * is actually CAN-protocol (CANBUS / CANOPEN / J1939 / DEVICENET) — refuses
 * otherwise.
 */
export async function POST(
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

  let body: { use29Bit?: unknown; baudKbps?: unknown; discoveredAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.use29Bit !== "boolean") {
    return NextResponse.json({ error: "'use29Bit' must be a boolean" }, { status: 400 });
  }
  if (typeof body.baudKbps !== "number" || !Number.isFinite(body.baudKbps) || body.baudKbps <= 0) {
    return NextResponse.json({ error: "'baudKbps' must be a positive number" }, { status: 400 });
  }

  const bus = await db.bus.findUnique({
    where: { id: busIdNum },
    select: { id: true, projectId: true, protocol: true },
  });
  if (!bus) return NextResponse.json({ error: `Bus ${busIdNum} not found` }, { status: 404 });
  if (bus.projectId !== projectId) {
    return NextResponse.json({ error: `Bus ${busIdNum} does not belong to project ${projectId}` }, { status: 400 });
  }
  const canProtocols = ["CANBUS", "CANOPEN", "J1939", "DEVICENET"];
  if (!canProtocols.includes(bus.protocol)) {
    return NextResponse.json({ error: `Bus ${busIdNum} protocol ${bus.protocol} is not CAN` }, { status: 400 });
  }

  const discoveredAt = typeof body.discoveredAt === "string" ? new Date(body.discoveredAt) : new Date();
  if (Number.isNaN(discoveredAt.getTime())) {
    return NextResponse.json({ error: "'discoveredAt' must be ISO-8601" }, { status: 400 });
  }

  const updated = await db.bus.update({
    where: { id: busIdNum },
    data: {
      canFrameFormat: body.use29Bit ? "EXTENDED" : "STANDARD",
      baudRateKbit: body.baudKbps,
      canFramingDiscoveredAt: discoveredAt,
    },
    select: {
      id: true, protocol: true, baudRateKbit: true,
      canFrameFormat: true, canFramingMode: true, canFramingDiscoveredAt: true,
    },
  });

  return NextResponse.json({
    accepted: true,
    bus: {
      id: updated.id,
      protocol: updated.protocol,
      baudKbps: updated.baudRateKbit,
      use29Bit: updated.canFrameFormat === "EXTENDED",
      canFrameFormat: updated.canFrameFormat,
      canFramingMode: updated.canFramingMode,
      canFramingDiscoveredAt: updated.canFramingDiscoveredAt,
    },
  });
}
