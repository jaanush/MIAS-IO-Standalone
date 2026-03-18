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
import { SIGNAL_ORIGINS, SIGNAL_TYPES, TRIGGER_TYPES, SWITCHING_TYPES, WIRE_CONFIGS, SIGNAL_DIRECTIONS } from "@/lib/enums";

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
  ioCardId: z.preprocess(
    (v) => (v === "" || v == null || v === "none" ? null : Number(v)),
    z.number().int().nullable().optional()
  ),
  channelPosition: numericField,
  // Discrete
  trigger: z.enum(TRIGGER_TYPES).default("NO"),
  filterTimeMs: numericField,
  switchingType: z.enum(SWITCHING_TYPES).nullable().optional(),
  signalVoltage: z.string().optional().nullable(),
  // Analog
  inputTypeId: z.preprocess(
    (v) => (v === "" || v == null || v === "none" ? null : Number(v)),
    z.number().int().nullable().optional()
  ),
  wireConfig: z.enum(WIRE_CONFIGS).nullable().optional(),
  scaleMin: numericField,
  scaleMax: numericField,
  rawMin: numericField,
  rawMax: numericField,
  rawZero: numericField,
  deadband: numericField,
  useTankLevel: z.boolean().default(false),
  scalingFbOverride: z.string().optional().nullable(),
  deadbandRawMin: numericField,
  deadbandRawZero: numericField,
  deadbandRawMax: numericField,
  sensorFailRaw: numericField,
  sensorFailMargin: numericField,
  sensorFailBehavior: z.string().optional().nullable(),
  sensorFailDelayMs: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().int().nullable().optional()
  ),
  engineeringUnitId: z.preprocess(
    (v) => (v === "" || v == null || v === "none" ? null : Number(v)),
    z.number().int().nullable().optional()
  ),
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
  // Alarm configuration
  alarmGroup: z.string().max(1).optional().nullable(),
  alarmBlockMask: z.string().max(5).optional().nullable(),
  commBlockMask: z.string().max(5).optional().nullable(),
  fatBlock: z.boolean().default(false),
  suppressionSt: z.string().optional().nullable(),
  specialAlarmFb: z.string().max(100).optional().nullable(),
  specialAlarmInput: z.string().max(255).optional().nullable(),
  anaToDigAlarm: z.boolean().default(false),
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

  const { data: cards = [] } = trpc.signal.cardsForProject.useQuery(
    { projectId },
    { enabled: open }
  );

  const { data: engineeringUnits = [] } = trpc.signal.engineeringUnits.useQuery(
    undefined,
    { enabled: open }
  );

  const { data: inputTypes = [] } = trpc.signal.analogInputTypes.useQuery(undefined, { enabled: open });

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
      trigger: "NO",
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
        ioCardId: signal.ioCardId ?? null,
        channelPosition: signal.channelPosition ?? null,
        trigger: signal.discreteSignal?.trigger ?? "NO",
        filterTimeMs: toNum(signal.discreteSignal?.filterTimeMs),
        switchingType: signal.discreteSignal?.switchingType ?? null,
        signalVoltage: signal.discreteSignal?.signalVoltage ?? "",
        inputTypeId: signal.analogSignal?.inputTypeId ?? null,
        wireConfig: signal.analogSignal?.wireConfig ?? null,
        scaleMin: toNum(signal.analogSignal?.scaleMin),
        scaleMax: toNum(signal.analogSignal?.scaleMax),
        rawMin: toNum(signal.analogSignal?.rawMin),
        rawMax: toNum(signal.analogSignal?.rawMax),
        rawZero: toNum(signal.analogSignal?.rawZero),
        deadband: toNum(signal.analogSignal?.deadband),
        engineeringUnitId: signal.analogSignal?.engineeringUnitId ?? null,
        useTankLevel: signal.analogSignal?.useTankLevel ?? false,
        scalingFbOverride: signal.analogSignal?.scalingFbOverride ?? "",
        deadbandRawMin: toNum(signal.analogSignal?.deadbandRawMin),
        deadbandRawZero: toNum(signal.analogSignal?.deadbandRawZero),
        deadbandRawMax: toNum(signal.analogSignal?.deadbandRawMax),
        sensorFailRaw: toNum(signal.analogSignal?.sensorFailRaw),
        sensorFailMargin: toNum(signal.analogSignal?.sensorFailMargin),
        sensorFailBehavior: signal.analogSignal?.sensorFailBehavior ?? "",
        sensorFailDelayMs: signal.analogSignal?.sensorFailDelayMs ?? null,
        direction: (signal.direction as FormValues["direction"]) ?? null,
        systemId: signal.systemId ?? null,
        componentTag: signal.componentTag ?? "",
        drawingRef: signal.drawingRef ?? "",
        cabinetLocation: signal.cabinetLocation ?? "",
        gvlId: signal.gvlId ?? null,
        alarmGroup: signal.alarmGroup ?? "",
        alarmBlockMask: signal.alarmBlockMask ?? "",
        commBlockMask: signal.commBlockMask ?? "",
        fatBlock: signal.fatBlock ?? false,
        suppressionSt: signal.suppressionSt ?? "",
        specialAlarmFb: signal.specialAlarmFb ?? "",
        specialAlarmInput: signal.specialAlarmInput ?? "",
        anaToDigAlarm: signal.anaToDigAlarm ?? false,
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
        trigger: "NO",
        tag: "",
        description: "",
        notes: "",
        ioCardId: null,
        channelPosition: null,
        filterTimeMs: null,
        switchingType: null,
        signalVoltage: "",
        inputTypeId: null,
        wireConfig: null,
        scaleMin: null,
        scaleMax: null,
        rawMin: null,
        rawMax: null,
        rawZero: null,
        deadband: null,
        engineeringUnitId: null,
        useTankLevel: false,
        scalingFbOverride: "",
        deadbandRawMin: null,
        deadbandRawZero: null,
        deadbandRawMax: null,
        sensorFailRaw: null,
        sensorFailMargin: null,
        sensorFailBehavior: "",
        sensorFailDelayMs: null,
        direction: null,
        systemId: null,
        componentTag: "",
        drawingRef: "",
        cabinetLocation: "",
        gvlId: null,
        alarmGroup: "",
        alarmBlockMask: "",
        commBlockMask: "",
        fatBlock: false,
        suppressionSt: "",
        specialAlarmFb: "",
        specialAlarmInput: "",
        anaToDigAlarm: false,
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
  const ioCardId = watch("ioCardId");
  const isIec = origin === "IEC";

  function onSubmit(values: FormValues) {
    const base = {
      tag: values.tag || null,
      description: values.description || null,
      notes: values.notes || null,
      origin: values.origin,
      ioCardId: values.ioCardId ?? null,
      channelPosition:
        values.channelPosition != null ? Number(values.channelPosition) : null,
      // discrete
      trigger: values.trigger,
      filterTimeMs: values.filterTimeMs ?? null,
      switchingType: values.switchingType ?? null,
      signalVoltage: values.signalVoltage || null,
      // analog
      inputTypeId: values.inputTypeId ?? null,
      wireConfig: values.wireConfig ?? null,
      scaleMin: values.scaleMin ?? null,
      scaleMax: values.scaleMax ?? null,
      rawMin: values.rawMin ?? null,
      rawMax: values.rawMax ?? null,
      rawZero: values.rawZero ?? null,
      deadband: values.deadband ?? null,
      engineeringUnitId: values.engineeringUnitId ?? null,
      useTankLevel: values.useTankLevel ?? false,
      scalingFbOverride: values.scalingFbOverride || null,
      deadbandRawMin: values.deadbandRawMin ?? null,
      deadbandRawZero: values.deadbandRawZero ?? null,
      deadbandRawMax: values.deadbandRawMax ?? null,
      sensorFailRaw: values.sensorFailRaw ?? null,
      sensorFailMargin: values.sensorFailMargin ?? null,
      sensorFailBehavior: values.sensorFailBehavior || null,
      sensorFailDelayMs: values.sensorFailDelayMs ?? null,
      // classification
      direction: values.direction ?? null,
      systemId: values.systemId ?? null,
      componentTag: values.componentTag || null,
      drawingRef: values.drawingRef || null,
      cabinetLocation: values.cabinetLocation || null,
      gvlId: values.gvlId ?? null,
      // alarm config
      alarmGroup: values.alarmGroup || null,
      alarmBlockMask: values.alarmBlockMask || null,
      commBlockMask: values.commBlockMask || null,
      fatBlock: values.fatBlock ?? false,
      suppressionSt: values.suppressionSt || null,
      specialAlarmFb: values.specialAlarmFb || null,
      specialAlarmInput: values.specialAlarmInput || null,
      anaToDigAlarm: values.anaToDigAlarm ?? false,
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

          {/* ── Section 3: Hardware Assignment ── */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Hardware Assignment
            </h3>
            {isIec ? (
              <>
                <Field label="Card" error={errors.ioCardId?.message}>
                  <Controller
                    name="ioCardId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value != null ? String(field.value) : "none"}
                        onValueChange={(v) => {
                          field.onChange(v === "none" ? null : Number(v));
                          if (v === "none") setValue("channelPosition", null);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="— Unassigned —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Unassigned —</SelectItem>
                          {cards.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.path}
                              {c.articleNumber ? ` — ${c.articleNumber}` : ""}
                              {c.description ? `: ${c.description}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>

                {ioCardId != null && (
                  <Field label="Channel (0-based)" error={errors.channelPosition?.message}>
                    <Input
                      type="number"
                      min={0}
                      {...register("channelPosition")}
                      placeholder="e.g. 0"
                    />
                  </Field>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground rounded-md border border-dashed px-3 py-2">
                Hardware assignment for <strong>{origin}</strong> signals is configured via network settings, not a physical card slot.
              </p>
            )}
          </section>

          {/* ── Section 4: Discrete Settings ── */}
          {signalType === "DISCRETE" && (
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Discrete Settings
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Trigger" error={errors.trigger?.message}>
                  <Controller
                    name="trigger"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NO">NO — Normally Open</SelectItem>
                          <SelectItem value="NC">NC — Normally Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>

                <Field label="Filter Time (ms)" error={errors.filterTimeMs?.message}>
                  <Input
                    type="number"
                    step="0.001"
                    {...register("filterTimeMs")}
                    placeholder="e.g. 3.0"
                  />
                </Field>

                <Field label="Switching Type" error={errors.switchingType?.message}>
                  <Controller
                    name="switchingType"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value ?? "none"}
                        onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          <SelectItem value="HIGH_SIDE">High Side</SelectItem>
                          <SelectItem value="LOW_SIDE">Low Side</SelectItem>
                          <SelectItem value="BOTH">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>

                <Field label="Signal Voltage" error={errors.signalVoltage?.message}>
                  <Input
                    {...register("signalVoltage")}
                    placeholder="e.g. 24 VDC"
                  />
                </Field>
              </div>
            </section>
          )}

          {/* ── Section 5: Analog Settings ── */}
          {signalType === "ANALOG" && (
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Analog Settings
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Input Type" error={errors.inputTypeId?.message}>
                  <Controller
                    name="inputTypeId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value != null ? String(field.value) : "none"}
                        onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select input type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {inputTypes.map((t) => (
                            <SelectItem key={t.id} value={String(t.id)}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>

                <Field label="Wire Config" error={errors.wireConfig?.message}>
                  <Controller
                    name="wireConfig"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value ?? "none"}
                        onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          <SelectItem value="TWO_WIRE">2-Wire</SelectItem>
                          <SelectItem value="THREE_WIRE">3-Wire</SelectItem>
                          <SelectItem value="FOUR_WIRE">4-Wire</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Scale Min" error={errors.scaleMin?.message}>
                  <Input type="number" step="any" {...register("scaleMin")} />
                </Field>
                <Field label="Scale Max" error={errors.scaleMax?.message}>
                  <Input type="number" step="any" {...register("scaleMax")} />
                </Field>
                <Field label="Raw Min" error={errors.rawMin?.message}>
                  <Input type="number" step="any" {...register("rawMin")} />
                </Field>
                <Field label="Raw Zero" error={errors.rawZero?.message}>
                  <Input type="number" step="any" {...register("rawZero")} placeholder="ADC zero point" />
                </Field>
                <Field label="Raw Max" error={errors.rawMax?.message}>
                  <Input type="number" step="any" {...register("rawMax")} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Engineering Unit" error={errors.engineeringUnitId?.message}>
                  <Controller
                    name="engineeringUnitId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value != null ? String(field.value) : "none"}
                        onValueChange={(v) =>
                          field.onChange(v === "none" ? null : Number(v))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {engineeringUnits.map((eu) => (
                            <SelectItem key={eu.id} value={String(eu.id)}>
                              {eu.symbol}
                              {eu.description ? ` — ${eu.description}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>

                <Field label="Deadband" error={errors.deadband?.message}>
                  <Input type="number" step="any" {...register("deadband")} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Use Tank Level FB">
                  <label className="flex items-center gap-2 text-sm pt-1">
                    <input type="checkbox" {...register("useTankLevel")} className="h-4 w-4" />
                    Use FB_TankLevel (non-linear geometry)
                  </label>
                </Field>
                <Field label="Scaling FB Override" error={errors.scalingFbOverride?.message}>
                  <Input {...register("scalingFbOverride")} placeholder="e.g. FB_MyCustomScale" />
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Field label="Deadband Raw Min" error={errors.deadbandRawMin?.message}>
                  <Input type="number" step="any" {...register("deadbandRawMin")} />
                </Field>
                <Field label="Deadband Raw Zero" error={errors.deadbandRawZero?.message}>
                  <Input type="number" step="any" {...register("deadbandRawZero")} />
                </Field>
                <Field label="Deadband Raw Max" error={errors.deadbandRawMax?.message}>
                  <Input type="number" step="any" {...register("deadbandRawMax")} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Sensor Fail Raw ADC" error={errors.sensorFailRaw?.message}>
                  <Input type="number" step="any" {...register("sensorFailRaw")} placeholder="e.g. 0" />
                </Field>
                <Field label="Sensor Fail Margin" error={errors.sensorFailMargin?.message}>
                  <Input type="number" step="any" {...register("sensorFailMargin")} />
                </Field>
                <Field label="Sensor Fail Behavior" error={errors.sensorFailBehavior?.message}>
                  <Input {...register("sensorFailBehavior")} placeholder="e.g. HOLD" />
                </Field>
                <Field label="Sensor Fail Delay (ms)" error={errors.sensorFailDelayMs?.message}>
                  <Input type="number" {...register("sensorFailDelayMs")} />
                </Field>
              </div>
            </section>
          )}

          {/* ── Section 6: Alarm Configuration ── */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Alarm Configuration
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Alarm Group (A/B/C)" error={errors.alarmGroup?.message}>
                <Input {...register("alarmGroup")} placeholder="A, B, or C" maxLength={1} />
              </Field>
              <Field label="Alarm Block Mask" error={errors.alarmBlockMask?.message}>
                <Input {...register("alarmBlockMask")} placeholder="D-HH-H-L-LL e.g. 00000" maxLength={5} />
              </Field>
              <Field label="Commissioning Block Mask" error={errors.commBlockMask?.message}>
                <Input {...register("commBlockMask")} placeholder="D-HH-H-L-LL e.g. 11111" maxLength={5} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("fatBlock")} className="h-4 w-4" />
                FAT Block (block all alarms in FAT init)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("anaToDigAlarm")} className="h-4 w-4" />
                Force Analogue → Digital Alarm
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Special Alarm FB" error={errors.specialAlarmFb?.message}>
                <Input {...register("specialAlarmFb")} placeholder="e.g. FB_Alarm_FollowSetpoint" />
              </Field>
              <Field label="Special Alarm Input Ref" error={errors.specialAlarmInput?.message}>
                <Input {...register("specialAlarmInput")} placeholder="e.g. GVL_Settings.SpeedSetpoint" />
              </Field>
            </div>
            <Field label="Suppression ST Expression" error={errors.suppressionSt?.message}>
              <Input {...register("suppressionSt")} placeholder="e.g. NOT GVL_Modes.bEngineRunning" />
            </Field>
          </section>

          {/* ── Section 7: Code Generation ── */}
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
