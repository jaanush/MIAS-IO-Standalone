"use client";

import { useEffect, useState } from "react";
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
import type { SignalRowState } from "./SignalGrid";

const NONE = "__none__";

type InputType = { id: number; code: string; name: string };
type Eu = { id: number; symbol: string };

type Props = {
  open: boolean;
  onClose: () => void;
  row: SignalRowState;
  engineeringUnits: Eu[];
  inputTypes: InputType[];
  onChange: (patch: Partial<SignalRowState>) => void;
};

export function DefaultsDialog({ open, onClose, row, engineeringUnits, inputTypes, onChange }: Props) {
  const [local, setLocal] = useState<Partial<SignalRowState>>({});

  useEffect(() => {
    if (open) setLocal({});
  }, [open]);

  function patch(key: keyof SignalRowState, value: unknown) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  function get<K extends keyof SignalRowState>(key: K): SignalRowState[K] {
    return (key in local ? local[key] : row[key]) as SignalRowState[K];
  }

  function handleSave() {
    onChange(local);
    onClose();
  }

  const isDiscrete = row.ioType === "DI" || row.ioType === "DO";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isDiscrete ? "Discrete" : "Analog"} Defaults
            {row.tagSuffix && <span className="ml-2 text-muted-foreground font-normal text-sm">— {row.tagSuffix}</span>}
          </DialogTitle>
        </DialogHeader>

        {isDiscrete ? (
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Trigger</Label>
              <Select
                value={get("defaultTrigger") ?? NONE}
                onValueChange={(v) => patch("defaultTrigger", v === NONE ? null : v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— none —</SelectItem>
                  <SelectItem value="NO">NO (Normally Open)</SelectItem>
                  <SelectItem value="NC">NC (Normally Closed)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Filter Time (ms)</Label>
              <Input
                type="number"
                step="0.001"
                value={get("defaultFilterTimeMs") ?? ""}
                onChange={(e) => patch("defaultFilterTimeMs", e.target.value === "" ? null : Number(e.target.value))}
                placeholder="e.g. 3"
              />
            </div>

            <div className="space-y-1">
              <Label>Switching Type</Label>
              <Select
                value={get("defaultSwitchingType") ?? NONE}
                onValueChange={(v) => patch("defaultSwitchingType", v === NONE ? null : v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— none —</SelectItem>
                  <SelectItem value="HIGH_SIDE">High Side</SelectItem>
                  <SelectItem value="LOW_SIDE">Low Side</SelectItem>
                  <SelectItem value="BOTH">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Input Type</Label>
              <Select
                value={get("defaultInputTypeId") != null ? String(get("defaultInputTypeId")) : NONE}
                onValueChange={(v) => patch("defaultInputTypeId", v === NONE ? null : Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— none —</SelectItem>
                  {inputTypes.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Wire Config</Label>
              <Select
                value={get("defaultWireConfig") ?? NONE}
                onValueChange={(v) => patch("defaultWireConfig", v === NONE ? null : v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— none —</SelectItem>
                  <SelectItem value="TWO_WIRE">2-wire</SelectItem>
                  <SelectItem value="THREE_WIRE">3-wire</SelectItem>
                  <SelectItem value="FOUR_WIRE">4-wire</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Scale Min</Label>
                <Input
                  type="number"
                  value={get("defaultScaleMin") ?? ""}
                  onChange={(e) => patch("defaultScaleMin", e.target.value === "" ? null : Number(e.target.value))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label>Scale Max</Label>
                <Input
                  type="number"
                  value={get("defaultScaleMax") ?? ""}
                  onChange={(e) => patch("defaultScaleMax", e.target.value === "" ? null : Number(e.target.value))}
                  placeholder="100"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Engineering Unit</Label>
              <Select
                value={String(get("defaultEuId") ?? NONE)}
                onValueChange={(v) => patch("defaultEuId", v === NONE ? null : Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— none —</SelectItem>
                  {engineeringUnits.map((eu) => (
                    <SelectItem key={eu.id} value={String(eu.id)}>{eu.symbol}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
