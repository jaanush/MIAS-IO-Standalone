"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Trash2, ExternalLink, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BUS_PROTOCOLS, CARD_TYPES, DIAGNOSTIC_TYPES } from "@/lib/enums";
import { wagoDatasheetUrl } from "@/lib/utils";
import { LifecycleBadge } from "@/components/LifecycleBadge";

export const CARD_TYPE_OPTIONS = [
  { value: "DI", label: "DI — Digital Input" },
  { value: "DO", label: "DO — Digital Output" },
  { value: "AI", label: "AI — Analog Input" },
  { value: "AO", label: "AO — Analog Output" },
  { value: "MIXED", label: "Mixed" },
  { value: "COUNTER", label: "Counter" },
  { value: "PWM", label: "PWM" },
  { value: "SERIAL", label: "Serial" },
  { value: "IO_LINK", label: "IO-Link" },
  { value: "SUPPLY", label: "Supply" },
  { value: "RELAY", label: "Relay" },
] as const;

export const moduleSchema = z.object({
  vendorName: z.string().min(1, "Required"),
  articleNumber: z.string().min(1, "Required"),
  description: z.string().optional().nullable(),
  cardType: z.enum(CARD_TYPES),
  maxInputChannels: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).nullable().optional()),
  maxOutputChannels: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).nullable().optional()),
  bitResolution: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().positive().nullable().optional()),
  supplyVoltageField: z.string().optional().nullable(),
  filterTimeMs: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().nullable().optional()),
  galvanicIsolation: z.boolean().optional().nullable(),
  isolationVoltageV: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().nullable().optional()),
  tempMinC: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().nullable().optional()),
  tempMaxC: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().nullable().optional()),
  maxChannelCurrentMa: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().nullable().optional()),
  shortCircuitProtected: z.boolean().default(false),
  providesNetwork: z.boolean().default(false),
  protocols: z.array(z.enum(BUS_PROTOCOLS)).default([]),
  ipRating: z.string().default("IP20"),
  moduleWidthMm: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().positive().nullable().optional()),
  signalRange: z.string().optional().nullable(),
  busCurrentConsumptionMa: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().nullable().optional()),
  fieldCurrentConsumptionMa: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().nullable().optional()),
  approvalIds: z.array(z.number().int()).default([]),
  conversionTimeMs: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().nullable().optional()),
  notes: z.string().optional().nullable(),
  hasDiagnostics: z.boolean().default(false),
  diagnosticType: z.enum(DIAGNOSTIC_TYPES).default("NONE"),
  diagnosticBitsPerChannel: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(1).nullable().optional()),
});

export type ModuleFormValues = z.infer<typeof moduleSchema>;

type Approval = { id: number; code: string; name: string };

type Props = {
  defaultValues?: Partial<ModuleFormValues>;
  approvals?: Approval[];
  onSubmit: (values: ModuleFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
  isSubmitting?: boolean;
  lifecycleStatus?: string;
  successorArticle?: string | null;
  manualUrl?: string | null;
};

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border border-input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}

