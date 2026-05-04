"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/trpc/client";
import { cn } from "@/lib/utils";
import { ArrowLeft, CheckSquare, Square, Play, Search } from "lucide-react";
import Link from "next/link";

/** IO-Check signal selection — pick which signals to check, then start a session */
export default function IOCheckSelectPage({
  params,
}: {
  params: Promise<{ projectId: string; plcId: string }>;
}) {
  const { projectId, plcId } = use(params);
  const plcIdNum = Number(plcId);
  const router = useRouter();

  const { data: signals, isLoading } = trpc.devtools.plcSignals.useQuery({
    plcId: plcIdNum,
  });

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [operatorName, setOperatorName] = useState("");
  const [filter, setFilter] = useState("");

  const createSession = trpc.devtools.ioCheckCreate.useMutation({
    onSuccess: (session) => {
      router.push(`/devtools/${projectId}/io-check/session/${session.id}`);
    },
  });

  // Tokenized AND-match against tag/description/carrier/card.
  const filtered = useMemo(() => {
    if (!signals) return [];
    const tokens = filter.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return signals;
    return signals.filter((s) => {
      const haystack = [s.tag, s.description, s.carrierName, s.cardArticle]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return tokens.every((t) => haystack.includes(t));
    });
  }, [signals, filter]);

  // Group by carrier + card
  const grouped = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof signals>>();
    for (const s of filtered) {
      if (!s.nodeId) continue; // Skip signals without OPC UA mapping
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

  const toggleSignal = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const all = (signals ?? []).filter((s) => s.nodeId).map((s) => s.signalId);
    setSelected(new Set(all));
  };

  const selectNone = () => setSelected(new Set());

  const startCheck = () => {
    if (selected.size === 0) return;
    createSession.mutate({
      projectId: Number(projectId),
      plcId: plcIdNum,
      operatorName: operatorName || undefined,
      signalIds: Array.from(selected),
    });
  };

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
          <h1 className="text-sm font-semibold">IO-Check — Select Signals</h1>
        </div>

        <input
          type="text"
          placeholder="Operator name (optional)"
          value={operatorName}
          onChange={(e) => setOperatorName(e.target.value)}
          className="w-full px-3 py-1.5 text-sm rounded-md border bg-background"
        />

        <div className="flex items-center gap-2 text-xs">
          <button onClick={selectAll} className="text-primary hover:underline">
            Select all
          </button>
          <span className="text-muted-foreground">|</span>
          <button onClick={selectNone} className="text-primary hover:underline">
            Clear
          </button>
          <span className="ml-auto text-muted-foreground">
            {selected.size} selected
          </span>
        </div>
      </div>

      {/* Signal list with checkboxes */}
      <div className="flex-1 overflow-auto">
        {isLoading && (
          <p className="p-4 text-sm text-muted-foreground">Loading signals...</p>
        )}

        {Array.from(grouped.entries()).map(([groupName, groupSignals]) => (
          <div key={groupName}>
            <div className="sticky top-0 px-4 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 border-b">
              {groupName}
            </div>
            {groupSignals.map((sig) => (
              <button
                key={sig.signalId}
                onClick={() => toggleSignal(sig.signalId)}
                className="flex items-center gap-3 w-full px-4 py-2.5 border-b text-left hover:bg-accent/50 transition-colors"
              >
                {selected.has(sig.signalId) ? (
                  <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-mono text-xs truncate">{sig.tag}</p>
                  {sig.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {sig.description}
                    </p>
                  )}
                </div>
                <span className="ml-auto text-xs text-muted-foreground shrink-0">
                  {sig.signalType} {sig.direction}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Start button */}
      <div className="px-4 py-3 border-t bg-background">
        <button
          onClick={startCheck}
          disabled={selected.size === 0 || createSession.isPending}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors",
            selected.size > 0
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed",
          )}
        >
          <Play className="h-4 w-4" />
          Start IO-Check ({selected.size} signals)
        </button>
      </div>
    </div>
  );
}
