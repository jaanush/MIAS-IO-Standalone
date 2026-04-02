"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { ServerMessage, ClientMessage } from "@/server/lib/ws/protocol";

type MessageHandler = (msg: ServerMessage) => void;

/**
 * WebSocket hook for DevTools live monitoring.
 *
 * Connects to /ws, auto-reconnects, dispatches messages to listeners.
 * Returns send() and subscribe() functions + connection state.
 */
export function useDevToolsSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<MessageHandler>>(new Set());
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [connected, setConnected] = useState(false);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (mountedRef.current) setConnected(true);
      };

      ws.onclose = () => {
        if (mountedRef.current) {
          setConnected(false);
          // Auto-reconnect after 2s
          reconnectTimerRef.current = setTimeout(() => {
            if (mountedRef.current) connect();
          }, 2000);
        }
      };

      ws.onerror = () => {
        // onclose will fire after this — reconnect handled there
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as ServerMessage;
          for (const handler of listenersRef.current) {
            handler(msg);
          }
        } catch {
          // Ignore malformed messages
        }
      };
    } catch {
      // Connection failed — retry
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, 2000);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    // Reconnect on visibility change (phone lock/unlock)
    const onVisibility = () => {
      if (document.visibilityState === "visible" && wsRef.current?.readyState !== WebSocket.OPEN) {
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  /** Subscribe to incoming messages. Returns an unsubscribe function. */
  const subscribe = useCallback((handler: MessageHandler) => {
    listenersRef.current.add(handler);
    return () => {
      listenersRef.current.delete(handler);
    };
  }, []);

  return { connected, send, subscribe };
}
