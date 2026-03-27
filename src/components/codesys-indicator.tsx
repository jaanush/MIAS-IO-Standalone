"use client";

import Link from "next/link";
import { trpc } from "@/trpc/client";
import { Network } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function CodesysIndicator() {
  const { data: sessions = [] } = trpc.codesys.activeSessions.useQuery(
    {},
    { refetchInterval: 10_000 }
  );

  const connected = sessions.length > 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href="/settings/remote" className="relative flex items-center justify-center h-8 w-8">
            <Network className={`h-4 w-4 ${connected ? "text-green-500" : "text-muted-foreground/30"}`} />
            {connected && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            )}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {connected ? (
            <div className="space-y-1">
              <div className="font-medium text-green-600">CODESYS Connected</div>
              {sessions.map((s) => (
                <div key={s.id} className="text-muted-foreground">
                  {s.hostname} — {s.email}
                  {s.pluginVersion && <span className="ml-1 opacity-60">v{s.pluginVersion}</span>}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">CODESYS not connected</span>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
