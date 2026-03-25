"use client";

import { use } from "react";
import { trpc } from "@/trpc/client";
import { CodesysSettingsForm } from "../details/_components/CodesysSettingsForm";
import { CodesysTaskPanel } from "../details/_components/CodesysTaskPanel";
import { Badge } from "@/components/ui/badge";
import { Network } from "lucide-react";

/** Shape of the JSON metadata blob stored on CodesysSession. */
interface SessionMetadata {
  projectName?: string;
  gvlCount?: number;
  pouCount?: number;
  dutCount?: number;
}

export default function RemotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const projectId = Number(id);

  const { data: sessions = [] } = trpc.codesys.activeSessions.useQuery(
    { projectId },
    { refetchInterval: 5_000 }
  );

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">CODESYS Remote</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage CODESYS plugin connections, tasks, and code generation settings.
        </p>
      </div>

      {/* Active sessions */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Active Sessions
        </h2>
        {sessions.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center">
            <Network className="h-8 w-8 mx-auto text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground mt-2">No CODESYS sessions connected</p>
            <p className="text-xs text-muted-foreground mt-1">
              Start the MIAS plugin in CODESYS to establish a connection.
            </p>
          </div>
        ) : (
          <div className="rounded-md border divide-y">
            {sessions.map((s) => {
              const meta = s.metadata as SessionMetadata | null;
              return (
              <div key={s.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Network className="h-5 w-5 text-green-500" />
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{s.hostname}</div>
                    <div className="text-xs text-muted-foreground">{s.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <Badge variant="outline" className="text-[10px]">v{s.pluginVersion}</Badge>
                  {s.projectOpen && (
                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                      Project Open
                    </Badge>
                  )}
                  {meta?.projectName && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {meta.projectName}
                    </span>
                  )}
                  {meta && (
                    <span className="text-[10px] text-muted-foreground">
                      GVL:{meta.gvlCount ?? 0} POU:{meta.pouCount ?? 0} DUT:{meta.dutCount ?? 0}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(s.lastHeartbeatAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Settings */}
      <CodesysSettingsForm projectId={projectId} />

      {/* Tasks */}
      <CodesysTaskPanel projectId={projectId} />
    </div>
  );
}
