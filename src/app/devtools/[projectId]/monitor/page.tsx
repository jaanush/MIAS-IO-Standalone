"use client";

import { use } from "react";
import Link from "next/link";
import { trpc } from "@/trpc/client";
import { Activity, ChevronRight } from "lucide-react";

/** Monitor tab — select which PLC to monitor */
export default function MonitorLandingPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);

  const { data: hardware } = trpc.projectHardware.getHardware.useQuery({
    projectId: Number(projectId),
  });

  const plcs = hardware?.plcs ?? [];

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-lg font-semibold mb-1">Live Monitor</h1>
      <p className="text-xs text-muted-foreground mb-4">
        Select a PLC to view live signal values
      </p>

      <div className="flex flex-col gap-2">
        {plcs.map((plc) => (
          <Link
            key={plc.id}
            href={`/devtools/${projectId}/monitor/${plc.id}`}
            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
          >
            <Activity className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{plc.name}</p>
              <p className="text-xs text-muted-foreground">
                {plc.ipAddress ?? "No IP"}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
