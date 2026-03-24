"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Settings2, Trash2 } from "lucide-react";
import { BUS_PROTOCOLS, NETWORK_NODE_ROLES, ETHERNET_PROTOCOL_SET } from "@/lib/enums";

type PortData = {
  ipAddress: string | null;
  ipNetworkId: number | null;
  label: string | null;
};

type Props = {
  portNumber: number;
  port: PortData | null;
  projectId: number;
  /** The device that owns this port — for BusNode management */
  plcId?: number;
  carrierId?: number;
  onSave: (data: { label: string | null; ipAddress: string | null; ipNetworkId: number | null }) => void;
  saving?: boolean;
};

type IpNetworkInfo = {
  id: number;
  name: string | null;
  buses: { id: number; protocol: string; description: string | null }[];
};

export function PortNetworkEditor({ portNumber, port, projectId, plcId, carrierId, onSave, saving }: Props) {
  const utils = trpc.useUtils();
  const createNetwork = trpc.projectHardware.ipNetworkCreate.useMutation({
    onSuccess: () => utils.projectHardware.ipNetworkList.invalidate(),
  });
  const createBus = trpc.projectHardware.busCreate.useMutation({
    onSuccess: () => utils.projectHardware.ipNetworkList.invalidate(),
  });
  const upsertNode = trpc.projectHardware.busNodeUpsert.useMutation({
    onSuccess: () => utils.projectHardware.getHardware.invalidate(),
  });
  const deleteNode = trpc.projectHardware.busNodeDelete.useMutation({
    onSuccess: () => utils.projectHardware.getHardware.invalidate(),
  });
  const { data: ipNetworks = [] } = trpc.projectHardware.ipNetworkList.useQuery({ projectId });

  const [ip, setIp] = useState(port?.ipAddress ?? "");
  const [label, setLabel] = useState(port?.label ?? "");
  const [networkId, setNetworkId] = useState<string>(String(port?.ipNetworkId ?? ""));
  const [adding, setAdding] = useState(false);
  const [selectedBusId, setSelectedBusId] = useState("");
  const [nodeConfigBus, setNodeConfigBus] = useState<{ id: number; protocol: string } | null>(null);
  const [nodeRole, setNodeRole] = useState("CLIENT");
  const [nodeAddress, setNodeAddress] = useState("");
  const [nodeIp, setNodeIp] = useState("");

  useEffect(() => {
    setIp(port?.ipAddress ?? "");
    setLabel(port?.label ?? "");
    setNetworkId(String(port?.ipNetworkId ?? ""));
  }, [port]);

  const isDirty =
    ip !== (port?.ipAddress ?? "") ||
    label !== (port?.label ?? "") ||
    networkId !== String(port?.ipNetworkId ?? "");

  const assignedNetwork = port?.ipNetworkId
    ? (ipNetworks as IpNetworkInfo[]).find((n) => n.id === port.ipNetworkId)
    : null;

  // Find which buses on this network the device is already connected to
  // We get this from the getHardware data via the bus nodes on each bus
  const { data: hwData } = trpc.projectHardware.getHardware.useQuery({ projectId });
  const allBuses = [...(hwData?.plcs ?? []).flatMap((p) => p.buses), ...(hwData?.networks ?? [])];
  const deviceBusIds = new Set(
    allBuses
      .filter((b) => b.nodes?.some((n: any) => (plcId && n.plc?.id === plcId) || (carrierId && n.carrier?.id === carrierId)))
      .map((b) => b.id)
  );

  const networkBuses = assignedNetwork?.buses ?? [];
  const unconnectedBuses = networkBuses.filter((b) => !deviceBusIds.has(b.id));
  const connectedBuses = networkBuses.filter((b) => deviceBusIds.has(b.id));

  async function handleCreateNetwork() {
    const net = await createNetwork.mutateAsync({ projectId, name: `Network ${ipNetworks.length + 1}` });
    setNetworkId(String(net.id));
    onSave({ label: port?.label || null, ipAddress: port?.ipAddress || null, ipNetworkId: net.id });
  }

  async function handleAddExistingBus() {
    if (!selectedBusId) return;
    await upsertNode.mutateAsync({
      busId: Number(selectedBusId),
      plcId: plcId ?? undefined,
      carrierId: carrierId ?? undefined,
      role: "CLIENT",
    });
    setAdding(false);
    setSelectedBusId("");
  }

  async function handleCreateBus() {
    if (!assignedNetwork) return;
    const bus = await createBus.mutateAsync({
      projectId,
      protocol: "MODBUS_TCP",
      role: "MASTER",
      ipNetworkId: assignedNetwork.id,
    });
    await upsertNode.mutateAsync({
      busId: bus.id,
      plcId: plcId ?? undefined,
      carrierId: carrierId ?? undefined,
      role: "CLIENT",
    });
    setAdding(false);
  }

  function handleRemoveBus(busId: number) {
    // Find the node for this device on this bus
    const bus = allBuses.find((b) => b.id === busId);
    const node = bus?.nodes?.find((n: any) => (plcId && n.plc?.id === plcId) || (carrierId && n.carrier?.id === carrierId));
    if (node) deleteNode.mutate({ id: (node as any).id });
  }

  function openNodeConfig(bus: { id: number; protocol: string }) {
    const busData = allBuses.find((b) => b.id === bus.id);
    const node = busData?.nodes?.find((n: any) => (plcId && n.plc?.id === plcId) || (carrierId && n.carrier?.id === carrierId));
    setNodeConfigBus(bus);
    setNodeRole((node as any)?.role ?? "CLIENT");
    setNodeAddress((node as any)?.nodeAddress != null ? String((node as any).nodeAddress) : "");
    setNodeIp((node as any)?.ipAddress ?? "");
  }

  function handleSaveNodeConfig() {
    if (!nodeConfigBus) return;
    upsertNode.mutate({
      busId: nodeConfigBus.id,
      plcId: plcId ?? undefined,
      carrierId: carrierId ?? undefined,
      role: nodeRole as any,
      nodeAddress: nodeAddress ? Number(nodeAddress) : null,
    });
    setNodeConfigBus(null);
  }

  return (
    <div className="rounded-md border px-3 py-2 space-y-2">
      <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Port {portNumber + 1}</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" className="h-8 text-sm w-24" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">IP Address</Label>
          <Input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="192.168.1.x" className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">IP Network</Label>
          <div className="flex gap-1">
            <select
              className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm"
              value={networkId}
              onChange={(e) => setNetworkId(e.target.value)}
            >
              <option value="">— None —</option>
              {(ipNetworks as IpNetworkInfo[]).map((n) => (
                <option key={n.id} value={n.id}>{n.name ?? `Network #${n.id}`}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" className="h-8 px-2 shrink-0" disabled={createNetwork.isPending} onClick={handleCreateNetwork} title="Create new IP network">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <Button size="sm" className="h-8" disabled={!isDirty || saving} onClick={() => onSave({ label: label || null, ipAddress: ip || null, ipNetworkId: networkId ? Number(networkId) : null })}>
          {saving ? "…" : "Save"}
        </Button>
      </div>

      {/* Buses on this network */}
      {assignedNetwork && (
        <div className="pl-1 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Buses</span>

          {/* Connected buses */}
          {connectedBuses.map((b) => (
            <div key={b.id} className="flex items-center gap-2 text-xs pl-2 py-0.5 rounded hover:bg-muted/30">
              <Badge variant="outline" className="text-[10px] px-1 py-0 font-mono">{b.protocol}</Badge>
              <span className="text-muted-foreground truncate flex-1">{b.description ?? ""}</span>
              <button type="button" className="text-muted-foreground hover:text-foreground shrink-0" title="Bus node settings" onClick={() => openNodeConfig(b)}>
                <Settings2 className="h-3 w-3" />
              </button>
              <button type="button" className="text-muted-foreground hover:text-destructive shrink-0" title="Disconnect from bus" onClick={() => handleRemoveBus(b.id)}>
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}

          {/* Add bus */}
          {!adding ? (
            <button type="button" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground pl-2 py-0.5" onClick={() => setAdding(true)}>
              <Plus className="h-3 w-3" /> Add bus
            </button>
          ) : (
            <div className="flex items-center gap-1.5 pl-2">
              {unconnectedBuses.length > 0 && (
                <>
                  <select className="h-7 flex-1 rounded border border-input bg-background px-1.5 text-xs" value={selectedBusId} onChange={(e) => setSelectedBusId(e.target.value)}>
                    <option value="">Select bus...</option>
                    {unconnectedBuses.map((b) => (
                      <option key={b.id} value={b.id}>{b.protocol}{b.description ? ` — ${b.description}` : ""}</option>
                    ))}
                  </select>
                  <Button size="sm" className="h-7 text-xs px-2" disabled={!selectedBusId || upsertNode.isPending} onClick={handleAddExistingBus}>
                    Join
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" className="h-7 text-xs px-2" disabled={createBus.isPending} onClick={handleCreateBus}>
                {createBus.isPending ? "…" : "New Bus"}
              </Button>
              <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => { setAdding(false); setSelectedBusId(""); }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bus node config dialog */}
      <Dialog open={!!nodeConfigBus} onOpenChange={(o) => !o && setNodeConfigBus(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Bus Node Settings — {nodeConfigBus?.protocol}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Role</Label>
              <select className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm" value={nodeRole} onChange={(e) => setNodeRole(e.target.value)}>
                {NETWORK_NODE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Node Address</Label>
              <Input type="number" className="h-8 text-sm" value={nodeAddress} onChange={(e) => setNodeAddress(e.target.value)} placeholder="e.g. 1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNodeConfigBus(null)}>Cancel</Button>
            <Button size="sm" disabled={upsertNode.isPending} onClick={handleSaveNodeConfig}>
              {upsertNode.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
