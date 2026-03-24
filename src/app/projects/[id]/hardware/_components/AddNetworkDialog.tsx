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
  const allCarriers = plcs.flatMap((p) => [...p.carriers, ...p.buses.flatMap((n) => n.carriers)]);

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

  const sel = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm h-8";

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
            <select className={sel} value={protocol} onChange={(e) => setProtocol(e.target.value)}>
              <option value="">Select protocol...</option>
              {BUS_PROTOCOLS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
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
                  <select className={sel} value={role} onChange={(e) => setRole(e.target.value)}>
                    {["MASTER", "SLAVE", "ADAPTER", "SCANNER"].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
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
                    <select className={sel} value={serialParity} onChange={(e) => setSerialParity(e.target.value)}>
                      <option value="">—</option>
                      {SERIAL_PARITY.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Stop Bits</Label>
                    <select className={sel} value={serialStopBits} onChange={(e) => setSerialStopBits(e.target.value)}>
                      <option value="">—</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                    </select>
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
                      <select className={sel} value={canMode} onChange={(e) => setCanMode(e.target.value)}>
                        <option value="">—</option>
                        {CAN_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
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
                  <select className={sel} value={firstNodeType} onChange={(e) => { setFirstNodeType(e.target.value as any); setFirstNodeId(""); }}>
                    <option value="">Skip</option>
                    <option value="plc">PLC</option>
                    <option value="carrier">Carrier</option>
                  </select>
                  {firstNodeType && (
                    <>
                      <select className={sel} value={firstNodeId} onChange={(e) => setFirstNodeId(e.target.value)}>
                        <option value="">Select...</option>
                        {firstNodeType === "plc"
                          ? plcs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)
                          : allCarriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
                        }
                      </select>
                      <select className={sel} value={firstNodeRole} onChange={(e) => setFirstNodeRole(e.target.value)}>
                        {NETWORK_NODE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
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
