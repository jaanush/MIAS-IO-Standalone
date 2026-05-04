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
import { CardList } from "./CardList";
import { PortNetworkEditor } from "./PortNetworkEditor";
import { KbusHealthCheck } from "./KbusHealthCheck";
import { RackStripView } from "./RackStripView";
import { wagoDatasheetUrl } from "@/lib/utils";
import type { Carrier, Plc } from "@/lib/types/hardware";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";

const schema = z.object({
  name: z.string().min(1, "Required"),
  cabinetNumber: z.coerce.number().int().min(1).max(9).optional().nullable(),
  carrierNumber: z.coerce.number().int().min(1).max(99).optional().nullable(),
  firmwareVersion: z.string().optional().nullable(),
  modbusInputBase: z.coerce.number().int().optional().nullable(),
  modbusOutputBase: z.coerce.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
});
type FormValues = z.infer<typeof schema>;

type Props = {
  carrier: Carrier;
  projectId: number;
  /** Parent PLC (the one this carrier is attached to). Drives the K-bus
   *  health check — the calculator aggregates every local carrier on the
   *  parent PLC, since they all share the same K-bus chain. */
  parentPlc?: Plc | null;
  onRefresh: () => void;
};

export function CarrierDetail({ carrier, projectId, parentPlc, onRefresh }: Props) {
  const [confirmProps, confirm] = useConfirm();
  const update = trpc.projectHardware.carrierUpdate.useMutation({ onSuccess: onRefresh });
  const deleteCarrier = trpc.projectHardware.carrierDelete.useMutation({ onSuccess: onRefresh });
  const carrierPortSave = trpc.projectHardware.carrierPortSave.useMutation({ onSuccess: onRefresh });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: carrier.name,
      cabinetNumber: carrier.cabinetNumber ?? undefined,
      carrierNumber: carrier.carrierNumber ?? undefined,
      firmwareVersion: carrier.firmwareVersion ?? "",
      modbusInputBase: carrier.modbusInputBase ?? undefined,
      modbusOutputBase: carrier.modbusOutputBase ?? undefined,
      notes: carrier.notes ?? "",
    },
  });

  useEffect(() => {
    reset({
      name: carrier.name,
      cabinetNumber: carrier.cabinetNumber ?? undefined,
      carrierNumber: carrier.carrierNumber ?? undefined,
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
          onClick={() => confirm("Delete this carrier? This cannot be undone.", () => deleteCarrier.mutate({ id: carrier.id }))}
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
            <Label>Cabinet Number (1-9)</Label>
            <Input type="number" min={1} max={9} {...register("cabinetNumber")} placeholder="e.g. 3" />
          </div>
          <div className="space-y-1">
            <Label>Carrier Number (1-99)</Label>
            <Input type="number" min={1} max={99} {...register("carrierNumber")} placeholder="e.g. 3" />
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
              const port = (carrier.ports ?? []).find((p) => p.portNumber === i);
              return (
                <PortNetworkEditor
                  key={i}
                  portNumber={i}
                  port={port ?? null}
                  projectId={projectId}
                  carrierId={carrier.id}
                  onSave={(data) => carrierPortSave.mutate({ carrierId: carrier.id, portNumber: i, ...data })}
                  saving={carrierPortSave.isPending}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Rack front view — coupler anchor + this carrier's modules */}
      <RackStripView plc={parentPlc ?? null} carrier={carrier} />

      {/* Card list */}
      <CardList
        carrierId={carrier.id}
        projectId={projectId}
        maxSlots={carrier.catalog?.maxModules ?? null}
        cards={carrier.cards}
        onRefresh={onRefresh}
      />

      {/* K-bus health check — only on the local-bus chain (carriers attached
          directly to a PLC's K-bus, not on a remote fieldbus coupler). */}
      {carrier.busId == null && parentPlc && <KbusHealthCheck plc={parentPlc} />}

      <ConfirmDialog {...confirmProps} confirmLabel="Delete" />
    </div>
  );
}

