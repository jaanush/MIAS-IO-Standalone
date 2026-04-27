"use client";

import { use, useMemo, useState } from "react";
import { trpc } from "@/trpc/client";
import { useFr007LiveReadings } from "@/hooks/use-fr007-live-readings";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  SkipForward,
  FastForward,
  ArrowLeft,
  Flag,
} from "lucide-react";
import Link from "next/link";

/** Active IO-Check workflow — one signal at a time with pass/fail */
export default function IOCheckSessionPage({
  params,
}: {
  params: Promise<{ projectId: string; sessionId: string }>;
}) {
  const { projectId, sessionId } = use(params);
  const [currentIndex, setCurrentIndex] = useState(0);

  const utils = trpc.useUtils();
  const { data: session, isLoading } = trpc.devtools.ioCheckGet.useQuery({
    sessionId: Number(sessionId),
  });

  const updateResult = trpc.devtools.ioCheckUpdate.useMutation({
    onSuccess: () => {
      utils.devtools.ioCheckGet.invalidate({ sessionId: Number(sessionId) });
    },
  });

  const completeSession = trpc.devtools.ioCheckComplete.useMutation({
    onSuccess: () => {
      utils.devtools.ioCheckGet.invalidate({ sessionId: Number(sessionId) });
    },
  });

  const results = session?.results ?? [];
  const current = results[currentIndex];

  // Live readings via FR-007 (plugin-pushed). Monitoring is auto-enabled
  // for every signal in the session by `ioCheckCreate`. We poll just the
  // current signal at 1s; switching signals re-queries seamlessly.
  const currentSignalIds = useMemo(
    () => (current ? [current.signalId] : []),
    [current],
  );
  const liveValues = useFr007LiveReadings(currentSignalIds, "SCALED", 1000);
  const liveValue = current ? liveValues.get(current.signalId) : null;

  // Skip-to-next-module: jump past every result whose source io_card matches
  // the current signal's card. Compare by ioCard.id resolved on each result.
  const skipToNextModule = () => {
    if (!current) return;
    const currentCardId = (current.signal as any)?.ioCard?.id ?? null;
    if (currentCardId == null) {
      // No card — fall back to plain next-signal behaviour.
      if (currentIndex < results.length - 1) setCurrentIndex(currentIndex + 1);
      return;
    }
    for (let i = currentIndex + 1; i < results.length; i++) {
      const cardId = (results[i].signal as any)?.ioCard?.id ?? null;
      if (cardId !== currentCardId) {
        setCurrentIndex(i);
        return;
      }
    }
    // No further module — go to the end.
    setCurrentIndex(results.length - 1);
  };

  // Progress stats
  const checked = results.filter((r) => r.status !== "PENDING").length;
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  const markAndNext = (status: "PASS" | "FAIL" | "SKIPPED") => {
    if (!current) return;
    updateResult.mutate(
      {
        resultId: current.id,
        status,
        measuredValue: liveValue ? String(liveValue.value) : undefined,
      },
      {
        onSuccess: () => {
          if (currentIndex < results.length - 1) {
            setCurrentIndex((i) => i + 1);
          }
        },
      },
    );
  };

  if (isLoading) {
    return <p className="p-4 text-sm text-muted-foreground">Loading session...</p>;
  }

  if (!session) {
    return <p className="p-4 text-sm text-destructive">Session not found.</p>;
  }

  const isComplete = session.completedAt != null;

  // Summary view when complete
  if (isComplete || checked === results.length) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <Link
            href={`/devtools/${projectId}/connect`}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-sm font-semibold">IO-Check Complete</h1>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-green-500/10 p-3">
              <p className="text-2xl font-bold text-green-600">{passed}</p>
              <p className="text-xs text-muted-foreground">Passed</p>
            </div>
            <div className="rounded-lg bg-red-500/10 p-3">
              <p className="text-2xl font-bold text-red-600">{failed}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-2xl font-bold">
                {results.length - passed - failed}
              </p>
              <p className="text-xs text-muted-foreground">Skipped</p>
            </div>
          </div>

          {/* Result list */}
          <div className="border rounded-lg divide-y">
            {results.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 px-3 py-2 text-sm"
              >
                <div
                  className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    r.status === "PASS" && "bg-green-500",
                    r.status === "FAIL" && "bg-red-500",
                    r.status === "SKIPPED" && "bg-muted-foreground/30",
                    r.status === "PENDING" && "bg-yellow-500",
                  )}
                />
                <span className="font-mono text-xs truncate flex-1">
                  {r.signal.tag}
                </span>
                <span className="text-xs text-muted-foreground">
                  {r.measuredValue ?? "—"}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    r.status === "PASS" && "text-green-600",
                    r.status === "FAIL" && "text-red-600",
                  )}
                >
                  {r.status}
                </span>
              </div>
            ))}
          </div>

          {!isComplete && (
            <button
              onClick={() =>
                completeSession.mutate({ sessionId: Number(sessionId) })
              }
              className="w-full py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium"
            >
              <Flag className="h-4 w-4 inline mr-1" />
              Mark Session Complete
            </button>
          )}
        </div>
      </div>
    );
  }

  // Active check view — one signal at a time
  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      <div className="px-4 py-2 border-b">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>
            Signal {currentIndex + 1} of {results.length}
          </span>
          <span>
            {checked} checked ({passed} ✓ {failed} ✗)
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(checked / results.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Signal card — large display */}
      {current && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
          {/* Signal tag */}
          <p className="font-mono text-lg font-semibold text-center">
            {current.signal.tag}
          </p>
          {current.signal.description && (
            <p className="text-sm text-muted-foreground text-center">
              {current.signal.description}
            </p>
          )}

          {/* Live value — BIG */}
          <div className="flex flex-col items-center gap-1">
            {liveValue ? (
              <>
                {current.signal.signalType === "DISCRETE" ? (
                  <div
                    className={cn(
                      "px-8 py-4 rounded-xl text-3xl font-bold",
                      liveValue.value
                        ? "bg-green-500/20 text-green-600"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {liveValue.value ? "ON" : "OFF"}
                  </div>
                ) : (
                  <p className="text-5xl font-bold tabular-nums">
                    {typeof liveValue.value === "number"
                      ? liveValue.value.toFixed(1)
                      : String(liveValue.value ?? "—")}
                  </p>
                )}
                {current.signal.analogSignal?.engineeringUnit?.symbol && (
                  <p className="text-lg text-muted-foreground">
                    {current.signal.analogSignal.engineeringUnit.symbol}
                  </p>
                )}
                <p
                  className={cn(
                    "text-xs",
                    liveValue.status === "Good"
                      ? "text-green-600"
                      : "text-destructive",
                  )}
                >
                  {liveValue.status}
                </p>
              </>
            ) : (
              <p className="text-3xl text-muted-foreground">—</p>
            )}
          </div>

          {/* Current status badge */}
          {current.status !== "PENDING" && (
            <div
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium",
                current.status === "PASS" && "bg-green-500/20 text-green-600",
                current.status === "FAIL" && "bg-red-500/20 text-red-600",
                current.status === "SKIPPED" && "bg-muted text-muted-foreground",
              )}
            >
              {current.status}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="px-4 py-3 border-t bg-background space-y-2">
        {/* Pass / Fail / Skip */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => markAndNext("PASS")}
            disabled={updateResult.isPending}
            className="flex items-center justify-center gap-1 py-3 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
          >
            <Check className="h-4 w-4" />
            Pass
          </button>
          <button
            onClick={() => markAndNext("FAIL")}
            disabled={updateResult.isPending}
            className="flex items-center justify-center gap-1 py-3 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
          >
            <X className="h-4 w-4" />
            Fail
          </button>
          <button
            onClick={() => markAndNext("SKIPPED")}
            disabled={updateResult.isPending}
            className="flex items-center justify-center gap-1 py-3 rounded-lg bg-muted text-muted-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            <SkipForward className="h-4 w-4" />
            Skip
          </button>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <button
            onClick={skipToNextModule}
            disabled={currentIndex === results.length - 1}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
            title="Skip to first signal of next module"
          >
            <FastForward className="h-3.5 w-3.5" />
            Next module
          </button>
          <button
            onClick={() =>
              setCurrentIndex((i) => Math.min(results.length - 1, i + 1))
            }
            disabled={currentIndex === results.length - 1}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
