"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, ExternalLink } from "lucide-react";
import { AddNetworkDialog } from "./AddNetworkDialog";
import { SlotGrid } from "./SlotGrid";
import type { IoCardInfo } from "./AddNetworkDialog";
import { CAN_MODES, SERIAL_PARITY, ETHERNET_PROTOCOL_SET, type BusProtocol } from "@/lib/enums";
import { wagoDatasheetUrl } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1, "Required"),
  notes: z.string().optional().nullable(),
});
type FormValues = z.infer<typeof schema>;

type NetworkPort = { id: number; portNumber: number; label: string | null };

type Network = {
  id: number;
  protocol: string;
  role: string;
  nodeAddress: number | null;
  description: string | null;
  ioCardId: number | null;
  ioCard: { id: number; name: string | null; slotPosition: number } | null;
  plcPorts: NetworkPort[];
  carriers: LocalCarrier[];
  // protocol-specific params
  baudRateKbit: number | null;
  baudRateBps: number | null;
  serialParity: string | null;
  serialStopBits: number | null;
  ipAddress: string | null;
  ipPort: number | null;
  canMode: string | null;
  canHeartbeatMs: number | null;
  canSyncPeriodMs: number | null;
  cyclePeriodMs: number | null;
};

type Port = {
  id: number;
  portNumber: number;
  label: string | null;
  ipAddress: string | null;
  plcNetworkId: number | null;
};

type IoCard = {
  id: number;
  slotPosition: number;
  cardType: string;
  name: string | null;
  deletedAt: Date | null;
  catalog: {
    id: number;
    articleNumber: string;
    vendorName: string;
    cardType: string;
    maxInputChannels: number | null;
    maxOutputChannels: number | null;
    providesNetwork: boolean;
    protocols: { protocol: string }[];
    approvals: { approvalId: number }[];
  } | null;
};

type LocalCarrier = {
  id: number;
  name: string;
  deletedAt: Date | null;
  catalog: { id: number; articleNumber: string; vendorName: string; maxModules: number | null } | null;
  cards: IoCard[];
};

type Plc = {
  id: number;
  name: string;
  ipAddress?: string | null;
  notes?: string | null;
  deletedAt: Date | null;
  catalog: {
    id: number;
    articleNumber: string;
    vendorName: string;
    maxModules: number | null;
    busPowerBudgetMa: number | null;
    ethernetPorts: number | null;
    protocols: { protocol: string }[];
  } | null;
  networks: Network[];
  carriers: LocalCarrier[];
  ports: Port[];
};

type Props = {
  plc: Plc;
  projectId: number;
  onRefresh: () => void;
};

