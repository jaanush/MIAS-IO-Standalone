"use client";

import { useState } from "react";
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
import { trpc } from "@/trpc/client";

/** Default COB-ID bases for standard CANopen PDOs (1–4) */
const DEFAULT_COB_BASES: Record<string, number[]> = {
  TPDO: [0x180, 0x280, 0x380, 0x480],
  RPDO: [0x200, 0x300, 0x400, 0x500],
};

type ExistingPdo = { direction: string; pdoNumber: number };

type Props = {
  open: boolean;
  onClose: () => void;
  componentId: number;
  existingPdos: ExistingPdo[];
  onCreated: () => void;
};

function nextAvailableNumber(direction: string, existing: ExistingPdo[]): number {
  const used = new Set(existing.filter((p) => p.direction === direction).map((p) => p.pdoNumber));
  for (let n = 1; n <= 99; n++) {
    if (!used.has(n)) return n;
  }
  return 1;
}

export function PdoCreateDialog({ open, onClose, componentId, existingPdos, onCreated }: Props) {
  const [direction, setDirection] = useState<"TPDO" | "RPDO">("TPDO");
  const [pdoNumber, setPdoNumber] = useState(() => nextAvailableNumber("TPDO", existingPdos));
  const [cobId, setCobId] = useState<string>("");
  const [eventTimerMs, setEventTimerMs] = useState("100");
  const [transmissionType, setTransmissionType] = useState("254");
  const [description, setDescription] = useState("");

  const create = trpc.components.pdoCreate.useMutation({
    onSuccess: () => {
      onCreated();
      onClose();
    },
  });

  function handleDirectionChange(d: "TPDO" | "RPDO") {
    setDirection(d);
    const next = nextAvailableNumber(d, existingPdos);
    setPdoNumber(next);
    // Auto-fill default COB-ID base
    const defaults = DEFAULT_COB_BASES[d];
    if (next >= 1 && next <= 4) {
      setCobId(`0x${defaults[next - 1].toString(16).toUpperCase()}`);
    } else {
      setCobId("");
    }
  }

  function handleNumberChange(n: number) {
    setPdoNumber(n);
    const defaults = DEFAULT_COB_BASES[direction];
    if (n >= 1 && n <= 4) {
      setCobId(`0x${defaults[n - 1].toString(16).toUpperCase()}`);
    } else {
      setCobId("");
    }
  }

  function handleSubmit() {
    const cobIdNum = cobId ? parseInt(cobId.replace(/^0x/i, ""), 16) : null;
    create.mutate({
      componentId,
      direction,
      pdoNumber,
      cobId: isNaN(cobIdNum as number) ? null : cobIdNum,
      eventTimerMs: eventTimerMs ? Number(eventTimerMs) : null,
      transmissionType: transmissionType ? Number(transmissionType) : null,
      description: description || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add PDO</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Direction</Label>
              <Select value={direction} onValueChange={(v) => handleDirectionChange(v as "TPDO" | "RPDO")}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TPDO">TPDO (device → PLC)</SelectItem>
                  <SelectItem value="RPDO">RPDO (PLC → device)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>PDO Number</Label>
              <Input
                type="number"
                min={1}
                max={99}
                value={pdoNumber}
                onChange={(e) => handleNumberChange(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>COB-ID Base (hex)</Label>
              <Input
                type="text"
                value={cobId}
                onChange={(e) => setCobId(e.target.value)}
                placeholder="e.g. 0x180"
                className="font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label>Transmission Type</Label>
              <Input
                type="number"
                min={0}
                max={255}
                value={transmissionType}
                onChange={(e) => setTransmissionType(e.target.value)}
                placeholder="254"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Event Timer (ms)</Label>
            <Input
              type="number"
              min={0}
              value={eventTimerMs}
              onChange={(e) => setEventTimerMs(e.target.value)}
              placeholder="100"
            />
          </div>

          <div className="space-y-1">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Status & fault words"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
