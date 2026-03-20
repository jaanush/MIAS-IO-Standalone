"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2 } from "lucide-react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SIGNAL_ORIGINS, SIGNAL_TYPES, SIGNAL_DIRECTIONS } from "@/lib/enums";

// ── Types ─────────────────────────────────────────────────────────────────────

type SignalRow = {
  id: number;
  tag: string | null;
  signalType: "DISCRETE" | "ANALOG";
  origin: string;
  ioCardId: number | null;
  channelPosition: number | null;
  description: string | null;
  notes: string | null;
  direction: "INPUT" | "OUTPUT" | null;
  systemId: number | null;
  componentTag: string | null;
  drawingRef: string | null;
  cabinetLocation: string | null;
  gvlId: number | null;
  alarmGroup: string | null;
  alarmBlockMask: string | null;
  commBlockMask: string | null;
  fatBlock: boolean;
  suppressionSt: string | null;
  specialAlarmFb: string | null;
  specialAlarmInput: string | null;
  anaToDigAlarm: boolean;
  isRetain: boolean;
  isPersistent: boolean;
  loggingEnabled: boolean;
  fbNameOverride: string | null;
  useShortName: boolean;
  discreteSignal: {
    trigger: "NO" | "NC";
    filterTimeMs: unknown;
    switchingType: "HIGH_SIDE" | "LOW_SIDE" | "BOTH" | null;
    signalVoltage: string | null;
  } | null;
  analogSignal: {
    inputTypeId: number | null;
    inputType: { id: number; code: string; name: string } | null;
    wireConfig: "TWO_WIRE" | "THREE_WIRE" | "FOUR_WIRE" | null;
    scaleMin: unknown;
    scaleMax: unknown;
    rawMin: unknown;
    rawMax: unknown;
    rawZero: unknown;
    clampLow: unknown;
    clampHigh: unknown;
    deadband: unknown;
    engineeringUnitId: number | null;
    engineeringUnit: { id: number; symbol: string } | null;
    useTankLevel: boolean;
    scalingFbOverride: string | null;
    deadbandRawMin: unknown;
    deadbandRawZero: unknown;
    deadbandRawMax: unknown;
    sensorFailRaw: unknown;
    sensorFailMargin: unknown;
    sensorFailBehavior: string | null;
    sensorFailDelayMs: number | null;
  } | null;
  ioCard: {
    id: number;
    carrier: {
      name: string;
      plc: { id: number; name: string };
    };
  } | null;
};

type Props = {
  projectId: number;
  signal: SignalRow | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

// ── Zod schema ────────────────────────────────────────────────────────────────

const numericField = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().nullable().optional()
);

