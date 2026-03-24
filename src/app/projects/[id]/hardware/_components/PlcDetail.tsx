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
import { Trash2, ExternalLink } from "lucide-react";
import { CardList } from "./CardList";
import { PortNetworkEditor } from "./PortNetworkEditor";
import { wagoDatasheetUrl } from "@/lib/utils";
import type { Plc, Bus, IoCard, Carrier, Port } from "@/lib/types/hardware";

const schema = z.object({
  name: z.string().min(1, "Required"),
  notes: z.string().optional().nullable(),
});
type FormValues = z.infer<typeof schema>;

type Props = {
  plc: Plc;
  projectId: number;
  onRefresh: () => void;
};

export function PlcDetail({ plc, projectId, onRefresh }: Props) {
  const update = trpc.projectHardware.plcUpdate.useMutation({ onSuccess: onRefresh });
  const deletePlc = trpc.projectHardware.plcDelete.useMutation({ onSuccess: onRefresh });
  const plcPortSave = trpc.projectHardware.plcPortSave.useMutation({ onSuccess: onRefresh });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
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

      {/* Ethernet Ports — IP network configuration */}
      {plc.catalog?.ethernetPorts != null && plc.catalog.ethernetPorts > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Ethernet Ports
          </h3>
          <div className="space-y-2">
            {Array.from({ length: plc.catalog.ethernetPorts }, (_, i) => {
              const port = (plc.ports ?? []).find((p) => p.portNumber === i);
              return (
                <PortNetworkEditor
                  key={i}
                  portNumber={i}
                  port={port ?? null}
                  projectId={projectId}
                  plcId={plc.id}
                  onSave={(data) => plcPortSave.mutate({ plcId: plc.id, portNumber: i, ...data })}
                  saving={plcPortSave.isPending}
                />
              );
            })}
          </div>
        </div>
      )}

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
              <CardList
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

