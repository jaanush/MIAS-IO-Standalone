"use client";

import { use, useState } from "react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { HardwareTree } from "./_components/HardwareTree";
import { PlcDetail } from "./_components/PlcDetail";
import { CarrierDetail } from "./_components/CarrierDetail";
import { InstanceDetail } from "./_components/InstanceDetail";
import { NetworkDetail } from "./_components/NetworkDetail";
import { AddPlcDialog } from "./_components/AddPlcDialog";
import { AddCarrierDialog } from "./_components/AddCarrierDialog";
import { AddComponentInstanceDialog } from "./_components/AddComponentInstanceDialog";

type SelectedNode =
  | { type: "plc"; id: number }
  | { type: "network"; id: number; plcId: number }
  | { type: "carrier"; id: number }
  | { type: "instance"; id: number };

export default function ProjectHardwarePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const projectId = Number(id);
  const utils = trpc.useUtils();

  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [addPlcOpen, setAddPlcOpen] = useState(false);
  const [addCarrierForPlc, setAddCarrierForPlc] = useState<number | null>(null);
  const [addInstanceOpen, setAddInstanceOpen] = useState(false);
  const [addInstanceNetworkId, setAddInstanceNetworkId] = useState<number | null>(null);

  const { data: plcs = [], isLoading, refetch } = trpc.projectHardware.getHardware.useQuery({
    projectId,
  });

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
          ...p.networks.flatMap((n) => n.carriers),
        ]).find((c) => c.id === selected.id) ?? null
      : null;

  const selectedNetwork =
    selected?.type === "network"
      ? plcs.flatMap((p) => p.networks).find((n) => n.id === selected.id) ?? null
      : null;

  const selectedInstance =
    selected?.type === "instance"
      ? plcs.flatMap((p) => p.networks.flatMap((n) => n.instances)).find((i) => i.id === selected.id) ?? null
      : null;

  const selectedInstanceNetwork =
    selectedInstance?.plcNetworkId != null
      ? plcs.flatMap((p) => p.networks).find((n) => n.id === selectedInstance.plcNetworkId) ?? null
      : null;

  const addCarrierPlc = addCarrierForPlc != null ? plcs.find((p) => p.id === addCarrierForPlc) : null;

  // All networks across all PLCs (for the add instance dialog)
  const allNetworks = plcs.flatMap((p) => p.networks);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left panel — tree */}
      <div className="w-64 border-r flex flex-col shrink-0 overflow-y-auto">
        <div className="flex items-center justify-between px-3 pt-4 pb-2 border-b">
          <span className="text-sm font-semibold">Hardware</span>
        </div>

        <div className="flex-1 p-2 overflow-y-auto">
          {isLoading ? (
            <p className="text-xs text-muted-foreground p-2">Loading…</p>
          ) : (
            <HardwareTree
              plcs={plcs}
              selected={selected}
              onSelect={setSelected}
              onAddInstance={(networkId) => { setAddInstanceNetworkId(networkId); setAddInstanceOpen(true); }}
            />
          )}
        </div>

        <div className="border-t p-2 space-y-1">
          <Button
            size="sm"
            className="w-full"
            onClick={() => setAddPlcOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" /> Add PLC
          </Button>
          {(() => {
            const plcWithBus = plcs.find((p) => p.networks.length > 0);
            return (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={!plcWithBus}
                title={!plcWithBus ? "No PLC with networks defined" : undefined}
                onClick={() => {
                  const target = selectedPlc?.networks.length ? selectedPlc : plcWithBus!;
                  setAddCarrierForPlc(target.id);
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Add Carrier
              </Button>
            );
          })()}
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={allNetworks.length === 0}
            title={allNetworks.length === 0 ? "No networks defined" : undefined}
            onClick={() => {
              setAddInstanceNetworkId(selected?.type === "network" ? selected.id : null);
              setAddInstanceOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Add Instance
          </Button>
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
            networks={
              plcs
                .find((p) =>
                  [...p.carriers, ...p.networks.flatMap((n) => n.carriers)].some(
                    (c) => c.id === selectedCarrier.id
                  )
                )
                ?.networks ?? []
            }
            onRefresh={refresh}
          />
        )}

        {selectedNetwork && !selectedCarrier && !selectedPlc && !selectedInstance && (
          <NetworkDetail
            key={selectedNetwork.id}
            network={selectedNetwork}
            onRefresh={refresh}
          />
        )}

        {selectedInstance && (
          <InstanceDetail
            key={selectedInstance.id}
            instance={selectedInstance}
            network={selectedInstanceNetwork ?? null}
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
          networks={addCarrierPlc.networks}
          open
          busCouplerMode
          onClose={() => setAddCarrierForPlc(null)}
          onCreated={refresh}
        />
      )}

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
