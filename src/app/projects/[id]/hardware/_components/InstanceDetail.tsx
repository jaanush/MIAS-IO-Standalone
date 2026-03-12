"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Instance = {
  id: number;
  name: string;
  tag: string | null;
  notes: string | null;
  plcNetworkId: number | null;
  component: {
    id: number;
    name: string;
    manufacturer: string | null;
    model: string | null;
  };
};

type Network = {
  id: number;
  protocol: string;
  nodeAddress: number | null;
  description: string | null;
};

type Props = {
  instance: Instance;
  network: Network | null;
  onDeleted: () => void;
  onRefresh: () => void;
};

export function InstanceDetail({ instance, network, onDeleted, onRefresh }: Props) {
  const [name, setName] = useState(instance.name);
  const [tag, setTag] = useState(instance.tag ?? "");
  const [notes, setNotes] = useState(instance.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const update = trpc.projectHardware.instanceUpdate.useMutation();
  const del = trpc.projectHardware.instanceDelete.useMutation();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await update.mutateAsync({
        id: instance.id,
        name: name.trim(),
        tag: tag.trim() || null,
        notes: notes.trim() || null,
      });
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete instance "${instance.name}"? This will also delete all its signals and cannot be undone.`)) return;
    setDeleting(true);
    try {
      await del.mutateAsync({ id: instance.id });
      onDeleted();
    } finally {
      setDeleting(false);
    }
  }

  const networkLabel = network
    ? [network.protocol, network.nodeAddress != null ? `Node ${network.nodeAddress}` : null, network.description]
        .filter(Boolean).join(" · ")
    : "—";

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
          <p className="text-xs text-muted-foreground mt-0.5">Network: {networkLabel}</p>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Instance name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className="space-y-1.5">
          <Label>Tag <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. P01" />
        </div>

        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>

          <Button
            type="button"
            variant="destructive"
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? "Deleting…" : "Delete instance"}
          </Button>
        </div>
      </form>
    </div>
  );
}
