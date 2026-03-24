"use client";

import { useState, useRef, useEffect } from "react";
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
import type { Bus } from "@/lib/types/hardware";

type Props = {
  projectId: number;
  plcId: number;
  networks: (Bus & { plcName?: string })[];
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** When true: network selection is required and couplers are filtered by protocol */
  busCouplerMode?: boolean;
};

export function AddCarrierDialog({
  projectId,
  plcId,
  networks,
  open,
  onClose,
  onCreated,
  busCouplerMode = false,
}: Props) {
  const [name, setName] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedCatalogId, setSelectedCatalogId] = useState<number | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [networkId, setNetworkId] = useState<number | null>(null);
  const [ipAddress, setIpAddress] = useState("");
  const [nodeAddress, setNodeAddress] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: couplers = [] } = trpc.projectHardware.couplersForProject.useQuery(
    { projectId },
    { enabled: open }
  );

  const create = trpc.projectHardware.carrierCreate.useMutation({
    onSuccess: () => {
      onCreated();
      onClose();
      setName("");
      setCatalogSearch("");
      setSelectedCatalogId(null);
      setNetworkId(null);
      setIpAddress("");
      setNodeAddress("");
    },
  });

  // When a network is selected, filter couplers to those supporting that protocol.
  // In bus coupler mode with no network selected, show couplers matching any of the PLC's protocols.
  const selectedNetwork = networks.find((n) => n.id === networkId);
  const plcProtocols = new Set(networks.map((n) => n.protocol));

  const eligibleCouplers = couplers.filter((c) => {
    if (!busCouplerMode) return true;
    const supported = new Set(c.protocols.map((p) => p.protocol as string));
    if (selectedNetwork) return supported.has(selectedNetwork.protocol);
    // No network selected yet — show couplers supporting any of the PLC's protocols
    return [...plcProtocols].some((p) => supported.has(p));
  });

  const filtered = eligibleCouplers.filter((c) => {
    const q = catalogSearch.toLowerCase();
    return (
      c.articleNumber.toLowerCase().includes(q) ||
      (c.description ?? "").toLowerCase().includes(q)
    );
  });

  const selectedCatalog = couplers.find((c) => c.id === selectedCatalogId);

  // Reset coupler selection if it no longer fits after network change
  useEffect(() => {
    if (selectedCatalogId && busCouplerMode && selectedNetwork) {
      const still = eligibleCouplers.find((c) => c.id === selectedCatalogId);
      if (!still) {
        setSelectedCatalogId(null);
        setCatalogSearch("");
      }
    }
  }, [networkId]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit =
    !!name &&
    !!selectedCatalogId &&
    (!busCouplerMode || !!networkId) &&
    !create.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{busCouplerMode ? "Add Bus Coupler" : "Add Carrier"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Name / Tag</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={busCouplerMode ? "e.g. Coupler-01" : "e.g. Carrier-01"}
              autoFocus
            />
          </div>

          {/* Network selection — required in bus coupler mode */}
          {(networks.length > 0) && (
            <div className="space-y-1">
              <Label>
                Network{busCouplerMode && <span className="text-destructive"> *</span>}
              </Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={networkId ?? ""}
                onChange={(e) => {
                  setNetworkId(e.target.value ? Number(e.target.value) : null);
                  // Clear coupler when network changes in bus mode
                  if (busCouplerMode) {
                    setSelectedCatalogId(null);
                    setCatalogSearch("");
                  }
                }}
              >
                {!busCouplerMode && <option value="">— Local (no network) —</option>}
                {busCouplerMode && <option value="">— select network —</option>}
                {networks.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.plcName ? `${n.plcName} — ` : ""}{n.protocol} / {n.role}
                    {n.nodeAddress != null ? ` (Node ${n.nodeAddress})` : ""}
                    {n.description ? ` — ${n.description}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <Label>Coupler Model</Label>
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
                {eligibleCouplers.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3">
                    {busCouplerMode
                      ? "No couplers support the selected network protocol."
                      : "No couplers match this project's approval requirements."}
                  </p>
                ) : filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3">No matches.</p>
                ) : (
                  filtered.map((c) => {
                    const supportedProtocols = c.protocols.map((p) => p.protocol).join(", ");
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent/50"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSelectedCatalogId(c.id);
                          setCatalogSearch(`${c.articleNumber} — ${c.description ?? ""}`);
                          setDropdownOpen(false);
                          if (!name) setName(c.articleNumber);
                        }}
                      >
                        <span className="font-mono">{c.articleNumber}</span>
                        {c.maxModules != null && (
                          <span className="text-muted-foreground ml-2 text-xs">({c.maxModules} slots)</span>
                        )}
                        {supportedProtocols && (
                          <span className="text-muted-foreground ml-2 text-xs">[{supportedProtocols}]</span>
                        )}
                        {c.description && (
                          <span className="block text-xs text-muted-foreground truncate">{c.description}</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
            {selectedCatalog && (
              <p className="text-xs text-muted-foreground">
                Max modules: {selectedCatalog.maxModules ?? "—"}
                {selectedCatalog.protocols.length > 0 && (
                  <> · Protocols: {selectedCatalog.protocols.map((p) => p.protocol).join(", ")}</>
                )}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>IP Address</Label>
              <Input
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                placeholder="192.168.1.20"
              />
            </div>
            <div className="space-y-1">
              <Label>Node Address</Label>
              <Input
                type="number"
                value={nodeAddress}
                onChange={(e) => setNodeAddress(e.target.value)}
                placeholder="1"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              disabled={!canSubmit}
              onClick={() =>
                create.mutate({
                  plcId,
                  catalogId: selectedCatalogId,
                  busId: networkId,
                  name,
                  ipAddress: ipAddress || null,
                  nodeAddress: nodeAddress ? Number(nodeAddress) : null,
                })
              }
            >
              {create.isPending ? "Adding…" : busCouplerMode ? "Add Bus Coupler" : "Add Carrier"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
