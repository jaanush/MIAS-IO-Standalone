"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronRight, RefreshCw, X, Eye } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";

/** Structured result data stored in CodesysTask.resultData (Prisma Json field). */
interface TaskResultData {
  changes?: { applied: number; skipped: number; warnings: number };
  devices?: Array<{ name: string; ip?: string; depth?: number }>;
  ioMapping?: Array<{ name: string; parent?: string; channels?: Array<{ id: string }> }>;
  [key: string]: unknown;
}

type Task = inferRouterOutputs<AppRouter>["codesys"]["taskList"][number];

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
  const purge = trpc.codesys.taskPurgeCompleted.useMutation({
    onSuccess: () => utils.codesys.taskList.invalidate({ projectId }),
  });

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [viewResult, setViewResult] = useState<Task | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const activeTasks = tasks.filter((t) => t.status === "QUEUED" || t.status === "CLAIMED");
  const completedTasks = tasks.filter((t) => t.status === "SUCCESS" || t.status === "FAILURE");

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
            variant="outline"
            className="h-7 text-xs"
            disabled={enqueue.isPending}
            onClick={() =>
              enqueue.mutate({
                projectId,
                type: "SYNC_HARDWARE",
                params: {},
              })
            }
          >
            Sync Hardware
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={enqueue.isPending}
            onClick={() =>
              enqueue.mutate({
                projectId,
                type: "BUILD",
                params: {},
              })
            }
          >
            Build
          </Button>
        </div>
      </div>

      {activeTasks.length === 0 && completedTasks.length === 0 && !isLoading && (
        <p className="text-sm text-muted-foreground">No tasks yet.</p>
      )}

      {/* Active tasks */}
      <div className="space-y-1">
        {activeTasks.map((task) => {
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
                <span className={`ml-auto rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_BADGE[task.status]}`}>
                  {task.status}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(task.createdAt).toLocaleTimeString()}
                </span>
                {task.status === "QUEUED" && (
                  <button className="text-muted-foreground hover:text-destructive" onClick={() => cancel.mutate({ id: task.id })} title="Cancel">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {isExpanded && (
                <div className="border-t px-3 py-2 bg-muted/40 space-y-1">
                  {task.resultLog.length > 0 && <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">{task.resultLog.join("\n")}</pre>}
                  {task.resultError && <p className="text-xs text-destructive font-mono">{task.resultError}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Completed tasks (collapsible) */}
      {completedTasks.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCompleted((s) => !s)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {showCompleted ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Completed ({completedTasks.length})
          </button>
          <button
            type="button"
            onClick={() => purge.mutate({ projectId })}
            disabled={purge.isPending}
            className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
          >
            {purge.isPending ? "Purging..." : "Clear history"}
          </button>
        </div>
      )}

      {showCompleted && <div className="space-y-1">
        {completedTasks.map((task) => {
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
                {task.resultData && (
                  <button
                    className="text-blue-600 hover:text-blue-800"
                    onClick={() => setViewResult(task)}
                    title="View results"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                )}
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
      </div>}

      {viewResult && (
        <TaskResultDialog task={viewResult} onClose={() => setViewResult(null)} />
      )}
    </section>
  );
}

function TaskResultDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const data = task.resultData as TaskResultData | null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {task.type} Results
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {task.completedAt ? new Date(task.completedAt).toLocaleString() : ""}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          {data?.changes && (
            <div className="flex gap-3">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Applied: {data.changes.applied}
              </Badge>
              {data.changes.skipped > 0 && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  Skipped: {data.changes.skipped}
                </Badge>
              )}
              {data.changes.warnings > 0 && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  Warnings: {data.changes.warnings}
                </Badge>
              )}
            </div>
          )}

          {/* Devices tree */}
          {data?.devices && data.devices.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-muted-foreground">Device Tree</h3>
              <div className="rounded border bg-muted/20 p-3 text-xs font-mono space-y-0.5 max-h-[200px] overflow-y-auto">
                {data.devices.map((dev, i) => (
                  <div key={i} style={{ paddingLeft: (dev.depth ?? 0) * 16 }}>
                    <span className="text-foreground">{dev.name}</span>
                    {dev.ip && <span className="text-muted-foreground ml-2">{dev.ip}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* IO Mapping */}
          {data?.ioMapping && data.ioMapping.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-muted-foreground">I/O Mapping</h3>
              <div className="overflow-x-auto rounded border max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b bg-muted/40">
                      <th className="px-2 py-1.5 text-left font-medium">Module</th>
                      <th className="px-2 py-1.5 text-left font-medium">Parent</th>
                      <th className="px-2 py-1.5 text-left font-medium">Channels</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ioMapping.map((mod, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-2 py-1 font-mono">{mod.name}</td>
                        <td className="px-2 py-1 text-muted-foreground">{mod.parent ?? "—"}</td>
                        <td className="px-2 py-1 font-mono text-muted-foreground">
                          {mod.channels?.map((ch) => ch.id).join(", ") ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Log */}
          {task.resultLog.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-muted-foreground">Log</h3>
              <pre className="rounded border bg-muted/20 p-3 text-xs font-mono whitespace-pre-wrap text-muted-foreground max-h-[200px] overflow-y-auto">
                {task.resultLog.join("\n")}
              </pre>
            </div>
          )}

          {task.resultError && (
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-destructive">Error</h3>
              <p className="text-xs font-mono text-destructive">{task.resultError}</p>
            </div>
          )}

          {/* Raw data fallback */}
          {data && !data.devices && !data.ioMapping && !data.changes && (
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-muted-foreground">Result Data</h3>
              <pre className="rounded border bg-muted/20 p-3 text-xs font-mono whitespace-pre-wrap text-muted-foreground max-h-[300px] overflow-y-auto">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
