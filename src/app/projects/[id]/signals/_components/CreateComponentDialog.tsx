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

interface Props {
  open: boolean;
  projectId: number;
  signalIds: number[];
  onCreated: (componentId: number, instanceId: number) => void;
  onCancel: () => void;
}

export function CreateComponentDialog({ open, projectId, signalIds, onCreated, onCancel }: Props) {
  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [version, setVersion] = useState("");
  const [description, setDescription] = useState("");

  const create = trpc.components.createFromSignals.useMutation({
    onSuccess: (data) => {
      onCreated(data.componentId, data.instanceId);
      setName("");
      setManufacturer("");
      setModel("");
      setVersion("");
      setDescription("");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate({
      projectId,
      name: name.trim(),
      manufacturer: manufacturer.trim() || null,
      model: model.trim() || null,
      version: version.trim() || null,
      description: description.trim() || null,
      signalIds,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create component from {signalIds.length} signal{signalIds.length !== 1 ? "s" : ""}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="cc-name">Name <span className="text-destructive">*</span></Label>
            <Input
              id="cc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Propulsion Motor"
              required
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cc-mfr">Manufacturer</Label>
              <Input id="cc-mfr" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} placeholder="optional" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cc-model">Model</Label>
              <Input id="cc-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="optional" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="cc-ver">Version</Label>
            <Input id="cc-ver" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="optional" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cc-desc">Description</Label>
            <Input id="cc-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="optional" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={create.isPending}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {create.isPending ? "Creating…" : "Create component"}
            </Button>
          </DialogFooter>
          {create.error && (
            <p className="text-xs text-destructive">{create.error.message}</p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
