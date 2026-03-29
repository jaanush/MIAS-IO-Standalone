"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/trpc/client";

type Signal = {
  id: number;
  channelOffset: number;
  tagSuffix: string | null;
  description: string | null;
  ioType: string;
  canopenIndex: number | null;
  canopenSubIndex: number | null;
  bitOffset: number | null;
  bitLength: number | null;
  rawDataType: string | null;
  pdoConfigId?: number | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  pdoConfigId: number;
  /** All signals for this component */
  allSignals: Signal[];
  /** Signal IDs already assigned to this specific PDO */
  currentSignalIds: Set<number>;
  onAssigned: () => void;
};

function formatIndex(index: number | null, sub: number | null): string {
  if (index == null) return "—";
  const hex = `0x${index.toString(16).toUpperCase().padStart(4, "0")}`;
  return sub != null ? `${hex}:${sub}` : hex;
}

/** Guess bit size from raw data type if bitLength is not set */
function guessBitLength(sig: Signal): number {
  if (sig.bitLength != null) return sig.bitLength;
  switch (sig.rawDataType) {
    case "BOOL": return 1;
    case "INT8": case "UINT8": return 8;
    case "INT16": case "UINT16": return 16;
    case "INT32": case "UINT32": case "FLOAT32": return 32;
    case "FLOAT64": case "INT64": case "UINT64": return 64;
    default: return 16; // Default assumption
  }
}

export function PdoSignalPicker({ open, onClose, pdoConfigId, allSignals, currentSignalIds, onAssigned }: Props) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(currentSignalIds));
  const [filter, setFilter] = useState("");

  const assign = trpc.components.pdoAssignSignals.useMutation({
    onSuccess: () => {
      onAssigned();
      onClose();
    },
  });

  // Signals available for picking: not assigned to another PDO, or assigned to this PDO
  const available = useMemo(() => {
    const lc = filter.toLowerCase();
    return allSignals.filter((s) => {
      // Available if: unassigned, or assigned to this PDO
      if (s.pdoConfigId != null && s.pdoConfigId !== pdoConfigId) return false;
      // Filter
      if (lc) {
        const text = `${s.tagSuffix ?? ""} ${s.description ?? ""} ${formatIndex(s.canopenIndex, s.canopenSubIndex)}`.toLowerCase();
        if (!text.includes(lc)) return false;
      }
      return true;
    });
  }, [allSignals, pdoConfigId, filter]);

  const totalBits = useMemo(() => {
    let sum = 0;
    for (const sig of allSignals) {
      if (selected.has(sig.id)) sum += guessBitLength(sig);
    }
    return sum;
  }, [selected, allSignals]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAssign() {
    // Auto-pack: assign sequential bit offsets
    const orderedSignals = allSignals
      .filter((s) => selected.has(s.id))
      .sort((a, b) => a.channelOffset - b.channelOffset);

    let offset = 0;
    const assignments = orderedSignals.map((s) => {
      const bits = guessBitLength(s);
      const a = { signalId: s.id, bitOffset: offset };
      offset += bits;
      return a;
    });

    assign.mutate({ pdoConfigId, assignments });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Assign Signals to PDO</DialogTitle>
        </DialogHeader>

        <Input
          placeholder="Filter signals…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="mb-2"
        />

        <div className="flex-1 overflow-y-auto border rounded-md">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-2 py-1.5 w-8"></th>
                <th className="px-2 py-1.5 font-medium w-10">Ch</th>
                <th className="px-2 py-1.5 font-medium">Tag</th>
                <th className="px-2 py-1.5 font-medium">Index</th>
                <th className="px-2 py-1.5 font-medium w-10">Sub</th>
                <th className="px-2 py-1.5 font-medium w-12">Bits</th>
                <th className="px-2 py-1.5 font-medium w-8">IO</th>
              </tr>
            </thead>
            <tbody>
              {available.length === 0 && (
                <tr><td colSpan={7} className="px-2 py-4 text-center text-muted-foreground">No available signals</td></tr>
              )}
              {available.map((sig) => (
                <tr
                  key={sig.id}
                  className="border-b last:border-0 hover:bg-accent/30 cursor-pointer"
                  onClick={() => toggle(sig.id)}
                >
                  <td className="px-2 py-1">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-input cursor-pointer"
                      checked={selected.has(sig.id)}
                      onChange={() => toggle(sig.id)}
                    />
                  </td>
                  <td className="px-2 py-1 tabular-nums">{sig.channelOffset}</td>
                  <td className="px-2 py-1 font-mono truncate max-w-[140px]">{sig.tagSuffix ?? "—"}</td>
                  <td className="px-2 py-1 font-mono tabular-nums">{formatIndex(sig.canopenIndex, sig.canopenSubIndex)}</td>
                  <td className="px-2 py-1 tabular-nums">{sig.canopenSubIndex ?? "—"}</td>
                  <td className="px-2 py-1 tabular-nums">{sig.bitLength ?? "?"}</td>
                  <td className="px-2 py-1">{sig.ioType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {selected.size} selected · {totalBits}/64 bits
            {totalBits > 64 && <span className="text-amber-500 ml-1">(exceeds CAN frame)</span>}
          </span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAssign} disabled={assign.isPending || selected.size === 0}>
            {assign.isPending ? "Assigning…" : "Assign Selected"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
