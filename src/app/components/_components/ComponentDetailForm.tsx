"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { COMPONENT_STATUS, BUS_PROTOCOLS } from "@/lib/enums";

const schema = z.object({
  name: z.string().min(1, "Required"),
  parentId: z.number().int().optional().nullable(),
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

export function ComponentDetailForm({ id, onDeleted, onListRefresh }: Props) {
  const [confirmProps, confirmAction] = useConfirm();
  const router = useRouter();
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.components.componentById.useQuery({ id });
  const { data: allComponents = [] } = trpc.components.componentList.useQuery();
  const update = trpc.components.componentUpdate.useMutation({
    onSuccess: () => {
      utils.components.componentList.invalidate();
      utils.components.componentMeta.invalidate({ id });
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

  useEffect(() => {
    if (data) {
      reset({
        name: data.name,
        parentId: data.parentId ?? null,
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
    confirmAction("Delete this component? All signal definitions will be lost.", async () => {
      await remove.mutateAsync({ id });
    });
  }

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!data) return <div className="p-8 text-muted-foreground">Component not found.</div>;

  return (
    <div className="flex flex-col flex-1">
      <div className="p-8 max-w-5xl space-y-8">
        {/* Identity form */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Identity</h2>
          <form onSubmit={handleSubmit(onSaveMeta)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input {...register("name")} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Parent Component</Label>
                <Select
                  key={"parent-" + watch("parentId")}
                  value={watch("parentId") ? String(watch("parentId")) : "__none__"}
                  onValueChange={(v) => setValue("parentId", v === "__none__" ? null : Number(v), { shouldDirty: true })}
                >
                  <SelectTrigger><SelectValue placeholder="None (root)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None (root component)</SelectItem>
                    {allComponents.filter((c) => c.id !== id).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Inherits signals from parent</p>
              </div>
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

      {/* Children */}
      {data.children && data.children.length > 0 && (
        <section className="px-8 py-4 space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Child Components ({data.children.length})
          </h2>
          <div className="rounded border divide-y text-sm">
            {data.children.map((child: any) => (
              <button
                key={child.id}
                type="button"
                onClick={() => router.push(`/components/${child.id}`)}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-accent/30 transition-colors text-left"
              >
                <span className="font-medium text-blue-600 hover:underline">{child.name}</span>
                <span className="text-xs text-muted-foreground">
                  {child._count?.signals ?? 0} signals, {child._count?.instances ?? 0} instances
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Child components inherit this component&apos;s signals. Signals at the same channel offset are overridden.
          </p>
        </section>
      )}

      <ConfirmDialog {...confirmProps} confirmLabel="Delete" />
    </div>
  );
}
