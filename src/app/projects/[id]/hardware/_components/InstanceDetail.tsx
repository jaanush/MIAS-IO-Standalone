"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NETWORK_NODE_ROLES, ETHERNET_PROTOCOL_SET, type NetworkNodeRole } from "@/lib/enums";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import type { ComponentInstance, Bus } from "@/lib/types/hardware";
import { InstanceParameters } from "./InstanceParameters";

type Props = {
  instance: ComponentInstance;
  network: Bus | null;
  projectId: number;
  onDeleted: () => void;
  onRefresh: () => void;
};

export function InstanceDetail({ instance, network, projectId, onDeleted, onRefresh }: Props) {
  const [confirmProps, confirmAction] = useConfirm();
  const [name, setName] = useState(instance.name);
  const [tag, setTag] = useState(instance.tag ?? "");
  const [notes, setNotes] = useState(instance.notes ?? "");
  const [nodeRole, setNodeRole] = useState(instance.nodeRole ?? "");
  const [nodeAddress, setNodeAddress] = useState(instance.nodeAddress != null ? String(instance.nodeAddress) : "");
  const [canIdOffset, setCanIdOffset] = useState(instance.canIdOffset != null ? String(instance.canIdOffset) : "");
  const [fbOverride, setFbOverride] = useState(instance.functionBlockOverride ?? "");

  useEffect(() => {
    setName(instance.name);
    setTag(instance.tag ?? "");
    setNotes(instance.notes ?? "");
    setNodeRole(instance.nodeRole ?? "");
    setNodeAddress(instance.nodeAddress != null ? String(instance.nodeAddress) : "");
    setCanIdOffset(instance.canIdOffset != null ? String(instance.canIdOffset) : "");
    setFbOverride(instance.functionBlockOverride ?? "");
  }, [instance]);

  const update = trpc.projectHardware.instanceUpdate.useMutation({ onSuccess: onRefresh });
  const del = trpc.projectHardware.instanceDelete.useMutation();

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    update.mutate({
      id: instance.id,
      name: name.trim(),
      tag: tag.trim() || null,
      notes: notes.trim() || null,
      nodeRole: (nodeRole || null) as NetworkNodeRole | null,
      nodeAddress: nodeAddress ? Number(nodeAddress) : null,
      canIdOffset: canIdOffset ? Number(canIdOffset) : null,
      functionBlockOverride: fbOverride.trim() || null,
    });
  }

  async function handleDelete() {
    confirmAction(`Delete instance "${instance.name}"? This will also delete all its signals.`, async () => {
      await del.mutateAsync({ id: instance.id });
      onDeleted();
    });
  }

  const isCan = network && ["CANBUS", "CANOPEN", "J1939"].includes(network.protocol);
  const isEthernet = network && ETHERNET_PROTOCOL_SET.has(network.protocol);

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-lg font-semibold">{instance.name}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {instance.component.name}
          {(instance.component.manufacturer || instance.component.model) && (
            <> · {[instance.component.manufacturer, instance.component.model].filter(Boolean).join(" ")}</>
          )}
        </p>
        {network && (
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">{network.protocol}</Badge>
            {network.description && <span className="text-xs text-muted-foreground">{network.description}</span>}
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Identity */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Instance Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tag</Label>
            <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. P01" className="h-8 text-sm" />
          </div>
        </div>

        {/* Bus node settings */}
        {network && (
          <div className="rounded-md border p-3 space-y-3 bg-muted/20">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Bus Node Settings</span>
            <div className="grid grid-cols-2 gap-3">
              {!isCan && (
                <div className="space-y-1">
                  <Label className="text-xs">Role</Label>
                  <Select value={nodeRole || "__none__"} onValueChange={(v) => setNodeRole(v === "__none__" ? "" : v)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {NETWORK_NODE_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">{isCan ? "Node ID" : "Node Address"}</Label>
                <Input
                  inputMode="numeric"
                  value={nodeAddress}
                  onChange={(e) => setNodeAddress(e.target.value)}
                  placeholder="e.g. 1"
                  className="h-8 text-sm tabular-nums"
                />
              </div>
              {isCan && (
                <div className="space-y-1">
                  <Label className="text-xs">CAN ID Offset</Label>
                  <Input
                    inputMode="numeric"
                    value={canIdOffset}
                    onChange={(e) => setCanIdOffset(e.target.value)}
                    placeholder="0"
                    className="h-8 text-sm tabular-nums"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* FR-008: per-instance parameters */}
        <InstanceParameters instanceId={instance.id} componentId={instance.component.id} projectId={projectId} />

        {/* Code gen */}
        <div className="space-y-1">
          <Label className="text-xs">Function Block Override</Label>
          <Input value={fbOverride} onChange={(e) => setFbOverride(e.target.value)} placeholder="Optional" className="h-8 text-sm" />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-8 text-sm" />
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={update.isPending || !name.trim()}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" size="sm" variant="destructive" disabled={del.isPending} onClick={handleDelete}>
            {del.isPending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </form>
      <ConfirmDialog {...confirmProps} confirmLabel="Delete" />
    </div>
  );
}
