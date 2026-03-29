"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Trash2, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";
import { PdoFrameVisualizer } from "./PdoFrameVisualizer";
import { PdoSignalPicker } from "./PdoSignalPicker";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";

type PdoSignal = {
  id: number;
  channelOffset: number;
  tagSuffix: string | null;
  description: string | null;
  ioType: string;
  rawDataType: string | null;
  bitOffset: number | null;
  bitLength: number | null;
  canopenIndex: number | null;
  canopenSubIndex: number | null;
};

type PdoConfigData = {
  id: number;
  direction: string;
  pdoNumber: number;
  cobId: number | null;
  transmissionType: number | null;
  eventTimerMs: number | null;
  inhibitTimeUs: number | null;
  syncWindowUs: number | null;
  timeoutMs: number | null;
  nodeId: number | null;
  description: string | null;
  signals: PdoSignal[];
};

type AllSignal = PdoSignal & { pdoConfigId?: number | null };

type Props = {
  pdo: PdoConfigData;
  allSignals: AllSignal[];
  onRefresh: () => void;
};

function formatHex(n: number | null): string {
  if (n == null) return "—";
  return `0x${n.toString(16).toUpperCase().padStart(3, "0")}`;
}

function formatIndex(index: number | null, sub: number | null): string {
  if (index == null) return "—";
  const hex = `0x${index.toString(16).toUpperCase().padStart(4, "0")}`;
  return sub != null ? `${hex}:${sub}` : hex;
}

