"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDevToolsSocket } from "@/hooks/use-devtools-socket";
import { createContext, useContext } from "react";
import type { ServerMessage, ClientMessage } from "@/server/lib/ws/protocol";

// Context for WebSocket — shared across all devtools pages
interface DevToolsContextValue {
  wsConnected: boolean;
  send: (msg: ClientMessage) => void;
  subscribe: (handler: (msg: ServerMessage) => void) => () => void;
}

const DevToolsContext = createContext<DevToolsContextValue | null>(null);

export function useDevTools() {
  const ctx = useContext(DevToolsContext);
  if (!ctx) throw new Error("useDevTools must be used within DevTools layout");
  return ctx;
}

export default function DevToolsLayout({ children }: { children: React.ReactNode }) {
  const { connected, send, subscribe } = useDevToolsSocket();
  const pathname = usePathname();

  return (
    <DevToolsContext.Provider value={{ wsConnected: connected, send, subscribe }}>
      <div className="flex flex-col h-full">
        {/* Compact mobile header */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <Link href="/devtools" className="font-semibold text-sm">
            MIAS DevTools
          </Link>
          <div className="flex items-center gap-2">
            {connected ? (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <Wifi className="h-3.5 w-3.5" />
                Live
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <WifiOff className="h-3.5 w-3.5" />
                Offline
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </DevToolsContext.Provider>
  );
}
