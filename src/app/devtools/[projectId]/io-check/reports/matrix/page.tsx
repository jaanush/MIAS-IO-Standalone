"use client";

/**
 * IO-Check Summary Matrix — signals (rows) × sessions (cols), each cell a
 * color-coded status indicator. Untested = light gray, PASS = green,
 * FAIL = red, SKIPPED = amber, PENDING = neutral. Click a cell to open
 * the session detail.
 */

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { trpc } from "@/trpc/client";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";

const COLORS: Record<string, { cls: string; label: string }> = {
  PASS:    { cls: "bg-emerald-500", label: "Pass" },
  FAIL:    { cls: "bg-red-500", label: "Fail" },
  SKIPPED: { cls: "bg-amber-500", label: "Skipped" },
  PENDING: { cls: "bg-muted-foreground/30", label: "Pending" },
};
const UNTESTED_CLS = "bg-muted/50";

export default function IoCheckMatrixPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const [filter, setFilter] = useState("");
  const { data, isLoading } = trpc.devtools.ioCheckMatrix.useQuery({
    projectId: Number(projectId),
  });

  const sessions = data?.sessions ?? [];
  const signals = data?.signals ?? [];
  const cells = data?.cells ?? {};

  const visible = useMemo(() => {
    if (!filter) return signals;
    const f = filter.toLowerCase();
    return signals.filter(
      (s) =>
        (s.tag ?? "").toLowerCase().includes(f) ||
        (s.description ?? "").toLowerCase().includes(f) ||
        (s.ioCard?.carrier.name ?? "").toLowerCase().includes(f),
    );
  }, [signals, filter]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <Link href={`/devtools/${projectId}/io-check/reports`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-sm font-semibold flex-1">Summary matrix</h1>
        <span className="text-[11px] text-muted-foreground">
          {sessions.length} reports · {signals.length} distinct signals
        </span>
      </div>

      <div className="px-4 py-2 border-b flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Filter signals…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 max-w-xs text-sm"
        />
        <div className="flex items-center gap-3 text-[10px]">
          {Object.entries(COLORS).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <span className={`inline-block h-3 w-3 rounded ${v.cls}`} />
              {v.label}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className={`inline-block h-3 w-3 rounded ${UNTESTED_CLS}`} />
            Untested
          </span>
        </div>
      </div>

      {isLoading ? (
        <p className="p-4 text-xs text-muted-foreground">Loading…</p>
      ) : sessions.length === 0 ? (
        <p className="p-4 text-xs text-muted-foreground">No reports yet.</p>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="text-xs border-separate border-spacing-0">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="sticky left-0 z-20 bg-muted/95 backdrop-blur px-3 py-2 text-left font-medium border-b border-r min-w-[280px]">
                  Signal
                </th>
                {sessions.map((s) => {
                  const date = new Date(s.startedAt);
                  return (
                    <th
                      key={s.id}
                      className="bg-muted/95 backdrop-blur px-1 py-1 border-b border-r"
                      title={`${s.plc.name} · ${date.toLocaleString()}${s.operatorName ? " · " + s.operatorName : ""}`}
                    >
                      <Link
                        href={`/devtools/${projectId}/io-check/session/${s.id}`}
                        className="flex flex-col items-center text-[10px] font-mono leading-tight whitespace-nowrap hover:underline"
                      >
                        <span>{date.toISOString().slice(5, 10)}</span>
                        <span className="text-muted-foreground">{s.plc.name}</span>
                      </Link>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((sig) => (
                <tr key={sig.id} className="hover:bg-accent/30">
                  <td className="sticky left-0 z-10 bg-background px-3 py-1 border-b border-r font-mono whitespace-nowrap">
                    <div className="text-foreground">{sig.tag ?? "—"}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {sig.ioCard?.carrier.name ?? "—"}
                      {sig.ioCard ? ` · S${String(sig.ioCard.slotPosition).padStart(2, "0")}` : ""}
                      {sig.signalType ? ` · ${sig.signalType}` : ""}
                    </div>
                  </td>
                  {sessions.map((s) => {
                    const cell = cells[`${sig.id}:${s.id}`];
                    const color = cell ? COLORS[cell.status]?.cls ?? UNTESTED_CLS : UNTESTED_CLS;
                    const tip = cell
                      ? `${COLORS[cell.status]?.label ?? cell.status}${cell.checkedAt ? ` · ${new Date(cell.checkedAt).toLocaleString()}` : ""}`
                      : "Untested";
                    return (
                      <td key={s.id} className="border-b border-r p-0.5">
                        <Link
                          href={`/devtools/${projectId}/io-check/session/${s.id}`}
                          title={tip}
                          className={`block h-5 w-7 rounded ${color} hover:ring-2 hover:ring-primary transition`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
