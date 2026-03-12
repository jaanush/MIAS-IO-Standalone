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
import type { SignalRowState } from "./SignalGrid";
import { RAW_DATA_TYPES } from "@/lib/enums";

// WORKAROUND: Radix Select doesn't allow empty string as value, so nullable fields use a sentinel
const NONE = "__none__";

type Props = {
  open: boolean;
  onClose: () => void;
  row: SignalRowState;
  plcDataTypes: { id: number; code: string }[];
  onChange: (patch: Partial<SignalRowState>) => void;
};
const MODBUS_REG_TYPES = [
  { value: "COIL", label: "Coil" },
  { value: "DISCRETE_INPUT", label: "Discrete Input" },
  { value: "HOLDING_REGISTER", label: "Holding Register" },
  { value: "INPUT_REGISTER", label: "Input Register" },
];

export function BusConfigDialog({ open, onClose, row, plcDataTypes, onChange }: Props) {
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

  const origin = row.origin;
  const isCanopen = origin === "CANOPEN";
  const isJ1939 = origin === "J1939";
  const isRawCan = origin === "CANBUS";
  const isModbus = origin === "MODBUS_RTU" || origin === "MODBUS_TCP";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Bus Config
            {row.tagSuffix && <span className="ml-2 text-muted-foreground font-normal text-sm">— {row.tagSuffix}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* PLC data type */}
          <div className="space-y-1">
            <Label>PLC Data Type</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={get("plcDataTypeId") != null ? String(get("plcDataTypeId")) : NONE}
              onChange={(e) => patch("plcDataTypeId", e.target.value === NONE ? null : Number(e.target.value))}
            >
              <option value={NONE}>— none —</option>
              {plcDataTypes.map((t) => (
                <option key={t.id} value={String(t.id)}>{t.code}</option>
              ))}
            </select>
          </div>

          {/* Raw data type + byte order */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Raw Data Type</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={get("rawDataType") ?? NONE}
                onChange={(e) => patch("rawDataType", e.target.value === NONE ? null : e.target.value)}
              >
                <option value={NONE}>— none —</option>
                {RAW_DATA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Byte Order</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={get("byteOrder") ?? NONE}
                onChange={(e) => patch("byteOrder", e.target.value === NONE ? null : e.target.value)}
              >
                <option value={NONE}>— none —</option>
                <option value="BIG_ENDIAN">Big Endian</option>
                <option value="LITTLE_ENDIAN">Little Endian</option>
              </select>
            </div>
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
                    value={get("canopenIndex") != null ? `0x${get("canopenIndex")!.toString(16).toUpperCase().padStart(4, "0")}` : ""}
                    onChange={(e) => {
                      const v = e.target.value.replace(/^0x/i, "");
                      patch("canopenIndex", v === "" ? null : parseInt(v, 16));
                    }}
                    placeholder="e.g. 0x2390"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Subindex</Label>
                  <Input
                    type="number"
                    min={0}
                    max={255}
                    value={get("canopenSubIndex") ?? ""}
                    onChange={(e) => patch("canopenSubIndex", e.target.value === "" ? null : Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Node ID</Label>
                  <Input
                    type="number"
                    value={get("canNodeId") ?? ""}
                    onChange={(e) => patch("canNodeId", e.target.value === "" ? null : Number(e.target.value))}
                    placeholder="1"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Bit in word <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    type="number"
                    min={0}
                    max={31}
                    value={get("bitOffset") ?? ""}
                    onChange={(e) => patch("bitOffset", e.target.value === "" ? null : Number(e.target.value))}
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
                    value={get("j1939Pgn") ?? ""}
                    onChange={(e) => patch("j1939Pgn", e.target.value === "" ? null : Number(e.target.value))}
                    placeholder="e.g. 61444"
                  />
                </div>
                <div className="space-y-1">
                  <Label>SPN</Label>
                  <Input
                    type="number"
                    value={get("j1939Spn") ?? ""}
                    onChange={(e) => patch("j1939Spn", e.target.value === "" ? null : Number(e.target.value))}
                    placeholder="e.g. 190"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Source Address (Node ID)</Label>
                <Input
                  type="number"
                  value={get("canNodeId") ?? ""}
                  onChange={(e) => patch("canNodeId", e.target.value === "" ? null : Number(e.target.value))}
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
                    value={get("canNodeId") ?? ""}
                    onChange={(e) => patch("canNodeId", e.target.value === "" ? null : Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label>CAN ID (decimal)</Label>
                  <Input
                    type="number"
                    value={get("canId") ?? ""}
                    onChange={(e) => patch("canId", e.target.value === "" ? null : Number(e.target.value))}
                    placeholder="e.g. 418"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Bit Offset</Label>
                  <Input
                    type="number"
                    value={get("bitOffset") ?? ""}
                    onChange={(e) => patch("bitOffset", e.target.value === "" ? null : Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Bit Length</Label>
                  <Input
                    type="number"
                    value={get("bitLength") ?? ""}
                    onChange={(e) => patch("bitLength", e.target.value === "" ? null : Number(e.target.value))}
                    placeholder="16"
                  />
                </div>
              </div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Multiplexing</p>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input cursor-pointer"
                    checked={get("isMuxIndicator") ?? false}
                    onChange={(e) => {
                      patch("isMuxIndicator", e.target.checked);
                      if (e.target.checked) patch("muxId", null);
                    }}
                  />
                  Mux indicator (selector signal)
                </label>
              </div>
              {!(get("isMuxIndicator") ?? false) && (
                <div className="space-y-1">
                  <Label>Mux ID <span className="text-muted-foreground font-normal">(valid when indicator equals this value)</span></Label>
                  <Input
                    type="number"
                    min={0}
                    value={get("muxId") ?? ""}
                    onChange={(e) => patch("muxId", e.target.value === "" ? null : Number(e.target.value))}
                    placeholder="e.g. 0, 1, 2 …"
                  />
                </div>
              )}
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
                  value={get("modbusUnitId") ?? ""}
                  onChange={(e) => patch("modbusUnitId", e.target.value === "" ? null : Number(e.target.value))}
                  placeholder="1"
                />
              </div>
              <div className="space-y-1">
                <Label>Register Type</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={get("modbusRegisterType") ?? NONE}
                  onChange={(e) => patch("modbusRegisterType", e.target.value === NONE ? null : e.target.value)}
                >
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
                  value={get("modbusRegisterOffset") ?? ""}
                  onChange={(e) => patch("modbusRegisterOffset", e.target.value === "" ? null : Number(e.target.value))}
                  placeholder="0"
                />
              </div>
            </>
          )}
        </div>

          {/* Timeout */}
          <div className="space-y-1">
            <Label>Communication Timeout (ms)</Label>
            <Input
              type="number"
              min={0}
              value={get("timeoutMs") ?? ""}
              onChange={(e) => patch("timeoutMs", e.target.value === "" ? null : Number(e.target.value))}
              placeholder="e.g. 500"
            />
          </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