export function PdoCard({ pdo, allSignals, onRefresh }: Props) {
  const [confirmProps, confirmAction] = useConfirm();
  const [expanded, setExpanded] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Local form state for params
  const [cobId, setCobId] = useState(pdo.cobId != null ? `0x${pdo.cobId.toString(16).toUpperCase()}` : "");
  const [transmissionType, setTransmissionType] = useState(pdo.transmissionType != null ? String(pdo.transmissionType) : "");
  const [eventTimerMs, setEventTimerMs] = useState(pdo.eventTimerMs != null ? String(pdo.eventTimerMs) : "");
  const [inhibitTimeUs, setInhibitTimeUs] = useState(pdo.inhibitTimeUs != null ? String(pdo.inhibitTimeUs) : "");
  const [syncWindowUs, setSyncWindowUs] = useState(pdo.syncWindowUs != null ? String(pdo.syncWindowUs) : "");
  const [timeoutMs, setTimeoutMs] = useState(pdo.timeoutMs != null ? String(pdo.timeoutMs) : "");
  const [description, setDescription] = useState(pdo.description ?? "");

  const updateMut = trpc.components.pdoUpdate.useMutation({ onSuccess: () => { setDirty(false); onRefresh(); } });
  const deleteMut = trpc.components.pdoDelete.useMutation({ onSuccess: onRefresh });
  const unassignMut = trpc.components.pdoUnassignSignal.useMutation({ onSuccess: onRefresh });

  const totalBits = pdo.signals.reduce((sum, s) => sum + (s.bitLength ?? 0), 0);
  const totalBytes = Math.ceil(totalBits / 8);

  function handleSaveParams() {
    const cobIdNum = cobId ? parseInt(cobId.replace(/^0x/i, ""), 16) : null;
    updateMut.mutate({
      id: pdo.id,
      cobId: isNaN(cobIdNum as number) ? null : cobIdNum,
      transmissionType: transmissionType ? Number(transmissionType) : null,
      eventTimerMs: eventTimerMs ? Number(eventTimerMs) : null,
      inhibitTimeUs: inhibitTimeUs ? Number(inhibitTimeUs) : null,
      syncWindowUs: syncWindowUs ? Number(syncWindowUs) : null,
      timeoutMs: timeoutMs ? Number(timeoutMs) : null,
      description: description || null,
    });
  }

  function handleDelete() {
    confirmAction(`Delete ${pdo.direction} ${pdo.pdoNumber}? Signals will be unlinked.`, async () => {
      await deleteMut.mutateAsync({ id: pdo.id });
    });
  }

  function handleUnassign(signalId: number) {
    unassignMut.mutate({ signalId });
  }

  function markDirty() { if (!dirty) setDirty(true); }

  return (
    <>
      <div className="border rounded-md">
        {/* Header */}
        <div
          role="button"
          tabIndex={0}
          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent/30 transition-colors cursor-pointer"
          onClick={() => setExpanded((e) => !e)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded((v) => !v); } }}
        >
          <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform", expanded && "rotate-90")} />
          <Badge variant="outline" className={cn(
            "text-[10px] px-1.5 py-0 font-mono",
            pdo.direction === "TPDO" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-700 border-amber-200"
          )}>
            {pdo.direction} {pdo.pdoNumber}
          </Badge>
          <span className="text-xs text-muted-foreground font-mono">{formatHex(pdo.cobId)}</span>
          <span className="text-xs text-muted-foreground truncate flex-1">{pdo.description ?? ""}</span>
          <span className="text-xs tabular-nums text-muted-foreground">{totalBytes}/8 bytes</span>
          {/* Inline byte usage bar */}
          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", totalBits > 64 ? "bg-red-500" : totalBits > 48 ? "bg-amber-500" : "bg-emerald-500")}
              style={{ width: `${Math.min(100, (totalBits / 64) * 100)}%` }}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="border-t px-4 py-3 space-y-4">
            {/* Parameters form */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Communication Parameters</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">COB-ID Base (hex)</Label>
                  <Input
                    type="text"
                    value={cobId}
                    onChange={(e) => { setCobId(e.target.value); markDirty(); }}
                    placeholder="e.g. 0x180"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Transmission Type</Label>
                  <Input
                    type="number"
                    min={0}
                    max={255}
                    value={transmissionType}
                    onChange={(e) => { setTransmissionType(e.target.value); markDirty(); }}
                    placeholder="254"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Event Timer (ms)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={eventTimerMs}
                    onChange={(e) => { setEventTimerMs(e.target.value); markDirty(); }}
                    placeholder="100"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Timeout (ms)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={timeoutMs}
                    onChange={(e) => { setTimeoutMs(e.target.value); markDirty(); }}
                    placeholder="3000"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Inhibit Time (μs)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={inhibitTimeUs}
                    onChange={(e) => { setInhibitTimeUs(e.target.value); markDirty(); }}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Sync Window (μs)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={syncWindowUs}
                    onChange={(e) => { setSyncWindowUs(e.target.value); markDirty(); }}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); markDirty(); }}
                    placeholder="e.g. Status & fault words"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              {dirty && (
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleSaveParams} disabled={updateMut.isPending}>
                    {updateMut.isPending ? "Saving…" : "Save Parameters"}
                  </Button>
                </div>
              )}
            </div>

            {/* Mapped signals */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Mapped Signals ({pdo.signals.length})
                </p>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowPicker(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Add Signals
                </Button>
              </div>

              {pdo.signals.length > 0 ? (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="px-2 py-1.5 font-medium w-12">Offset</th>
                        <th className="px-2 py-1.5 font-medium">Tag</th>
                        <th className="px-2 py-1.5 font-medium">Index</th>
                        <th className="px-2 py-1.5 font-medium w-12">Bits</th>
                        <th className="px-2 py-1.5 font-medium w-8">IO</th>
                        <th className="px-2 py-1.5 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pdo.signals.map((sig) => (
                        <tr key={sig.id} className="border-b last:border-0">
                          <td className="px-2 py-1 tabular-nums">{sig.bitOffset ?? "—"}</td>
                          <td className="px-2 py-1 font-mono truncate max-w-[160px]">{sig.tagSuffix ?? "—"}</td>
                          <td className="px-2 py-1 font-mono tabular-nums">{formatIndex(sig.canopenIndex, sig.canopenSubIndex)}</td>
                          <td className="px-2 py-1 tabular-nums">{sig.bitLength ?? "?"}</td>
                          <td className="px-2 py-1">{sig.ioType}</td>
                          <td className="px-2 py-1">
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => handleUnassign(sig.id)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-2">No signals mapped. Click "Add Signals" to assign.</p>
              )}
            </div>

            {/* Frame visualizer */}
            {pdo.signals.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Frame Layout</p>
                <PdoFrameVisualizer
                  signals={pdo.signals.filter((s) => s.bitOffset != null && s.bitLength != null).map((s) => ({
                    tagSuffix: s.tagSuffix,
                    bitOffset: s.bitOffset!,
                    bitLength: s.bitLength!,
                    canopenIndex: s.canopenIndex,
                    canopenSubIndex: s.canopenSubIndex,
                  }))}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {showPicker && (
        <PdoSignalPicker
          open
          onClose={() => setShowPicker(false)}
          pdoConfigId={pdo.id}
          allSignals={allSignals}
          currentSignalIds={new Set(pdo.signals.map((s) => s.id))}
          onAssigned={onRefresh}
        />
      )}

      <ConfirmDialog {...confirmProps} confirmLabel="Delete" />
    </>
  );
}
