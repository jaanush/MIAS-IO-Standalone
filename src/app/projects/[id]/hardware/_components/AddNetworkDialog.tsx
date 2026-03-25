"use client";

import { useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BUS_PROTOCOLS, NETWORK_NODE_ROLES, CAN_MODES, SERIAL_PARITY, ETHERNET_PROTOCOL_SET, type BusProtocol } from "@/lib/enums";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (networkId: number) => void;
  projectId: number;
  /** Pre-select first node (contextual creation from PLC/carrier) */
  initialPlcId?: number | null;
  initialCarrierId?: number | null;
};

export function AddNetworkDialog({
  open,
  onClose,
  onSaved,
  projectId,
  initialPlcId,
  initialCarrierId,
}: Props) {
  const [protocol, setProtocol] = useState<string>("");
  const [description, setDescription] = useState("");
  const [role, setRole] = useState("MASTER");
  // Protocol-specific
  const [baudRateKbit, setBaudRateKbit] = useState("");
  const [serialParity, setSerialParity] = useState("");
  const [serialStopBits, setSerialStopBits] = useState("");
  const [canMode, setCanMode] = useState("");
  const [canHeartbeatMs, setCanHeartbeatMs] = useState("");
  const [canSyncPeriodMs, setCanSyncPeriodMs] = useState("");
  const [ipPort, setIpPort] = useState("");
  const [cyclePeriodMs, setCyclePeriodMs] = useState("");
  // First node
  const [firstNodeType, setFirstNodeType] = useState<"plc" | "carrier" | "">(
    initialPlcId ? "plc" : initialCarrierId ? "carrier" : ""
  );
  const [firstNodeId, setFirstNodeId] = useState<string>(
    initialPlcId ? String(initialPlcId) : initialCarrierId ? String(initialCarrierId) : ""
  );
  const [firstNodeRole, setFirstNodeRole] = useState("CLIENT");

  const { data: hwData } = trpc.projectHardware.getHardware.useQuery({ projectId }, { enabled: open });
  const plcs = hwData?.plcs ?? [];
  const allCarriers = plcs.flatMap((p) => [...p.carriers, ...p.buses.flatMap((n: any) => n.carriers)]);

  const createNetwork = trpc.projectHardware.busCreate.useMutation();
  const upsertNode = trpc.projectHardware.busNodeUpsert.useMutation();

  const proto = protocol as BusProtocol;
  const isSerial = ["MODBUS_RTU", "PROFIBUS", "DEVICENET"].includes(proto);
  const isCan = ["CANBUS", "CANOPEN", "J1939"].includes(proto);
  const isEthernet = ETHERNET_PROTOCOL_SET.has(proto);

  function reset() {
    setProtocol("");
    setDescription("");
    setRole("MASTER");
    setBaudRateKbit("");
    setSerialParity("");
    setSerialStopBits("");
    setCanMode("");
    setCanHeartbeatMs("");
    setCanSyncPeriodMs("");
    setIpPort("");
    setCyclePeriodMs("");
    setFirstNodeType(initialPlcId ? "plc" : initialCarrierId ? "carrier" : "");
    setFirstNodeId(initialPlcId ? String(initialPlcId) : initialCarrierId ? String(initialCarrierId) : "");
    setFirstNodeRole("CLIENT");
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleCreate() {
    const net = await createNetwork.mutateAsync({
      projectId,
      protocol: proto,
      role: role as any,
      description: description || null,
      baudRateKbit: baudRateKbit ? Number(baudRateKbit) : null,
      serialParity: (serialParity || null) as any,
      serialStopBits: serialStopBits ? Number(serialStopBits) : null,
      ipPort: ipPort ? Number(ipPort) : null,
      canMode: (canMode || null) as any,
      canHeartbeatMs: canHeartbeatMs ? Number(canHeartbeatMs) : null,
      canSyncPeriodMs: canSyncPeriodMs ? Number(canSyncPeriodMs) : null,
      cyclePeriodMs: cyclePeriodMs ? Number(cyclePeriodMs) : null,
    });

    // Add first node if specified
    if (firstNodeId && firstNodeType) {
      await upsertNode.mutateAsync({
        busId: net.id,
        plcId: firstNodeType === "plc" ? Number(firstNodeId) : undefined,
        carrierId: firstNodeType === "carrier" ? Number(firstNodeId) : undefined,
        role: firstNodeRole as any,
      });
    }

    reset();
    onSaved(net.id);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Network</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Protocol */}
          <div className="space-y-1">
            <Label className="text-xs">Protocol *</Label>
            <Select value={protocol || "__none__"} onValueChange={(v) => setProtocol(v === "__none__" ? "" : v)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select protocol...</SelectItem>
                {BUS_PROTOCOLS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {protocol && (
            <>
              {/* Basic config */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-8 text-sm" placeholder="e.g. Field devices" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Network Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["MASTER", "SLAVE", "ADAPTER", "SCANNER"].map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Serial params */}
              {isSerial && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Baud Rate (kbit/s)</Label>
                    <Input type="number" value={baudRateKbit} onChange={(e) => setBaudRateKbit(e.target.value)} className="h-8 text-sm" placeholder="115" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Parity</Label>
                    <Select value={serialParity || "__none__"} onValueChange={(v) => setSerialParity(v === "__none__" ? "" : v)}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {SERIAL_PARITY.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Stop Bits</Label>
                    <Select value={serialStopBits || "__none__"} onValueChange={(v) => setSerialStopBits(v === "__none__" ? "" : v)}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* CAN params */}
              {isCan && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Baud Rate (kbit/s)</Label>
                    <Input type="number" value={baudRateKbit} onChange={(e) => setBaudRateKbit(e.target.value)} className="h-8 text-sm" placeholder="500" />
                  </div>
                  {proto === "CANBUS" && (
                    <div className="space-y-1">
                      <Label className="text-xs">CAN Mode</Label>
                      <Select value={canMode || "__none__"} onValueChange={(v) => setCanMode(v === "__none__" ? "" : v)}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {CAN_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs">Heartbeat (ms)</Label>
                    <Input type="number" value={canHeartbeatMs} onChange={(e) => setCanHeartbeatMs(e.target.value)} className="h-8 text-sm" placeholder="1000" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Sync Period (ms)</Label>
                    <Input type="number" value={canSyncPeriodMs} onChange={(e) => setCanSyncPeriodMs(e.target.value)} className="h-8 text-sm" placeholder="100" />
                  </div>
                </div>
              )}

              {/* Ethernet params */}
              {isEthernet && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">TCP Port</Label>
                    <Input type="number" value={ipPort} onChange={(e) => setIpPort(e.target.value)} className="h-8 text-sm" placeholder="502" />
                  </div>
                </div>
              )}

              {/* Cycle period (all) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Cycle Period (ms)</Label>
                  <Input type="number" value={cyclePeriodMs} onChange={(e) => setCyclePeriodMs(e.target.value)} className="h-8 text-sm" placeholder="optional" />
                </div>
              </div>

              {/* First node (optional) */}
              <div className="rounded-md border p-3 space-y-2 bg-muted/20">
                <Label className="text-xs font-medium">First Connected Node (optional)</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Select value={firstNodeType || "__none__"} onValueChange={(v) => { setFirstNodeType((v === "__none__" ? "" : v) as any); setFirstNodeId(""); }}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Skip</SelectItem>
                      <SelectItem value="plc">PLC</SelectItem>
                      <SelectItem value="carrier">Carrier</SelectItem>
                    </SelectContent>
                  </Select>
                  {firstNodeType && (
                    <>
                      <Select value={firstNodeId || "__none__"} onValueChange={(v) => setFirstNodeId(v === "__none__" ? "" : v)}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Select...</SelectItem>
                          {firstNodeType === "plc"
                            ? plcs.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)
                            : allCarriers.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)
                          }
                        </SelectContent>
                      </Select>
                      <Select value={firstNodeRole} onValueChange={setFirstNodeRole}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {NETWORK_NODE_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            disabled={!protocol || createNetwork.isPending}
            onClick={handleCreate}
          >
            {createNetwork.isPending ? "Creating..." : "Create Network"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
