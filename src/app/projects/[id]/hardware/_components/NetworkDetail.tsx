"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CAN_MODES, CAN_ORIGIN_SET, ETHERNET_PROTOCOL_SET, SERIAL_PARITY, type BusProtocol } from "@/lib/enums";

// ── Types ─────────────────────────────────────────────────────────────────────

type Instance = {
  id: number;
  name: string;
  tag: string | null;
  notes: string | null;
  plcNetworkId: number | null;
  canIdOffset: number | null;
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
  role: string;
  nodeAddress: number | null;
  description: string | null;
  ioCardId: number | null;
  ioCard: { id: number; name: string | null; slotPosition: number } | null;
  plcPorts: { id: number; portNumber: number; label: string | null }[];
  instances: Instance[];
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

type Props = {
  network: Network;
  onRefresh: () => void;
};

// ── Main component ─────────────────────────────────────────────────────────────

export function NetworkDetail({ network, onRefresh }: Props) {
  const utils = trpc.useUtils();

  const proto = network.protocol as BusProtocol;
  const isSerial = ["MODBUS_RTU", "PROFIBUS", "DEVICENET"].includes(proto);
  const isCan = CAN_ORIGIN_SET.has(proto);
  const isEthernet = ETHERNET_PROTOCOL_SET.has(proto);

  const hostedBy = network.ioCard
    ? `Slot ${network.ioCard.slotPosition + 1}${network.ioCard.name ? ` — ${network.ioCard.name}` : ""}`
    : "PLC CPU";

  function handleOffsetSaved() {
    onRefresh();
    utils.projectHardware.networkCanIds.invalidate({ networkId: network.id });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-sm">{network.protocol}</Badge>
        <Badge variant="secondary">{network.role}</Badge>
        <span className="text-sm text-muted-foreground">via {hostedBy}</span>
        {network.plcPorts.length > 0 && (
          <span className="text-sm text-muted-foreground">
            · Port {network.plcPorts.map((p) => p.portNumber + 1).join(", ")}
          </span>
        )}
      </div>

      {/* Network Config Form */}
      <NetworkConfigForm
        network={network}
        isSerial={isSerial}
        isCan={isCan}
        isEthernet={isEthernet}
        onSaved={onRefresh}
      />

      {/* Bus Devices */}
      <BusDevicesSection
        instances={network.instances}
        isCan={isCan}
        onRefresh={handleOffsetSaved}
      />

      {/* CAN ID Spans (CAN protocols only) */}
      {isCan && <CanIdSpanSection networkId={network.id} />}
    </div>
  );
}

// ── Network config form ────────────────────────────────────────────────────────

function NetworkConfigForm({
  network,
  isSerial,
  isCan,
  isEthernet,
  onSaved,
}: {
  network: Network;
  isSerial: boolean;
  isCan: boolean;
  isEthernet: boolean;
  onSaved: () => void;
}) {
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

  const update = trpc.projectHardware.networkUpdate.useMutation({ onSuccess: onSaved });

  const sel = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm";

  return (
    <div className="space-y-4 rounded-md border p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Network Configuration
      </h3>

      <div className="grid grid-cols-2 gap-3">
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
          <Input
            type="number"
            value={nodeAddress}
            onChange={(e) => setNodeAddress(e.target.value)}
            className="h-8 text-sm"
            placeholder="optional"
          />
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Description</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-8 text-sm"
            placeholder="optional"
          />
        </div>
      </div>

      {isSerial && (
        <>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">
            Serial Parameters
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Baud Rate (kbit/s)</Label>
              <Input
                type="number"
                value={baudRateKbit}
                onChange={(e) => setBaudRateKbit(e.target.value)}
                className="h-8 text-sm"
                placeholder="e.g. 115"
              />
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

      {isCan && (
        <>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">
            CAN Parameters
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Baud Rate (kbit/s)</Label>
              <Input
                type="number"
                value={baudRateKbit}
                onChange={(e) => setBaudRateKbit(e.target.value)}
                className="h-8 text-sm"
                placeholder="e.g. 500"
              />
            </div>
            {network.protocol === "CANBUS" && (
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
              <Input
                type="number"
                value={canHeartbeatMs}
                onChange={(e) => setCanHeartbeatMs(e.target.value)}
                className="h-8 text-sm"
                placeholder="e.g. 1000"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sync Period (ms)</Label>
              <Input
                type="number"
                value={canSyncPeriodMs}
                onChange={(e) => setCanSyncPeriodMs(e.target.value)}
                className="h-8 text-sm"
                placeholder="e.g. 100"
              />
            </div>
          </div>
        </>
      )}

      {isEthernet && (
        <>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">
            Network Parameters
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">IP Address</Label>
              <Input
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                className="h-8 text-sm"
                placeholder="e.g. 192.168.1.100"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">TCP Port</Label>
              <Input
                type="number"
                value={ipPort}
                onChange={(e) => setIpPort(e.target.value)}
                className="h-8 text-sm"
                placeholder="e.g. 502"
              />
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Cycle Period (ms)</Label>
          <Input
            type="number"
            value={cyclePeriodMs}
            onChange={(e) => setCyclePeriodMs(e.target.value)}
            className="h-8 text-sm"
            placeholder="optional"
          />
        </div>
      </div>

      <div className="flex justify-end">
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
  );
}

// ── Bus devices section ────────────────────────────────────────────────────────

function BusDevicesSection({
  instances,
  isCan,
  onRefresh,
}: {
  instances: Instance[];
  isCan: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Bus Devices
      </h3>
      {instances.length === 0 ? (
        <p className="text-sm text-muted-foreground">No devices assigned to this network.</p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Instance</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Component</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tag</th>
                {isCan && (
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    CAN ID Offset
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {instances.map((inst) => (
                <InstanceRow key={inst.id} instance={inst} isCan={isCan} onRefresh={onRefresh} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InstanceRow({
  instance,
  isCan,
  onRefresh,
}: {
  instance: Instance;
  isCan: boolean;
  onRefresh: () => void;
}) {
  const [offset, setOffset] = useState(
    instance.canIdOffset != null ? String(instance.canIdOffset) : ""
  );
  const update = trpc.projectHardware.instanceUpdate.useMutation({ onSuccess: onRefresh });

  const savedOffset = instance.canIdOffset != null ? String(instance.canIdOffset) : "";
  const isDirty = offset !== savedOffset;

  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2 font-medium">{instance.name}</td>
      <td className="px-3 py-2 text-muted-foreground">
        {instance.component.name}
        {(instance.component.manufacturer || instance.component.model) && (
          <span className="text-xs ml-1 text-muted-foreground/70">
            {[instance.component.manufacturer, instance.component.model].filter(Boolean).join(" ")}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-muted-foreground">{instance.tag ?? "—"}</td>
      {isCan && (
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={offset}
              onChange={(e) => setOffset(e.target.value)}
              className="h-7 w-28 text-sm"
              placeholder="0"
            />
            {isDirty && (
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate({
                    id: instance.id,
                    name: instance.name,
                    tag: instance.tag,
                    notes: instance.notes,
                    canIdOffset: offset !== "" ? Number(offset) : null,
                  })
                }
              >
                {update.isPending ? "…" : "Save"}
              </Button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

// ── CAN ID span section ────────────────────────────────────────────────────────

function CanIdSpanSection({ networkId }: { networkId: number }) {
  const { data = [], isLoading } = trpc.projectHardware.networkCanIds.useQuery({ networkId });

  const toHex = (n: number) => `0x${n.toString(16).toUpperCase().padStart(3, "0")}`;

  const instanceSpans = data.map((inst) => {
    const effectiveIds = inst.component.signals
      .map((s) => (s.canId ?? 0) + (inst.canIdOffset ?? 0))
      .filter((id) => id > 0);
    return {
      id: inst.id,
      name: inst.name,
      offset: inst.canIdOffset,
      signalCount: inst.component.signals.length,
      min: effectiveIds.length > 0 ? Math.min(...effectiveIds) : null,
      max: effectiveIds.length > 0 ? Math.max(...effectiveIds) : null,
    };
  });

  const allBounds = instanceSpans.flatMap((s) =>
    s.min != null && s.max != null ? [s.min, s.max] : []
  );
  const globalMin = allBounds.length > 0 ? Math.min(...allBounds) : null;
  const globalMax = allBounds.length > 0 ? Math.max(...allBounds) : null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        CAN ID Spans
      </h3>
      <p className="text-xs text-muted-foreground">
        Effective CAN IDs per device (component base ID + instance offset). Use the aggregate range to
        configure hardware acceptance filters.
      </p>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : instanceSpans.length === 0 ? (
        <p className="text-sm text-muted-foreground">No devices with CAN signal definitions.</p>
      ) : (
        <>
          {globalMin != null && (
            <div className="rounded-md border bg-muted/30 px-4 py-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                Aggregate filter span
              </p>
              <p className="text-sm font-mono font-semibold">
                {toHex(globalMin)} – {toHex(globalMax!)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {globalMax! - globalMin + 1} IDs (decimal {globalMin} – {globalMax})
              </p>
            </div>
          )}

          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Device</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Offset</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Signals</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">CAN ID Range</th>
                </tr>
              </thead>
              <tbody>
                {instanceSpans.map((span) => (
                  <tr key={span.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{span.name}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">
                      {span.offset != null ? `+${span.offset}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{span.signalCount}</td>
                    <td className="px-3 py-2 font-mono">
                      {span.min != null ? (
                        span.min === span.max ? (
                          toHex(span.min)
                        ) : (
                          `${toHex(span.min)} – ${toHex(span.max!)}`
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
