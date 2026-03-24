import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "../../../../_auth";
import { tagToVarName, deduplicateVarNames } from "../../../../_address";

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

  const gvl = await db.globalVariableList.findUnique({
    where: { id: gvlIdNum },
    select: { id: true, name: true, generationMode: true },
  });
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
      componentTag: true,
      ioCard: {
        select: {
          slotPosition: true,
          cardType: true,
          carrierId: true,
        },
      },
      channelPosition: true,
      instanceSignal: {
        select: {
          instance: {
            select: {
              tag: true,
              functionBlockOverride: true,
              component: {
                select: { functionBlock: true },
              },
            },
          },
        },
      },
      analogSignal: {
        select: { plcDataTypeCatalog: { select: { code: true } }, engineeringUnit: { select: { symbol: true } } },
      },
      discreteSignal: {
        select: { plcDataType: { select: { code: true } } },
      },
      busSignal: {
        select: {
          bus: { select: { protocol: true } },
          plcDataType: true,
          unitId: true,
          registerType: true,
          registerOffset: true,
          nodeId: true,
        },
      },
    },
  });

  // FB_INSTANCES mode: emit one FB instance per component, not per signal
  if (gvl.generationMode === "FB_INSTANCES") {
    return generateFbInstances(gvl.name, signals);
  }

  // FLAT_VARS mode (default)
  return generateFlatVars(signals);
}

function generateFbInstances(
  gvlName: string,
  signals: {
    tag: string | null;
    isRetain: boolean;
    isPersistent: boolean;
    componentTag: string | null;
    instanceSignal: {
      instance: {
        tag: string | null;
        functionBlockOverride: string | null;
        component: { functionBlock: string | null };
      };
    } | null;
  }[]
): NextResponse {
  // Group signals by component instance to get unique FB instance declarations
  const instanceMap = new Map<string, { tag: string; fbType: string; isRetain: boolean; isPersistent: boolean }>();

  for (const s of signals) {
    const inst = s.instanceSignal?.instance;
    const instanceTag = inst?.tag ?? s.componentTag;
    if (!instanceTag) continue;

    if (instanceMap.has(instanceTag)) continue;

    const fbType = inst?.functionBlockOverride ?? inst?.component.functionBlock ?? null;
    if (!fbType) continue;

    instanceMap.set(instanceTag, {
      tag: instanceTag,
      fbType,
      isRetain: s.isRetain,
      isPersistent: s.isPersistent,
    });
  }

  const instances = [...instanceMap.values()].sort((a, b) => a.tag.localeCompare(b.tag));
  const normal = instances.filter((i) => !i.isRetain && !i.isPersistent);
  const retain = instances.filter((i) => i.isRetain && !i.isPersistent);
  const persistent = instances.filter((i) => i.isPersistent);

  function instanceLine(inst: { tag: string; fbType: string }): string {
    const varName = tagToVarName(inst.tag);
    const pad = " ".repeat(Math.max(1, 40 - varName.length));
    return `    ${varName}${pad}: ${inst.fbType};`;
  }

  const lines: string[] = [];

  if (normal.length > 0) {
    lines.push("VAR_GLOBAL");
    for (const inst of normal) lines.push(instanceLine(inst));
    lines.push("END_VAR");
    lines.push("");
  }

  if (retain.length > 0) {
    lines.push("VAR_GLOBAL RETAIN");
    for (const inst of retain) lines.push(instanceLine(inst));
    lines.push("END_VAR");
    lines.push("");
  }

  if (persistent.length > 0) {
    lines.push("VAR_GLOBAL PERSISTENT RETAIN");
    for (const inst of persistent) lines.push(instanceLine(inst));
    lines.push("END_VAR");
    lines.push("");
  }

  if (lines.length === 0) {
    lines.push("VAR_GLOBAL");
    lines.push(`    (* ${gvlName}: no component instances found — check functionBlock on components *)`);
    lines.push("END_VAR");
  }

  return new NextResponse(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function generateFlatVars(
  signals: {
    id: number;
    tag: string | null;
    description: string | null;
    signalType: string;
    origin: string;
    isRetain: boolean;
    isPersistent: boolean;
    analogSignal: { plcDataTypeCatalog: { code: string } | null; engineeringUnit: { symbol: string } | null } | null;
    discreteSignal: { plcDataType: { code: string } | null } | null;
    busSignal: {
      bus: { protocol: string } | null;
      plcDataType: string | null;
      unitId: number | null;
      registerType: string | null;
      registerOffset: number | null;
      nodeId: number | null;
    } | null;
  }[]
): NextResponse {
  // Resolve plcDataType with fallback chain: busSignal → discrete → analog → default by signalType
  function resolveDataType(s: (typeof signals)[0]): string {
    if (s.busSignal?.plcDataType) return s.busSignal.plcDataType;
    if (s.discreteSignal?.plcDataType?.code) return s.discreteSignal.plcDataType.code;
    if (s.analogSignal?.plcDataTypeCatalog?.code) return s.analogSignal.plcDataTypeCatalog.code;
    return s.signalType === "ANALOG" ? "INT" : "BOOL";
  }

  // Deduplicate variable names across all signals in this GVL
  const rawNames = signals.map((s) => tagToVarName(s.tag));
  const varNames = deduplicateVarNames(rawNames);

  // Group by RETAIN/PERSISTENT for proper VAR_GLOBAL sections
  type IndexedSignal = { idx: number; signal: (typeof signals)[0] };
  const retain: IndexedSignal[] = [];
  const persistent: IndexedSignal[] = [];
  const normal: IndexedSignal[] = [];
  signals.forEach((s, i) => {
    const entry = { idx: i, signal: s };
    if (s.isPersistent) persistent.push(entry);
    else if (s.isRetain) retain.push(entry);
    else normal.push(entry);
  });

  function signalLine({ idx, signal: s }: IndexedSignal): string {
    const varName = varNames[idx];
    const dataType = resolveDataType(s);

    const parts: string[] = [];
    if (s.description) parts.push(s.description);
    if (s.analogSignal?.engineeringUnit?.symbol) parts.push(`[${s.analogSignal.engineeringUnit.symbol}]`);
    if (s.busSignal) {
      const proto = s.busSignal.bus?.protocol ?? "";
      if (s.busSignal.unitId != null) parts.push(`${proto} unit:${s.busSignal.unitId}`);
      if (s.busSignal.registerType && s.busSignal.registerOffset != null)
        parts.push(`${s.busSignal.registerType}:${s.busSignal.registerOffset}`);
      if (s.busSignal.nodeId != null) parts.push(`node:${s.busSignal.nodeId}`);
    }
    const comment = parts.length > 0 ? ` (* ${parts.join(" — ")} *)` : "";

    const pad = " ".repeat(Math.max(1, 40 - varName.length));
    return `    ${varName}${pad}: ${dataType};${comment}`;
  }

  const lines: string[] = [];

  if (normal.length > 0) {
    lines.push("VAR_GLOBAL");
    for (const entry of normal) lines.push(signalLine(entry));
    lines.push("END_VAR");
    lines.push("");
  }

  if (retain.length > 0) {
    lines.push("VAR_GLOBAL RETAIN");
    for (const entry of retain) lines.push(signalLine(entry));
    lines.push("END_VAR");
    lines.push("");
  }

  if (persistent.length > 0) {
    lines.push("VAR_GLOBAL PERSISTENT RETAIN");
    for (const entry of persistent) lines.push(signalLine(entry));
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
