"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { trpc } from "@/trpc/client";
import { useDevTools } from "../../layout";
import type { ServerMessage } from "@/server/lib/ws/protocol";
import { Cpu, Plug, Unplug, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type PlcStatus = { connected: boolean; status: string; error?: string };

export default function ConnectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { wsConnected, send, subscribe } = useDevTools();
  const [statuses, setStatuses] = useState<Map<number, PlcStatus>>(new Map());

  const { data: hardware } = trpc.projectHardware.getHardware.useQuery({
    projectId: Number(projectId),
  });

  // Listen for connection status updates
  useEffect(() => {
    return subscribe((msg: ServerMessage) => {
      if (msg.type === "connection") {
        setStatuses((prev) => {
          const next = new Map(prev);
          next.set(msg.plcId, {
            connected: msg.connected,
            status: msg.status,
            error: msg.error,
          });
          return next;
        });
      }
    });
  }, [subscribe]);

  const plcs = hardware?.plcs ?? [];

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-lg font-semibold mb-1">PLC Connections</h1>
      <p className="text-xs text-muted-foreground mb-4">
        {wsConnected ? "WebSocket connected" : "WebSocket disconnected — reconnecting..."}
      </p>

      <div className="flex flex-col gap-3">
        {plcs.map((plc) => {
          const st = statuses.get(plc.id);
          const isConnected = st?.connected === true;
          const isConnecting = st?.status === "connecting" || st?.status === "reconnecting";

          return (
            <div
              key={plc.id}
              className="flex items-center gap-3 p-3 rounded-lg border"
            >
              <Cpu className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{plc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {plc.ipAddress ?? "No IP configured"}
                </p>
                {st?.error && (
                  <p className="text-xs text-destructive mt-0.5 truncate">{st.error}</p>
                )}
              </div>

              {/* Status badge */}
              <div
                className={cn(
                  "h-2.5 w-2.5 rounded-full shrink-0",
                  isConnected && "bg-green-500",
                  isConnecting && "bg-yellow-500 animate-pulse",
                  !isConnected && !isConnecting && "bg-muted-foreground/30",
                )}
              />

              {/* Connect/disconnect button */}
              {plc.ipAddress && (
                <button
                  onClick={() => {
                    const id = `conn-${plc.id}-${Date.now()}`;
                    if (isConnected) {
                      send({ type: "disconnect", id, plcId: plc.id });
                    } else {
                      send({ type: "connect", id, plcId: plc.id });
                    }
                  }}
                  disabled={!wsConnected || isConnecting}
                  className={cn(
                    "flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    isConnected
                      ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                      : "bg-primary/10 text-primary hover:bg-primary/20",
                    (!wsConnected || isConnecting) && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {isConnecting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isConnected ? (
                    <Unplug className="h-3.5 w-3.5" />
                  ) : (
                    <Plug className="h-3.5 w-3.5" />
                  )}
                  {isConnected ? "Disconnect" : "Connect"}
                </button>
              )}

              {/* Link to monitor when connected */}
              {isConnected && (
                <Link
                  href={`/devtools/${projectId}/monitor/${plc.id}`}
                  className="text-xs text-primary hover:underline"
                >
                  Monitor →
                </Link>
              )}
            </div>
          );
        })}

        {plcs.length === 0 && (
          <p className="text-sm text-muted-foreground">No PLCs in this project.</p>
        )}
      </div>
    </div>
  );
}