const formSchema = z.object({
  tag: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  signalType: z.enum(SIGNAL_TYPES),
  origin: z.enum(SIGNAL_ORIGINS),
  direction: z.enum(SIGNAL_DIRECTIONS).nullable().optional(),
  systemId: z.preprocess(
    (v) => (v === "" || v == null || v === "none" ? null : Number(v)),
    z.number().int().nullable().optional()
  ),
  componentTag: z.string().optional().nullable(),
  drawingRef: z.string().optional().nullable(),
  cabinetLocation: z.string().optional().nullable(),
  gvlId: z.preprocess(
    (v) => (v === "" || v == null || v === "none" ? null : Number(v)),
    z.number().int().nullable().optional()
  ),
  // Code generation flags
  isRetain: z.boolean().default(false),
  isPersistent: z.boolean().default(false),
  loggingEnabled: z.boolean().default(false),
  fbNameOverride: z.string().max(255).optional().nullable(),
  useShortName: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

// ── Helper ────────────────────────────────────────────────────────────────────

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AddEditSignalDialog({
  projectId,
  signal,
  open,
  onClose,
  onSaved,
}: Props) {
  const isEdit = signal !== null;

  const utils = trpc.useUtils();

  const { data: systems = [] } = trpc.signal.systemList.useQuery(undefined, { enabled: open });
  const { data: gvls = [] } = trpc.signal.gvlList.useQuery(undefined, { enabled: open });

  const create = trpc.signal.create.useMutation({
    onSuccess: () => {
      utils.signal.list.invalidate({ projectId });
      onSaved();
      onClose();
    },
  });

  const update = trpc.signal.update.useMutation({
    onSuccess: () => {
      utils.signal.list.invalidate({ projectId });
      onSaved();
      onClose();
    },
  });

  const del = trpc.signal.delete.useMutation({
    onSuccess: () => {
      utils.signal.list.invalidate({ projectId });
      onSaved();
      onClose();
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      signalType: "DISCRETE",
      origin: "IEC",
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (!open) return;
    if (signal) {
      reset({
        tag: signal.tag ?? "",
        description: signal.description ?? "",
        notes: signal.notes ?? "",
        signalType: signal.signalType,
        origin: signal.origin as FormValues["origin"],
        direction: (signal.direction as FormValues["direction"]) ?? null,
        systemId: signal.systemId ?? null,
        componentTag: signal.componentTag ?? "",
        drawingRef: signal.drawingRef ?? "",
        cabinetLocation: signal.cabinetLocation ?? "",
        gvlId: signal.gvlId ?? null,
        isRetain: signal.isRetain ?? false,
        isPersistent: signal.isPersistent ?? false,
        loggingEnabled: signal.loggingEnabled ?? false,
        fbNameOverride: signal.fbNameOverride ?? "",
        useShortName: signal.useShortName ?? false,
      });
    } else {
      reset({
        signalType: "DISCRETE",
        origin: "IEC",
        tag: "",
        description: "",
        notes: "",
        direction: null,
        systemId: null,
        componentTag: "",
        drawingRef: "",
        cabinetLocation: "",
        gvlId: null,
        isRetain: false,
        isPersistent: false,
        loggingEnabled: false,
        fbNameOverride: "",
        useShortName: false,
      });
    }
  }, [signal, open, reset]);

  const signalType = watch("signalType");
  const origin = watch("origin");

  function onSubmit(values: FormValues) {
    const base = {
      tag: values.tag || null,
      description: values.description || null,
      notes: values.notes || null,
      origin: values.origin,
      // classification
      direction: values.direction ?? null,
      systemId: values.systemId ?? null,
      componentTag: values.componentTag || null,
      drawingRef: values.drawingRef || null,
      cabinetLocation: values.cabinetLocation || null,
      gvlId: values.gvlId ?? null,
      // code gen flags
      isRetain: values.isRetain ?? false,
      isPersistent: values.isPersistent ?? false,
      loggingEnabled: values.loggingEnabled ?? false,
      fbNameOverride: values.fbNameOverride || null,
      useShortName: values.useShortName ?? false,
    };

    if (isEdit) {
      update.mutate({ id: signal.id, ...base });
    } else {
      create.mutate({
        projectId,
        signalType: values.signalType,
        ...base,
      });
    }
  }

  function handleDelete() {
    if (!signal) return;
    if (confirm(`Delete signal "${signal.tag ?? signal.id}"? This cannot be undone.`)) {
      del.mutate({ id: signal.id });
    }
  }

  const isPending = create.isPending || update.isPending || del.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit Signal — ${signal.tag ?? `#${signal.id}`}` : "Add Signal"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* ── Section 1: Basic ── */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Basic
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tag" error={errors.tag?.message}>
                <Input {...register("tag")} placeholder="e.g. TI-101" />
              </Field>
              <Field label="Description" error={errors.description?.message}>
                <Input {...register("description")} placeholder="Short description" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Signal Type: readonly in edit mode */}
              <Field label="Signal Type" error={errors.signalType?.message}>
                {isEdit ? (
                  <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                    {signal.signalType === "DISCRETE" ? "Discrete" : "Analog"}
                  </div>
                ) : (
                  <div className="flex gap-4 pt-1">
                    {(["DISCRETE", "ANALOG"] as const).map((t) => (
                      <label
                        key={t}
                        className="flex items-center gap-2 cursor-pointer text-sm"
                      >
                        <input
                          type="radio"
                          value={t}
                          {...register("signalType")}
                          className="h-4 w-4"
                        />
                        {t === "DISCRETE" ? "Discrete" : "Analog"}
                      </label>
                    ))}
                  </div>
                )}
              </Field>

              <Field label="Origin" error={errors.origin?.message}>
                <Controller
                  name="origin"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select origin" />
                      </SelectTrigger>
                      <SelectContent>
                        {SIGNAL_ORIGINS.map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>
          </section>

          {/* ── Section 2: Classification ── */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Classification
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Direction">
                <Controller
                  name="direction"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ?? "none"}
                      onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                    >
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        <SelectItem value="INPUT">Input</SelectItem>
                        <SelectItem value="OUTPUT">Output</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="System">
                <Controller
                  name="systemId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value != null ? String(field.value) : "none"}
                      onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))}
                    >
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {systems.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.code} — {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Component Identifier">
                <Input {...register("componentTag")} placeholder="e.g. 625-M01" />
              </Field>
              <Field label="Drawing Reference">
                <Input {...register("drawingRef")} placeholder="e.g. 625-E01" />
              </Field>
              <Field label="Cabinet Location">
                <Input {...register("cabinetLocation")} placeholder="e.g. A01" />
              </Field>
              <Field label="GVL">
                <Controller
                  name="gvlId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value != null ? String(field.value) : "none"}
                      onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))}
                    >
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {gvls.map((g) => (
                          <SelectItem key={g.id} value={String(g.id)}>
                            {g.name}{g.description ? ` — ${g.description}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>
          </section>

          {/* ── Section 3: Code Generation ── */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Code Generation
            </h3>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("loggingEnabled")} className="h-4 w-4" />
                Logging enabled (AnyConversion)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("isRetain")} className="h-4 w-4" />
                RETAIN (survives warm restart)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("isPersistent")} className="h-4 w-4" />
                PERSISTENT (survives power cycle)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("useShortName")} className="h-4 w-4" />
                Use short tag name (System_Component only)
              </label>
            </div>
            <Field label="FB / Struct Name Override" error={errors.fbNameOverride?.message}>
              <Input {...register("fbNameOverride")} placeholder="e.g. FB_PumpStation_01" />
            </Field>
          </section>

          {/* ── Notes ── */}
          <section className="space-y-2">
            <Label>Notes</Label>
            <textarea
              {...register("notes")}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Internal notes…"
            />
          </section>

          {/* ── Actions ── */}
          <div className="flex items-center justify-between border-t pt-4">
            {isEdit ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
