"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";

type IpNetworkData = {
  id: number;
  name: string | null;
  subnet: string | null;
  gateway: string | null;
  dns: string | null;
  description: string | null;
  buses: { id: number; protocol: string; description: string | null }[];
};

type Props = {
  network: IpNetworkData;
  projectId: number;
  onRefresh: () => void;
  onDeleted: () => void;
};

export function IpNetworkDetail({ network, projectId, onRefresh, onDeleted }: Props) {
  const update = trpc.projectHardware.ipNetworkUpdate.useMutation({ onSuccess: onRefresh });
  const deleteNet = trpc.projectHardware.ipNetworkDelete.useMutation({ onSuccess: onDeleted });
  const [name, setName] = useState(network.name ?? "");
  const [subnet, setSubnet] = useState(network.subnet ?? "");
  const [gateway, setGateway] = useState(network.gateway ?? "");
  const [dns, setDns] = useState(network.dns ?? "");
  const [description, setDescription] = useState(network.description ?? "");

  useEffect(() => {
    setName(network.name ?? "");
    setSubnet(network.subnet ?? "");
    setGateway(network.gateway ?? "");
    setDns(network.dns ?? "");
    setDescription(network.description ?? "");
  }, [network]);

  const isDirty =
    name !== (network.name ?? "") ||
    subnet !== (network.subnet ?? "") ||
    gateway !== (network.gateway ?? "") ||
    dns !== (network.dns ?? "") ||
    description !== (network.description ?? "");

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{network.name ?? `Network #${network.id}`}</h2>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => { if (confirm("Delete this IP network?")) deleteNet.mutate({ id: network.id }); }}
        >
          <Trash2 className="h-4 w-4 mr-1" /> Delete
        </Button>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Engine Room LAN" className="h-8 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Subnet (CIDR)</Label>
            <Input value={subnet} onChange={(e) => setSubnet(e.target.value)} placeholder="192.168.1.0/24" className="h-8 text-sm font-mono" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Gateway</Label>
            <Input value={gateway} onChange={(e) => setGateway(e.target.value)} placeholder="192.168.1.1" className="h-8 text-sm font-mono" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">DNS Servers</Label>
          <Input value={dns} onChange={(e) => setDns(e.target.value)} placeholder="8.8.8.8, 8.8.4.4" className="h-8 text-sm font-mono" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className="h-8 text-sm" />
        </div>
        <Button size="sm" disabled={!isDirty || update.isPending} onClick={() => update.mutate({
          id: network.id,
          name: name || null,
          subnet: subnet || null,
          gateway: gateway || null,
          dns: dns || null,
          description: description || null,
        })}>
          {update.isPending ? "Saving…" : "Save"}
        </Button>
      </div>

      {/* Buses on this network */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Buses on this network
        </h3>
        {network.buses.length === 0 ? (
          <p className="text-xs text-muted-foreground">No buses assigned to this network yet.</p>
        ) : (
          <div className="space-y-1">
            {network.buses.map((b) => (
              <div key={b.id} className="flex items-center gap-2 text-sm rounded-md border px-3 py-1.5">
                <Badge variant="outline" className="text-xs font-mono">{b.protocol}</Badge>
                <span className="text-muted-foreground">{b.description ?? ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
