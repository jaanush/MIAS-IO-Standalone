"use client";

import { useState, useRef, useId } from "react";
import { trpc } from "@/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── DBC parser ────────────────────────────────────────────────────────────────

type DbcSignal = {
  messageName: string;
  messageId: number;
  name: string;
  startBit: number;
  length: number;
  byteOrder: "little" | "big"; // 1 = little endian (Intel), 0 = big endian (Motorola)
  signed: boolean;
  factor: number;
  offset: number;
  rangeMin: number | null;
  rangeMax: number | null;
  unit: string;
  comment: string | null;
  // derived
  ioType: "DI" | "DO" | "AI" | "AO";
};

function parseDbc(text: string): DbcSignal[] {
  const lines = text.split(/\r?\n/);
  const signals: DbcSignal[] = [];
  const comments = new Map<string, string>(); // "MsgId.SigName" → comment

  let currentMsg: { id: number; name: string } | null = null;

  // First pass: collect comments
  for (let i = 0; i < lines.length; i++) {
    const cm = lines[i].match(/^CM_\s+SG_\s+(\d+)\s+(\w+)\s+"((?:[^"\\]|\\.)*)"\s*;/);
    if (cm) {
      comments.set(`${cm[1]}.${cm[2]}`, cm[3].replace(/\\"/g, '"'));
    }
  }

  // Second pass: parse messages and signals
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Message definition
    const msgMatch = line.match(/^BO_\s+(\d+)\s+(\w+)\s*:\s*\d+\s+\S+/);
    if (msgMatch) {
      currentMsg = { id: Number(msgMatch[1]), name: msgMatch[2] };
      continue;
    }

    // Signal definition
    const sigMatch = line.match(
      /^SG_\s+(\w+)\s*:\s*(\d+)\|(\d+)@([01])([+-])\s*\(([^,]+),([^)]+)\)\s*\[([^|]*)\|([^\]]*)\]\s*"([^"]*)"/
    );
    if (sigMatch && currentMsg) {
      const [, name, startBit, length, byteOrder, valueType, factor, offset, rMin, rMax, unit] = sigMatch;
      const len = Number(length);
      const rangeMin = rMin.trim() !== "" ? Number(rMin) : null;
      const rangeMax = rMax.trim() !== "" ? Number(rMax) : null;

      signals.push({
        messageName: currentMsg.name,
        messageId: currentMsg.id,
        name,
        startBit: Number(startBit),
        length: len,
        byteOrder: byteOrder === "1" ? "little" : "big",
        signed: valueType === "-",
        factor: Number(factor),
        offset: Number(offset),
        rangeMin: rangeMin !== null && !isNaN(rangeMin) ? rangeMin : null,
        rangeMax: rangeMax !== null && !isNaN(rangeMax) ? rangeMax : null,
        unit: unit.trim(),
        comment: comments.get(`${currentMsg.id}.${name}`) ?? null,
        ioType: len === 1 ? "DI" : "AI",
      });
    }
  }

  return signals;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  componentId: number;
  existingChannelCount: number;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ImportDbcDialog({ componentId, existingChannelCount, open, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const headerId = useId();

  const [parsedSignals, setParsedSignals] = useState<DbcSignal[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const { data: engineeringUnits = [] } = trpc.components.euList.useQuery(undefined, { enabled: open });
  const utils = trpc.useUtils();
  const signalUpsert = trpc.components.signalUpsert.useMutation();

  // Build EU symbol → id map
  const euMap = new Map(engineeringUnits.map((eu) => [eu.symbol.toLowerCase(), eu.id]));

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError(null);
    setParsedSignals([]);
    setSelected(new Set());
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target!.result as string;
        const sigs = parseDbc(text);
        if (sigs.length === 0) {
          setParseError("No signals found. Make sure the file is a valid .dbc with BO_/SG_ definitions.");
          return;
        }
        setParsedSignals(sigs);
        setSelected(new Set(sigs.map((_, i) => i)));
      } catch (err) {
        setParseError(`Failed to parse file: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsText(file);
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(parsedSignals.map((_, i) => i)) : new Set());
  }

  function toggleRow(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  async function handleImport() {
    if (parsedSignals.length === 0) return;

    setImporting(true);
    setImportError(null);
    setImportProgress({ done: 0, total: parsedSignals.length });

    let channelOffset = existingChannelCount;

    try {
      for (let i = 0; i < parsedSignals.length; i++) {
        const sig = parsedSignals[i];

        // Resolve EU: try exact match, then lowercase
        const euId = euMap.get(sig.unit.toLowerCase()) ?? null;

        // Compute physical range (raw range × factor + offset)
        // Clamp to Decimal(12,4) safe range — null if out of bounds or not useful
        const MAX_DEC = 99_999_999;
        function toSafeDecimal(v: number | null): number | null {
          if (v === null || !isFinite(v) || Math.abs(v) > MAX_DEC) return null;
          return v;
        }
        const scaleMin = toSafeDecimal(sig.rangeMin !== null ? sig.rangeMin * sig.factor + sig.offset : null);
        const scaleMax = toSafeDecimal(sig.rangeMax !== null ? sig.rangeMax * sig.factor + sig.offset : null);

        await signalUpsert.mutateAsync({
          componentId,
          channelOffset: channelOffset++,
          active: selected.has(i),
          ioType: sig.ioType,
          tagSuffix: sig.name,
          description: sig.comment ?? sig.name,
          ...(sig.ioType === "AI" || sig.ioType === "AO"
            ? {
                defaultScaleMin: scaleMin,
                defaultScaleMax: scaleMax,
                defaultEuId: euId,
              }
            : {}),
          discreteAlarms: [],
          analogAlarms: [],
        });

        setImportProgress({ done: i + 1, total: parsedSignals.length });
      }

      await utils.components.componentById.invalidate({ id: componentId });
      onImported();
      onClose();
    } catch (err) {
      setImportError(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
  }

  function handleClose() {
    if (importing) return;
    setParsedSignals([]);
    setSelected(new Set());
    setFileName(null);
    setParseError(null);
    setImportError(null);
    setImportProgress(null);
    if (fileRef.current) fileRef.current.value = "";
    onClose();
  }

  const allChecked = parsedSignals.length > 0 && selected.size === parsedSignals.length;
  const someChecked = selected.size > 0 && selected.size < parsedSignals.length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-5xl flex flex-col" style={{ maxHeight: "90vh" }}>
        <DialogHeader>
          <DialogTitle>Import Signals from DBC File</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 min-h-0 flex-1 overflow-hidden">
          {/* File picker */}
          <div className="space-y-1 shrink-0">
            <label className="text-sm font-medium">CAN DBC File (.dbc)</label>
            <input
              ref={fileRef}
              type="file"
              accept=".dbc"
              onChange={handleFileChange}
              disabled={importing}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent"
            />
          </div>

          {/* Parse error */}
          {parseError && (
            <p className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive shrink-0">
              {parseError}
            </p>
          )}

          {/* Signal table */}
          {parsedSignals.length > 0 && (
            <div className="flex flex-col min-h-0 flex-1 gap-1">
              <p className="text-sm font-medium shrink-0">
                {parsedSignals.length} signal{parsedSignals.length !== 1 ? "s" : ""} found
                {" — "}<span className="font-normal text-muted-foreground">{selected.size} marked active</span>
              </p>
              <div className="overflow-auto flex-1 rounded-md border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b">
                    <tr>
                      <th className="px-2 py-2 w-16 font-medium text-center">
                        <label className="flex flex-col items-center gap-0.5 cursor-pointer select-none">
                          <input
                            id={headerId}
                            type="checkbox"
                            checked={allChecked}
                            ref={(el) => { if (el) el.indeterminate = someChecked; }}
                            onChange={(e) => toggleAll(e.target.checked)}
                            className="cursor-pointer"
                          />
                          <span className="text-[10px] font-medium">Active</span>
                        </label>
                      </th>
                      <th className="px-2 py-2 font-medium text-left">Message</th>
                      <th className="px-2 py-2 font-medium text-left">Signal Name</th>
                      <th className="px-2 py-2 font-medium text-left">Description</th>
                      <th className="px-2 py-2 font-medium text-center">Type</th>
                      <th className="px-2 py-2 font-medium text-center">Bits</th>
                      <th className="px-2 py-2 font-medium text-center">Order</th>
                      <th className="px-2 py-2 font-medium text-right">Factor</th>
                      <th className="px-2 py-2 font-medium text-right">Offset</th>
                      <th className="px-2 py-2 font-medium text-right">Min</th>
                      <th className="px-2 py-2 font-medium text-right">Max</th>
                      <th className="px-2 py-2 font-medium text-left">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedSignals.map((sig, i) => (
                      <tr
                        key={i}
                        className={cn(
                          "border-b last:border-0 cursor-pointer",
                          selected.has(i) ? "hover:bg-accent/40" : "hover:bg-muted/20 opacity-50"
                        )}
                        onClick={() => toggleRow(i)}
                      >
                        <td className="px-2 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(i)}
                            onChange={() => toggleRow(i)}
                            className="cursor-pointer"
                          />
                        </td>
                        <td className="px-2 py-1 font-mono truncate max-w-[120px]">{sig.messageName}</td>
                        <td className="px-2 py-1 font-mono truncate max-w-[160px]">{sig.name}</td>
                        <td className="px-2 py-1 truncate max-w-[200px] text-muted-foreground">{sig.comment ?? "—"}</td>
                        <td className="px-2 py-1 text-center">
                          {(() => {
                            const IO_COLORS: Record<string, string> = {
                              DI: "bg-blue-50 border-blue-200 text-blue-700",
                              DO: "bg-green-50 border-green-200 text-green-700",
                              AI: "bg-purple-50 border-purple-200 text-purple-700",
                              AO: "bg-orange-50 border-orange-200 text-orange-700",
                            };
                            return (
                              <span className={cn(
                                "rounded px-1 py-0.5 text-[10px] font-medium border",
                                IO_COLORS[sig.ioType] ?? "bg-gray-100 border-gray-300 text-gray-600"
                              )}>
                                {sig.ioType}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-2 py-1 text-center tabular-nums">{sig.length}</td>
                        <td className="px-2 py-1 text-center text-muted-foreground">{sig.byteOrder === "little" ? "Intel" : "Mot."}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{sig.factor}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{sig.offset}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{sig.rangeMin ?? "—"}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{sig.rangeMax ?? "—"}</td>
                        <td className="px-2 py-1 font-mono">{sig.unit || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import progress */}
          {importProgress && (
            <p className="text-sm text-muted-foreground shrink-0">
              Importing {importProgress.done} of {importProgress.total}…
            </p>
          )}

          {/* Import error */}
          {importError && (
            <p className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive shrink-0">
              {importError}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t pt-4 shrink-0">
            <Button variant="outline" onClick={handleClose} disabled={importing}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={parsedSignals.length === 0 || importing}
            >
              {importing
                ? `Importing ${importProgress?.done ?? 0} of ${importProgress?.total ?? 0}…`
                : parsedSignals.length > 0
                  ? `Import All ${parsedSignals.length} Signal${parsedSignals.length !== 1 ? "s" : ""}`
                  : "Import"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
