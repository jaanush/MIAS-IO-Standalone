"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Cpu, Server, Box, Plus, Trash2 } from "lucide-react";
import { CAN_MODES, CAN_ORIGIN_SET, ETHERNET_PROTOCOL_SET, SERIAL_PARITY, NETWORK_NODE_ROLES, type BusProtocol } from "@/lib/enums";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import type { Bus, BusNode, ComponentInstance } from "@/lib/types/hardware";

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  network: Bus;
  projectId: number;
  onRefresh: () => void;
};

// ── Main component ─────────────────────────────────────────────────────────────

export function NetworkDetail({ network, projectId, onRefresh }: Props) {
  const utils = trpc.useUtils();
  const busUpdate = trpc.projectHardware.busUpdate.useMutation({ onSuccess: onRefresh });
  const { data: ipNetworks = [] } = trpc.projectHardware.ipNetworkList.useQuery({ projectId });

  const proto = network.protocol as BusProtocol;
  const isSerial = ["MODBUS_RTU", "PROFIBUS", "DEVICENET"].includes(proto);
  const isCan = CAN_ORIGIN_SET.has(proto);
  const isEthernet = ETHERNET_PROTOCOL_SET.has(proto);

  function handleOffsetSaved() {
    onRefresh();
    utils.projectHardware.busCanIds.invalidate({ busId: network.id });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-sm">{network.protocol}</Badge>
        {network.description && (
          <span className="text-sm font-medium">{network.description}</span>
        )}
        <span className="text-sm text-muted-foreground">
          {(network.nodes ?? []).length} node{(network.nodes ?? []).length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* IP Network assignment (ethernet buses only) */}
      {isEthernet && (
        <div className="flex items-center gap-2">
          <Label className="text-xs shrink-0">IP Network:</Label>
          <select
            className="h-8 flex-1 max-w-xs rounded-md border border-input bg-background px-2 text-sm"
            value={network.ipNetworkId ?? ""}
            onChange={(e) => {
              busUpdate.mutate({
                id: network.id,
                ipNetworkId: e.target.value ? Number(e.target.value) : null,
              });
            }}
          >
            <option value="">— None —</option>
            {(ipNetworks as any[]).map((n) => (
              <option key={n.id} value={n.id}>
                {n.name ?? `Network #${n.id}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Connected Nodes */}
      <ConnectedNodesSection
        network={network}
        projectId={projectId}
        isCan={isCan}
        onRefresh={onRefresh}
      />

      {/* Network Config Form */}
      <NetworkConfigForm
        network={network}
        isSerial={isSerial}
        isCan={isCan}
        isEthernet={isEthernet}
        onSaved={onRefresh}
      />

      {/* CAN ID Spans (CAN protocols only) */}
      {isCan && <CanIdSpanSection networkId={network.id} />}
    </div>
  );
}

// ── Connected nodes section ──────────────────────────────────────────────────

function ConnectedNodesSection({
  network,
  projectId,
  isCan,
  onRefresh,
}: {
  network: Bus;
  projectId: number;
  isCan: boolean;
  onRefresh: () => void;
}) {
  const [confirmProps, confirmAction] = useConfirm();
  const upsertNode = trpc.projectHardware.busNodeUpsert.useMutation();
  const deleteNode = trpc.projectHardware.busNodeDelete.useMutation({ onSuccess: onRefresh });
  const instanceCreate = trpc.projectHardware.instanceCreate.useMutation();
  const instanceUpdate = trpc.projectHardware.instanceUpdate.useMutation({ onSuccess: onRefresh });
  const instanceDelete = trpc.projectHardware.instanceDelete.useMutation({ onSuccess: onRefresh });
  const busUpdate = trpc.projectHardware.busUpdate.useMutation();

  // Fetch available PLCs and carriers for the "Add Node" dropdown
  const { data: hwData } = trpc.projectHardware.getHardware.useQuery(
    { projectId },
    { staleTime: 30_000 } // prevent refetch loops
  );
  const plcs = hwData?.plcs ?? [];
  const allCarriers = plcs.flatMap((p: any) => [
    ...(p.carriers ?? []),
    ...(p.buses ?? []).flatMap((b: any) => b.carriers ?? []),
  ]);

  // IDs already connected
  const nodes = network.nodes ?? [];
  const instances = network.instances ?? [];
  const connectedPlcIds = new Set(nodes.filter((n) => n.plc).map((n) => n.plc!.id));
  const connectedCarrierIds = new Set(nodes.filter((n) => n.carrier).map((n) => n.carrier!.id));

  const totalNodes = nodes.length + instances.length;

  // Available components for this bus protocol
  const componentsForBus = trpc.projectHardware.componentsForNetwork.useQuery(
    { protocol: network.protocol, projectId },
    { enabled: true }
  );
  const availableComponents = (componentsForBus.data ?? []) as { id: number; name: string; _count: { signals: number } }[];

  // All IO cards that provide network and match this bus protocol
  const allIoCards = plcs.flatMap((p) => [
    ...p.carriers.flatMap((c: any) => (c.cards ?? []).filter((card: any) =>
      card.catalog?.providesNetwork && card.catalog?.protocols?.some((pr: any) => pr.protocol === network.protocol)
    ).map((card: any) => ({ ...card, carrierId: c.id, carrierName: c.name }))),
    ...p.buses.flatMap((b: any) => (b.carriers ?? []).flatMap((c: any) =>
      (c.cards ?? []).filter((card: any) =>
        card.catalog?.providesNetwork && card.catalog?.protocols?.some((pr: any) => pr.protocol === network.protocol)
      ).map((card: any) => ({ ...card, carrierName: c.name }))
    )),
  ]);

  const connectedInstanceIds = new Set(instances.map((i) => i.id));

  const [addType, setAddType] = useState<"plc" | "carrier" | "component" | "module" | null>(null);
  const [addId, setAddId] = useState<string>("");

  async function handleAdd() {
    if (!addId) return;
    const id = Number(addId);
    if (addType === "plc") {
      await upsertNode.mutateAsync({ busId: network.id, plcId: id, role: "CLIENT" });
    } else if (addType === "carrier") {
      await upsertNode.mutateAsync({ busId: network.id, carrierId: id, role: "SERVER" });
    } else if (addType === "component") {
      const comp = availableComponents.find((c) => c.id === id);
      if (comp) {
        await instanceCreate.mutateAsync({
          projectId,
          componentId: id,
          busId: network.id,
          name: comp.name,
        });
      }
    } else if (addType === "module") {
      const card = allIoCards.find((c: any) => c.id === id);
      await busUpdate.mutateAsync({ id: network.id, ioCardId: id });
      if (card?.carrierId) {
        await upsertNode.mutateAsync({ busId: network.id, carrierId: card.carrierId, role: "SERVER" });
      }
    }
    setAddType(null);
    setAddId("");
    onRefresh();
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Connected Nodes
      </h3>

      {totalNodes > 0 ? (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs">
                <th className="px-3 py-1.5 font-medium">Device</th>
                {!isCan && <th className="px-3 py-1.5 font-medium w-24">Role</th>}
                <th className="px-3 py-1.5 font-medium w-20">{isCan ? "Node ID" : "Node Addr"}</th>
                {isCan && <th className="px-3 py-1.5 font-medium w-20">CAN Offset</th>}
                <th className="px-3 py-1.5 font-medium w-10" />
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => {
                const deviceName = node.plc?.name ?? (
                  node.carrier
                    ? (node.carrier.cabinetNumber != null && node.carrier.carrierNumber != null
                        ? `N${node.carrier.cabinetNumber}:D${String(node.carrier.carrierNumber).padStart(2, "0")} ${node.carrier.name}`
                        : node.carrier.name)
                    : "Unknown"
                );
                const DeviceIcon = node.plc ? Cpu : Server;

                return (
                  <tr key={node.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-1.5">
                      <span className="flex items-center gap-1.5">
                        <DeviceIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{deviceName}</span>
                      </span>
                    </td>
                    {!isCan && (
                      <td className="px-3 py-1.5">
                        <select
                          className="h-7 w-full rounded border border-input bg-background px-1.5 text-xs"
                          value={node.role}
                          onChange={(e) => upsertNode.mutate({
                            busId: network.id,
                            plcId: node.plc?.id ?? undefined,
                            carrierId: node.carrier?.id ?? undefined,
                            role: e.target.value as any,
                            nodeAddress: node.nodeAddress,
                            ipAddress: node.ipAddress,
                          })}
                        >
                          {NETWORK_NODE_ROLES.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td className="px-3 py-1.5">
                      <Input
                        inputMode="numeric"
                        className="h-7 w-full text-xs px-2 tabular-nums"
                        defaultValue={node.nodeAddress ?? ""}
                        placeholder="—"
                        onBlur={(e) => {
                          const v = e.target.value ? Number(e.target.value) : null;
                          if (v !== node.nodeAddress) {
                            upsertNode.mutate({
                              busId: network.id,
                              plcId: node.plc?.id ?? undefined,
                              carrierId: node.carrier?.id ?? undefined,
                              role: node.role as any,
                              nodeAddress: v,
                              ipAddress: node.ipAddress,
                            });
                          }
                        }}
                      />
                    </td>
                    {isCan && <td className="px-3 py-1.5" />}
                    <td className="px-3 py-1.5">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive"
                        title="Remove from bus"
                        onClick={() => confirmAction("Remove this node from the bus?", () => deleteNode.mutate({ id: node.id }))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {/* Component instances as nodes */}
              {instances.map((inst) => (
                <tr key={`inst-${inst.id}`} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-1.5">
                    <span className="flex items-center gap-1.5">
                      <Box className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{inst.name}</span>
                      <span className="text-[10px] text-muted-foreground">{inst.component.name}</span>
                    </span>
                  </td>
                  {!isCan && (
                    <td className="px-3 py-1.5">
                      <select
                        className="h-7 w-full rounded border border-input bg-background px-1.5 text-xs"
                        value={inst.nodeRole ?? ""}
                        onChange={(e) => instanceUpdate.mutate({
                          id: inst.id,
                          name: inst.name,
                          nodeRole: (e.target.value || null) as any,
                          nodeAddress: inst.nodeAddress,
                        })}
                      >
                        <option value="">—</option>
                        {NETWORK_NODE_ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td className="px-3 py-1.5">
                    <Input
                      inputMode="numeric"
                      className="h-7 w-full text-xs px-2 tabular-nums"
                      defaultValue={inst.nodeAddress ?? ""}
                      placeholder="—"
                      onBlur={(e) => {
                        const v = e.target.value ? Number(e.target.value) : null;
                        if (v !== inst.nodeAddress) {
                          instanceUpdate.mutate({
                            id: inst.id,
                            name: inst.name,
                            nodeRole: inst.nodeRole as any,
                            nodeAddress: v,
                          });
                        }
                      }}
                    />
                  </td>
                  {isCan && (
                    <td className="px-3 py-1.5">
                      <Input
                        inputMode="numeric"
                        className="h-7 w-full text-xs px-2 tabular-nums"
                        defaultValue={inst.canIdOffset ?? ""}
                        placeholder="0"
                        onBlur={(e) => {
                          const v = e.target.value ? Number(e.target.value) : null;
                          if (v !== inst.canIdOffset) {
                            instanceUpdate.mutate({
                              id: inst.id,
                              name: inst.name,
                              nodeRole: inst.nodeRole as any,
                              nodeAddress: inst.nodeAddress,
                              canIdOffset: v,
                            });
                          }
                        }}
                      />
                    </td>
                  )}
                  <td className="px-3 py-1.5">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      title="Remove instance"
                      onClick={() => confirmAction(`Remove ${inst.name}? This will delete its signals.`, () => instanceDelete.mutate({ id: inst.id }))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground py-2">No devices connected to this bus.</p>
      )}

      {/* Add node */}
      <div className="flex items-center gap-2">
        <select
          className="h-8 rounded border border-input bg-background px-2 text-xs"
          value={addType ?? ""}
          onChange={(e) => { setAddType((e.target.value || null) as any); setAddId(""); }}
        >
          <option value="">+ Add node...</option>
          <option value="plc">PLC</option>
          <option value="carrier">Carrier</option>
          <option value="component">Component</option>
          {allIoCards.length > 0 && <option value="module">Module (bus host)</option>}
        </select>
        {addType && (
          <>
            <select
              className="h-8 flex-1 rounded border border-input bg-background px-2 text-xs"
              value={addId}
              onChange={(e) => setAddId(e.target.value)}
            >
              <option value="">Select {addType}...</option>
              {addType === "plc" && plcs.filter((p) => !connectedPlcIds.has(p.id)).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              {addType === "carrier" && allCarriers.filter((c: any) => !connectedCarrierIds.has(c.id)).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              {addType === "component" && availableComponents.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c._count.signals} signals)</option>
              ))}
              {addType === "module" && allIoCards.map((c: any) => (
                <option key={c.id} value={c.id}>{c.carrierName} / Slot {c.slotPosition + 1} — {c.catalog?.articleNumber}</option>
              ))}
            </select>
            <Button size="sm" className="h-8" disabled={!addId || upsertNode.isPending || instanceCreate.isPending} onClick={handleAdd}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </>
        )}
      </div>
      <ConfirmDialog {...confirmProps} confirmLabel="Delete" />
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
  network: Bus;
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
  const [ipPort, setIpPort] = useState(String(network.ipPort ?? ""));
  const [canMode, setCanMode] = useState(network.canMode ?? "");
  const [canHeartbeatMs, setCanHeartbeatMs] = useState(String(network.canHeartbeatMs ?? ""));
  const [canSyncPeriodMs, setCanSyncPeriodMs] = useState(String(network.canSyncPeriodMs ?? ""));
  const [cyclePeriodMs, setCyclePeriodMs] = useState(String(network.cyclePeriodMs ?? ""));

  const update = trpc.projectHardware.busUpdate.useMutation({ onSuccess: onSaved });

  const sel = "w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm";

  return (
    <div className="space-y-4 rounded-md border p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Bus Configuration
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Name</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-8 text-sm"
            placeholder="e.g. Field devices bus"
          />
        </div>
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
            TCP Parameters
          </p>
          <div className="grid grid-cols-2 gap-3">
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
  instances: ComponentInstance[];
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
  instance: ComponentInstance;
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
  const { data = [], isLoading } = trpc.projectHardware.busCanIds.useQuery({ busId: networkId });

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
