import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { db } from "@/lib/db";
import { renderAllJmobileFiles, type AlarmInput } from "@/lib/jmobile-export";

/**
 * GET /api/project/{id}/jmobile-export
 *
 * Generates the JMobile (Exor SCADA HMI) alarm-import bundle for the named
 * project and returns a ZIP containing:
 *   - ExportedAlarms.xml  — alarm-definition table (1 row per discrete alarm,
 *                          5 rows per analog signal for LL/L/H/HH/SF levels)
 *   - AlarmTexter.xml     — sequential message text per alarm
 *   - setAlarmTable.js    — JS startup snippet (aT(...) calls) for JMobile's
 *                          Startup script after //PASTE FROM EXCEL
 *
 * Pending alarms (alarmNo=null) are skipped — operator must hit "Lock numbering"
 * on /projects/[id]/jmobile before export to assign stable slot indices.
 *
 * Reference: docs/jmobile-export-schema.md, src/lib/jmobile-export.ts.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Pull every discrete + analog alarm row for this project.
  // DiscreteAlarm.signal → DiscreteSignal → Signal (project_id lives on Signal)
  const [discrete, analog] = await Promise.all([
    db.discreteAlarm.findMany({
      where: { signal: { signal: { projectId } } },
      select: {
        id: true,
        alarmNo: true,
        signalId: true,
        condition: true,
        alarmGroup: true,
        severity: true,
        delaySeconds: true,
        message: true,
        signal: { select: { signal: { select: { tag: true } } } },
      },
    }),
    db.analogAlarm.findMany({
      where: { signal: { signal: { projectId } } },
      select: {
        id: true,
        alarmNo: true,
        signalId: true,
        condition: true,
        alarmGroup: true,
        severity: true,
        delaySeconds: true,
        message: true,
        setpoint: true,
        hysteresis: true,
        signal: { select: { signal: { select: { tag: true } } } },
      },
    }),
  ]);

  const alarms: AlarmInput[] = [
    ...discrete.map<AlarmInput>((a) => ({
      id: a.id,
      alarmNo: a.alarmNo,
      kind: "discrete" as const,
      condition: a.condition,
      signalId: a.signalId,
      signalTag: a.signal?.signal?.tag ?? null,
      alarmGroup: (a.alarmGroup ?? null) as "A" | "B" | "C" | null,
      severity: a.severity as AlarmInput["severity"],
      message: a.message,
      delaySeconds: a.delaySeconds,
    })),
    ...analog.map<AlarmInput>((a) => ({
      id: a.id,
      alarmNo: a.alarmNo,
      kind: "analog" as const,
      condition: a.condition,
      signalId: a.signalId,
      signalTag: a.signal?.signal?.tag ?? null,
      alarmGroup: (a.alarmGroup ?? null) as "A" | "B" | "C" | null,
      severity: a.severity as AlarmInput["severity"],
      message: a.message,
      delaySeconds: a.delaySeconds,
      setpoint: a.setpoint?.toString() ?? null,
      hysteresis: a.hysteresis?.toString() ?? null,
    })),
  ];

  const files = renderAllJmobileFiles({
    projectId: project.id,
    projectName: project.name,
    alarms,
  });

  const zip = new JSZip();
  for (const [name, body] of Object.entries(files)) {
    zip.file(name, body);
  }
  const bundle = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  const fileName = `jmobile-import_${project.name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.zip`;
  return new NextResponse(bundle as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
