"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Cpu, Network, Server, Box, Plus, Globe, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Plc, Bus, Carrier, IpNetwork, SelectedNode } from "@/lib/types/hardware";

type Props = {
  plcs: Plc[];
  standaloneNetworks?: Bus[];
  ipNetworks?: IpNetwork[];
  selected: SelectedNode | null;
  onSelect: (node: SelectedNode | null) => void;
  onAddInstance: (networkId: number) => void;
};

function TreeItem({
  icon,
  label,
  sublabel,
  active,
  children,
  onClick,
  defaultOpen,
  onAdd,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  active?: boolean;
  children?: React.ReactNode;
  onClick?: () => void;
  defaultOpen?: boolean;
  onAdd?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  const hasChildren = !!children;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 rounded px-2 py-1.5 text-sm select-none group",
          active ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50",
        )}
      >
        {hasChildren ? (
          <button
            type="button"
            className="shrink-0 hover:text-foreground text-muted-foreground p-0.5 -m-0.5 rounded"
            onClick={() => setOpen((o) => !o)}
            tabIndex={-1}
          >
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <button
          type="button"
          className="flex items-center gap-1 flex-1 min-w-0 cursor-pointer text-left"
          onClick={onClick}
        >
          <span className="shrink-0 text-muted-foreground">{icon}</span>
          <span className="truncate flex-1">{label}</span>
          {sublabel && <span className="text-xs text-muted-foreground shrink-0">{sublabel}</span>}
        </button>
        {onAdd && (
          <button
            type="button"
            title="Add component instance"
            className="shrink-0 opacity-0 group-hover:opacity-100 hover:text-foreground text-muted-foreground p-0.5 rounded"
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            tabIndex={-1}
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>
      {hasChildren && open && <div className="ml-5 border-l pl-2 space-y-0.5">{children}</div>}
    </div>
  );
}

function carrierPrefix(c: Carrier): string {
  if (c.cabinetNumber != null && c.carrierNumber != null) {
    return `N${c.cabinetNumber}:D${String(c.carrierNumber).padStart(2, "0")} `;
  }
  return "";
}

function NetworkSubtree({ net, plcName, isSelected, onSelect, onAddInstance }: {
  net: Bus; plcName?: string; isSelected: (n: SelectedNode) => boolean;
  onSelect: (n: SelectedNode) => void; onAddInstance: (id: number) => void;
}) {
  const host = net.ioCard && plcName ? `${plcName}:${net.ioCard.slotPosition + 1}` : plcName ?? null;
  const carriers = net.carriers ?? [];
  const instances = net.instances ?? [];
  const hasChildren = carriers.length > 0 || instances.length > 0;
  return (
    <TreeItem
      key={net.id}
      icon={<Network className="h-3.5 w-3.5" />}
      label={net.protocol}
      sublabel={net.description ?? host ?? undefined}
      active={isSelected({ type: "network", id: net.id })}
      onClick={() => onSelect({ type: "network", id: net.id })}
      defaultOpen
      onAdd={() => onAddInstance(net.id)}
    >
      {hasChildren ? (
        <>
          {carriers.map((carrier) => (
            <TreeItem
              key={carrier.id}
              icon={<Server className="h-3.5 w-3.5" />}
              label={`${carrierPrefix(carrier)}${carrier.name}`}
              sublabel={carrier.catalog?.articleNumber}
              active={isSelected({ type: "carrier", id: carrier.id })}
              onClick={() => onSelect({ type: "carrier", id: carrier.id })}
            />
          ))}
          {instances.map((inst) => (
            <TreeItem
              key={inst.id}
              icon={<Box className="h-3.5 w-3.5" />}
              label={inst.name}
              sublabel={inst.tag ?? inst.component.name}
              active={isSelected({ type: "instance", id: inst.id })}
              onClick={() => onSelect({ type: "instance", id: inst.id })}
            />
          ))}
        </>
      ) : undefined}
    </TreeItem>
  );
}

export function HardwareTree({ plcs, standaloneNetworks = [], ipNetworks = [], selected, onSelect, onAddInstance }: Props) {
  function isSelected(node: SelectedNode) {
    if (!selected) return false;
    if (node.type !== selected.type) return false;
    return node.id === selected.id;
  }

  // Determine the primary PLC for each shared bus (lowest PLC ID among connected PLCs)
  const busPrimaryPlc = new Map<number, number>(); // busId → primary plcId
  for (const plc of plcs) {
    for (const bus of plc.buses) {
      const existing = busPrimaryPlc.get(bus.id);
      if (existing === undefined || plc.id < existing) {
        busPrimaryPlc.set(bus.id, plc.id);
      }
    }
  }

  // For each PLC: primary buses (render fully) vs linked buses (dimmed reference)
  function getPrimaryBuses(plcId: number): Bus[] {
    const plc = plcs.find((p) => p.id === plcId);
    if (!plc) return [];
    return plc.buses.filter((b) => busPrimaryPlc.get(b.id) === plcId);
  }

  function getLinkedBuses(plcId: number): Bus[] {
    const plc = plcs.find((p) => p.id === plcId);
    if (!plc) return [];
    return plc.buses.filter((b) => busPrimaryPlc.get(b.id) !== plcId);
  }

  return (
    <div className="space-y-0.5">
      {/* Networks & unconnected buses */}
      {(ipNetworks.length > 0 || standaloneNetworks.length > 0) && (
        <TreeItem
          icon={<Globe className="h-3.5 w-3.5" />}
          label="Networks & Buses"
          sublabel={`${ipNetworks.length}N ${standaloneNetworks.length}B`}
          defaultOpen
        >
          {ipNetworks.map((net) => (
            <TreeItem
              key={`ipnet-${net.id}`}
              icon={<Network className="h-3.5 w-3.5" />}
              label={net.name ?? `Network #${net.id}`}
              sublabel={net.buses && net.buses.length > 0 ? net.buses.map((b) => b.protocol).join(", ") : undefined}
              active={isSelected({ type: "ipNetwork", id: net.id })}
              onClick={() => onSelect({ type: "ipNetwork", id: net.id })}
            />
          ))}
          {standaloneNetworks.map((net) => (
            <NetworkSubtree key={net.id} net={net} isSelected={isSelected} onSelect={onSelect} onAddInstance={onAddInstance} />
          ))}
        </TreeItem>
      )}

      {/* PLCs with their buses */}
      {plcs.map((plc) => {
        const primaryBuses = getPrimaryBuses(plc.id);
        const linkedBuses = getLinkedBuses(plc.id);
        return (
          <TreeItem
            key={plc.id}
            icon={<Cpu className="h-3.5 w-3.5" />}
            label={plc.name}
            sublabel={plc.catalog?.articleNumber}
            active={isSelected({ type: "plc", id: plc.id })}
            onClick={() => onSelect({ type: "plc", id: plc.id })}
            defaultOpen
          >
            {/* Primary buses — full rendering with carriers and instances */}
            {primaryBuses.map((net) => (
              <NetworkSubtree key={net.id} net={net} plcName={plc.name} isSelected={isSelected} onSelect={onSelect} onAddInstance={onAddInstance} />
            ))}
            {/* Shared buses — dimmed link nodes */}
            {linkedBuses.map((net) => (
              <TreeItem
                key={`link-${net.id}`}
                icon={<ArrowUpRight className="h-3.5 w-3.5 opacity-50" />}
                label={net.protocol}
                sublabel={net.description ?? undefined}
                active={isSelected({ type: "network", id: net.id })}
                onClick={() => onSelect({ type: "network", id: net.id })}
              />
            ))}
            {/* Local carriers are shown in PLC detail panel, not in tree */}
          </TreeItem>
        );
      })}
    </div>
  );
}
