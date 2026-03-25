"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Cpu, Server, Box, Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CAN_ORIGIN_SET, ETHERNET_PROTOCOL_SET, NETWORK_NODE_ROLES, type BusProtocol, type NetworkNodeRole } from "@/lib/enums";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import type { Bus, BusNode, ComponentInstance, IpNetwork } from "@/lib/types/hardware";
import { NetworkConfigForm } from "./NetworkConfigForm";
import { CanIdSpanSection } from "./CanIdSpanSection";

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
          <Select
            value={network.ipNetworkId != null ? String(network.ipNetworkId) : "__none__"}
            onValueChange={(v) => {
              busUpdate.mutate({
                id: network.id,
                ipNetworkId: v === "__none__" ? null : Number(v),
              });
            }}
          >
            <SelectTrigger className="h-8 flex-1 max-w-xs text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— None —</SelectItem>
              {(ipNetworks as IpNetwork[]).map((n) => (
                <SelectItem key={n.id} value={String(n.id)}>
                  {n.name ?? `Network #${n.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                        <Select
                          value={node.role}
                          onValueChange={(v) => upsertNode.mutate({
                            busId: network.id,
                            plcId: node.plc?.id ?? undefined,
                            carrierId: node.carrier?.id ?? undefined,
                            role: v as NetworkNodeRole,
                            nodeAddress: node.nodeAddress,
                            ipAddress: node.ipAddress,
                          })}
                        >
                          <SelectTrigger className="h-7 w-full text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {NETWORK_NODE_ROLES.map((r) => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                              role: node.role as NetworkNodeRole,
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
                      <Select
                        value={inst.nodeRole ?? "__none__"}
                        onValueChange={(v) => instanceUpdate.mutate({
                          id: inst.id,
                          name: inst.name,
                          nodeRole: (v === "__none__" ? null : v) as NetworkNodeRole | null,
                          nodeAddress: inst.nodeAddress,
                        })}
                      >
                        <SelectTrigger className="h-7 w-full text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {NETWORK_NODE_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                            nodeRole: inst.nodeRole as NetworkNodeRole | null,
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
                              nodeRole: inst.nodeRole as NetworkNodeRole | null,
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
        <Select
          value={addType ?? "__none__"}
          onValueChange={(v) => { setAddType((v === "__none__" ? null : v) as "plc" | "carrier" | "component" | "module" | null); setAddId(""); }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">+ Add node...</SelectItem>
            <SelectItem value="plc">PLC</SelectItem>
            <SelectItem value="carrier">Carrier</SelectItem>
            <SelectItem value="component">Component</SelectItem>
            {allIoCards.length > 0 && <SelectItem value="module">Module (bus host)</SelectItem>}
          </SelectContent>
        </Select>
        {addType && (
          <>
            <Select
              value={addId || "__none__"}
              onValueChange={(v) => setAddId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger className="h-8 flex-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select {addType}...</SelectItem>
                {addType === "plc" && plcs.filter((p) => !connectedPlcIds.has(p.id)).map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
                {addType === "carrier" && allCarriers.filter((c: any) => !connectedCarrierIds.has(c.id)).map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
                {addType === "component" && availableComponents.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name} ({c._count.signals} signals)</SelectItem>
                ))}
                {addType === "module" && allIoCards.map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.carrierName} / Slot {c.slotPosition + 1} — {c.catalog?.articleNumber}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

