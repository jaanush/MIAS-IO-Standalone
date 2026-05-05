"use client";

/**
 * JMobile alarm-table view (Phase 4 of the JMobile-export work).
 *
 * Lists every alarm in the project (discrete + analog) with its locked
 * alarm_no. The "Lock numbering" button assigns sequential ints to any
 * unnumbered alarms; existing numbers stay frozen so JMobile imports
 * remain stable across IO-list edits. The actual XML export comes once
 * the plugin populates iec_alarm_path (FR pending).
 */

import { use, useMemo, useState } from "react";
import { trpc } from "@/trpc/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Lock, Eraser, Download } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";

type AlarmRow =
  | {
      kind: "discrete";
      id: number;
      alarmNo: number | null;
      tag: string | null;
      description: string | null;
      condition: string;
      severity: string;
      alarmGroup: string | null;
      message: string | null;
    }
  | {
      kind: "analog";
      id: number;
      alarmNo: number | null;
      tag: string | null;
      description: string | null;
      condition: string;
      severity: string;
      alarmGroup: string | null;
      message: string | null;
      setpoint: number;
      hysteresis: number;
    };

export default function JMobilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const projectId = Number(id);
  const [confirmProps, confirmAction] = useConfirm();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.signal.alarmListForProject.useQuery({ projectId });
  const lockMut = trpc.signal.alarmLockNumbering.useMutation({
    onSuccess: () => utils.signal.alarmListForProject.invalidate({ projectId }),
  });
  const renumberMut = trpc.signal.alarmRenumberFromScratch.useMutation({
    onSuccess: () => utils.signal.alarmListForProject.invalidate({ projectId }),
  });

  const [filter, setFilter] = useState("");
  const [showOnly, setShowOnly] = useState<"all" | "numbered" | "pending">("all");

  const all: AlarmRow[] = useMemo(() => {
    if (!data) return [];
    return [...data.discrete, ...data.analog].sort((a, b) => {
      // Numbered first, ordered by alarm_no asc; unnumbered after, by tag.
      if (a.alarmNo != null && b.alarmNo != null) return a.alarmNo - b.alarmNo;
      if (a.alarmNo != null) return -1;
      if (b.alarmNo != null) return 1;
      return (a.tag ?? "").localeCompare(b.tag ?? "");
    });
  }, [data]);

  const visible = useMemo(() => {
    return all.filter((a) => {
      if (filter) {
        const f = filter.toLowerCase();
        const tag = (a.tag ?? "").toLowerCase();
        const desc = (a.description ?? "").toLowerCase();
        const msg = (a.message ?? "").toLowerCase();
        if (!tag.includes(f) && !desc.includes(f) && !msg.includes(f)) return false;
      }
      if (showOnly === "numbered" && a.alarmNo == null) return false;
      if (showOnly === "pending" && a.alarmNo != null) return false;
      return true;
    });
  }, [all, filter, showOnly]);

  const stats = useMemo(() => {
    const total = all.length;
    const numbered = all.filter((a) => a.alarmNo != null).length;
    const pending = total - numbered;
    const maxNo = all.reduce((m, a) => Math.max(m, a.alarmNo ?? 0), 0);
    return { total, numbered, pending, maxNo };
  }, [all]);

  return (
    <div className="flex flex-col flex-1 min-h-0 px-8 py-6 max-w-6xl gap-4">
      <div>
        <h1 className="text-xl font-semibold">JMobile Alarm Table</h1>
        <p className="text-sm text-muted-foreground">
          Locked alarm numbering for the legacy JMobile XML imports. Once an alarm
          gets a number it stays pinned across edits — only freshly added alarms
          get new numbers on the next lock.
        </p>
        <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
          <span><strong className="text-foreground">{stats.total}</strong> alarms</span>
          <span><strong className="text-emerald-600 dark:text-emerald-400">{stats.numbered}</strong> numbered</span>
          <span><strong className="text-amber-600 dark:text-amber-400">{stats.pending}</strong> awaiting numbering</span>
          {stats.maxNo > 0 && <span>highest no: <strong className="text-foreground">{stats.maxNo}</strong></span>}
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <Input
          placeholder="Filter by tag, description, or message…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm h-9 text-sm"
        />
        <Select value={showOnly} onValueChange={(v) => setShowOnly(v as typeof showOnly)}>
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All alarms</SelectItem>
            <SelectItem value="numbered">Numbered only</SelectItem>
            <SelectItem value="pending">Awaiting numbering</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="default"
          disabled={lockMut.isPending || stats.pending === 0}
          onClick={() => lockMut.mutate({ projectId })}
        >
          <Lock className="h-3.5 w-3.5 mr-1" />
          {lockMut.isPending ? "Locking…" : `Lock ${stats.pending} pending`}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={renumberMut.isPending || stats.numbered === 0}
          onClick={() =>
            confirmAction(
              `Wipe all ${stats.numbered} alarm numbers and start fresh? Any external references (JMobile imports already done) will need re-importing.`,
              async () => {
                await renumberMut.mutateAsync({ projectId, confirm: true });
              },
            )
          }
        >
          <Eraser className="h-3.5 w-3.5 mr-1" /> Renumber from scratch
        </Button>
        <Button
          size="sm"
          variant="default"
          disabled={stats.numbered === 0}
          onClick={() => {
            // Browser-native download of the ZIP. The endpoint streams a generated
            // bundle (ExportedAlarms.xml + AlarmTexter.xml + setAlarmTable.js).
            window.location.href = `/api/project/${projectId}/jmobile-export`;
          }}
          title={stats.pending > 0 ? `${stats.pending} alarm(s) still pending — they'll be skipped in the export. Lock numbering first.` : "Download JMobile import bundle"}
        >
          <Download className="h-3.5 w-3.5 mr-1" /> Download JMobile bundle
        </Button>
      </div>

      <div className="rounded-md border overflow-auto flex-1 min-h-0">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs sticky top-0 z-10 shadow-[inset_0_-1px_0_var(--border)]">
            <tr>
              <th className="text-right px-3 py-2 font-medium w-16">No.</th>
              <th className="text-left px-3 py-2 font-medium w-48">Tag</th>
              <th className="text-left px-3 py-2 font-medium">Description / Message</th>
              <th className="text-left px-3 py-2 font-medium w-20">Kind</th>
              <th className="text-left px-3 py-2 font-medium w-20">Cond.</th>
              <th className="text-left px-3 py-2 font-medium w-20">Sev.</th>
              <th className="text-center px-3 py-2 font-medium w-12">Grp.</th>
              <th className="text-right px-3 py-2 font-medium w-24">Setpoint</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground text-xs">Loading…</td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground text-xs">No alarms match.</td></tr>
            ) : (
              visible.map((a) => (
                <tr key={`${a.kind}:${a.id}`} className="border-t">
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums text-xs">
                    {a.alarmNo != null ? (
                      <span className="text-foreground">{a.alarmNo}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-xs truncate">{a.tag ?? "—"}</td>
                  <td className="px-3 py-1.5 text-xs">
                    <div className="truncate">{a.description ?? "—"}</div>
                    {a.message && <div className="text-[11px] text-muted-foreground truncate">{a.message}</div>}
                  </td>
                  <td className="px-3 py-1.5">
                    <Badge variant="outline" className="text-[10px]">{a.kind}</Badge>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[11px]">{a.condition}</td>
                  <td className="px-3 py-1.5 font-mono text-[11px]">{a.severity}</td>
                  <td className="px-3 py-1.5 text-center font-mono text-[11px]">{a.alarmGroup ?? "—"}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-[11px] tabular-nums">
                    {a.kind === "analog"
                      ? `${a.setpoint}${a.hysteresis ? ` ±${a.hysteresis}` : ""}`
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        XML export and JMobile-side template constants are pending the plugin's
        <code className="mx-1 text-[11px]">iec_alarm_path</code> work — see
        <code className="mx-1 text-[11px]">docs/jmobile-export-schema.md</code>.
      </p>

      <ConfirmDialog {...confirmProps} confirmLabel="Renumber" />
    </div>
  );
}
