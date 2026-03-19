"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SignalGrid } from "../[id]/_components/SignalGrid";
import { ImportDbcDialog } from "../[id]/_components/ImportDbcDialog";
import { Upload, Network } from "lucide-react";
import { ImportModbusDialog } from "./ImportModbusDialog";
import { COMPONENT_STATUS, BUS_PROTOCOLS } from "@/lib/enums";

const schema = z.object({
  name: z.string().min(1, "Required"),
  manufacturer: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  version: z.string().optional().nullable(),
  functionBlock: z.string().max(100).optional().nullable(),
  busProtocol: z.enum(BUS_PROTOCOLS).optional().nullable(),
  status: z.enum(COMPONENT_STATUS),
  description: z.string().optional().nullable(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  id: number;
  onDeleted: () => void;
  onListRefresh: () => void;
}

export function ComponentDetail({ id, onDeleted, onListRefresh }: Props) {
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [showImportDbc, setShowImportDbc] = useState(false);
  const [showImportModbus, setShowImportModbus] = useState(false);
  const utils = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.components.componentById.useQuery({ id });

  const update = trpc.components.componentUpdate.useMutation({
    onSuccess: () => {
      utils.components.componentList.invalidate();
      onListRefresh();
    },
  });

  const remove = trpc.components.componentDelete.useMutation({
    onSuccess: () => {
      utils.components.componentList.invalidate();
      onDeleted();
    },
  });

  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isDirty } } =
    useForm<FormValues>({
      resolver: zodResolver(schema) as any,
    });

  // Sync form when data loads or changes
  useEffect(() => {
    if (data) {
      reset({
        name: data.name,
        manufacturer: data.manufacturer,
        model: data.model,
        version: data.version,
        functionBlock: data.functionBlock,
        busProtocol: data.busProtocol as FormValues["busProtocol"],
        status: data.status as FormValues["status"],
        description: data.description,
      });
    }
  }, [data, reset]);

  async function onSaveMeta(values: FormValues) {
    setIsSavingMeta(true);
    try {
      await update.mutateAsync({ id, ...values });
      reset(values);
    } finally {
      setIsSavingMeta(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this component? All signal definitions will be lost.")) return;
    await remove.mutateAsync({ id });
  }

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!data) return <div className="p-8 text-muted-foreground">Component not found.</div>;

  return (
    <div className="flex flex-col flex-1">
      <div className="p-8 max-w-5xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold">{data.name}</h1>
          {data.manufacturer && (
            <p className="text-sm text-muted-foreground">{data.manufacturer}{data.model ? ` · ${data.model}` : ""}</p>
          )}
        </div>

        <Separator />

        {/* Identity form */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Identity</h2>
          <form onSubmit={handleSubmit(onSaveMeta)} className="space-y-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Manufacturer</Label>
                <Input {...register("manufacturer")} placeholder="e.g. Grundfos" />
              </div>
              <div className="space-y-1">
                <Label>Model</Label>
                <Input {...register("model")} className="font-mono" />
              </div>
              <div className="space-y-1">
                <Label>Version</Label>
                <Input {...register("version")} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Function Block</Label>
                <Input {...register("functionBlock")} placeholder="e.g. FB_Pump" className="font-mono" />
                <p className="text-xs text-muted-foreground">CODESYS function block name</p>
              </div>
              <div className="space-y-1">
                <Label>Bus Protocol</Label>
                {/* WORKAROUND: key forces remount — Radix Select v2.2.6 doesn't update displayed text on controlled value change (github.com/radix-ui/primitives/issues/3381) */}
                {/* WORKAROUND: __none__ sentinel — Radix Select doesn't allow empty string as value, so nullable fields use a sentinel */}
                <Select
                  key={"bp-" + watch("busProtocol")}
                  value={watch("busProtocol") ?? "__none__"}
                  onValueChange={(v) => setValue("busProtocol", v === "__none__" ? null : v as FormValues["busProtocol"], { shouldDirty: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {BUS_PROTOCOLS.map((p) => (
                      <SelectItem key={p} value={p}>{p.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Bus protocol for all signals</p>
              </div>
              <div className="space-y-1">
                <Label>Min CAN ID Offset</Label>
                <Input value={data.minCanIdOffset ?? "—"} readOnly disabled className="font-mono bg-muted" />
                <p className="text-xs text-muted-foreground">Auto-computed from signal CAN IDs</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Status</Label>
                {/* WORKAROUND: key forces remount — Radix Select v2.2.6 (see busProtocol comment above) */}
                <Select
                  key={"st-" + watch("status")}
                  value={watch("status")}
                  onValueChange={(v) => setValue("status", v as FormValues["status"], { shouldDirty: true })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="DEPRECATED">Deprecated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea {...register("description")} rows={2} />
            </div>

            <div className="flex items-center justify-between pt-1">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
              >
                Delete Component
              </Button>
              <Button type="submit" disabled={!isDirty || isSavingMeta} size="sm">
                {isSavingMeta ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </section>
      </div>

      <div className="border-t" />

      {/* Signal grid — full width */}
      <section className="px-8 py-6 space-y-3 flex-1">
        <div className="flex items-center justify-between max-w-5xl">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Signals</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.signals.length} signal{data.signals.length !== 1 ? "s" : ""} defined
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowImportModbus(true)}>
              <Network className="h-4 w-4 mr-1" /> Import Modbus
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowImportDbc(true)}>
              <Upload className="h-4 w-4 mr-1" /> Import DBC
            </Button>
          </div>
        </div>
        <SignalGrid
          componentId={id}
          signals={data.signals}
          onRefresh={() => refetch()}
        />
      </section>

      {showImportModbus && data && (
        <ImportModbusDialog
          componentId={id}
          componentName={data.name}
          open
          onClose={() => setShowImportModbus(false)}
          onImported={() => {
            refetch();
            setShowImportModbus(false);
          }}
        />
      )}

      {showImportDbc && (
        <ImportDbcDialog
          componentId={id}
          existingChannelCount={data.signals.length}
          open
          onClose={() => setShowImportDbc(false)}
          onImported={() => {
            refetch();
            setShowImportDbc(false);
          }}
        />
      )}
    </div>
  );
}
