"use client";

import { trpc } from "@/trpc/client";

export function CanIdSpanSection({ networkId }: { networkId: number }) {
  const { data = [], isLoading } = trpc.projectHardware.busCanIds.useQuery({ busId: networkId });

  const toHex = (n: number) => `0x${n.toString(16).toUpperCase().padStart(3, "0")}`;

  const instanceSpans = data.map((inst) => {
    const effectiveIds = inst.component.signals
      .map((s) => (s.canId ?? 0) + (inst.canIdOffset ?? 0))
      .filter((id) => id > 0);
    return {
      id: inst.id,
      name: inst.name,
      offset: inst.canIdOffset,
      signalCount: inst.component.signals.length,
      min: effectiveIds.length > 0 ? Math.min(...effectiveIds) : null,
      max: effectiveIds.length > 0 ? Math.max(...effectiveIds) : null,
    };
  });

  const allBounds = instanceSpans.flatMap((s) =>
    s.min != null && s.max != null ? [s.min, s.max] : []
  );
  const globalMin = allBounds.length > 0 ? Math.min(...allBounds) : null;
  const globalMax = allBounds.length > 0 ? Math.max(...allBounds) : null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        CAN ID Spans
      </h3>
      <p className="text-xs text-muted-foreground">
        Effective CAN IDs per device (component base ID + instance offset). Use the aggregate range to
        configure hardware acceptance filters.
      </p>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : instanceSpans.length === 0 ? (
        <p className="text-sm text-muted-foreground">No devices with CAN signal definitions.</p>
      ) : (
        <>
          {globalMin != null && (
            <div className="rounded-md border bg-muted/30 px-4 py-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                Aggregate filter span
              </p>
              <p className="text-sm font-mono font-semibold">
                {toHex(globalMin)} – {toHex(globalMax!)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {globalMax! - globalMin + 1} IDs (decimal {globalMin} – {globalMax})
              </p>
            </div>
          )}

          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Device</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Offset</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Signals</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">CAN ID Range</th>
                </tr>
              </thead>
              <tbody>
                {instanceSpans.map((span) => (
                  <tr key={span.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{span.name}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">
                      {span.offset != null ? `+${span.offset}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{span.signalCount}</td>
                    <td className="px-3 py-2 font-mono">
                      {span.min != null ? (
                        span.min === span.max ? (
                          toHex(span.min)
                        ) : (
                          `${toHex(span.min)} – ${toHex(span.max!)}`
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
