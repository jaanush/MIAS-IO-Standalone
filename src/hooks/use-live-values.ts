"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ServerMessage } from "@/server/lib/ws/protocol";

interface LiveValue {
  value: unknown;
  dataType: string;
  timestamp: string;
  status: string;
  statusCode: number;
}

/**
 * Subscribe to live OPC UA values for a set of signals.
 *
 * Returns a Map<signalId, LiveValue> that updates in real-time.
 * Automatically subscribes/unsubscribes via the WebSocket.
 */
export function useLiveValues(
  send: (msg: any) => void,
  subscribe: (handler: (msg: ServerMessage) => void) => () => void,
  wsConnected: boolean,
  plcId: number | null,
  signalIds: number[],
) {
  const [values, setValues] = useState<Map<number, LiveValue>>(new Map());
  const subscribedRef = useRef(false);
  const reqIdRef = useRef(0);

  // Subscribe to value updates from WebSocket
  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === "values" && msg.plcId === plcId) {
        setValues((prev) => {
          const next = new Map(prev);
          for (const u of msg.updates) {
            next.set(u.signalId, {
              value: u.value,
              dataType: u.dataType,
              timestamp: u.ts,
              status: u.status,
              statusCode: u.statusCode,
            });
          }
          return next;
        });
      }
    });
    return unsub;
  }, [subscribe, plcId]);

  // Send subscribe/unsubscribe messages when signalIds change
  useEffect(() => {
    if (!wsConnected || !plcId || signalIds.length === 0) return;

    const id = `sub-${++reqIdRef.current}`;
    send({ type: "subscribe", id, plcId, signalIds });
    subscribedRef.current = true;

    return () => {
      if (subscribedRef.current && signalIds.length > 0) {
        const unsubId = `unsub-${++reqIdRef.current}`;
        send({ type: "unsubscribe", id: unsubId, plcId, signalIds });
        subscribedRef.current = false;
      }
    };
  }, [wsConnected, plcId, signalIds, send]);

  return values;
}
