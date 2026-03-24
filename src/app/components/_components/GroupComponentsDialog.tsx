"use client";

import { useMemo, useState } from "react";
import { Search, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type Step = "select" | "preview" | "confirm";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (parentId: number) => void;
};

export function GroupComponentsDialog({ open, onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>("select");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState("");
  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");

  const { data: components = [] } = trpc.components.componentList.useQuery();
  const utils = trpc.useUtils();

  const selectedIds = useMemo(() => [...selected], [selected]);

  const preview = trpc.components.previewGrouping.useQuery(
    { componentIds: selectedIds },
    { enabled: step === "preview" && selectedIds.length >= 2 }
  );

  const groupMutation = trpc.components.groupComponents.useMutation({
    onSuccess: (data) => {
      utils.components.componentList.invalidate();
      reset();
      onCreated(data.parentId);
    },
  });

  function reset() {
    setStep("select");
    setSelected(new Set());
    setFilter("");
    setName("");
    setManufacturer("");
    setModel("");
    groupMutation.reset();
  }

  function handleClose() {
    reset();
    onClose();
  }

  function toggleComponent(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function goToPreview() {
    setStep("preview");
  }

  function goToConfirm() {
    // Pre-fill manufacturer if all selected share the same
    const selectedComps = components.filter((c) => selected.has(c.id));
    const manufacturers = new Set(selectedComps.map((c) => c.manufacturer).filter(Boolean));
    if (manufacturers.size === 1) setManufacturer([...manufacturers][0]!);
    setStep("confirm");
  }

  function handleCreate() {
    groupMutation.mutate({
      name,
      manufacturer: manufacturer || null,
      model: model || null,
      componentIds: selectedIds,
    });
  }

  const filtered = useMemo(() => {
    if (!filter) return components;
    const q = filter.toLowerCase();
    return components.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.manufacturer ?? "").toLowerCase().includes(q) ||
        (c.model ?? "").toLowerCase().includes(q)
    );
  }, [components, filter]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === "select" && "Group Components"}
            {step === "preview" && "Common Signals"}
            {step === "confirm" && "Create Parent Component"}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Select components */}
        {step === "select" && (
          <div className="flex flex-col gap-3 min-h-0 flex-1">
            <p className="text-sm text-muted-foreground">
              Select 2 or more components to group. Common signals will be extracted into a shared parent.
            </p>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <div className="flex-1 overflow-y-auto border rounded-md divide-y max-h-[300px]">
              {filtered.map((c) => {
                const hasParent = !!(c as any).parent?.id;
                const isSelected = selected.has(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent/50 ${
                      hasParent ? "opacity-40 pointer-events-none" : ""
                    } ${isSelected ? "bg-primary/5" : ""}`}
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-input"
                      checked={isSelected}
                      disabled={hasParent}
                      onChange={() => toggleComponent(c.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[c.manufacturer, c.model].filter(Boolean).join(" / ") || "No manufacturer"}
                        {" \u00B7 "}
                        {(c as any)._count?.signals ?? 0} signals
                      </div>
                    </div>
                    {hasParent && (
                      <span className="text-[10px] text-muted-foreground">Has parent</span>
                    )}
                  </label>
                );
              })}
              {filtered.length === 0 && (
                <p className="text-xs text-muted-foreground px-3 py-4 text-center">No components match.</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{selected.size} selected</p>
          </div>
        )}

        {/* Step 2: Preview common signals */}
        {step === "preview" && (
          <div className="flex flex-col gap-3 min-h-0 flex-1">
            {preview.isLoading && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Analyzing signals...
              </div>
            )}
            {preview.error && (
              <p className="text-sm text-destructive">{preview.error.message}</p>
            )}
            {preview.data && (
              <>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{preview.data.commonSignals.length}</span> common signal{preview.data.commonSignals.length !== 1 ? "s" : ""} found
                  across {preview.data.totalComponents} components. These will be moved to the parent.
                </p>
                {preview.data.commonSignals.length > 0 ? (
                  <div className="flex-1 overflow-y-auto border rounded-md divide-y max-h-[300px]">
                    {preview.data.commonSignals.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                        <Badge variant={s.ioType === "DI" || s.ioType === "DO" ? "secondary" : "outline"} className="font-mono text-[11px]">
                          {s.ioType}
                        </Badge>
                        <span className="font-mono text-sm">{s.tagSuffix || "(no tag)"}</span>
                        {s.origin && (
                          <span className="text-xs text-muted-foreground ml-auto">{s.origin}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    No common signals found. The selected components have no signals with matching tag, type, and origin.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 3: Name and create */}
        {step === "confirm" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Name the parent component that will hold the {preview.data?.commonSignals.length ?? 0} common signals.
            </p>
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium">Name *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Base Pump"
                  className="h-8 text-sm"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium">Manufacturer</label>
                  <Input
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Model</label>
                  <Input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>
            {groupMutation.error && (
              <p className="text-sm text-destructive">{groupMutation.error.message}</p>
            )}
          </div>
        )}

        <DialogFooter className="flex-row gap-2 justify-between sm:justify-between">
          {step !== "select" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(step === "confirm" ? "preview" : "select")}
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            {step === "select" && (
              <Button size="sm" disabled={selected.size < 2} onClick={goToPreview}>
                Next <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
            {step === "preview" && (
              <Button
                size="sm"
                disabled={!preview.data || preview.data.commonSignals.length === 0}
                onClick={goToConfirm}
              >
                Next <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
            {step === "confirm" && (
              <Button
                size="sm"
                disabled={!name.trim() || groupMutation.isPending}
                onClick={handleCreate}
              >
                {groupMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                Create Group
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
