"use client";

/**
 * Lists ComponentInstances of a given template scoped to a project, with each
 * instance's parameter editor inline. Used on /projects/[id]/components so
 * non-bus instances (like Tank Sensors) are reachable somewhere — they
 * don't appear in the hardware tree.
 */

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { InstanceParameters } from "../../hardware/_components/InstanceParameters";

type Props = {
  componentId: number;
  projectId: number;
};

export function TemplateInstancesPanel({ componentId, projectId }: Props) {
  const { data: instances = [] } = trpc.components.instancesForComponent.useQuery({ componentId, projectId });
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  if (instances.length === 0) return null;

  return (
    <div className="border-t pt-4 mt-6 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Instances on this project ({instances.length})
        </h3>
      </div>
      <div className="space-y-2">
        {instances.map((inst) => {
          const open = expanded.has(inst.id);
          return (
            <div key={inst.id} className="rounded-md border">
              <button
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent/40 transition-colors"
                onClick={() => {
                  const next = new Set(expanded);
                  if (open) next.delete(inst.id);
                  else next.add(inst.id);
                  setExpanded(next);
                }}
              >
                <div className="flex items-center gap-2 text-sm">
                  {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  <span className="font-medium">{inst.name}</span>
                  {inst.tag && <code className="text-xs text-muted-foreground">{inst.tag}</code>}
                  {inst.bus && <Badge variant="outline" className="text-[10px]">{inst.bus.protocol}{inst.bus.description ? ` · ${inst.bus.description}` : ""}</Badge>}
                  {!inst.busId && <Badge variant="outline" className="text-[10px] text-muted-foreground">no network</Badge>}
                  {inst.nodeAddress != null && <span className="text-[10px] text-muted-foreground">node {inst.nodeAddress}</span>}
                </div>
              </button>
              {open && (
                <div className="px-3 pb-3 pt-1">
                  <InstanceParameters instanceId={inst.id} componentId={componentId} projectId={projectId} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
