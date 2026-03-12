"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Cpu, Network, Server, Box, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type IoCard = {
  id: number;
  slotPosition: number;
  cardType: string;
  name: string | null;
  deletedAt: Date | null;
  catalog: { id: number; articleNumber: string; vendorName: string; cardType: string; maxInputChannels: number | null; maxOutputChannels: number | null; approvals: { approvalId: number }[] } | null;
};

type Carrier = {
  id: number;
  name: string;
  plcNetworkId: number | null;
  deletedAt: Date | null;
  catalog: { id: number; articleNumber: string; vendorName: string; maxModules: number | null } | null;
  cards: IoCard[];
};

type ComponentInstance = {
  id: number;
  name: string;
  tag: string | null;
  component: { id: number; name: string; manufacturer: string | null; model: string | null };
};

type PlcNetwork = {
  id: number;
  protocol: string;
  role: string;
  nodeAddress: number | null;
  description: string | null;
  ioCard: { slotPosition: number } | null;
  carriers: Carrier[];
  instances: ComponentInstance[];
};

type Plc = {
  id: number;
  name: string;
  deletedAt: Date | null;
  catalog: { id: number; articleNumber: string; vendorName: string; maxModules: number | null; busPowerBudgetMa: number | null } | null;
  networks: PlcNetwork[];
  carriers: Carrier[];
};

type SelectedNode =
  | { type: "plc"; id: number }
  | { type: "network"; id: number; plcId: number }
  | { type: "carrier"; id: number }
  | { type: "instance"; id: number };

type Props = {
  plcs: Plc[];
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

export function HardwareTree({ plcs, selected, onSelect, onAddInstance }: Props) {
  function isSelected(node: SelectedNode) {
    if (!selected) return false;
    if (node.type !== selected.type) return false;
    return node.id === selected.id;
  }

  return (
    <div className="space-y-0.5">
      {plcs.map((plc) => (
        <TreeItem
          key={plc.id}
          icon={<Cpu className="h-3.5 w-3.5" />}
          label={plc.name}
          sublabel={plc.catalog?.articleNumber}
          active={isSelected({ type: "plc", id: plc.id })}
          onClick={() => onSelect({ type: "plc", id: plc.id })}
          defaultOpen
        >
          {plc.networks.map((net) => {
            const host = net.ioCard
              ? `${plc.name}:${net.ioCard.slotPosition + 1}`
              : plc.name;
            const hasNetChildren = net.carriers.length > 0 || net.instances.length > 0;
            return (
              <TreeItem
                key={net.id}
                icon={<Network className="h-3.5 w-3.5" />}
                label={net.protocol}
                sublabel={host}
                active={isSelected({ type: "network", id: net.id, plcId: plc.id })}
                onClick={() => onSelect({ type: "network", id: net.id, plcId: plc.id })}
                defaultOpen
                onAdd={() => onAddInstance(net.id)}
              >
                {hasNetChildren ? (
                  <>
                    {net.carriers.map((carrier) => (
                      <TreeItem
                        key={carrier.id}
                        icon={<Server className="h-3.5 w-3.5" />}
                        label={carrier.name}
                        sublabel={carrier.catalog?.articleNumber}
                        active={isSelected({ type: "carrier", id: carrier.id })}
                        onClick={() => onSelect({ type: "carrier", id: carrier.id })}
                      />
                    ))}
                    {net.instances.map((inst) => (
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
          })}
          {plc.carriers.map((carrier) => (
            <TreeItem
              key={carrier.id}
              icon={<Server className="h-3.5 w-3.5" />}
              label={carrier.name}
              sublabel={carrier.catalog?.articleNumber}
              active={isSelected({ type: "carrier", id: carrier.id })}
              onClick={() => onSelect({ type: "carrier", id: carrier.id })}
            />
          ))}
        </TreeItem>
      ))}
    </div>
  );
}
