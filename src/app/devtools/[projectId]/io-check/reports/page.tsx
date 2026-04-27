"use client";

/**
 * IO-Check Reports — every session in this project across all PLCs, with
 * pass/fail/pending/skipped counts and links to the per-session detail or
 * the cross-tab summary matrix.
 */

import { use } from "react";
import Link from "next/link";
import { trpc } from "@/trpc/client";
import { ArrowLeft, Grid3x3, ChevronRight, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function IoCheckReportsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { data: sessions = [], isLoading } = trpc.devtools.ioCheckListForProject.useQuery({
    projectId: Number(projectId),
  });

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <Link href={`/devtools/${projectId}/io-check`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-sm font-semibold flex-1">Reports</h1>
        <Link
          href={`/devtools/${projectId}/io-check/reports/matrix`}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border hover:bg-accent"
        >
          <Grid3x3 className="h-3.5 w-3.5" />
          Summary matrix
        </Link>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-2 max-w-3xl mx-auto w-full">
        {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!isLoading && sessions.length === 0 && (
          <p className="text-xs text-muted-foreground">No reports yet. Start an IO-check from the landing page.</p>
        )}
        {sessions.map((s) => {
          const date = new Date(s.startedAt).toLocaleString();
          const open = s.completedAt == null;
          return (
            <Link
              key={s.id}
              href={`/devtools/${projectId}/io-check/session/${s.id}`}
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
            >
              <ClipboardCheck className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{s.plcName}</p>
                  {open && <Badge variant="outline" className="text-[10px]">in progress</Badge>}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                  <span>{date}</span>
                  {s.operatorName && <span>· {s.operatorName}</span>}
                  <span>· {s.total} signals</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Counter label="PASS" n={s.PASS} className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" />
                  <Counter label="FAIL" n={s.FAIL} className="bg-red-500/15 text-red-700 dark:text-red-300" />
                  <Counter label="SKIP" n={s.SKIPPED} className="bg-amber-500/15 text-amber-700 dark:text-amber-300" />
                  <Counter label="PEND" n={s.PENDING} className="bg-muted text-muted-foreground" />
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Counter({ label, n, className }: { label: string; n: number; className: string }) {
  if (n === 0) return null;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${className}`}>
      {label} {n}
    </span>
  );
}
