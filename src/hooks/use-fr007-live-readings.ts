"use client";

/**
 * FR-007 live-readings hook — drop-in replacement for `useLiveValues` (the
 * older OPC UA WebSocket flow). Polls `signalLiveReadingsByIds` at the
 * given interval and exposes a Map<signalId, LiveValue> with the same
 * shape so call sites can swap with minimal change.
 *
 * The plugin pushes readings to `signal_reading_live`; this hook just
 * tails the cache. For the IO-check wizard, monitoring is auto-enabled
 * on session create (see `devtools.ioCheckCreate`).
 */

import { useMemo } from "react";
import { trpc } from "@/trpc/client";

export type LiveValue = {
  value: unknown;
  dataType: string;
  timestamp: string;
  status: string;
  statusCode: number;
};

/**
 * @param signalIds — list of project signal ids to fetch readings for
 * @param mode      — SCALED (DAO output, default) or RAW (HAL input)
 * @param intervalMs — poll interval; defaults to 1s for live UI
 */
export function useFr007LiveReadings(
  signalIds: number[],
  mode: "SCALED" | "RAW" = "SCALED",
  intervalMs = 1000,
) {
  const { data = [] } = trpc.devtools.signalLiveReadingsByIds.useQuery(
    { signalIds, mode },
    {
      enabled: signalIds.length > 0,
      refetchInterval: signalIds.length > 0 ? intervalMs : false,
    },
  );

  return useMemo(() => {
    const map = new Map<number, LiveValue>();
    for (const r of data) {
      // Map the JMobile-shaped `state` into a Good/Bad/Stale-style status.
      const status =
        r.state === "Good"
          ? "Good"
          : r.state === "Bad" || r.state === "Error"
            ? "Bad"
            : r.state === "Stale"
              ? "Stale"
              : r.state ?? "Unknown";
      map.set(r.signalId, {
        value: r.value,
        dataType: "",
        timestamp: r.tsPlugin instanceof Date ? r.tsPlugin.toISOString() : String(r.tsPlugin),
        status,
        statusCode: status === "Good" ? 0 : 1,
      });
    }
    return map;
  }, [data]);
}
