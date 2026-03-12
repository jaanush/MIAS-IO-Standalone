import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "../../../../_auth";
import { tagToVarName } from "../../../../_address";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; gvlId: string }> }
) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  const { id, gvlId } = await params;
  const projectId = Number(id);
  const gvlIdNum = Number(gvlId);

  if (isNaN(projectId) || isNaN(gvlIdNum)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const gvl = await db.globalVariableList.findUnique({ where: { id: gvlIdNum }, select: { id: true, name: true } });
  if (!gvl) return NextResponse.json({ error: "GVL not found" }, { status: 404 });

  const signals = await db.signal.findMany({
    where: { projectId, gvlId: gvlIdNum },
    orderBy: { tag: "asc" },
    select: {
      id: true,
      tag: true,
      description: true,
      signalType: true,
      origin: true,
      direction: true,
      isRetain: true,
      isPersistent: true,
      ioCard: {
        select: {
          slotPosition: true,
          cardType: true,
          carrierId: true,
        },
      },
      channelPosition: true,
      analogSignal: {
        select: { plcDataTypeCatalog: { select: { code: true } }, engineeringUnit: { select: { symbol: true } } },
      },
      discreteSignal: {
        select: { plcDataType: { select: { code: true } } },
      },
      busSignal: {
        select: {
          plcNetwork: { select: { protocol: true } },
          unitId: true,
          registerType: true,
          registerOffset: true,
          nodeId: true,
        },
      },
    },
  });

  // Group by RETAIN/PERSISTENT for proper VAR_GLOBAL sections
  const retain = signals.filter((s) => s.isRetain && !s.isPersistent);
  const persistent = signals.filter((s) => s.isPersistent);
  const normal = signals.filter((s) => !s.isRetain && !s.isPersistent);

  function signalLine(s: (typeof signals)[0]): string {
    const varName = tagToVarName(s.tag);
    let dataType = "BOOL";
    if (s.discreteSignal?.plcDataType?.code) dataType = s.discreteSignal.plcDataType.code;
    else if (s.analogSignal?.plcDataTypeCatalog?.code) dataType = s.analogSignal.plcDataTypeCatalog.code;
    else if (s.signalType === "ANALOG") dataType = "INT";

    const parts: string[] = [];
    if (s.description) parts.push(s.description);
    if (s.analogSignal?.engineeringUnit?.symbol) parts.push(`[${s.analogSignal.engineeringUnit.symbol}]`);
    if (s.busSignal) {
      const proto = s.busSignal.plcNetwork?.protocol ?? "";
      if (s.busSignal.unitId != null) parts.push(`${proto} unit:${s.busSignal.unitId}`);
      if (s.busSignal.registerType && s.busSignal.registerOffset != null)
        parts.push(`${s.busSignal.registerType}:${s.busSignal.registerOffset}`);
      if (s.busSignal.nodeId != null) parts.push(`node:${s.busSignal.nodeId}`);
    }
    const comment = parts.length > 0 ? ` (* ${parts.join(" — ")} *)` : "";

    const pad = " ".repeat(Math.max(1, 32 - varName.length));
    return `    ${varName}${pad}: ${dataType};${comment}`;
  }

  const lines: string[] = [];

  if (normal.length > 0) {
    lines.push("VAR_GLOBAL");
    for (const s of normal) lines.push(signalLine(s));
    lines.push("END_VAR");
    lines.push("");
  }

  if (retain.length > 0) {
    lines.push("VAR_GLOBAL RETAIN");
    for (const s of retain) lines.push(signalLine(s));
    lines.push("END_VAR");
    lines.push("");
  }

  if (persistent.length > 0) {
    lines.push("VAR_GLOBAL PERSISTENT RETAIN");
    for (const s of persistent) lines.push(signalLine(s));
    lines.push("END_VAR");
    lines.push("");
  }

  if (lines.length === 0) {
    lines.push("VAR_GLOBAL");
    lines.push("    (* No signals assigned to this GVL *)");
    lines.push("END_VAR");
  }

  return new NextResponse(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
