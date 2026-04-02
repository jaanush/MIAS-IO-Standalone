"use client";

import { use, useEffect, useMemo, useState } from "react";
import { trpc } from "@/trpc/client";
import { useDevTools } from "../../../layout";
import { useLiveValues } from "@/hooks/use-live-values";
import { cn } from "@/lib/utils";
import { Search, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function MonitorPage({
  params,
}: {
  params: Promise<{ projectId: string; plcId: string }>;
}) {
  const { projectId, plcId } = use(params);
  const plcIdNum = Number(plcId);
  const { wsConnected, send, subscribe } = useDevTools();
  const [filter, setFilter] = useState("");

  const { data: signals, isLoading } = trpc.devtools.plcSignals.useQuery({
    plcId: plcIdNum,
  });

  // All signal IDs that have a valid OPC UA node ID
  const subscribableIds = useMemo(
    () => (signals ?? []).filter((s) => s.nodeId).map((s) => s.signalId),
    [signals],
  );

  const liveValues = useLiveValues(send, subscribe, wsConnected, plcIdNum, subscribableIds);

  // Filter signals
  const filtered = useMemo(() => {
    if (!signals) return [];
    if (!filter) return signals;
    const q = filter.toLowerCase();
    return signals.filter(
      (s) =>
        s.tag.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.carrierName.toLowerCase().includes(q) ||
        s.cardArticle?.toLowerCase().includes(q),
    );
  }, [signals, filter]);

  // Group by carrier + card
  const grouped = useMemo(() => {
    const groups = new Map<string, typeof filtered>();
    for (const s of filtered) {
      const key = `${s.carrierName} / Slot ${s.slotPosition}${s.cardArticle ? ` (${s.cardArticle})` : ""}`;
      let arr = groups.get(key);
      if (!arr) {
        arr = [];
        groups.set(key, arr);
      }
      arr.push(s);
    }
    return groups;
  }, [filtered]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b space-y-2">
        <div className="flex items-center gap-2">
          <Link
            href={`/devtools/${projectId}/connect`}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-sm font-semibold">Live Monitor</h1>
          <span className="text-xs text-muted-foreground ml-auto">
            {subscribableIds.length} signals
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter signals..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border bg-background"
          />
        </div>
      </div>

      {/* Signal list */}
      <div className="flex-1 overflow-auto">
        {isLoading && (
          <p className="p-4 text-sm text-muted-foreground">Loading signals...</p>
        )}

        {Array.from(grouped.entries()).map(([groupName, groupSignals]) => (
          <div key={groupName}>
            <div className="sticky top-0 px-4 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 border-b">
              {groupName}
            </div>
            {groupSignals.map((sig) => {
              const live = liveValues.get(sig.signalId);
              const isStale =
                live && Date.now() - new Date(live.timestamp).getTime() > 5000;
              const isBad = live && live.statusCode !== 0;

              return (
                <div
                  key={sig.signalId}
                  className="flex items-center gap-2 px-4 py-2 border-b text-sm"
                >
                  {/* Status dot */}
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      !live && "bg-muted-foreground/20",
                      live && !isStale && !isBad && "bg-green-500",
                      live && isStale && !isBad && "bg-yellow-500",
                      isBad && "bg-red-500",
                    )}
                  />

                  {/* Tag + description */}
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs truncate">{sig.tag}</p>
                    {sig.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {sig.description}
                      </p>
                    )}
                  </div>

                  {/* Live value */}
                  <div className="text-right shrink-0">
                    {live ? (
                      <span
                        className={cn(
                          "font-mono text-sm font-medium tabular-nums",
                          isBad && "text-destructive",
                        )}
                      >
                        {formatValue(live.value, sig.signalType)}
                        {sig.unit && (
                          <span className="text-xs text-muted-foreground ml-1">
                            {sig.unit}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {!isLoading && filtered.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            {filter ? "No signals match the filter." : "No signals found for this PLC."}
          </p>
        )}
      </div>
    </div>
  );
}

function formatValue(value: unknown, signalType: string | null): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "ON" : "OFF";
  if (typeof value === "number") {
    // Show 1 decimal for analog, integer for others
    if (signalType === "ANALOG") return value.toFixed(1);
    return String(value);
  }
  return String(value);
}
