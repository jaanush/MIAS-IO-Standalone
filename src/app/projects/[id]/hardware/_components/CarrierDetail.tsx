"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, ExternalLink } from "lucide-react";
import { SlotGrid } from "./SlotGrid";
import { wagoDatasheetUrl } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1, "Required"),
  ipAddress: z.string().optional().nullable(),
  nodeAddress: z.coerce.number().int().optional().nullable(),
  firmwareVersion: z.string().optional().nullable(),
  modbusInputBase: z.coerce.number().int().optional().nullable(),
  modbusOutputBase: z.coerce.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
});
type FormValues = z.infer<typeof schema>;

type Network = {
  id: number;
  protocol: string;
  role: string;
  nodeAddress: number | null;
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
    approvals: { approvalId: number }[];
  } | null;
};

type Carrier = {
  id: number;
  name: string;
  ipAddress?: string | null;
  nodeAddress?: number | null;
  firmwareVersion?: string | null;
  modbusInputBase?: number | null;
  modbusOutputBase?: number | null;
  notes?: string | null;
  deletedAt: Date | null;
  catalog: {
    id: number;
    articleNumber: string;
    vendorName: string;
    maxModules: number | null;
    ethernetPorts: number | null;
  } | null;
  cards: IoCard[];
  ports: Port[];
};

type Props = {
  carrier: Carrier;
  projectId: number;
  networks: Network[];
  onRefresh: () => void;
};

export function CarrierDetail({ carrier, projectId, networks, onRefresh }: Props) {
  const update = trpc.projectHardware.carrierUpdate.useMutation({ onSuccess: onRefresh });
  const deleteCarrier = trpc.projectHardware.carrierDelete.useMutation({ onSuccess: onRefresh });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: carrier.name,
      ipAddress: carrier.ipAddress ?? "",
      nodeAddress: carrier.nodeAddress ?? undefined,
      firmwareVersion: carrier.firmwareVersion ?? "",
      modbusInputBase: carrier.modbusInputBase ?? undefined,
      modbusOutputBase: carrier.modbusOutputBase ?? undefined,
      notes: carrier.notes ?? "",
    },
  });

  useEffect(() => {
    reset({
      name: carrier.name,
      ipAddress: carrier.ipAddress ?? "",
      nodeAddress: carrier.nodeAddress ?? undefined,
      firmwareVersion: carrier.firmwareVersion ?? "",
      modbusInputBase: carrier.modbusInputBase ?? undefined,
      modbusOutputBase: carrier.modbusOutputBase ?? undefined,
      notes: carrier.notes ?? "",
    });
  }, [carrier, reset]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{carrier.name}</h2>
          {carrier.catalog && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              {carrier.catalog.vendorName} — {carrier.catalog.articleNumber}
              {wagoDatasheetUrl(carrier.catalog.articleNumber) && (
                <a
                  href={wagoDatasheetUrl(carrier.catalog.articleNumber)!}
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
            if (confirm("Delete this carrier? This cannot be undone.")) deleteCarrier.mutate({ id: carrier.id });
          }}
        >
          <Trash2 className="h-4 w-4 mr-1" /> Delete
        </Button>
      </div>

      {/* Edit form */}
      <form onSubmit={handleSubmit((v) => update.mutate({ id: carrier.id, ...v }))} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1 col-span-2">
            <Label>Name</Label>
            <Input {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>IP Address</Label>
            <Input {...register("ipAddress")} placeholder="192.168.1.20" />
          </div>
          <div className="space-y-1">
            <Label>Node Address</Label>
            <Input type="number" {...register("nodeAddress")} />
          </div>
          <div className="space-y-1">
            <Label>Firmware Version</Label>
            <Input {...register("firmwareVersion")} placeholder="e.g. 3.1.0" />
          </div>
          <div className="space-y-1">
            <Label>Modbus Input Base Word</Label>
            <Input type="number" {...register("modbusInputBase")} placeholder="e.g. 100" />
          </div>
          <div className="space-y-1">
            <Label>Modbus Output Base Word</Label>
            <Input type="number" {...register("modbusOutputBase")} placeholder="e.g. 100" />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Input {...register("notes")} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={!isDirty || update.isPending}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>

      {/* Ethernet Ports */}
      {carrier.catalog?.ethernetPorts != null && carrier.catalog.ethernetPorts > 1 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Ethernet Ports
          </h3>
          <div className="space-y-2">
            {Array.from({ length: carrier.catalog.ethernetPorts }, (_, i) => {
              const port = carrier.ports.find((p) => p.portNumber === i);
              return (
                <CarrierPortRow
                  key={i}
                  portNumber={i}
                  port={port ?? null}
                  networks={networks}
                  carrierId={carrier.id}
                  onRefresh={onRefresh}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Slot grid */}
      <SlotGrid
        carrierId={carrier.id}
        projectId={projectId}
        maxSlots={carrier.catalog?.maxModules ?? null}
        cards={carrier.cards}
        onRefresh={onRefresh}
      />
    </div>
  );
}

function CarrierPortRow({
  portNumber,
  port,
  networks,
  carrierId,
  onRefresh,
}: {
  portNumber: number;
  port: Port | null;
  networks: Network[];
  carrierId: number;
  onRefresh: () => void;
}) {
  const save = trpc.projectHardware.carrierPortSave.useMutation({ onSuccess: onRefresh });
  const [ip, setIp] = useState(port?.ipAddress ?? "");
  const [networkId, setNetworkId] = useState<string>(String(port?.plcNetworkId ?? ""));
  const [label, setLabel] = useState(port?.label ?? "");

  useEffect(() => {
    setIp(port?.ipAddress ?? "");
    setNetworkId(String(port?.plcNetworkId ?? ""));
    setLabel(port?.label ?? "");
  }, [port]);

  const isDirty =
    ip !== (port?.ipAddress ?? "") ||
    networkId !== String(port?.plcNetworkId ?? "") ||
    label !== (port?.label ?? "");

  return (
    <div className="rounded-md border px-3 py-2">
      <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 items-end">
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
          <Input
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="192.168.1.20"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Bus / Network</Label>
          <select
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm h-8"
            value={networkId}
            onChange={(e) => setNetworkId(e.target.value)}
          >
            <option value="">— None —</option>
            {networks.map((n) => (
              <option key={n.id} value={n.id}>
                {n.protocol} / {n.role}
                {n.nodeAddress != null ? ` (Node ${n.nodeAddress})` : ""}
              </option>
            ))}
          </select>
        </div>
        <Button
          size="sm"
          className="h-8"
          disabled={!isDirty || save.isPending}
          onClick={() =>
            save.mutate({
              carrierId,
              portNumber,
              label: label || null,
              ipAddress: ip || null,
              plcNetworkId: networkId ? Number(networkId) : null,
            })
          }
        >
          {save.isPending ? "…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
