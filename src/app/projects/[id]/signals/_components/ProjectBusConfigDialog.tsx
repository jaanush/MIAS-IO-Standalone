"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";
import { RAW_DATA_TYPES, PLC_DATA_TYPES, MODBUS_REGISTER_TYPES } from "@/lib/enums";

type SignalRow = inferRouterOutputs<AppRouter>["signal"]["list"][number];
type NetworkInfo = inferRouterOutputs<AppRouter>["signal"]["networksForProject"][number];

// WORKAROUND: Radix Select doesn't allow empty string as value, so nullable fields use a sentinel
const NONE = "__none__";

const MODBUS_REG_TYPES = [
  { value: "COIL", label: "Coil" },
  { value: "DISCRETE_INPUT", label: "Discrete Input" },
  { value: "HOLDING_REGISTER", label: "Holding Register" },
  { value: "INPUT_REGISTER", label: "Input Register" },
];

type BusState = {
  plcNetworkId: number | null;
  rawDataType: string;
  plcDataType: string;
  byteOrder: string;
  timeoutMs: string;
  nodeId: string;
  canId: string;
  bitOffset: string;
  bitLength: string;
  canopenIndex: string;
  canopenSubIndex: string;
  j1939Pgn: string;
  j1939Spn: string;
  unitId: string;
  registerType: string;
  registerOffset: string;
};

function emptyState(signal: SignalRow): BusState {
  const b = signal.busSignal;
  return {
    plcNetworkId: b?.plcNetworkId ?? null,
    rawDataType: b?.rawDataType ?? "WORD",
    plcDataType: b?.plcDataType ?? "INT",
    byteOrder: b?.byteOrder ?? "BIG_ENDIAN",
    timeoutMs: b?.timeoutMs != null ? String(b.timeoutMs) : "",
    nodeId: b?.nodeId != null ? String(b.nodeId) : "",
    canId: b?.canId != null ? String(b.canId) : "",
    bitOffset: b?.bitOffset != null ? String(b.bitOffset) : "",
    bitLength: b?.bitLength != null ? String(b.bitLength) : "",
    canopenIndex: b?.canopenIndex != null ? `0x${b.canopenIndex.toString(16).toUpperCase().padStart(4, "0")}` : "",
    canopenSubIndex: b?.canopenSubIndex != null ? String(b.canopenSubIndex) : "",
    j1939Pgn: b?.j1939Pgn != null ? String(b.j1939Pgn) : "",
    j1939Spn: b?.j1939Spn != null ? String(b.j1939Spn) : "",
    unitId: b?.unitId != null ? String(b.unitId) : "",
    registerType: b?.registerType ?? "",
    registerOffset: b?.registerOffset != null ? String(b.registerOffset) : "",
  };
}

type Props = {
  open: boolean;
  onClose: () => void;
  signal: SignalRow;
  networks: NetworkInfo[];
  onSaved: () => void;
};

