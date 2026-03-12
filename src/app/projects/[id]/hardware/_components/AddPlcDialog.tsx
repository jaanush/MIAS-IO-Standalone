"use client";

import { useState, useRef } from "react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  projectId: number;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export function AddPlcDialog({ projectId, open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedCatalogId, setSelectedCatalogId] = useState<number | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: plcCatalog = [] } = trpc.hardware.plcCatalogList.useQuery(undefined, { enabled: open });

  const create = trpc.projectHardware.plcCreate.useMutation({
    onSuccess: () => {
      onCreated();
      onClose();
      setName("");
      setCatalogSearch("");
      setSelectedCatalogId(null);
      setDropdownOpen(false);
    },
  });

  const filtered = plcCatalog.filter((p) => {
    const q = catalogSearch.toLowerCase();
    return (
      p.articleNumber.toLowerCase().includes(q) ||
      (p.description ?? "").toLowerCase().includes(q)
    );
  });

  const selectedCatalog = plcCatalog.find((p) => p.id === selectedCatalogId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add PLC</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Name / Tag</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. PLC-01"
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label>Catalog Model</Label>
            <Input
              ref={searchRef}
              value={catalogSearch}
              onChange={(e) => {
                setCatalogSearch(e.target.value);
                setSelectedCatalogId(null);
                setDropdownOpen(true);
              }}
              onFocus={() => setDropdownOpen(true)}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
              placeholder="Search article number or description…"
            />
            {dropdownOpen && !selectedCatalogId && (
              <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                {filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3">No matches.</p>
                ) : (
                  filtered.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent/50"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSelectedCatalogId(p.id);
                        setCatalogSearch(`${p.articleNumber} — ${p.description ?? p.vendorName}`);
                        setDropdownOpen(false);
                        if (!name) setName(p.articleNumber);
                      }}
                    >
                      <span className="font-mono">{p.articleNumber}</span>
                      {p.description && (
                        <span className="block text-xs text-muted-foreground truncate">{p.description}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
            {selectedCatalog && (
              <p className="text-xs text-muted-foreground">
                Max modules: {selectedCatalog.maxModules ?? "—"} · Bus power: {selectedCatalog.busPowerBudgetMa ?? "—"} mA
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              disabled={!name || !selectedCatalogId || create.isPending}
              onClick={() =>
                create.mutate({
                  projectId,
                  catalogId: selectedCatalogId!,
                  name,
                })
              }
            >
              {create.isPending ? "Adding…" : "Add PLC"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
