"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, RefreshCw, X } from "lucide-react";

type Task = {
  id: string;
  type: string;
  status: "QUEUED" | "CLAIMED" | "SUCCESS" | "FAILURE";
  params: unknown;
  resultLog: string[];
  resultError: string | null;
  claimedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

const STATUS_BADGE: Record<Task["status"], string> = {
  QUEUED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  CLAIMED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  SUCCESS: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  FAILURE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function CodesysTaskPanel({ projectId }: { projectId: number }) {
  const utils = trpc.useUtils();
  const { data: tasks = [], isLoading } = trpc.codesys.taskList.useQuery(
    { projectId },
    { refetchInterval: 5000 }
  );

  const enqueue = trpc.codesys.taskEnqueue.useMutation({
    onSuccess: () => utils.codesys.taskList.invalidate({ projectId }),
  });
  const cancel = trpc.codesys.taskCancel.useMutation({
    onSuccess: () => utils.codesys.taskList.invalidate({ projectId }),
  });

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          CODESYS Sync
        </h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={isLoading}
            onClick={() => utils.codesys.taskList.invalidate({ projectId })}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={enqueue.isPending}
            onClick={() =>
              enqueue.mutate({
                projectId,
                type: "SYNC_GVLS",
                params: {},
              })
            }
          >
            {enqueue.isPending ? "Queuing…" : "Sync GVLs"}
          </Button>
        </div>
      </div>

      {tasks.length === 0 && !isLoading && (
        <p className="text-sm text-muted-foreground">No tasks yet. Click &quot;Sync GVLs&quot; to queue a sync.</p>
      )}

      <div className="space-y-1">
        {tasks.map((task) => {
          const isExpanded = expanded.has(task.id);
          const hasLog = task.resultLog.length > 0 || task.resultError;
          return (
            <div key={task.id} className="rounded-md border text-sm">
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={!hasLog}
                  onClick={() => toggleExpand(task.id)}
                >
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                <span className="font-mono text-xs">{task.type}</span>
                <span
                  className={`ml-auto rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_BADGE[task.status]}`}
                >
                  {task.status}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(task.createdAt).toLocaleTimeString()}
                </span>
                {task.status === "QUEUED" && (
                  <button
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => cancel.mutate({ id: task.id })}
                    title="Cancel"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {isExpanded && (
                <div className="border-t px-3 py-2 bg-muted/40 space-y-1">
                  {task.resultLog.length > 0 && (
                    <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">
                      {task.resultLog.join("\n")}
                    </pre>
                  )}
                  {task.resultError && (
                    <p className="text-xs text-destructive font-mono">{task.resultError}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
