"use client";

import { use } from "react";
import Link from "next/link";
import { trpc } from "@/trpc/client";
import { ClipboardCheck, Plus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** IO-Check tab — shows PLC list to start new check or view past sessions */
export default function IOCheckLandingPage({
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
      <h1 className="text-lg font-semibold mb-1">IO-Check</h1>
      <p className="text-xs text-muted-foreground mb-4">
        Select a PLC to start a new IO-check session
      </p>

      <div className="flex flex-col gap-2">
        {plcs.map((plc) => (
          <Link
            key={plc.id}
            href={`/devtools/${projectId}/io-check/${plc.id}`}
            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
          >
            <ClipboardCheck className="h-5 w-5 text-muted-foreground shrink-0" />
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
