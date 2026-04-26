"use client";

/**
 * Reusable curve editor dialog.
 *
 * Renders an editable point grid for a piecewise-linear lookup curve
 * (FR-008). Used by the per-instance parameter editor for CURVE-typed
 * parameters and anywhere else a Curve row needs maintenance.
 *
 * Server enforces ascending x — the dialog previews and blocks save when
 * violated.
 */

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { trpc } from "@/trpc/client";
import { CURVE_TYPES, type CurveType } from "@/lib/enums";

type Point = { x: string; y: string };

type Props = {
  open: boolean;
  onClose: () => void;
  /** Existing curve to edit. Pass null to create a new one. */
  curveId: number | null;
  /** Type label suggested for new curves; existing types are loaded from the curve. */
  defaultType?: CurveType;
  /** When set, enables a live-capture section that lets the user fill x from
   *  a project signal's current reading (FR-008 + FR-007). */
  projectId?: number;
  /**
   * Called after save with the resulting curve id (existing or newly created).
   * Caller is expected to wire it into whatever consumed the curve (e.g. an
   * instance parameter row).
   */
  onSaved: (curveId: number) => void;
};

export function CurveEditor({ open, onClose, curveId, defaultType, projectId, onSaved }: Props) {
  const utils = trpc.useUtils();
  const { data: existing } = trpc.components.curveById.useQuery(
    { id: curveId ?? -1 },
    { enabled: !!curveId && open },
  );

  const [type, setType] = useState<CurveType>(defaultType ?? "GENERIC");
  const [points, setPoints] = useState<Point[]>([
    { x: "", y: "" },
    { x: "", y: "" },
  ]);

  // Hydrate from server when the dialog opens for an existing curve
  useEffect(() => {
    if (!open) return;
    if (existing) {
      setType(existing.type as CurveType);
      setPoints(
        existing.points.length >= 2
          ? existing.points.map((p) => ({ x: String(p.x), y: String(p.y) }))
          : [{ x: "", y: "" }, { x: "", y: "" }],
      );
    } else if (!curveId) {
      // Fresh curve — reset to a clean two-row template
      setType(defaultType ?? "GENERIC");
      setPoints([{ x: "", y: "" }, { x: "", y: "" }]);
    }
  }, [open, existing, curveId, defaultType]);

  const numericPoints = useMemo(
    () => points.map((p) => ({ x: parseFloat(p.x), y: parseFloat(p.y) })),
    [points],
  );

  const validation = useMemo(() => {
    if (points.length < 2) return "Need at least 2 points";
    for (let i = 0; i < numericPoints.length; i++) {
      if (Number.isNaN(numericPoints[i].x) || Number.isNaN(numericPoints[i].y)) {
        return `Row ${i + 1}: x and y must be numbers`;
      }
    }
    for (let i = 1; i < numericPoints.length; i++) {
      if (numericPoints[i].x <= numericPoints[i - 1].x) {
        return `Row ${i + 1}: x must be strictly greater than row ${i} (got ${numericPoints[i].x} ≤ ${numericPoints[i - 1].x})`;
      }
    }
    return null;
  }, [numericPoints, points.length]);

  // Live-capture state — only meaningful when projectId is set.
  const [liveSignalId, setLiveSignalId] = useState<number | null>(null);
  // Default to RAW: calibration must read the unscaled HAL value, otherwise
  // we'd be calibrating already-scaled data.
  const [liveMode, setLiveMode] = useState<"RAW" | "SCALED">("RAW");

  const { data: liveSignals = [] } = trpc.components.signalsForLiveCapture.useQuery(
    { projectId: projectId ?? -1 },
    { enabled: !!projectId && open },
  );
  const { data: liveReading } = trpc.components.signalLiveReadingById.useQuery(
    { signalId: liveSignalId ?? -1, mode: liveMode },
    {
      enabled: !!liveSignalId && open,
      refetchInterval: 2000,
    },
  );

  const liveSignal = liveSignals.find((s) => s.id === liveSignalId);
  const rawAvailable = !!liveSignal?.iecPathRaw;
  const scaledAvailable = !!liveSignal?.iecPath;

  function captureToNextX() {
    if (!liveReading) return;
    // Pull a numeric value out of the JSON payload, falling back to valueStr
    let raw: number | null = null;
    if (typeof liveReading.value === "number") raw = liveReading.value;
    else if (typeof liveReading.valueStr === "string") {
      const parsed = parseFloat(liveReading.valueStr);
      if (!Number.isNaN(parsed)) raw = parsed;
    }
    if (raw == null) return;
    // Find the first row with empty x; if none, append a new row with this x
    const idx = points.findIndex((p) => p.x.trim() === "");
    if (idx >= 0) {
      setPoints(points.map((p, i) => (i === idx ? { ...p, x: String(raw) } : p)));
    } else {
      setPoints([...points, { x: String(raw), y: "" }]);
    }
  }

  const create = trpc.components.curveCreate.useMutation();
  const update = trpc.components.curveUpdate.useMutation();

  async function handleSave() {
    if (validation) return;
    const payloadPoints = numericPoints.map((p) => ({ x: p.x, y: p.y }));
    try {
      if (curveId) {
        await update.mutateAsync({ id: curveId, type, points: payloadPoints });
        await utils.components.curveById.invalidate({ id: curveId });
        onSaved(curveId);
      } else {
        const created = await create.mutateAsync({ type, points: payloadPoints });
        onSaved(created.id);
      }
      onClose();
    } catch (e) {
      // Server validation failed (e.g. ascending-x); leave dialog open.
      // mutation.error is shown below.
    }
  }

  const serverError = create.error?.message ?? update.error?.message ?? null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{curveId ? "Edit Curve" : "New Curve"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as CurveType)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURVE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {projectId && (
            <div className="rounded-md border p-2 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Live capture (calibration)
                </Label>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={liveMode === "RAW" ? "default" : "outline"}
                    className="h-6 text-[10px] px-2"
                    disabled={liveSignalId != null && !rawAvailable}
                    onClick={() => setLiveMode("RAW")}
                  >
                    RAW
                  </Button>
                  <Button
                    size="sm"
                    variant={liveMode === "SCALED" ? "default" : "outline"}
                    className="h-6 text-[10px] px-2"
                    disabled={liveSignalId != null && !scaledAvailable}
                    onClick={() => setLiveMode("SCALED")}
                  >
                    Scaled
                  </Button>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <Select
                  value={liveSignalId == null ? "__none__" : String(liveSignalId)}
                  onValueChange={(v) => setLiveSignalId(v === "__none__" ? null : Number(v))}
                >
                  <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Pick source signal…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— none —</SelectItem>
                    {liveSignals.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.tag ?? `signal ${s.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={!liveSignalId || !liveReading}
                  onClick={captureToNextX}
                >
                  Capture → x
                </Button>
              </div>
              {liveSignalId && (
                <div className="text-[11px] font-mono">
                  {liveReading ? (
                    <span>
                      {liveMode === "RAW" ? "raw" : "scaled"}: <strong>{liveReading.valueStr}</strong>{" "}
                      <span className="text-muted-foreground">({liveReading.state})</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      waiting for {liveMode === "RAW" ? "raw" : "scaled"} reading…
                    </span>
                  )}
                  {liveMode === "RAW" && !rawAvailable && (
                    <p className="text-amber-600 dark:text-amber-400 mt-0.5">
                      No RAW path on this signal — switch to Scaled or pick a different signal.
                    </p>
                  )}
                </div>
              )}
              {liveSignals.length === 0 && (
                <p className="text-[10px] text-muted-foreground">
                  No signals with monitoring enabled in this project — turn on monitoring + run codegen so the plugin populates iec_path first.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Points (ascending x)</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPoints([...points, { x: "", y: "" }])}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add row
              </Button>
            </div>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th className="text-left px-2 py-1.5 w-10">#</th>
                    <th className="text-left px-2 py-1.5">x (raw)</th>
                    <th className="text-left px-2 py-1.5">y (scaled)</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody>
                  {points.map((p, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-2 py-1">
                        <Input
                          value={p.x}
                          onChange={(e) =>
                            setPoints(points.map((q, j) => (i === j ? { ...q, x: e.target.value } : q)))
                          }
                          type="number"
                          step="any"
                          className="h-8 font-mono text-xs"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          value={p.y}
                          onChange={(e) =>
                            setPoints(points.map((q, j) => (i === j ? { ...q, y: e.target.value } : q)))
                          }
                          type="number"
                          step="any"
                          className="h-8 font-mono text-xs"
                        />
                      </td>
                      <td className="px-2 py-1 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          disabled={i === 0}
                          onClick={() => {
                            const next = [...points];
                            [next[i - 1], next[i]] = [next[i], next[i - 1]];
                            setPoints(next);
                          }}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          disabled={i === points.length - 1}
                          onClick={() => {
                            const next = [...points];
                            [next[i + 1], next[i]] = [next[i], next[i + 1]];
                            setPoints(next);
                          }}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          disabled={points.length <= 2}
                          onClick={() => setPoints(points.filter((_, j) => j !== i))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {validation && (
              <p className="text-xs text-amber-600 dark:text-amber-400">{validation}</p>
            )}
            {serverError && (
              <p className="text-xs text-red-600 dark:text-red-400">{serverError}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={!!validation || create.isPending || update.isPending}
          >
            {create.isPending || update.isPending ? "Saving…" : curveId ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
