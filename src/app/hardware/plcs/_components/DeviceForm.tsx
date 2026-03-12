"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus, ExternalLink, BookOpen } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BUS_PROTOCOLS, PLC_SERIES } from "@/lib/enums";
import { wagoDatasheetUrl } from "@/lib/utils";
import { LifecycleBadge } from "@/components/LifecycleBadge";

export const deviceFormSchema = z.object({
  vendorName: z.string().min(1, "Required"),
  articleNumber: z.string().min(1, "Required"),
  description: z.string().optional().nullable(),
  series: z.string().optional().nullable(),
  generation: z.coerce.number().int().optional().nullable(),
  programMemoryKb: z.coerce.number().int().optional().nullable(),
  ramMemoryKb: z.coerce.number().int().optional().nullable(),
  dataMemoryKb: z.coerce.number().int().optional().nullable(),
  eco: z.boolean().default(false),
  maxModules: z.coerce.number().int().optional().nullable(),
  busPowerBudgetMa: z.coerce.number().int().optional().nullable(),
  supplyVoltageMinV: z.coerce.number().int().optional().nullable(),
  supplyVoltageMaxV: z.coerce.number().int().optional().nullable(),
  internalCurrentMa: z.coerce.number().int().optional().nullable(),
  ipRating: z.string().default("IP20"),
  tempMinC: z.coerce.number().int().optional().nullable(),
  tempMaxC: z.coerce.number().int().optional().nullable(),
  extendedTemp: z.boolean().default(false),
  ethernetPorts: z.coerce.number().int().optional().nullable(),
  dataRateMbit: z.coerce.number().int().optional().nullable(),
  hasSDCard: z.boolean().default(false),
  hasMediaRedundancy: z.boolean().default(false),
  widthMm: z.coerce.number().int().optional().nullable(),
  heightMm: z.coerce.number().int().optional().nullable(),
  depthMm: z.coerce.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
  approvalIds: z.array(z.number().int()).default([]),
  protocols: z.array(z.object({
    protocol: z.enum(BUS_PROTOCOLS),
    baudRateMaxKbit: z.coerce.number().int().optional().nullable(),
    nodeAddressMin: z.coerce.number().int().optional().nullable(),
    nodeAddressMax: z.coerce.number().int().optional().nullable(),
  })).default([]),
});

export type DeviceFormValues = z.infer<typeof deviceFormSchema>;

type Approval = { id: number; code: string; name: string };

