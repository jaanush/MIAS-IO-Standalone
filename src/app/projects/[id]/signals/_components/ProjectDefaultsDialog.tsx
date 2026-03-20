"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
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

const NONE = "__none__";

type SignalRow = {
  id: number;
  signalType: "DISCRETE" | "ANALOG";
  discreteSignal?: { trigger?: string; filterTimeMs?: unknown; switchingType?: string | null } | null;
  analogSignal?: {
    inputType?: { id: number; name: string } | null;
    inputTypeId?: number | null;
    wireConfig?: string | null;
    scaleMin?: unknown;
    scaleMax?: unknown;
    engineeringUnit?: { id: number; symbol: string } | null;
    engineeringUnitId?: number | null;
  } | null;
};

type Props = {
  open: boolean;
  signal: SignalRow;
  onClose: () => void;
  onSaved: () => void;
};

export function ProjectDefaultsDialog({ open, signal, onClose, onSaved }: Props) {
  const isDisc = signal.signalType === "DISCRETE";

  // Discrete state
  const [trigger, setTrigger] = useState(signal.discreteSignal?.trigger ?? "NO");
  const [filterTimeMs, setFilterTimeMs] = useState(
    signal.discreteSignal?.filterTimeMs != null ? Number(signal.discreteSignal.filterTimeMs) : null
  );

  // Analog state
  const { data: inputTypes = [] } = trpc.signal.analogInputTypes.useQuery(undefined, { enabled: !isDisc });
  const { data: units = [] } = trpc.signal.engineeringUnits.useQuery(undefined, { enabled: !isDisc });

  const [inputTypeId, setInputTypeId] = useState<number | null>(
    signal.analogSignal?.inputType?.id ?? signal.analogSignal?.inputTypeId ?? null
  );
  const [wireConfig, setWireConfig] = useState<string | null>(signal.analogSignal?.wireConfig ?? null);
  const [scaleMin, setScaleMin] = useState<number | null>(
    signal.analogSignal?.scaleMin != null ? Number(signal.analogSignal.scaleMin) : null
  );
  const [scaleMax, setScaleMax] = useState<number | null>(
    signal.analogSignal?.scaleMax != null ? Number(signal.analogSignal.scaleMax) : null
  );
  const [euId, setEuId] = useState<number | null>(
    signal.analogSignal?.engineeringUnit?.id ?? signal.analogSignal?.engineeringUnitId ?? null
  );

  const update = trpc.signal.update.useMutation({
    onSuccess: () => onSaved(),
  });

  function handleSave() {
    if (isDisc) {
      update.mutate({
        id: signal.id,
        trigger: trigger as "NO" | "NC",
        filterTimeMs: filterTimeMs,
      });
    } else {
      update.mutate({
        id: signal.id,
        inputTypeId,
        wireConfig: wireConfig as any,
        scaleMin,
        scaleMax,
        engineeringUnitId: euId,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isDisc ? "Discrete" : "Analog"} Defaults</DialogTitle>
        </DialogHeader>

        {isDisc ? (
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Trigger</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
              >
                <option value="NO">NO (Normally Open)</option>
                <option value="NC">NC (Normally Closed)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Filter Time (ms)</Label>
              <Input
                type="number"
                step="0.001"
                value={filterTimeMs ?? ""}
                onChange={(e) => setFilterTimeMs(e.target.value === "" ? null : Number(e.target.value))}
                placeholder="e.g. 3"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Input Type</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={inputTypeId != null ? String(inputTypeId) : NONE}
                onChange={(e) => setInputTypeId(e.target.value === NONE ? null : Number(e.target.value))}
              >
                <option value={NONE}>— none —</option>
                {inputTypes.map((t) => (
                  <option key={t.id} value={String(t.id)}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Wire Config</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={wireConfig ?? NONE}
                onChange={(e) => setWireConfig(e.target.value === NONE ? null : e.target.value)}
              >
                <option value={NONE}>— none —</option>
                <option value="TWO_WIRE">2-wire</option>
                <option value="THREE_WIRE">3-wire</option>
                <option value="FOUR_WIRE">4-wire</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Scale Min</Label>
                <Input
                  type="number"
                  value={scaleMin ?? ""}
                  onChange={(e) => setScaleMin(e.target.value === "" ? null : Number(e.target.value))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label>Scale Max</Label>
                <Input
                  type="number"
                  value={scaleMax ?? ""}
                  onChange={(e) => setScaleMax(e.target.value === "" ? null : Number(e.target.value))}
                  placeholder="100"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Engineering Unit</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={euId != null ? String(euId) : NONE}
                onChange={(e) => setEuId(e.target.value === NONE ? null : Number(e.target.value))}
              >
                <option value={NONE}>— none —</option>
                {units.map((eu) => (
                  <option key={eu.id} value={String(eu.id)}>{eu.symbol}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
