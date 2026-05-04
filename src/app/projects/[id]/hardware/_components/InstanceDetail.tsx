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
  const [commPartId, setCommPartId] = useState((instance as any).commissioningPartId ?? "");
  const [commVariant, setCommVariant] = useState((instance as any).commissioningVariant ?? "");

  useEffect(() => {
    setName(instance.name);
    setTag(instance.tag ?? "");
    setNotes(instance.notes ?? "");
    setNodeRole(instance.nodeRole ?? "");
    setNodeAddress(instance.nodeAddress != null ? String(instance.nodeAddress) : "");
    setCanIdOffset(instance.canIdOffset != null ? String(instance.canIdOffset) : "");
    setFbOverride(instance.functionBlockOverride ?? "");
    setCommPartId((instance as any).commissioningPartId ?? "");
    setCommVariant((instance as any).commissioningVariant ?? "");
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
      commissioningPartId: commPartId.trim() || null,
      commissioningVariant: commVariant.trim() || null,
    });
  }

  // FR-023: known variant sets per partId — derived from MIAS-ref's
  // databases/<vendor>/parts.json `specs.can_commissioning.variants` keys.
  // Currently only Editron's set is wired client-side; future vendors land
  // here as projects encounter them.
  const VARIANT_OPTIONS_BY_PART: Record<string, string[]> = {
    "danfoss-editron:ec-c1200-450": ["mc", "dcdc", "afe", "ug", "bc", "switch_control"],
  };
  const variantOptions = VARIANT_OPTIONS_BY_PART[commPartId] ?? null;

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

        {/* FR-023: device commissioning metadata. Plugin uses partId+variant
            to consume the right MIAS-ref `parts.json` recipe per device. */}
        {isCan && (
          <div className="rounded-md border p-3 space-y-3 bg-muted/20">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Device Commissioning</span>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Part ID</Label>
                <Input
                  value={commPartId}
                  onChange={(e) => setCommPartId(e.target.value)}
                  placeholder="e.g. danfoss-editron:ec-c1200-450"
                  className="h-8 text-sm font-mono"
                />
                <p className="text-[10px] text-muted-foreground">Pointer into MIAS-ref hardware DB. Plugin reads recipe from <code className="font-mono">parts.json[partId].specs.can_commissioning.variants[variant]</code>.</p>
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Firmware Variant</Label>
                {variantOptions ? (
                  <Select
                    key={"cv-" + commVariant}
                    value={commVariant || "__none__"}
                    onValueChange={(v) => setCommVariant(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {variantOptions.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={commVariant}
                    onChange={(e) => setCommVariant(e.target.value)}
                    placeholder="e.g. afe (vendor-specific)"
                    className="h-8 text-sm"
                  />
                )}
                <p className="text-[10px] text-muted-foreground">Which firmware variant is loaded — plugin selects the matching <code className="font-mono">minimum_sequence</code>.</p>
              </div>
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
