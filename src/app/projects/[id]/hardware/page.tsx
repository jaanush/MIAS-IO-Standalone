"use client";

import { use, useState, useCallback } from "react";
import { useQueryState, parseAsString, parseAsInteger } from "nuqs";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Plus, Cpu, Network, Server, Box, Workflow } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HardwareTree } from "./_components/HardwareTree";
import { PlcDetail } from "./_components/PlcDetail";
import { CarrierDetail } from "./_components/CarrierDetail";
import { InstanceDetail } from "./_components/InstanceDetail";
import { NetworkDetail } from "./_components/NetworkDetail";
import { AddPlcDialog } from "./_components/AddPlcDialog";
import { AddCarrierDialog } from "./_components/AddCarrierDialog";
import { AddComponentInstanceDialog } from "./_components/AddComponentInstanceDialog";
import { AddNetworkDialog } from "./_components/AddNetworkDialog";
import { IpNetworkDetail } from "./_components/IpNetworkDetail";
import type { SelectedNode } from "@/lib/types/hardware";

export default function ProjectHardwarePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const projectId = Number(id);
  const utils = trpc.useUtils();

  // URL-synced selection state: ?view=plc&nodeId=5
  const [viewType, setViewType] = useQueryState("view", parseAsString);
  const [nodeId, setNodeId] = useQueryState("nodeId", parseAsInteger);

  const selected: SelectedNode | null =
    viewType && nodeId != null
      ? ({ type: viewType, id: nodeId } as SelectedNode)
      : null;

  const setSelected = useCallback((node: SelectedNode | null) => {
    if (node) {
      setViewType(node.type);
      setNodeId(node.id);
    } else {
      setViewType(null);
      setNodeId(null);
    }
  }, [setViewType, setNodeId]);
  const [addPlcOpen, setAddPlcOpen] = useState(false);
  const [addCarrierForPlc, setAddCarrierForPlc] = useState<number | null>(null);
  const [addBusOpen, setAddBusOpen] = useState(false);
  const [addInstanceOpen, setAddInstanceOpen] = useState(false);
  const createIpNetwork = trpc.projectHardware.ipNetworkCreate.useMutation({
    onSuccess: () => {
      refresh();
      utils.projectHardware.ipNetworkList.invalidate();
    },
  });
  const [addInstanceNetworkId, setAddInstanceNetworkId] = useState<number | null>(null);

  const { data: hwData, isLoading, refetch } = trpc.projectHardware.getHardware.useQuery({
    projectId,
  });
  const plcs = hwData?.plcs ?? [];
  const standaloneNetworks = hwData?.networks ?? [];
  const { data: ipNetworks = [] } = trpc.projectHardware.ipNetworkList.useQuery({ projectId });

  function refresh() {
    refetch();
    utils.projectHardware.getHardware.invalidate({ projectId });
  }

  // Find selected node data from loaded plcs
  const selectedPlc =
    selected?.type === "plc" ? plcs.find((p) => p.id === selected.id) ?? null : null;

  const selectedCarrier =
    selected?.type === "carrier"
      ? plcs.flatMap((p) => [
          ...p.carriers,
          ...p.buses.flatMap((n: any) => n.carriers),
        ]).find((c) => c.id === selected.id) ?? null
      : null;

  const selectedNetwork =
    selected?.type === "network"
      ? [...plcs.flatMap((p) => p.buses), ...standaloneNetworks].find((n) => n.id === selected.id) ?? null
      : null;

  const allNets = [...plcs.flatMap((p) => p.buses), ...standaloneNetworks];

  const selectedInstance =
    selected?.type === "instance"
      ? allNets.flatMap((n: any) => n.instances).find((i) => i.id === selected.id) ?? null
      : null;

  const selectedInstanceNetwork =
    selectedInstance?.busId != null
      ? allNets.find((n) => n.id === selectedInstance.busId) ?? null
      : null;

  const selectedIpNetwork =
    selected?.type === "ipNetwork"
      ? ipNetworks.find((n) => n.id === selected.id) ?? null
      : null;

  const addCarrierPlc = addCarrierForPlc != null ? plcs.find((p) => p.id === addCarrierForPlc) : null;
  // All networks across all PLCs + standalone project networks
  const allNetworks = [
    ...plcs.flatMap((p) => p.buses.map((n: any) => ({ ...n, plcName: p.name }))),
    ...standaloneNetworks.map((n) => ({ ...n, plcName: "Project" })),
  ];

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left panel — tree */}
      <div className="w-[26rem] border-r flex flex-col shrink-0 overflow-y-auto">
        <div className="flex items-center justify-between px-3 pt-4 pb-2 border-b">
          <span className="text-sm font-semibold">Hardware</span>
        </div>

        <div className="flex-1 p-2 overflow-y-auto">
          {isLoading ? (
            <p className="text-xs text-muted-foreground p-2">Loading…</p>
          ) : (
            <HardwareTree
              plcs={plcs}
              standaloneNetworks={standaloneNetworks}
              ipNetworks={ipNetworks}
              selected={selected}
              onSelect={setSelected}
              onAddInstance={(networkId) => { setAddInstanceNetworkId(networkId); setAddInstanceOpen(true); }}
            />
          )}
        </div>

        <div className="border-t p-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" className="w-full">
                <Plus className="h-4 w-4 mr-1" /> Add...
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-52 p-1">
              <div className="space-y-0.5">
                <button
                  className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent text-left"
                  onClick={() => setAddPlcOpen(true)}
                >
                  <Cpu className="h-3.5 w-3.5 text-muted-foreground" /> PLC
                </button>
                <button
                  className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent text-left"
                  onClick={() => createIpNetwork.mutate({ projectId, name: `Network ${Date.now() % 1000}` })}
                >
                  <Network className="h-3.5 w-3.5 text-muted-foreground" /> IP Network
                </button>
                <button
                  className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent text-left"
                  onClick={() => setAddBusOpen(true)}
                >
                  <Workflow className="h-3.5 w-3.5 text-muted-foreground" /> Bus
                </button>
                <button
                  className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent text-left"
                  onClick={() => {
                    const plcWithBus = plcs.find((p) => p.buses.length > 0);
                    if (plcWithBus) {
                      const target = selectedPlc?.buses.length ? selectedPlc : plcWithBus;
                      setAddCarrierForPlc(target.id);
                    }
                  }}
                  disabled={!plcs.some((p) => p.buses.length > 0)}
                >
                  <Server className="h-3.5 w-3.5 text-muted-foreground" /> Carrier
                </button>
                <button
                  className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent text-left"
                  onClick={() => {
                    setAddInstanceNetworkId(selected?.type === "network" ? selected.id : null);
                    setAddInstanceOpen(true);
                  }}
                  disabled={allNetworks.length === 0}
                >
                  <Box className="h-3.5 w-3.5 text-muted-foreground" /> Component Instance
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Right panel — detail */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selected && (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            Select a PLC, carrier, or instance from the tree.
          </div>
        )}

        {selectedPlc && (
          <PlcDetail
            plc={selectedPlc}
            projectId={projectId}
            onRefresh={refresh}
          />
        )}

        {selectedCarrier && (
          <CarrierDetail
            carrier={selectedCarrier}
            projectId={projectId}
            onRefresh={refresh}
          />
        )}

        {selectedIpNetwork && (
          <IpNetworkDetail
            network={selectedIpNetwork!}
            projectId={projectId}
            onRefresh={() => { refresh(); utils.projectHardware.ipNetworkList.invalidate(); }}
            onDeleted={() => { setSelected(null); refresh(); utils.projectHardware.ipNetworkList.invalidate(); }}
          />
        )}

        {selectedNetwork && !selectedCarrier && !selectedPlc && !selectedInstance && !selectedIpNetwork && (
          <NetworkDetail
            key={selectedNetwork.id}
            network={selectedNetwork}
            projectId={projectId}
            onRefresh={refresh}
          />
        )}

        {selectedInstance && (
          <InstanceDetail
            key={selectedInstance.id}
            instance={selectedInstance}
            network={selectedInstanceNetwork ?? null}
            projectId={projectId}
            onDeleted={() => { setSelected(null); refresh(); }}
            onRefresh={refresh}
          />
        )}
      </div>

      {/* Dialogs */}
      <AddPlcDialog
        projectId={projectId}
        open={addPlcOpen}
        onClose={() => setAddPlcOpen(false)}
        onCreated={refresh}
      />

      {addCarrierPlc && (
        <AddCarrierDialog
          projectId={projectId}
          plcId={addCarrierPlc.id}
          networks={allNetworks}
          open
          busCouplerMode
          onClose={() => setAddCarrierForPlc(null)}
          onCreated={refresh}
        />
      )}

      <AddNetworkDialog
        open={addBusOpen}
        onClose={() => setAddBusOpen(false)}
        onSaved={(busId) => {
          setAddBusOpen(false);
          refresh();
          setSelected({ type: "network", id: busId });
        }}
        projectId={projectId}
      />

      {addInstanceOpen && (
        <AddComponentInstanceDialog
          open
          projectId={projectId}
          preselectedNetworkId={addInstanceNetworkId}
          networks={allNetworks}
          onClose={() => setAddInstanceOpen(false)}
          onCreated={() => { setAddInstanceOpen(false); refresh(); }}
        />
      )}
    </div>
  );
}