export function ModuleForm({ defaultValues, approvals = [], onSubmit, onDelete, isSubmitting, lifecycleStatus, successorArticle, manualUrl }: Props) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ModuleFormValues>({
    resolver: zodResolver(moduleSchema) as any,
    defaultValues: {
      shortCircuitProtected: false,
      providesNetwork: false,
      galvanicIsolation: true,
      ipRating: "IP20",
      approvalIds: [],
      ...defaultValues,
    },
  });

  const selectedApprovalIds = watch("approvalIds") ?? [];
  function toggleApproval(id: number) {
    if (selectedApprovalIds.includes(id)) {
      setValue("approvalIds", selectedApprovalIds.filter((c) => c !== id));
    } else {
      setValue("approvalIds", [...selectedApprovalIds, id]);
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Identity</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Vendor" error={errors.vendorName?.message}>
            <Input {...register("vendorName")} placeholder="e.g. Wago" />
          </Field>
          <Field label="Article Number" error={errors.articleNumber?.message}>
            <div className="flex gap-2 items-center">
              <Input {...register("articleNumber")} placeholder="e.g. 750-430" />
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
          </Field>
        </div>
        <Field label="Description" error={errors.description?.message}>
          <Input {...register("description")} placeholder="Short description" />
        </Field>
      </section>

      {/* Type & Channels */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Module Type</h2>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Card Type" error={errors.cardType?.message}>
            <Select
              value={watch("cardType")}
              onValueChange={(v) => setValue("cardType", v as ModuleFormValues["cardType"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {CARD_TYPE_OPTIONS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Max Input Ch." error={errors.maxInputChannels?.message}>
            <Input type="number" {...register("maxInputChannels")} placeholder="e.g. 4" />
          </Field>
          <Field label="Max Output Ch." error={errors.maxOutputChannels?.message}>
            <Input type="number" {...register("maxOutputChannels")} placeholder="e.g. 4" />
          </Field>
          <Field label="Bit Resolution" error={errors.bitResolution?.message}>
            <Input type="number" {...register("bitResolution")} placeholder="e.g. 16" />
          </Field>
          <Field label="Module Width (mm)" error={errors.moduleWidthMm?.message}>
            <Input type="number" {...register("moduleWidthMm")} placeholder="e.g. 12" />
          </Field>
          <Field label="Signal Range" error={errors.signalRange?.message}>
            <Input {...register("signalRange")} placeholder="e.g. 4–20 mA" />
          </Field>
        </div>
        <div className="space-y-3 pt-1">
          <CheckField
            label="Provides network"
            checked={!!watch("providesNetwork")}
            onChange={(v) => {
              setValue("providesNetwork", v);
              if (!v) setValue("protocols", []);
            }}
          />
          {watch("providesNetwork") && (
            <div className="space-y-1">
              <Label className="text-xs">Supported Protocols</Label>
              <div className="flex flex-wrap gap-2">
                {BUS_PROTOCOLS.map((p) => {
                  const selected = (watch("protocols") ?? []).includes(p);
                  return (
                    <label
                      key={p}
                      className="flex items-center gap-1.5 cursor-pointer rounded border px-2.5 py-1 text-xs hover:bg-accent/50"
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5"
                        checked={selected}
                        onChange={() => {
                          const cur = watch("protocols") ?? [];
                          setValue(
                            "protocols",
                            selected ? cur.filter((x) => x !== p) : [...cur, p]
                          );
                        }}
                      />
                      {p}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Electrical */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Electrical</h2>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Supply Voltage Field" error={errors.supplyVoltageField?.message}>
            <Input {...register("supplyVoltageField")} placeholder="e.g. 24 VDC" />
          </Field>
          <Field label="Filter Time (ms)" error={errors.filterTimeMs?.message}>
            <Input type="number" step="0.001" {...register("filterTimeMs")} />
          </Field>
          <Field label="Conversion Time (ms)" error={errors.conversionTimeMs?.message}>
            <Input type="number" step="0.01" {...register("conversionTimeMs")} />
          </Field>
          <Field label="Max Channel Current (mA)" error={errors.maxChannelCurrentMa?.message}>
            <Input type="number" {...register("maxChannelCurrentMa")} />
          </Field>
          <Field label="Bus Current (mA)" error={errors.busCurrentConsumptionMa?.message}>
            <Input type="number" {...register("busCurrentConsumptionMa")} />
          </Field>
          <Field label="Field Current (mA)" error={errors.fieldCurrentConsumptionMa?.message}>
            <Input type="number" {...register("fieldCurrentConsumptionMa")} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-6 pt-1">
          <CheckField
            label="Short circuit protected"
            checked={!!watch("shortCircuitProtected")}
            onChange={(v) => setValue("shortCircuitProtected", v)}
          />
        </div>
      </section>

      {/* Diagnostics */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Diagnostics</h2>
        <div className="flex flex-wrap gap-6 pt-1">
          <CheckField
            label="Has diagnostics"
            checked={!!watch("hasDiagnostics")}
            onChange={(v) => {
              setValue("hasDiagnostics", v);
              if (!v) {
                setValue("diagnosticType", "NONE");
                setValue("diagnosticBitsPerChannel", null);
              }
            }}
          />
        </div>
        {watch("hasDiagnostics") && (
          <div className="grid grid-cols-3 gap-4">
            <Field label="Diagnostic Type" error={errors.diagnosticType?.message}>
              <Select
                value={watch("diagnosticType") ?? "NONE"}
                onValueChange={(v) => {
                  setValue("diagnosticType", v as "NONE" | "DIGITAL_PAIRED" | "ANALOG_STATUS_BYTE");
                  if (v === "DIGITAL_PAIRED") setValue("diagnosticBitsPerChannel", 1);
                  else if (v === "ANALOG_STATUS_BYTE") setValue("diagnosticBitsPerChannel", 8);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIGITAL_PAIRED">Digital Paired</SelectItem>
                  <SelectItem value="ANALOG_STATUS_BYTE">Analog Status Byte</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Diag Bits / Channel" error={errors.diagnosticBitsPerChannel?.message}>
              <Input type="number" {...register("diagnosticBitsPerChannel")} />
            </Field>
          </div>
        )}
      </section>

      {/* Protection & Ratings */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Protection & Ratings</h2>
        <div className="grid grid-cols-3 gap-4">
          <Field label="IP Rating" error={errors.ipRating?.message}>
            <Input {...register("ipRating")} placeholder="IP20" />
          </Field>
          <Field label="Isolation Voltage (V)" error={errors.isolationVoltageV?.message}>
            <Input type="number" {...register("isolationVoltageV")} />
          </Field>
          <Field label="Temp Min (°C)" error={errors.tempMinC?.message}>
            <Input type="number" {...register("tempMinC")} placeholder="-20" />
          </Field>
          <Field label="Temp Max (°C)" error={errors.tempMaxC?.message}>
            <Input type="number" {...register("tempMaxC")} placeholder="55" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-6 pt-1">
          <CheckField
            label="Galvanic isolation"
            checked={watch("galvanicIsolation") ?? false}
            onChange={(v) => setValue("galvanicIsolation", v)}
          />
        </div>
      </section>

      {/* Approvals */}
      {approvals.length > 0 && (
        <>
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Approvals</h2>
            <div className="flex flex-wrap gap-3">
              {approvals.map((cert) => (
                <label key={cert.id} className="flex items-center gap-2 text-sm cursor-pointer rounded-md border px-3 py-2 hover:bg-accent/50">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={selectedApprovalIds.includes(cert.id)}
                    onChange={() => toggleApproval(cert.id)}
                  />
                  <span className="font-mono font-medium">{cert.code}</span>
                  <span className="text-muted-foreground text-xs">{cert.name}</span>
                </label>
              ))}
            </div>
          </section>
          <Separator />
        </>
      )}

      {/* Other */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Other</h2>
        <Field label="Notes" error={errors.notes?.message}>
          <textarea
            {...register("notes")}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Internal notes…"
          />
        </Field>
      </section>

      {/* Actions */}
      <div className="flex items-center justify-between border-t pt-4">
        {onDelete ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/hardware/modules")}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </form>
  );
}
