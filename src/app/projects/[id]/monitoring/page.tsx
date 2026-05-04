"use client";

/**
 * FR-007 — Live Monitoring management.
 *
 * Lists every signal in the project with two independent monitoring slots:
 * SCALED (DAO output) and RAW (HAL input, used for calibration). Each slot
 * has its own enable toggle, interval, and live-reading preview, and is
 * gated on the matching iec_path being populated by the plugin.
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

const INTERVAL_OPTIONS = [
  { value: 1000, label: "1 s" },
  { value: 5000, label: "5 s" },
  { value: 30000, label: "30 s" },
];

type Mode = "SCALED" | "RAW";

export default function MonitoringPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const projectId = Number(id);
  const { data: signals = [], refetch } = trpc.components.monitoringList.useQuery({ projectId });
  const upsert = trpc.components.monitoringUpsert.useMutation({ onSuccess: () => refetch() });
  const remove = trpc.components.monitoringDelete.useMutation({ onSuccess: () => refetch() });

  const [filter, setFilter] = useState("");
  const [showOnly, setShowOnly] = useState<"all" | "monitored" | "ready">("all");

  const visible = useMemo(() => {
    const tokens = filter.toLowerCase().split(/\s+/).filter(Boolean);
    return signals.filter((s) => {
      if (tokens.length > 0) {
        const haystack = [s.tag, s.description, s.iecPath, s.iecPathRaw]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!tokens.every((t) => haystack.includes(t))) return false;
      }
      const anyMonitored = (s.monitoring ?? []).some((m) => m.enabled);
      const anyReady = !!(s.iecPath || s.iecPathRaw);
      if (showOnly === "monitored" && !anyMonitored) return false;
      if (showOnly === "ready" && !anyReady) return false;
      return true;
    });
  }, [signals, filter, showOnly]);

  const stats = useMemo(() => {
    const total = signals.length;
    const readyScaled = signals.filter((s) => s.iecPath).length;
    const readyRaw = signals.filter((s) => s.iecPathRaw).length;
    const monitored = signals.filter((s) => (s.monitoring ?? []).some((m) => m.enabled)).length;
    return { total, readyScaled, readyRaw, monitored };
  }, [signals]);

  return (
    <div className="px-8 py-6 max-w-6xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Live Monitoring</h1>
        <p className="text-sm text-muted-foreground">
          Subscribe signals for the plugin's poll-and-push loop. Each signal can stream
          its <strong>SCALED</strong> (DAO output) and/or <strong>RAW</strong> (HAL input) value
          independently. Calibration UIs read the RAW path so you don't calibrate from
          already-scaled data.
        </p>
        <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
          <span><strong className="text-foreground">{stats.total}</strong> signals</span>
          <span><strong className="text-foreground">{stats.readyScaled}</strong> scaled-ready</span>
          <span><strong className="text-foreground">{stats.readyRaw}</strong> raw-ready</span>
          <span><strong className="text-foreground">{stats.monitored}</strong> monitored</span>
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <Input
          placeholder="Filter by tag or description…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm h-9 text-sm"
        />
        <Select value={showOnly} onValueChange={(v) => setShowOnly(v as typeof showOnly)}>
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All signals</SelectItem>
            <SelectItem value="ready">Codegen-ready only</SelectItem>
            <SelectItem value="monitored">Monitored only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs">
            <tr>
              <th rowSpan={2} className="text-left px-3 py-2 font-medium w-56 border-r align-bottom">Tag / Description</th>
              <th rowSpan={2} className="text-left px-3 py-2 font-medium w-20 border-r align-bottom">Origin</th>
              <th colSpan={3} className="px-3 py-2 font-medium border-r text-center">SCALED (DAO)</th>
              <th colSpan={3} className="px-3 py-2 font-medium text-center">RAW (HAL)</th>
            </tr>
            <tr>
              <th className="text-center px-2 py-1 font-medium w-20">Monitor</th>
              <th className="text-left px-2 py-1 font-medium w-20">Interval</th>
              <th className="text-left px-2 py-1 font-medium w-32 border-r">Latest</th>
              <th className="text-center px-2 py-1 font-medium w-20">Monitor</th>
              <th className="text-left px-2 py-1 font-medium w-20">Interval</th>
              <th className="text-left px-2 py-1 font-medium w-32">Latest</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted-foreground text-xs">
                  No signals match.
                </td>
              </tr>
            ) : (
              visible.map((s) => {
                const monByMode = new Map<Mode, { intervalMs: number; enabled: boolean }>();
                for (const m of s.monitoring ?? []) monByMode.set(m.mode as Mode, m);
                const readByMode = new Map<Mode, { valueStr: string; state: string }>();
                for (const r of s.liveReadings ?? []) readByMode.set(r.mode as Mode, r);

                return (
                  <tr key={s.id} className="border-t">
                    <td className="px-3 py-2 align-top border-r">
                      <div className="font-mono text-xs truncate">{s.tag ?? <span className="text-muted-foreground">—</span>}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{s.description ?? ""}</div>
                    </td>
                    <td className="px-3 py-2 align-top border-r">
                      <Badge variant="outline" className="text-[10px]">{s.origin}</Badge>
                    </td>

                    <ModeCell
                      mode="SCALED"
                      pathReady={!!s.iecPath}
                      mon={monByMode.get("SCALED")}
                      reading={readByMode.get("SCALED")}
                      onToggle={(enabled, intervalMs) =>
                        enabled
                          ? upsert.mutate({ signalId: s.id, mode: "SCALED", projectId, intervalMs, enabled: true })
                          : remove.mutate({ signalId: s.id, mode: "SCALED" })
                      }
                      onIntervalChange={(intervalMs) =>
                        upsert.mutate({ signalId: s.id, mode: "SCALED", projectId, intervalMs, enabled: true })
                      }
                      pending={upsert.isPending || remove.isPending}
                      borderRight
                    />

                    <ModeCell
                      mode="RAW"
                      pathReady={!!s.iecPathRaw}
                      mon={monByMode.get("RAW")}
                      reading={readByMode.get("RAW")}
                      onToggle={(enabled, intervalMs) =>
                        enabled
                          ? upsert.mutate({ signalId: s.id, mode: "RAW", projectId, intervalMs, enabled: true })
                          : remove.mutate({ signalId: s.id, mode: "RAW" })
                      }
                      onIntervalChange={(intervalMs) =>
                        upsert.mutate({ signalId: s.id, mode: "RAW", projectId, intervalMs, enabled: true })
                      }
                      pending={upsert.isPending || remove.isPending}
                      borderRight={false}
                    />
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModeCell({
  pathReady,
  mon,
  reading,
  onToggle,
  onIntervalChange,
  pending,
  borderRight,
}: {
  mode: Mode;
  pathReady: boolean;
  mon: { intervalMs: number; enabled: boolean } | undefined;
  reading: { valueStr: string; state: string } | undefined;
  onToggle: (enabled: boolean, intervalMs: number) => void;
  onIntervalChange: (intervalMs: number) => void;
  pending: boolean;
  borderRight: boolean;
}) {
  const enabled = mon?.enabled ?? false;
  const interval = mon?.intervalMs ?? 1000;
  return (
    <>
      <td className="px-2 py-2 text-center align-top">
        {pathReady ? (
          <Button
            size="sm"
            variant={enabled ? "default" : "outline"}
            className="h-7 text-[10px] px-2"
            disabled={pending}
            onClick={() => onToggle(!enabled, interval)}
          >
            {enabled ? "ON" : "off"}
          </Button>
        ) : (
          <span className="text-[10px] text-muted-foreground">no path</span>
        )}
      </td>
      <td className="px-2 py-2 align-top">
        <Select
          value={String(interval)}
          disabled={!pathReady || !enabled}
          onValueChange={(v) => onIntervalChange(Number(v))}
        >
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {INTERVAL_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className={`px-2 py-2 text-xs font-mono align-top ${borderRight ? "border-r" : ""}`}>
        {reading ? (
          <span>
            {reading.valueStr}
            <span className="text-muted-foreground"> · {reading.state}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </>
  );
}
