"use client";

import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

type Props = {
  projectId: number;
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
};

export function AddFromComponentDialog({ projectId, open, onClose, onAdded }: Props) {
  const [search, setSearch] = useState("");
  const [selectedComponentId, setSelectedTemplateId] = useState<number | null>(null);
  const [componentTag, setComponentTag] = useState("");
  const [defaultOrigin, setDefaultOrigin] = useState<string>("CANBUS");
  const [selectedOffsets, setSelectedOffsets] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const { data: templates = [], isLoading: loadingTemplates } = trpc.signal.componentList.useQuery(
    undefined,
    { enabled: open }
  );
  const { data: signals = [], isLoading: loadingSignals } = trpc.signal.componentSignals.useQuery(
    { componentId: selectedComponentId! },
    { enabled: selectedComponentId != null }
  );

  const utils = trpc.useUtils();
  const addFromComponent = trpc.signal.addFromComponent.useMutation();

  const selectedTemplate = templates.find((t) => t.id === selectedComponentId);

  // Auto-select all signals when a template's signals finish loading
  useEffect(() => {
    if (signals.length > 0) {
      setSelectedOffsets(new Set(signals.map((s) => s.channelOffset)));
    }
  }, [signals]);

  const filteredTemplates = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.manufacturer ?? "").toLowerCase().includes(q) ||
        (t.model ?? "").toLowerCase().includes(q)
    );
  }, [templates, search]);

  function selectComponent(id: number) {
    setSelectedTemplateId(id);
    setSelectedOffsets(new Set());
    setImportError(null);
  }

  const allChecked = signals.length > 0 && selectedOffsets.size === signals.length;
  const someChecked = selectedOffsets.size > 0 && selectedOffsets.size < signals.length;

  function toggleAll(checked: boolean) {
    setSelectedOffsets(checked ? new Set(signals.map((s) => s.channelOffset)) : new Set());
  }

  function toggleRow(offset: number) {
    setSelectedOffsets((prev) => {
      const next = new Set(prev);
      next.has(offset) ? next.delete(offset) : next.add(offset);
      return next;
    });
  }

  async function handleAdd() {
    if (!selectedComponentId || selectedOffsets.size === 0) return;
    setImporting(true);
    setImportError(null);
    try {
      await addFromComponent.mutateAsync({
        projectId,
        componentId: selectedComponentId,
        componentTag: componentTag.trim() || null,
        selectedOffsets: Array.from(selectedOffsets),
        defaultOrigin: defaultOrigin as "IEC" | "MODBUS_RTU" | "MODBUS_TCP" | "CANBUS" | "CANOPEN" | "PROFIBUS" | "PROFINET" | "ETHERNETIP" | "DEVICENET" | "BACNET" | "INTERNAL",
      });
      await utils.signal.list.invalidate({ projectId });
      onAdded();
      onClose();
    } catch (err) {
      setImportError(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
  }

  function handleClose() {
    if (importing) return;
    setSearch("");
    setSelectedTemplateId(null);
    setComponentTag("");
    setDefaultOrigin("CANBUS");
    setSelectedOffsets(new Set());
    setImportError(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-5xl flex flex-col" style={{ maxHeight: "90vh" }}>
        <DialogHeader>
          <DialogTitle>Add Signals from Component</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 min-h-0 flex-1 overflow-hidden">
          {/* Left: template list */}
          <div className="flex flex-col w-64 shrink-0 min-h-0">
            <Input
              placeholder="Search components…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm mb-2 shrink-0"
            />
            <div className="flex-1 overflow-auto rounded-md border">
              {loadingTemplates ? (
                <p className="text-xs text-muted-foreground p-3">Loading…</p>
              ) : filteredTemplates.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3">No components found.</p>
              ) : (
                filteredTemplates.map((t) => (
                  <button
                    key={t.id}
                    className={cn(
                      "w-full text-left px-3 py-2.5 border-b last:border-0 hover:bg-accent/50 transition-colors flex items-start justify-between gap-2",
                      selectedComponentId === t.id && "bg-accent"
                    )}
                    onClick={() => selectComponent(t.id)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      {(t.manufacturer || t.model) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {[t.manufacturer, t.model].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">{t._count.signals} signals</p>
                    </div>
                    {selectedComponentId === t.id && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right: signal preview */}
          <div className="flex flex-col flex-1 min-h-0 min-w-0">
            {!selectedComponentId ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground border rounded-md">
                Select a component to preview its signals
              </div>
            ) : (
              <>
                <div className="shrink-0 mb-2 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{selectedTemplate?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedOffsets.size} of {signals.length} signals selected
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs text-muted-foreground whitespace-nowrap" title="Applied to signals that have no origin set on the template">
                        Default Origin
                      </label>
                      <select
                        className="h-7 rounded border border-input bg-background px-1.5 text-xs"
                        value={defaultOrigin}
                        onChange={(e) => setDefaultOrigin(e.target.value)}
                      >
                        {["IEC","CANBUS","CANOPEN","MODBUS_TCP","MODBUS_RTU","PROFINET","PROFIBUS","ETHERNETIP","DEVICENET","BACNET","INTERNAL"].map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs text-muted-foreground whitespace-nowrap">Component Tag</label>
                      <Input
                        value={componentTag}
                        onChange={(e) => setComponentTag(e.target.value)}
                        placeholder="e.g. 625-P01"
                        className="h-7 text-xs w-32"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-auto rounded-md border min-h-0">
                  {loadingSignals ? (
                    <p className="text-xs text-muted-foreground p-3">Loading…</p>
                  ) : signals.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3">No signals defined in this component.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b">
                        <tr>
                          <th className="px-2 py-2 w-8">
                            <input
                              type="checkbox"
                              checked={allChecked}
                              ref={(el) => { if (el) el.indeterminate = someChecked; }}
                              onChange={(e) => toggleAll(e.target.checked)}
                              className="cursor-pointer"
                            />
                          </th>
                          <th className="px-2 py-2 font-medium text-left w-8">#</th>
                          <th className="px-2 py-2 font-medium text-left">Tag Suffix</th>
                          <th className="px-2 py-2 font-medium text-left">Description</th>
                          <th className="px-2 py-2 font-medium text-center">Type</th>
                          <th className="px-2 py-2 font-medium text-left">Origin</th>
                          <th className="px-2 py-2 font-medium text-left">PLC Type</th>
                          <th className="px-2 py-2 font-medium text-left">Input Type</th>
                          <th className="px-2 py-2 font-medium text-left">EU</th>
                          <th className="px-2 py-2 font-medium text-right">Scale Min</th>
                          <th className="px-2 py-2 font-medium text-right">Scale Max</th>
                        </tr>
                      </thead>
                      <tbody>
                        {signals.map((sig) => {
                          const isSelected = selectedOffsets.has(sig.channelOffset);
                          return (
                            <tr
                              key={sig.id}
                              className={cn(
                                "border-b last:border-0 cursor-pointer",
                                isSelected ? "hover:bg-accent/40 bg-accent/20" : "hover:bg-muted/20 text-muted-foreground"
                              )}
                              onClick={() => toggleRow(sig.channelOffset)}
                            >
                              <td className="px-2 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleRow(sig.channelOffset)}
                                  className="cursor-pointer"
                                />
                              </td>
                              <td className="px-2 py-1 text-muted-foreground tabular-nums">{sig.channelOffset}</td>
                              <td className="px-2 py-1 font-mono">{sig.tagSuffix ?? "—"}</td>
                              <td className="px-2 py-1 max-w-[220px] truncate" title={sig.description ?? undefined}>
                                {sig.description ?? "—"}
                              </td>
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
                              <td className="px-2 py-1">
                                {sig.origin ? (
                                  <span className={cn(
                                    "rounded px-1 py-0.5 text-[10px] font-medium border",
                                    sig.origin === "INTERNAL"
                                      ? "bg-gray-100 border-gray-300 text-gray-600"
                                      : "bg-green-50 border-green-200 text-green-700"
                                  )}>
                                    {sig.origin}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground italic">{defaultOrigin}</span>
                                )}
                              </td>
                              <td className="px-2 py-1 font-mono text-[10px]">
                                {sig.plcDataTypeCatalog?.code ?? "—"}
                              </td>
                              <td className="px-2 py-1 text-muted-foreground">{sig.defaultInputType?.name ?? "—"}</td>
                              <td className="px-2 py-1 font-mono">{sig.defaultEu?.symbol ?? "—"}</td>
                              <td className="px-2 py-1 text-right tabular-nums">
                                {sig.defaultScaleMin != null ? Number(sig.defaultScaleMin) : "—"}
                              </td>
                              <td className="px-2 py-1 text-right tabular-nums">
                                {sig.defaultScaleMax != null ? Number(sig.defaultScaleMax) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}

            {importError && (
              <p className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive shrink-0 mt-2">
                {importError}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t pt-4 shrink-0">
          <Button variant="outline" onClick={handleClose} disabled={importing}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={selectedOffsets.size === 0 || !selectedComponentId || importing}
          >
            {importing
              ? "Adding…"
              : `Add ${selectedOffsets.size > 0 ? `${selectedOffsets.size} signal${selectedOffsets.size !== 1 ? "s" : ""}` : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
