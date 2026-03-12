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
import { ETHERNET_PROTOCOL_SET, FIELDBUS_PROTOCOLS, CAN_MODES, SERIAL_PARITY, type BusProtocol } from "@/lib/enums";

export type IoCardInfo = {
  id: number;
  slotPosition: number;
  name: string | null;
  carrierName: string;
  protocols: string[];
};

export type PortInfo = {
  id: number;
  portNumber: number;
  label: string | null;
  ipAddress: string | null;
  plcNetworkId: number | null;
};

export type ExistingNetwork = {
  id: number;
  protocol: string;
  ioCardId: number | null;
  plcPorts: { id: number; portNumber: number }[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  plcId: number;
  ethernetPorts: number;
  catalogProtocols: string[];
  ports: PortInfo[];
  existingNetworks: ExistingNetwork[];
  ioCards: IoCardInfo[];
};

export function AddNetworkDialog({
  open,
  onClose,
  onSaved,
  plcId,
  ethernetPorts,
  catalogProtocols,
  ports,
  existingNetworks,
  ioCards,
}: Props) {
  const [host, setHost] = useState("");
  const [protocol, setProtocol] = useState("");
  const [role, setRole] = useState("MASTER");
  const [nodeAddress, setNodeAddress] = useState("");
  const [description, setDescription] = useState("");
  const [baudRateKbit, setBaudRateKbit] = useState("");
  const [serialParity, setSerialParity] = useState("");
  const [serialStopBits, setSerialStopBits] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [ipPort, setIpPort] = useState("");
  const [canMode, setCanMode] = useState("");
  const [canHeartbeatMs, setCanHeartbeatMs] = useState("");
  const [canSyncPeriodMs, setCanSyncPeriodMs] = useState("");
  const [cyclePeriodMs, setCyclePeriodMs] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const proto = protocol as BusProtocol;
  const isSerial = ["MODBUS_RTU", "PROFIBUS", "DEVICENET"].includes(protocol);
  const isCan = ["CANBUS", "CANOPEN", "J1939"].includes(protocol);
  const isEthernet = protocol ? ETHERNET_PROTOCOL_SET.has(proto) : false;

  const createNetwork = trpc.projectHardware.networkCreate.useMutation();
  const portSave = trpc.projectHardware.plcPortSave.useMutation();

  // Ports already linked to a network
  const usedPortNumbers = new Set(
    ports.filter((p) => p.plcNetworkId != null).map((p) => p.portNumber)
  );

  // CPU fieldbus protocols already in use
  const usedCpuProtocols = new Set(
    existingNetworks
      .filter((n) => n.ioCardId === null && !ETHERNET_PROTOCOL_SET.has(n.protocol as BusProtocol))
      .map((n) => n.protocol)
  );

  // IO cards that already host a network
  const usedCardIds = new Set(
    existingNetworks.filter((n) => n.ioCardId != null).map((n) => n.ioCardId)
  );

  type HostOption =
    | { kind: "port"; portNumber: number; label: string }
    | { kind: "cpu" }
    | { kind: "card"; cardId: number; label: string };

  // Build available protocols (protocol-first)
  const availableProtocols: string[] = [];

  // Ethernet protocols — available when there are free ports
  const freeEthernetCount = ethernetPorts - usedPortNumbers.size;
  if (freeEthernetCount > 0) {
    for (const p of ["MODBUS_TCP", "PROFINET", "ETHERNETIP", "BACNET", "ETHERCAT"]) {
      availableProtocols.push(p);
    }
  }

  // CPU fieldbus protocols
  for (const p of catalogProtocols) {
    if (!usedCpuProtocols.has(p) && !availableProtocols.includes(p)) {
      availableProtocols.push(p);
    }
  }

  // IO card protocols — include protocol if any unused card supports it
  for (const card of ioCards) {
    if (!usedCardIds.has(card.id)) {
      for (const p of card.protocols) {
        if (!availableProtocols.includes(p)) availableProtocols.push(p);
      }
      // Card with providesNetwork but no catalogued protocols: offer all unused fieldbus
      if (card.protocols.length === 0) {
        const usedCardProtocols = new Set(
          existingNetworks.filter((n) => n.ioCardId != null).map((n) => n.protocol)
        );
        for (const p of FIELDBUS_PROTOCOLS) {
          if (!usedCardProtocols.has(p) && !availableProtocols.includes(p)) {
            availableProtocols.push(p);
          }
        }
      }
    }
  }

  // Build host options filtered by selected protocol
  const hostOptions: HostOption[] = [];
  if (protocol) {
    if (ETHERNET_PROTOCOL_SET.has(protocol as BusProtocol)) {
      for (let i = 0; i < ethernetPorts; i++) {
        if (!usedPortNumbers.has(i)) {
          const saved = ports.find((p) => p.portNumber === i);
          const parts = [`Port ${i + 1}`];
          if (saved?.label) parts.push(`(${saved.label})`);
          if (saved?.ipAddress) parts.push(`— ${saved.ipAddress}`);
          hostOptions.push({ kind: "port", portNumber: i, label: parts.join(" ") });
        }
      }
    } else {
      // PLC CPU
      if (catalogProtocols.includes(protocol) && !usedCpuProtocols.has(protocol)) {
        hostOptions.push({ kind: "cpu" });
      }
      // IO cards that support this protocol and aren't already used
      for (const card of ioCards) {
        if (!usedCardIds.has(card.id)) {
          const supports =
            card.protocols.includes(protocol) || card.protocols.length === 0;
          if (supports) {
            const protoLabel = card.protocols.length > 0 ? ` [${card.protocols.join(", ")}]` : "";
            hostOptions.push({
              kind: "card",
              cardId: card.id,
              label: `Slot ${card.slotPosition + 1}${card.name ? ` — ${card.name}` : ""} (${card.carrierName})${protoLabel}`,
            });
          }
        }
      }
    }
  }

  function reset() {
    setHost("");
    setProtocol("");
    setRole("MASTER");
    setNodeAddress("");
    setDescription("");
    setBaudRateKbit("");
    setSerialParity("");
    setSerialStopBits("");
    setIpAddress("");
    setIpPort("");
    setCanMode("");
    setCanHeartbeatMs("");
    setCanSyncPeriodMs("");
    setCyclePeriodMs("");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSave() {
    if (!host) { setError("Select a host."); return; }
    if (!protocol) { setError("Select a protocol."); return; }

    setSaving(true);
    setError(null);
    try {
      let ioCardId: number | null = null;
      let portNumber: number | null = null;

      if (host === "cpu") {
        ioCardId = null;
      } else if (host.startsWith("card:")) {
        ioCardId = Number(host.slice(5));
      } else if (host.startsWith("port:")) {
        portNumber = Number(host.slice(5));
      }

      const net = await createNetwork.mutateAsync({
        plcId,
        ioCardId,
        protocol: protocol as Parameters<typeof createNetwork.mutateAsync>[0]["protocol"],
        role: role as "MASTER" | "SLAVE" | "ADAPTER" | "SCANNER",
        nodeAddress: nodeAddress ? Number(nodeAddress) : null,
        description: description || null,
        baudRateKbit: baudRateKbit ? Number(baudRateKbit) : null,
        serialParity: (serialParity || null) as Parameters<typeof createNetwork.mutateAsync>[0]["serialParity"],
        serialStopBits: serialStopBits ? Number(serialStopBits) : null,
        ipAddress: ipAddress || null,
        ipPort: ipPort ? Number(ipPort) : null,
        canMode: (canMode || null) as Parameters<typeof createNetwork.mutateAsync>[0]["canMode"],
        canHeartbeatMs: canHeartbeatMs ? Number(canHeartbeatMs) : null,
        canSyncPeriodMs: canSyncPeriodMs ? Number(canSyncPeriodMs) : null,
        cyclePeriodMs: cyclePeriodMs ? Number(cyclePeriodMs) : null,
      });

      if (portNumber !== null) {
        await portSave.mutateAsync({
          plcId,
          portNumber,
          plcNetworkId: net.id,
        });
      }

      reset();
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const sel = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Network</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {availableProtocols.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No available hardware found. Ensure the PLC catalog has supported protocols,
              add Ethernet ports, or add IO cards that provide a network.
            </p>
          ) : (
            <>
              {/* Step 1: Protocol */}
              <div className="space-y-1">
                <Label>Protocol <span className="text-destructive">*</span></Label>
                <select
                  className={sel}
                  value={protocol}
                  onChange={(e) => { setProtocol(e.target.value); setHost(""); }}
                >
                  <option value="">— select protocol —</option>
                  {availableProtocols.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Step 2: Host (filtered by protocol) */}
              {protocol && (
                <div className="space-y-1">
                  <Label>
                    {ETHERNET_PROTOCOL_SET.has(protocol as BusProtocol) ? "Network Port" : "Hardware Host"}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  {hostOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No available host for {protocol} — all hardware already in use.
                    </p>
                  ) : (
                    <select className={sel} value={host} onChange={(e) => setHost(e.target.value)}>
                      <option value="">— select host —</option>
                      {hostOptions.map((h) => {
                        if (h.kind === "cpu") return <option key="cpu" value="cpu">PLC CPU</option>;
                        if (h.kind === "port") return <option key={`port:${h.portNumber}`} value={`port:${h.portNumber}`}>{h.label}</option>;
                        return <option key={`card:${h.cardId}`} value={`card:${h.cardId}`}>{h.label}</option>;
                      })}
                    </select>
                  )}
                </div>
              )}

              {/* Step 3: Protocol config */}
              {protocol && host && (
                <>
                  {/* Always: Role, Node Address, Description */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Role</Label>
                      <select className={sel} value={role} onChange={(e) => setRole(e.target.value)}>
                        {["MASTER", "SLAVE", "ADAPTER", "SCANNER"].map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Node Address</Label>
                      <Input type="number" value={nodeAddress} onChange={(e) => setNodeAddress(e.target.value)} placeholder="optional" className="h-9" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Description</Label>
                    <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="optional" />
                  </div>

                  {/* Serial parameters */}
                  {isSerial && (
                    <>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Serial Parameters</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label>Baud Rate (kbit/s)</Label>
                          <Input type="number" value={baudRateKbit} onChange={(e) => setBaudRateKbit(e.target.value)} placeholder="e.g. 115" className="h-9" />
                        </div>
                        <div className="space-y-1">
                          <Label>Parity</Label>
                          <select className={sel} value={serialParity} onChange={(e) => setSerialParity(e.target.value)}>
                            <option value="">— none —</option>
                            {SERIAL_PARITY.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label>Stop Bits</Label>
                          <select className={sel} value={serialStopBits} onChange={(e) => setSerialStopBits(e.target.value)}>
                            <option value="">—</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {/* CAN parameters */}
                  {isCan && (
                    <>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">CAN Parameters</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label>Baud Rate (kbit/s)</Label>
                          <Input type="number" value={baudRateKbit} onChange={(e) => setBaudRateKbit(e.target.value)} placeholder="e.g. 500" className="h-9" />
                        </div>
                        {protocol === "CANBUS" && (
                          <div className="space-y-1">
                            <Label>CAN Mode</Label>
                            <select className={sel} value={canMode} onChange={(e) => setCanMode(e.target.value)}>
                              <option value="">— none —</option>
                              {CAN_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </div>
                        )}
                        <div className="space-y-1">
                          <Label>Heartbeat (ms)</Label>
                          <Input type="number" value={canHeartbeatMs} onChange={(e) => setCanHeartbeatMs(e.target.value)} placeholder="e.g. 1000" className="h-9" />
                        </div>
                        <div className="space-y-1">
                          <Label>Sync Period (ms)</Label>
                          <Input type="number" value={canSyncPeriodMs} onChange={(e) => setCanSyncPeriodMs(e.target.value)} placeholder="e.g. 100" className="h-9" />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Ethernet parameters */}
                  {isEthernet && (
                    <>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Network Parameters</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label>Remote IP Address</Label>
                          <Input value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} placeholder="e.g. 192.168.1.100" className="h-9" />
                        </div>
                        <div className="space-y-1">
                          <Label>TCP Port</Label>
                          <Input type="number" value={ipPort} onChange={(e) => setIpPort(e.target.value)} placeholder="e.g. 502" className="h-9" />
                        </div>
                      </div>
                    </>
                  )}

                  {/* All: cycle period */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Cycle Period (ms)</Label>
                      <Input type="number" value={cyclePeriodMs} onChange={(e) => setCyclePeriodMs(e.target.value)} placeholder="optional" className="h-9" />
                    </div>
                  </div>
                </>
              )}

              {error && (
                <p className="text-sm text-destructive rounded border border-destructive/30 bg-destructive/10 px-3 py-2">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving || availableProtocols.length === 0 || !protocol || !host}
          >
            {saving ? "Adding…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
