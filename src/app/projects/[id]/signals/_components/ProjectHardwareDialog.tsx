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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SIGNAL_ORIGINS, type SignalOrigin } from "@/lib/enums";

const NONE = "__none__";
const sel = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

type SignalRow = {
  id: number;
  origin: string;
  ioCardId: number | null;
  channelPosition: number | null;
  cabinetLocation: string | null;
  drawingRef: string | null;
  ioCard: {
    id: number;
    carrier: { name: string; plc: { id: number; name: string } };
  } | null;
};

type Props = {
  projectId: number;
  open: boolean;
  signal: SignalRow;
  onClose: () => void;
  onSaved: () => void;
};

export function ProjectHardwareDialog({ projectId, open, signal, onClose, onSaved }: Props) {
  const [origin, setOrigin] = useState(signal.origin);
  const [ioCardId, setIoCardId] = useState<number | null>(signal.ioCardId);
  const [channelPosition, setChannelPosition] = useState<number | null>(signal.channelPosition);
  const [cabinetLocation, setCabinetLocation] = useState(signal.cabinetLocation ?? "");
  const [drawingRef, setDrawingRef] = useState(signal.drawingRef ?? "");

  const isIec = origin === "IEC";

  const { data: cards = [] } = trpc.signal.cardsForProject.useQuery(
    { projectId },
    { enabled: open && isIec }
  );

  const update = trpc.signal.update.useMutation({ onSuccess: () => onSaved() });

  function handleSave() {
    update.mutate({
      id: signal.id,
      origin: origin as SignalOrigin,
      ioCardId: isIec ? ioCardId : null,
      channelPosition: isIec && ioCardId ? channelPosition : null,
      cabinetLocation: cabinetLocation || null,
      drawingRef: drawingRef || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Hardware Assignment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Signal Origin</Label>
            <Select value={origin} onValueChange={(v) => { setOrigin(v); if (v !== "IEC") { setIoCardId(null); setChannelPosition(null); } }}>
              <SelectTrigger className={sel}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIGNAL_ORIGINS.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isIec ? (
            <>
              <div className="space-y-1">
                <Label>IO Card</Label>
                <Select
                  value={ioCardId != null ? String(ioCardId) : NONE}
                  onValueChange={(v) => {
                    const val = v === NONE ? null : Number(v);
                    setIoCardId(val);
                    if (!val) setChannelPosition(null);
                  }}
                >
                  <SelectTrigger className={sel}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— Unassigned —</SelectItem>
                    {cards.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.path}
                        {c.articleNumber ? ` — ${c.articleNumber}` : ""}
                        {c.description ? `: ${c.description}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {ioCardId != null && (
                <div className="space-y-1">
                  <Label>Channel (0-based)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={channelPosition ?? ""}
                    onChange={(e) => setChannelPosition(e.target.value === "" ? null : Number(e.target.value))}
                    placeholder="e.g. 0"
                  />
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground rounded-md border border-dashed px-3 py-2">
              Network assignment for <strong>{origin}</strong> signals is configured via the Bus dialog.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Cabinet Location</Label>
              <Input value={cabinetLocation} onChange={(e) => setCabinetLocation(e.target.value)} placeholder="e.g. A01" />
            </div>
            <div className="space-y-1">
              <Label>Drawing Reference</Label>
              <Input value={drawingRef} onChange={(e) => setDrawingRef(e.target.value)} placeholder="e.g. 625-E01" />
            </div>
          </div>
        </div>

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