export function PlcDetail({ plc, projectId, onRefresh }: Props) {
  const update = trpc.projectHardware.plcUpdate.useMutation({ onSuccess: onRefresh });
  const deletePlc = trpc.projectHardware.plcDelete.useMutation({ onSuccess: onRefresh });
  const deleteNetwork = trpc.projectHardware.networkDelete.useMutation({ onSuccess: onRefresh });
  const [addNetworkOpen, setAddNetworkOpen] = useState(false);

  // Flatten all IoCards from carriers + networked carriers for AddNetworkDialog
  const allIoCards: IoCardInfo[] = [];
  for (const carrier of plc.carriers) {
    for (const card of carrier.cards) {
      if (card.catalog?.providesNetwork) {
        allIoCards.push({
          id: card.id,
          slotPosition: card.slotPosition,
          name: card.name,
          carrierName: carrier.name,
          protocols: card.catalog.protocols.map((p) => p.protocol),
        });
      }
    }
  }
  for (const net of plc.networks) {
    for (const carrier of net.carriers) {
      for (const card of carrier.cards) {
        if (card.catalog?.providesNetwork) {
          allIoCards.push({
            id: card.id,
            slotPosition: card.slotPosition,
            name: card.name,
            carrierName: carrier.name,
            protocols: card.catalog.protocols.map((p) => p.protocol),
          });
        }
      }
    }
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: plc.name, notes: plc.notes ?? "" },
  });

  useEffect(() => {
    reset({ name: plc.name, notes: plc.notes ?? "" });
  }, [plc, reset]);

  const localCarriers = plc.carriers;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{plc.name}</h2>
          {plc.catalog && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              {plc.catalog.vendorName} — {plc.catalog.articleNumber}
              {wagoDatasheetUrl(plc.catalog.articleNumber) && (
                <a
                  href={wagoDatasheetUrl(plc.catalog.articleNumber)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Open datasheet"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            if (confirm("Delete this PLC? This cannot be undone.")) deletePlc.mutate({ id: plc.id });
          }}
        >
          <Trash2 className="h-4 w-4 mr-1" /> Delete
        </Button>
      </div>

      {/* Catalog info */}
      {plc.catalog && (
        <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm flex gap-6">
          {plc.catalog.maxModules != null && (
            <span className="text-muted-foreground">
              Max modules: <strong>{plc.catalog.maxModules}</strong>
            </span>
          )}
          {plc.catalog.busPowerBudgetMa != null && (
            <span className="text-muted-foreground">
              Bus power: <strong>{plc.catalog.busPowerBudgetMa} mA</strong>
            </span>
          )}
          {plc.catalog.ethernetPorts != null && (
            <span className="text-muted-foreground">
              Ethernet ports: <strong>{plc.catalog.ethernetPorts}</strong>
            </span>
          )}
        </div>
      )}

      {/* Edit form */}
      <form onSubmit={handleSubmit((v) => update.mutate({ id: plc.id, ...v }))} className="space-y-4">
        <div className="space-y-1">
          <Label>Name</Label>
          <Input {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Notes</Label>
          <Input {...register("notes")} />
        </div>
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={!isDirty || update.isPending}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>

      {/* Ethernet Ports */}
      {plc.catalog?.ethernetPorts != null && plc.catalog.ethernetPorts > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Ethernet Ports
          </h3>
          <div className="space-y-2">
            {Array.from({ length: plc.catalog.ethernetPorts }, (_, i) => {
              const port = plc.ports.find((p) => p.portNumber === i);
              const linked = port?.plcNetworkId
                ? (plc.networks.find((n) => n.id === port.plcNetworkId) ?? null)
                : null;
              return (
                <PortRow
                  key={i}
                  portNumber={i}
                  port={port ?? null}
                  plcId={plc.id}
                  onRefresh={onRefresh}
                  linkedNetwork={linked}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Networks */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Networks
          </h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAddNetworkOpen(true)}
            disabled={false}
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
        {plc.networks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No networks configured.</p>
        ) : (
          <div className="space-y-2">
            {plc.networks.map((net) => (
              <NetworkRow
                key={net.id}
                network={net}
                onDelete={() => {
                  if (confirm("Delete this network? Carriers assigned to it will lose their network assignment.")) {
                    deleteNetwork.mutate({ id: net.id });
                  }
                }}
                onSaved={onRefresh}
              />
            ))}
          </div>
        )}
      </div>

      <AddNetworkDialog
        open={addNetworkOpen}
        onClose={() => setAddNetworkOpen(false)}
        onSaved={onRefresh}
        plcId={plc.id}
        ethernetPorts={plc.catalog?.ethernetPorts ?? 0}
        catalogProtocols={(plc.catalog?.protocols ?? []).map((p) => p.protocol)}
        ports={plc.ports}
        existingNetworks={plc.networks.map((n) => ({
          id: n.id,
          protocol: n.protocol,
          ioCardId: n.ioCardId,
          plcPorts: n.plcPorts,
        }))}
        ioCards={allIoCards}
      />

      {/* Local I/O Modules */}
      <div id="local-io" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Local I/O Modules
          </h3>
        </div>

        {localCarriers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No local carriers configured.</p>
        ) : (
          localCarriers.map((carrier) => (
            <div key={carrier.id} className="rounded-md border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{carrier.name}</span>
                {carrier.catalog && (
                  <span className="text-xs text-muted-foreground">{carrier.catalog.articleNumber}</span>
                )}
              </div>
              <SlotGrid
                carrierId={carrier.id}
                projectId={projectId}
                maxSlots={carrier.catalog?.maxModules ?? plc.catalog?.maxModules ?? null}
                cards={carrier.cards}
                onRefresh={onRefresh}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PortRow({
  portNumber,
  port,
  plcId,
  onRefresh,
  linkedNetwork,
}: {
  portNumber: number;
  port: Port | null;
  plcId: number;
  onRefresh: () => void;
  linkedNetwork: Network | null;
}) {
  const save = trpc.projectHardware.plcPortSave.useMutation({ onSuccess: onRefresh });
  const [ip, setIp] = useState(port?.ipAddress ?? "");
  const [label, setLabel] = useState(port?.label ?? "");

  useEffect(() => {
    setIp(port?.ipAddress ?? "");
    setLabel(port?.label ?? "");
  }, [port]);

  const isDirty = ip !== (port?.ipAddress ?? "") || label !== (port?.label ?? "");

  return (
    <div className="rounded-md border px-3 py-2">
      <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Port {portNumber + 1}</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label"
            className="h-8 text-sm w-24"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">IP Address</Label>
          <div className="flex items-center gap-2">
            <Input
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="192.168.1.10"
              className="h-8 text-sm"
            />
            {linkedNetwork && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                → {linkedNetwork.protocol}
                {linkedNetwork.description ? ` (${linkedNetwork.description})` : ""}
              </span>
            )}
          </div>
        </div>
        <Button
          size="sm"
          className="h-8"
          disabled={!isDirty || save.isPending}
          onClick={() =>
            save.mutate({
              plcId,
              portNumber,
              label: label || null,
              ipAddress: ip || null,
              plcNetworkId: port?.plcNetworkId ?? null,
            })
          }
        >
          {save.isPending ? "…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function NetworkRow({
  network,
  onDelete,
  onSaved,
}: {
  network: Network;
  onDelete: () => void;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const update = trpc.projectHardware.networkUpdate.useMutation({
    onSuccess: () => { setEditing(false); onSaved(); },
  });

  const [role, setRole] = useState(network.role);
  const [nodeAddress, setNodeAddress] = useState(String(network.nodeAddress ?? ""));
  const [description, setDescription] = useState(network.description ?? "");
  const [baudRateKbit, setBaudRateKbit] = useState(String(network.baudRateKbit ?? ""));
  const [serialParity, setSerialParity] = useState(network.serialParity ?? "");
  const [serialStopBits, setSerialStopBits] = useState(String(network.serialStopBits ?? ""));
  const [ipAddress, setIpAddress] = useState(network.ipAddress ?? "");
  const [ipPort, setIpPort] = useState(String(network.ipPort ?? ""));
  const [canMode, setCanMode] = useState(network.canMode ?? "");
  const [canHeartbeatMs, setCanHeartbeatMs] = useState(String(network.canHeartbeatMs ?? ""));
  const [canSyncPeriodMs, setCanSyncPeriodMs] = useState(String(network.canSyncPeriodMs ?? ""));
  const [cyclePeriodMs, setCyclePeriodMs] = useState(String(network.cyclePeriodMs ?? ""));

  const proto = network.protocol as BusProtocol;
  const isSerial = ["MODBUS_RTU", "PROFIBUS", "DEVICENET"].includes(proto);
  const isCan = ["CANBUS", "CANOPEN", "J1939"].includes(proto);
  const isEthernet = ETHERNET_PROTOCOL_SET.has(proto);

  const hostedBy = network.ioCard
    ? `Slot ${network.ioCard.slotPosition + 1}${network.ioCard.name ? ` — ${network.ioCard.name}` : ""}`
    : "PLC CPU";

  const sel = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm";

  return (
    <div className="rounded-md border px-3 py-2 space-y-2">
      {editing ? (
        <div className="space-y-2">
          {/* Protocol + host fixed at creation */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground pb-1">
            <Badge variant="outline" className="text-xs">{network.protocol}</Badge>
            <span>via {hostedBy}</span>
            {network.plcPorts.length > 0 && (
              <span>· Port {network.plcPorts.map((p) => p.portNumber + 1).join(", ")}</span>
            )}
          </div>

          {/* Always: Role, Node Address, Description */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Role</Label>
              <select className={sel} value={role} onChange={(e) => setRole(e.target.value)}>
                {["MASTER", "SLAVE", "ADAPTER", "SCANNER"].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Node Address</Label>
              <Input type="number" value={nodeAddress} onChange={(e) => setNodeAddress(e.target.value)} className="h-8 text-sm" placeholder="optional" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-8 text-sm" placeholder="optional" />
            </div>
          </div>

          {/* Serial: baud rate, parity, stop bits */}
          {isSerial && (
            <>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Serial Parameters</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Baud Rate (kbit/s)</Label>
                  <Input type="number" value={baudRateKbit} onChange={(e) => setBaudRateKbit(e.target.value)} className="h-8 text-sm" placeholder="e.g. 115" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Parity</Label>
                  <select className={sel} value={serialParity} onChange={(e) => setSerialParity(e.target.value)}>
                    <option value="">— none —</option>
                    {SERIAL_PARITY.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Stop Bits</Label>
                  <select className={sel} value={serialStopBits} onChange={(e) => setSerialStopBits(e.target.value)}>
                    <option value="">—</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* CAN: baud rate, mode, heartbeat, sync */}
          {isCan && (
            <>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">CAN Parameters</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Baud Rate (kbit/s)</Label>
                  <Input type="number" value={baudRateKbit} onChange={(e) => setBaudRateKbit(e.target.value)} className="h-8 text-sm" placeholder="e.g. 500" />
                </div>
                {proto === "CANBUS" && (
                  <div className="space-y-1">
                    <Label className="text-xs">CAN Mode</Label>
                    <select className={sel} value={canMode} onChange={(e) => setCanMode(e.target.value)}>
                      <option value="">— none —</option>
                      {CAN_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Heartbeat (ms)</Label>
                  <Input type="number" value={canHeartbeatMs} onChange={(e) => setCanHeartbeatMs(e.target.value)} className="h-8 text-sm" placeholder="e.g. 1000" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Sync Period (ms)</Label>
                  <Input type="number" value={canSyncPeriodMs} onChange={(e) => setCanSyncPeriodMs(e.target.value)} className="h-8 text-sm" placeholder="e.g. 100" />
                </div>
              </div>
            </>
          )}

          {/* Ethernet: IP address, TCP port */}
          {isEthernet && (
            <>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Network Parameters</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">IP Address</Label>
                  <Input value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} className="h-8 text-sm" placeholder="e.g. 192.168.1.100" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">TCP Port</Label>
                  <Input type="number" value={ipPort} onChange={(e) => setIpPort(e.target.value)} className="h-8 text-sm" placeholder="e.g. 502" />
                </div>
              </div>
            </>
          )}

          {/* All: cycle period */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Cycle Period (ms)</Label>
              <Input type="number" value={cyclePeriodMs} onChange={(e) => setCyclePeriodMs(e.target.value)} className="h-8 text-sm" placeholder="optional" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button
              size="sm"
              disabled={update.isPending}
              onClick={() =>
                update.mutate({
                  id: network.id,
                  role: role as Parameters<typeof update.mutate>[0]["role"],
                  nodeAddress: nodeAddress ? Number(nodeAddress) : null,
                  description: description || null,
                  baudRateKbit: baudRateKbit ? Number(baudRateKbit) : null,
                  serialParity: (serialParity || null) as Parameters<typeof update.mutate>[0]["serialParity"],
                  serialStopBits: serialStopBits ? Number(serialStopBits) : null,
                  ipAddress: ipAddress || null,
                  ipPort: ipPort ? Number(ipPort) : null,
                  canMode: (canMode || null) as Parameters<typeof update.mutate>[0]["canMode"],
                  canHeartbeatMs: canHeartbeatMs ? Number(canHeartbeatMs) : null,
                  canSyncPeriodMs: canSyncPeriodMs ? Number(canSyncPeriodMs) : null,
                  cyclePeriodMs: cyclePeriodMs ? Number(cyclePeriodMs) : null,
                })
              }
            >
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{network.protocol}</Badge>
            <Badge variant="secondary">{network.role}</Badge>
            <span className="text-xs text-muted-foreground">via {hostedBy}</span>
            {network.plcPorts.length > 0 && (
              <span className="text-xs text-muted-foreground">
                · Port {network.plcPorts.map((p) => p.portNumber + 1).join(", ")}
                {network.plcPorts[0].label ? ` (${network.plcPorts[0].label})` : ""}
              </span>
            )}
            {network.nodeAddress != null && (
              <span className="text-xs text-muted-foreground">· Node {network.nodeAddress}</span>
            )}
            {network.baudRateKbit != null && (
              <span className="text-xs text-muted-foreground">· {network.baudRateKbit} kbit/s</span>
            )}
            {network.serialParity && (
              <span className="text-xs text-muted-foreground">· {network.serialParity}</span>
            )}
            {network.serialStopBits != null && (
              <span className="text-xs text-muted-foreground">· {network.serialStopBits} stop</span>
            )}
            {network.canMode && (
              <span className="text-xs text-muted-foreground">· {network.canMode}</span>
            )}
            {network.ipAddress && (
              <span className="text-xs text-muted-foreground">· {network.ipAddress}{network.ipPort ? `:${network.ipPort}` : ""}</span>
            )}
            {network.canHeartbeatMs != null && (
              <span className="text-xs text-muted-foreground">· HB {network.canHeartbeatMs} ms</span>
            )}
            {network.cyclePeriodMs != null && (
              <span className="text-xs text-muted-foreground">· {network.cyclePeriodMs} ms cycle</span>
            )}
            {network.description && (
              <span className="text-xs text-muted-foreground">· {network.description}</span>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
