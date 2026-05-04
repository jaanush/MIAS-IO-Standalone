"use client";

import { use, useEffect, useMemo, useState } from "react";
import { trpc } from "@/trpc/client";
import { useDevTools } from "../../../layout";
import { useLiveValues } from "@/hooks/use-live-values";
import { cn } from "@/lib/utils";
import {
  qualityFromStatusCode,
  qualityDotClass,
  qualityTextClass,
} from "@/lib/opcua-quality";
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

  // Tokenized AND-match — every space-separated token must appear somewhere
  // in any searchable field. Lets you type "pump tank" or "tank D03" and
  // narrow incrementally, regardless of word order.
  const filtered = useMemo(() => {
    if (!signals) return [];
    const tokens = filter.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return signals;
    return signals.filter((s) => {
      const haystack = [
        s.tag,
        s.description,
        s.carrierName,
        s.cardArticle,
        s.signalType,
        s.direction,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return tokens.every((t) => haystack.includes(t));
    });
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
              const quality = live ? qualityFromStatusCode(live.statusCode) : null;
              const isStale =
                live && Date.now() - new Date(live.timestamp).getTime() > 5000;

              return (
                <div
                  key={sig.signalId}
                  className="flex items-center gap-2 px-4 py-2 border-b text-sm"
                >
                  {/* Status dot — quality drives the color, stale adds a ring */}
                  <div
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      !live && "bg-muted-foreground/20",
                      quality && qualityDotClass(quality),
                      isStale && "ring-2 ring-yellow-400/60",
                    )}
                    title={live ? `${live.status} (0x${live.statusCode.toString(16).padStart(8, "0")})` : "no data"}
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
                    {live && quality ? (
                      <span
                        className={cn(
                          "font-mono text-sm font-medium tabular-nums",
                          qualityTextClass(quality),
                        )}
                        title={live.status}
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
