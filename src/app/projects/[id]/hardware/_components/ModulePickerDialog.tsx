"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { wagoDatasheetUrl } from "@/lib/utils";

type Props = {
  projectId: number;
  carrierId: number;
  slotPosition: number;
  subgroup?: string | null;
  open: boolean;
  onClose: () => void;
  onAssigned: () => void;
};

export function ModulePickerDialog({ projectId, carrierId, slotPosition, subgroup, open, onClose, onAssigned }: Props) {
  const [search, setSearch] = useState("");
  const { data: modules = [], isLoading } = trpc.projectHardware.modulesForProject.useQuery(
    { projectId },
    { enabled: open }
  );

  const assign = trpc.projectHardware.cardAssign.useMutation({
    onSuccess: () => {
      onAssigned();
      onClose();
    },
  });

  const filtered = modules.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.articleNumber.toLowerCase().includes(q) ||
      m.vendorName.toLowerCase().includes(q) ||
      (m.description ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign Module — Slot {slotPosition + 1}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Search article number, vendor, description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {modules.length === 0
                ? "No modules match this project's approval requirements."
                : "No modules match your search."}
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y rounded-md border">
              {filtered.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors"
                  onClick={() => assign.mutate({ carrierId, slotPosition, catalogId: m.id, subgroup: subgroup ?? undefined })}
                  disabled={assign.isPending}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{m.articleNumber}</span>
                      <Badge variant="outline" className="text-xs">{m.cardType}</Badge>
                      {wagoDatasheetUrl(m.articleNumber) && (
                        <a
                          href={wagoDatasheetUrl(m.articleNumber)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Open datasheet"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{m.vendorName}</p>
                    {m.description && (
                      <p className="text-xs text-muted-foreground truncate">{m.description}</p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground text-right shrink-0">
                    {m.maxInputChannels != null && <div>In: {m.maxInputChannels}</div>}
                    {m.maxOutputChannels != null && <div>Out: {m.maxOutputChannels}</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
