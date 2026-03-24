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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Protocol → SignalOrigin compatibility: names match, so direct compare
function isCompatible(componentOrigins: string[], networkProtocol: string) {
  return componentOrigins.some((o) => o === networkProtocol);
}

type Network = {
  id: number;
  protocol: string;
  role: string;
  nodeAddress: number | null;
  description: string | null;
};

type Props = {
  open: boolean;
  projectId: number;
  /** Pre-selected network (when user clicked "+ Add instance" on a specific network) */
  preselectedNetworkId: number | null;
  networks: Network[];
  onClose: () => void;
  onCreated: () => void;
};

export function AddComponentInstanceDialog({
  open,
  projectId,
  preselectedNetworkId,
  networks,
  onClose,
  onCreated,
}: Props) {
  const [networkId, setNetworkId] = useState<string>(
    preselectedNetworkId != null ? String(preselectedNetworkId) : ""
  );
  const [componentId, setComponentId] = useState<string>("");
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedNetwork = networks.find((n) => n.id === Number(networkId));

  const { data: components = [] } = trpc.projectHardware.componentsForNetwork.useQuery(
    { protocol: selectedNetwork?.protocol ?? "", projectId },
    { enabled: !!selectedNetwork }
  );

  // Filter to compatible ones
  const compatible = components.filter((c) => {
    const origins = c.signals.map((s) => s.origin as string).filter(Boolean);
    if (!selectedNetwork) return true;
    return isCompatible(origins, selectedNetwork.protocol);
  });

  const create = trpc.projectHardware.instanceCreate.useMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!networkId || !componentId || !name.trim()) return;
    setSaving(true);
    try {
      await create.mutateAsync({
        projectId,
        componentId: Number(componentId),
        busId: Number(networkId),
        name: name.trim(),
        tag: tag.trim() || null,
      });
      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) onClose();
  }

  const networkLabel = (n: Network) => {
    let label = n.protocol;
    if (n.nodeAddress != null) label += ` (Node ${n.nodeAddress})`;
    if (n.description) label += ` — ${n.description}`;
    return label;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Component Instance</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Network</Label>
            <Select value={networkId} onValueChange={(v) => { setNetworkId(v); setComponentId(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select network…" />
              </SelectTrigger>
              <SelectContent>
                {networks.map((n) => (
                  <SelectItem key={n.id} value={String(n.id)}>
                    {networkLabel(n)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Component</Label>
            <Select
              value={componentId}
              onValueChange={setComponentId}
              disabled={!selectedNetwork}
            >
              <SelectTrigger>
                <SelectValue placeholder={selectedNetwork ? "Select component…" : "Select network first"} />
              </SelectTrigger>
              <SelectContent>
                {compatible.length === 0 && selectedNetwork && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    No compatible components for {selectedNetwork.protocol}
                  </div>
                )}
                {compatible.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    <span>{c.name}</span>
                    {(c.manufacturer || c.model) && (
                      <span className="text-xs text-muted-foreground ml-1">
                        {[c.manufacturer, c.model].filter(Boolean).join(" ")}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Instance name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pump 01"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tag <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="e.g. P01"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              disabled={!networkId || !componentId || !name.trim() || saving}
            >
              {saving ? "Adding…" : "Add instance"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