interface DeviceFormProps {
  defaultValues?: Partial<DeviceFormValues>;
  approvals: Approval[];
  onSubmit: (values: DeviceFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
  isSubmitting?: boolean;
  showPLCFields?: boolean;
  lifecycleStatus?: string;
  successorArticle?: string | null;
  manualUrl?: string | null;
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function DeviceForm({
  defaultValues,
  approvals,
  onSubmit,
  onDelete,
  isSubmitting,
  showPLCFields = true,
  lifecycleStatus,
  successorArticle,
  manualUrl,
}: DeviceFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<DeviceFormValues>({
    resolver: zodResolver(deviceFormSchema),
    defaultValues: {
      vendorName: "",
      articleNumber: "",
      eco: false,
      extendedTemp: false,
      hasSDCard: false,
      hasMediaRedundancy: false,
      ipRating: "IP20",
      approvalIds: [],
      protocols: [],
      ...defaultValues,
    },
  });

  const { fields: protocolFields, append: appendProtocol, remove: removeProtocol } =
    useFieldArray({ control, name: "protocols" });

  const selectedApprovalIds = watch("approvalIds");

  function toggleApproval(id: number) {
    const current = selectedApprovalIds ?? [];
    if (current.includes(id)) {
      setValue("approvalIds", current.filter((c) => c !== id));
    } else {
      setValue("approvalIds", [...current, id]);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Lifecycle + Documentation banner */}
      {(lifecycleStatus && lifecycleStatus !== "ACTIVE" && lifecycleStatus !== "UNKNOWN") && (
        <div className="flex items-center gap-3 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm">
          <LifecycleBadge status={lifecycleStatus} />
          {successorArticle && (
            <span className="text-yellow-800">Successor: <strong className="font-mono">{successorArticle}</strong></span>
          )}
        </div>
      )}
      {manualUrl && (
        <a
          href={manualUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <BookOpen className="h-4 w-4" /> View Manual
        </a>
      )}
      {/* Identity */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Identity</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Vendor" >
            <Input {...register("vendorName")} placeholder="e.g. Wago" />
            {errors.vendorName && <p className="text-xs text-destructive">{errors.vendorName.message}</p>}
          </Field>
          <Field label="Article Number">
            <div className="flex gap-2 items-center">
              <Input {...register("articleNumber")} placeholder="e.g. 750-891" className="font-mono" />
              {wagoDatasheetUrl(watch("articleNumber") ?? "") && (
                <a
                  href={wagoDatasheetUrl(watch("articleNumber") ?? "")!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  title="Open WAGO datasheet"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
            {errors.articleNumber && <p className="text-xs text-destructive">{errors.articleNumber.message}</p>}
          </Field>
        </div>
        <Field label="Description">
          <Input {...register("description")} placeholder="Short description" />
        </Field>
        {showPLCFields && (
          <Field label="Product Family">
            <Select
              value={watch("series") ?? ""}
              onValueChange={(v) => setValue("series", v || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select product family…" />
              </SelectTrigger>
              <SelectContent>
                {PLC_SERIES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </section>

      <Separator />

      {/* IO Bus */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">IO Bus</h2>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Max Modules">
            <Input type="number" {...register("maxModules")} />
          </Field>
          <Field label="Bus Power Budget (mA)">
            <Input type="number" {...register("busPowerBudgetMa")} />
          </Field>
          {showPLCFields && (
            <Field label="Generation">
              <Input type="number" {...register("generation")} />
            </Field>
          )}
        </div>
        {showPLCFields && (
          <div className="grid grid-cols-3 gap-4">
            <Field label="Program Memory (KB)">
              <Input type="number" {...register("programMemoryKb")} />
            </Field>
            <Field label="RAM Memory (KB)">
              <Input type="number" {...register("ramMemoryKb")} />
            </Field>
            <Field label="Data Memory (KB)">
              <Input type="number" {...register("dataMemoryKb")} />
            </Field>
          </div>
        )}
        <div className="flex gap-6">
          <CheckboxField label="ECO variant" checked={watch("eco")} onChange={(v) => setValue("eco", v)} />
        </div>
      </section>

      <Separator />

      {/* Network */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Network</h2>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Ethernet Ports">
            <Input type="number" {...register("ethernetPorts")} />
          </Field>
          <Field label="Data Rate (Mbit/s)">
            <Input type="number" {...register("dataRateMbit")} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-6">
          <CheckboxField label="SD Card" checked={watch("hasSDCard")} onChange={(v) => setValue("hasSDCard", v)} />
          <CheckboxField label="Media Redundancy" checked={watch("hasMediaRedundancy")} onChange={(v) => setValue("hasMediaRedundancy", v)} />
        </div>
      </section>

      <Separator />

      {/* Protocols */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Supported Protocols</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => appendProtocol({ protocol: "MODBUS_TCP", baudRateMaxKbit: null, nodeAddressMin: null, nodeAddressMax: null })}
          >
            <Plus className="mr-1 h-3 w-3" />
            Add Protocol
          </Button>
        </div>
        {protocolFields.map((field, index) => (
          <div key={field.id} className="flex items-end gap-3 rounded-md border p-3">
            <Field label="Protocol">
              <Select
                value={watch(`protocols.${index}.protocol`)}
                onValueChange={(v) => setValue(`protocols.${index}.protocol`, v as typeof BUS_PROTOCOLS[number])}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUS_PROTOCOLS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Baud Rate Max (kbit/s)">
              <Input type="number" className="w-32" {...register(`protocols.${index}.baudRateMaxKbit`)} />
            </Field>
            <Field label="Node Addr Min">
              <Input type="number" className="w-24" {...register(`protocols.${index}.nodeAddressMin`)} />
            </Field>
            <Field label="Node Addr Max">
              <Input type="number" className="w-24" {...register(`protocols.${index}.nodeAddressMax`)} />
            </Field>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mb-0.5 shrink-0"
              onClick={() => removeProtocol(index)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </section>

      <Separator />

      {/* Power */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Power Supply</h2>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Supply Voltage Min (V)">
            <Input type="number" {...register("supplyVoltageMinV")} />
          </Field>
          <Field label="Supply Voltage Max (V)">
            <Input type="number" {...register("supplyVoltageMaxV")} />
          </Field>
          <Field label="Internal Current (mA)">
            <Input type="number" {...register("internalCurrentMa")} />
          </Field>
        </div>
      </section>

      <Separator />

      {/* Environmental */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Environmental</h2>
        <div className="grid grid-cols-3 gap-4">
          <Field label="IP Rating">
            <Input {...register("ipRating")} placeholder="IP20" />
          </Field>
          <Field label="Temp Min (°C)">
            <Input type="number" {...register("tempMinC")} />
          </Field>
          <Field label="Temp Max (°C)">
            <Input type="number" {...register("tempMaxC")} />
          </Field>
        </div>
        <CheckboxField label="Extended Temperature" checked={watch("extendedTemp")} onChange={(v) => setValue("extendedTemp", v)} />
      </section>

      <Separator />

      {/* Physical */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Physical Dimensions</h2>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Width (mm)">
            <Input type="number" {...register("widthMm")} />
          </Field>
          <Field label="Height (mm)">
            <Input type="number" {...register("heightMm")} />
          </Field>
          <Field label="Depth (mm)">
            <Input type="number" {...register("depthMm")} />
          </Field>
        </div>
      </section>

      <Separator />

      {/* Approvals */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Approvals</h2>
        <div className="flex flex-wrap gap-3">
          {approvals.map((cert) => (
            <label key={cert.id} className="flex items-center gap-2 text-sm cursor-pointer rounded-md border px-3 py-2 hover:bg-accent/50">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={(selectedApprovalIds ?? []).includes(cert.id)}
                onChange={() => toggleApproval(cert.id)}
              />
              <span className="font-mono font-medium">{cert.code}</span>
              <span className="text-muted-foreground text-xs">{cert.name}</span>
            </label>
          ))}
        </div>
      </section>

      <Separator />

      {/* Notes */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Notes</h2>
        <textarea
          {...register("notes")}
          rows={3}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Additional notes…"
        />
      </section>

      <div className="flex items-center justify-between pt-2">
        {onDelete ? (
          <Button type="button" variant="destructive" onClick={onDelete}>
            Delete
          </Button>
        ) : (
          <div />
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
