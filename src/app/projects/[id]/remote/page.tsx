"use client";

import { use } from "react";
import { CodesysSettingsForm } from "../details/_components/CodesysSettingsForm";
import { CodesysTaskPanel } from "../details/_components/CodesysTaskPanel";

export default function RemotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const projectId = Number(id);

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">CODESYS Project</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Code generation settings and sync tasks for this project.
        </p>
      </div>

      {/* Settings */}
      <CodesysSettingsForm projectId={projectId} />

      {/* Tasks */}
      <CodesysTaskPanel projectId={projectId} />
    </div>
  );
}
