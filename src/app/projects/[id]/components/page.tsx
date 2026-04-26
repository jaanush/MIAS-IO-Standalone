"use client";

import { use, useState } from "react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BUS_PROTOCOLS, type BusProtocol } from "@/lib/enums";
import { ComponentDetail } from "@/app/components/_components/ComponentDetail";
import { TemplateInstancesPanel } from "./_components/TemplateInstancesPanel";

export default function ProjectComponentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const projectId = Number(id);
  const utils = trpc.useUtils();

  const { data: components = [], isLoading } = trpc.components.projectComponentList.useQuery({ projectId });

  const [selected, setSelected] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Build tree: roots and children
  const roots = components.filter((c) => !c.parent?.id);
  const childrenMap = new Map<number, typeof components>();
  for (const c of components) {
    const pid = c.parent?.id;
    if (pid) {
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid)!.push(c);
    }
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left — component list */}
      <div className="w-64 border-r flex flex-col shrink-0">
        <div className="p-3 border-b flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Project Components</h2>
            <p className="text-xs text-muted-foreground">{components.length} component{components.length !== 1 ? "s" : ""}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowCreate(true)} title="New component">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {isLoading && <p className="text-xs text-muted-foreground p-3">Loading...</p>}
          {roots.map((c) => (
            <div key={c.id}>
              <button
                onClick={() => setSelected(c.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md transition-colors",
                  selected === c.id ? "bg-accent font-medium" : "hover:bg-accent/50"
                )}
              >
                <div className="text-sm truncate">
                  {c.name}
                  {c._count.children > 0 && (
                    <span className="ml-1 text-[10px] text-muted-foreground/60">({c._count.children})</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {c.busProtocol && <Badge variant="outline" className="text-[10px] px-1 py-0">{c.busProtocol}</Badge>}
                  <span className="text-[11px] text-muted-foreground">
                    {c._count.instances} instance{c._count.instances !== 1 ? "s" : ""}
                  </span>
                </div>
              </button>
              {childrenMap.has(c.id) && (
                <div className="ml-3 border-l border-border/40 pl-2 space-y-0.5 mt-0.5">
                  {childrenMap.get(c.id)!.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => setSelected(child.id)}
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded-md transition-colors",
                        selected === child.id ? "bg-accent font-medium" : "hover:bg-accent/50"
                      )}
                    >
                      <div className="text-sm truncate">{child.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {child.busProtocol && <Badge variant="outline" className="text-[10px] px-1 py-0">{child.busProtocol}</Badge>}
                        <span className="text-[11px] text-muted-foreground">
                          {child._count.instances} instance{child._count.instances !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {!isLoading && components.length === 0 && (
            <p className="text-xs text-muted-foreground p-3">No project-scoped components. Import from MPV Serial IO or create one.</p>
          )}
        </div>
      </div>

      {/* Right — reuse the global ComponentDetail editor */}
      <div className="flex-1 overflow-auto">
        {selected ? (
          <div>
            <ComponentDetail
              key={selected}
              id={selected}
              onDeleted={() => {
                setSelected(null);
                utils.components.projectComponentList.invalidate({ projectId });
              }}
              onListRefresh={() => utils.components.projectComponentList.invalidate({ projectId })}
            />
            <div className="px-8 pb-8 max-w-5xl">
              <TemplateInstancesPanel componentId={selected} projectId={projectId} />
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a component or create a new one
          </div>
        )}
      </div>

      {showCreate && (
        <CreateComponentDialog
          projectId={projectId}
          onClose={() => setShowCreate(false)}
          onCreated={(newId) => {
            utils.components.projectComponentList.invalidate({ projectId });
            setSelected(newId);
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

function CreateComponentDialog({ projectId, onClose, onCreated }: {
  projectId: number;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [name, setName] = useState("");
  const [busProtocol, setBusProtocol] = useState("");
  const [description, setDescription] = useState("");

  const create = trpc.components.componentCreate.useMutation({
    onSuccess: (data) => onCreated(data.id),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Project Component</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Boiler Controller" autoFocus />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bus Protocol</Label>
            <Select value={busProtocol || "none"} onValueChange={(v) => setBusProtocol(v === "none" ? "" : v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {BUS_PROTOCOLS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </div>
          {create.error && (
            <p className="text-xs text-destructive">{create.error.message}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => create.mutate({ projectId, name, busProtocol: (busProtocol || null) as BusProtocol | null, description: description || null })}
              disabled={!name.trim() || create.isPending}
            >
              {create.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
