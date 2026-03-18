"use client";

import { useState } from "react";
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
import { COMPONENT_STATUS, BUS_PROTOCOLS } from "@/lib/enums";

const schema = z.object({
  name: z.string().min(1, "Required"),
  manufacturer: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  version: z.string().optional().nullable(),
  functionBlock: z.string().max(100).optional().nullable(),
  busProtocol: z.enum(BUS_PROTOCOLS).optional().nullable(),
  status: z.enum(COMPONENT_STATUS).default("DRAFT"),
  description: z.string().optional().nullable(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  onCreated: (id: number) => void;
  onCancel: () => void;
}

export function ComponentCreateForm({ onCreated, onCancel }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const utils = trpc.useUtils();

  const create = trpc.components.componentCreate.useMutation({
    onSuccess: (data) => {
      utils.components.componentList.invalidate();
      onCreated(data.id);
    },
  });

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { status: "DRAFT" },
  });

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    try {
      await create.mutateAsync(values);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">New Component</h1>
        <p className="text-sm text-muted-foreground">Define a reusable field device</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1">
          <Label>Name</Label>
          <Input {...register("name")} placeholder="e.g. Grundfos CRE Pump" />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Manufacturer</Label>
            <Input {...register("manufacturer")} placeholder="e.g. Grundfos" />
          </div>
          <div className="space-y-1">
            <Label>Model</Label>
            <Input {...register("model")} placeholder="e.g. CRE 3-2" className="font-mono" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Version</Label>
            <Input {...register("version")} placeholder="e.g. 1.0" />
          </div>
          <div className="space-y-1">
            <Label>Function Block</Label>
            <Input {...register("functionBlock")} placeholder="e.g. FB_Pump" className="font-mono" />
          </div>
          <div className="space-y-1">
            <Label>Bus Protocol</Label>
            {/* WORKAROUND: key forces remount — Radix Select v2.2.6 doesn't update displayed text on controlled value change (github.com/radix-ui/primitives/issues/3381) */}
            {/* WORKAROUND: __none__ sentinel — Radix Select doesn't allow empty string as value, so nullable fields use a sentinel */}
            <Select
              key={"bp-" + watch("busProtocol")}
              value={watch("busProtocol") ?? "__none__"}
              onValueChange={(v) => setValue("busProtocol", v === "__none__" ? null : v as FormValues["busProtocol"])}
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
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Status</Label>
            {/* WORKAROUND: key forces remount — Radix Select v2.2.6 (see busProtocol comment above) */}
            <Select
              key={"st-" + watch("status")}
              value={watch("status")}
              onValueChange={(v) => setValue("status", v as FormValues["status"])}
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
          <Textarea {...register("description")} rows={3} placeholder="Optional description…" />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create & Edit Signals"}
          </Button>
        </div>
      </form>
    </div>
  );
}
