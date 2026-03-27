"use client";

import { use, useEffect, useState } from "react";
import { trpc } from "@/trpc/client";
import { CodesysSettingsForm } from "../details/_components/CodesysSettingsForm";
import { CodesysTaskPanel } from "../details/_components/CodesysTaskPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Network, Download } from "lucide-react";

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

  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  useEffect(() => {
    fetch("/api/codesys/plugin/repository")
      .then((r) => r.ok ? r.json() : null)
      .then(setRepoInfo)
      .catch(() => {});
  }, []);

  const latestVersion = repoInfo?.latest?.version ?? null;

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
                  {latestVersion && s.pluginVersion !== latestVersion && (
                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700">
                      v{latestVersion} available
                    </Badge>
                  )}
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

      {/* Plugin download */}
      <PluginDownload info={repoInfo} />

      {/* Settings */}
      <CodesysSettingsForm projectId={projectId} />

      {/* Tasks */}
      <CodesysTaskPanel projectId={projectId} />
    </div>
  );
}

type RepoInfo = { latest: { version: string; filename: string; size: number; downloadUrl: string } | null };

function PluginDownload({ info }: { info: RepoInfo | null }) {
  if (!info?.latest) return null;

  const sizeMB = (info.latest.size / 1024 / 1024).toFixed(1);

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        MIAS Plugin
      </h2>
      <div className="rounded-md border px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{info.latest.filename}</p>
          <p className="text-xs text-muted-foreground">
            Version {info.latest.version} &middot; {sizeMB} MB
          </p>
        </div>
        <Button size="sm" variant="outline" asChild>
          <a href="/api/codesys/plugin/download">
            <Download className="h-4 w-4 mr-1" /> Download
          </a>
        </Button>
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        <p className="font-medium">Installation:</p>
        <ol className="list-decimal list-inside space-y-0.5 ml-1">
          <li>Download the .package file above</li>
          <li>In CODESYS: Tools &rarr; Package Manager &rarr; Install...</li>
          <li>Select the downloaded file, check &quot;Allow unsigned and self-signed packages&quot;</li>
          <li>Restart CODESYS</li>
        </ol>
        <p className="mt-2 text-amber-600 dark:text-amber-400">
          On first launch CODESYS may warn &quot;plug-in does not have a plug-in key&quot; &mdash; click No to continue. This is expected for unsigned plugins.
        </p>
      </div>
    </section>
  );
}