export function ProjectBusConfigDialog({ open, onClose, signal, networks, onSaved }: Props) {
  const [state, setState] = useState<BusState>(() => emptyState(signal));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setState(emptyState(signal));
      setError(null);
    }
  }, [open, signal]);

  const save = trpc.signal.busSignalSave.useMutation();
  const del = trpc.signal.busSignalDelete.useMutation();

  const utils = trpc.useUtils();

  const origin = signal.origin;
  const isCanopen = origin === "CANOPEN";
  const isJ1939 = origin === "J1939";
  const isRawCan = origin === "CANBUS";
  const isModbus = origin === "MODBUS_RTU" || origin === "MODBUS_TCP";

  function patch(key: keyof BusState, value: unknown) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!state.plcNetworkId) {
      setError("Please select a PLC network.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await save.mutateAsync({
        signalId: signal.id,
        plcNetworkId: state.plcNetworkId,
        rawDataType: state.rawDataType as Parameters<typeof save.mutateAsync>[0]["rawDataType"],
        plcDataType: state.plcDataType as Parameters<typeof save.mutateAsync>[0]["plcDataType"],
        byteOrder: state.byteOrder as "BIG_ENDIAN" | "LITTLE_ENDIAN",
        timeoutMs: state.timeoutMs !== "" ? Number(state.timeoutMs) : null,
        nodeId: state.nodeId !== "" ? Number(state.nodeId) : null,
        canId: state.canId !== "" ? Number(state.canId) : null,
        bitOffset: state.bitOffset !== "" ? Number(state.bitOffset) : null,
        bitLength: state.bitLength !== "" ? Number(state.bitLength) : null,
        canopenIndex: state.canopenIndex !== "" ? parseInt(state.canopenIndex.replace(/^0x/i, ""), 16) : null,
        canopenSubIndex: state.canopenSubIndex !== "" ? Number(state.canopenSubIndex) : null,
        j1939Pgn: state.j1939Pgn !== "" ? Number(state.j1939Pgn) : null,
        j1939Spn: state.j1939Spn !== "" ? Number(state.j1939Spn) : null,
        unitId: state.unitId !== "" ? Number(state.unitId) : null,
        registerType: (state.registerType || null) as Parameters<typeof save.mutateAsync>[0]["registerType"],
        registerOffset: state.registerOffset !== "" ? Number(state.registerOffset) : null,
      });
      await utils.signal.list.invalidate();
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!signal.busSignal) return;
    setSaving(true);
    setError(null);
    try {
      await del.mutateAsync({ signalId: signal.id });
      await utils.signal.list.invalidate();
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const inp = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-hidden focus:ring-1 focus:ring-ring";
  const sel = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-hidden focus:ring-1 focus:ring-ring";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Bus Config
            {signal.tag && <span className="ml-2 text-muted-foreground font-normal text-sm">— {signal.tag}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Network */}
          <div className="space-y-1">
            <Label>PLC Network <span className="text-destructive">*</span></Label>
            <select
              className={sel}
              value={state.plcNetworkId ?? NONE}
              onChange={(e) => patch("plcNetworkId", e.target.value === NONE ? null : Number(e.target.value))}
            >
              <option value={NONE}>— select network —</option>
              {networks.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.plc.name} / {n.protocol}{n.description ? ` (${n.description})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Raw data type + PLC data type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Raw Data Type</Label>
              <select className={sel} value={state.rawDataType} onChange={(e) => patch("rawDataType", e.target.value)}>
                {RAW_DATA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>PLC Data Type</Label>
              <select className={sel} value={state.plcDataType} onChange={(e) => patch("plcDataType", e.target.value)}>
                {PLC_DATA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Byte order */}
          <div className="space-y-1">
            <Label>Byte Order</Label>
            <select className={sel} value={state.byteOrder} onChange={(e) => patch("byteOrder", e.target.value)}>
              <option value="BIG_ENDIAN">Big Endian</option>
              <option value="LITTLE_ENDIAN">Little Endian</option>
            </select>
          </div>

          {/* Timeout */}
          <div className="space-y-1">
            <Label>Communication Timeout (ms)</Label>
            <Input
              type="number"
              min={0}
              value={state.timeoutMs}
              onChange={(e) => patch("timeoutMs", e.target.value)}
              placeholder="e.g. 500"
            />
          </div>

          {/* CANopen fields */}
          {isCanopen && (
            <>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">CANopen Addressing</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Object Index (hex)</Label>
                  <Input
                    type="text"
                    value={state.canopenIndex}
                    onChange={(e) => patch("canopenIndex", e.target.value)}
                    placeholder="e.g. 0x2390"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Subindex</Label>
                  <Input
                    type="number"
                    min={0}
                    max={255}
                    value={state.canopenSubIndex}
                    onChange={(e) => patch("canopenSubIndex", e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Node ID</Label>
                  <Input
                    type="number"
                    value={state.nodeId}
                    onChange={(e) => patch("nodeId", e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Bit in word <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    type="number"
                    min={0}
                    max={31}
                    value={state.bitOffset}
                    onChange={(e) => patch("bitOffset", e.target.value)}
                    placeholder="e.g. 0"
                  />
                </div>
              </div>
            </>
          )}

          {/* J1939 fields */}
          {isJ1939 && (
            <>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">J1939 Addressing</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>PGN</Label>
                  <Input
                    type="number"
                    value={state.j1939Pgn}
                    onChange={(e) => patch("j1939Pgn", e.target.value)}
                    placeholder="e.g. 61444"
                  />
                </div>
                <div className="space-y-1">
                  <Label>SPN</Label>
                  <Input
                    type="number"
                    value={state.j1939Spn}
                    onChange={(e) => patch("j1939Spn", e.target.value)}
                    placeholder="e.g. 190"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Source Address (Node ID)</Label>
                <Input
                  type="number"
                  value={state.nodeId}
                  onChange={(e) => patch("nodeId", e.target.value)}
                  placeholder="0"
                />
              </div>
            </>
          )}

          {/* Raw CANBUS fields */}
          {isRawCan && (
            <>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">CAN Addressing</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Node ID</Label>
                  <Input
                    type="number"
                    value={state.nodeId}
                    onChange={(e) => patch("nodeId", e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label>CAN ID (decimal)</Label>
                  <Input
                    type="number"
                    value={state.canId}
                    onChange={(e) => patch("canId", e.target.value)}
                    placeholder="e.g. 418"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Bit Offset</Label>
                  <Input
                    type="number"
                    value={state.bitOffset}
                    onChange={(e) => patch("bitOffset", e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Bit Length</Label>
                  <Input
                    type="number"
                    value={state.bitLength}
                    onChange={(e) => patch("bitLength", e.target.value)}
                    placeholder="16"
                  />
                </div>
              </div>
            </>
          )}

          {/* Modbus fields */}
          {isModbus && (
            <>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Modbus Addressing</p>
              <div className="space-y-1">
                <Label>Unit ID (Slave)</Label>
                <Input
                  type="number"
                  value={state.unitId}
                  onChange={(e) => patch("unitId", e.target.value)}
                  placeholder="1"
                />
              </div>
              <div className="space-y-1">
                <Label>Register Type</Label>
                <select className={sel} value={state.registerType || NONE} onChange={(e) => patch("registerType", e.target.value === NONE ? "" : e.target.value)}>
                  <option value={NONE}>— none —</option>
                  {MODBUS_REG_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Register Offset</Label>
                <Input
                  type="number"
                  value={state.registerOffset}
                  onChange={(e) => patch("registerOffset", e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Bit Offset <span className="text-muted-foreground font-normal">(in register)</span></Label>
                  <Input
                    type="number"
                    min={0}
                    max={15}
                    value={state.bitOffset}
                    onChange={(e) => patch("bitOffset", e.target.value)}
                    placeholder="e.g. 0"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Bit Length</Label>
                  <Input
                    type="number"
                    min={1}
                    max={16}
                    value={state.bitLength}
                    onChange={(e) => patch("bitLength", e.target.value)}
                    placeholder="e.g. 1"
                  />
                </div>
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-destructive rounded border border-destructive/30 bg-destructive/10 px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          {signal.busSignal && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving}
              className="mr-auto"
            >
              Remove
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
