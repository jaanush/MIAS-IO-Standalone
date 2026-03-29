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
import { Badge } from "@/components/ui/badge";
import { Upload, Network, ChevronRight, FileSpreadsheet } from "lucide-react";
import { StructuredImportDialog, type TargetField } from "@/components/structured-import-dialog";
import { cn } from "@/lib/utils";
import { ImportModbusDialog } from "./ImportModbusDialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { COMPONENT_STATUS, BUS_PROTOCOLS } from "@/lib/enums";
import { PdoConfigSection } from "../[id]/_components/PdoConfigSection";

// ── Structured import helpers ────────────────────────────────────────────────

const MODBUS_TARGET_FIELDS: TargetField[] = [
  { key: "address", label: "Modbus Address", required: true },
  { key: "registerType", label: "Register Type" },
  { key: "bit", label: "Bit Position" },
  { key: "name", label: "Signal Name", required: true },
  { key: "description", label: "Description" },
  { key: "dataType", label: "Data Type" },
  { key: "access", label: "Access (R/W)" },
  { key: "unit", label: "Unit" },
  { key: "scale", label: "Scale Factor" },
];

function resolveRegisterType(raw: string | undefined, address: string | undefined): "HOLDING_REGISTER" | "INPUT_REGISTER" | "COIL" | "DISCRETE_INPUT" {
  const r = (raw ?? "").toLowerCase();
  if (r.includes("holding")) return "HOLDING_REGISTER";
  if (r.includes("input")) return "INPUT_REGISTER";
  if (r.includes("coil")) return "COIL";
  if (r.includes("discrete")) return "DISCRETE_INPUT";
  const addr = parseInt(address ?? "", 10);
  if (addr >= 40000) return "HOLDING_REGISTER";
  if (addr >= 30000) return "INPUT_REGISTER";
  return "HOLDING_REGISTER";
}

function resolveDataType(raw: string | undefined, bit: string | undefined): "INT16" | "UINT16" | "INT32" | "UINT32" | "FLOAT32" | "BOOL" | "WORD" | "DWORD" {
  const r = (raw ?? "").toUpperCase();
  if (r === "BOOL" || (bit && bit !== "--" && bit !== "")) return "BOOL";
  if (r === "INT" || r === "INT16") return "INT16";
  if (r === "UINT" || r === "UINT16" || r === "WORD") return "UINT16";
  if (r === "DINT" || r === "INT32") return "INT32";
  if (r === "UDINT" || r === "UINT32" || r === "DWORD") return "UINT32";
  if (r === "REAL" || r === "FLOAT" || r === "FLOAT32") return "FLOAT32";
  return "INT16";
}

function resolveAccess(raw: string | undefined): "R" | "W" | "RW" {
  const r = (raw ?? "").toUpperCase().replace(/[^RWO]/g, "");
  if (r.includes("W") && r.includes("R")) return "RW";
  if (r.includes("W")) return "W";
  return "R";
}

// ── Form schema ─────────────────────────────────────────────────────────────

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

export function ComponentDetail({ id, onDeleted, onListRefresh }: Props) {
  const [confirmProps, confirmAction] = useConfirm();
  const router = useRouter();
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [showImportDbc, setShowImportDbc] = useState(false);
  const [showImportModbus, setShowImportModbus] = useState(false);
  const [showStructuredImport, setShowStructuredImport] = useState(false);
  const utils = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.components.componentById.useQuery({ id });
  const { data: allComponents = [] } = trpc.components.componentList.useQuery();
  const importMut = trpc.components.modbusImport.useMutation();
  const { data: effectiveSignals = [] } = trpc.components.effectiveSignals.useQuery(
    { componentId: id },
    { enabled: !!data?.parentId }
  );

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

      {/* PDO Configuration — CANopen/CANBUS only */}
      {(data.busProtocol === "CANOPEN" || data.busProtocol === "CANBUS") && (
        <PdoConfigSection
          componentId={id}
          hasParent={!!data.parentId}
          signals={data.signals as any}
          onRefresh={() => refetch()}
        />
      )}

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
            Child components inherit this component's signals. Signals at the same channel offset are overridden.
          </p>
        </section>
      )}

      {/* Inherited signals (read-only, collapsible) */}
      {data.parentId && effectiveSignals.length > 0 && (() => {
        const inherited = effectiveSignals.filter((s: any) => s.inherited);
        if (inherited.length === 0) return null;
        return <InheritedSignalsSection inherited={inherited} parentId={data.parentId!} parentName={data.parent?.name ?? "parent"} />;
      })()}

      <section className="px-8 py-6 space-y-3 flex-1">
        <div className="flex items-center justify-between max-w-5xl">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {data.parentId ? "Own Signals" : "Signals"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.signals.length} signal{data.signals.length !== 1 ? "s" : ""} defined{data.parent ? ` + ${effectiveSignals.filter((s: any) => s.inherited).length} inherited` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowStructuredImport(true)}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Structured Import
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowImportModbus(true)}>
              <Network className="h-4 w-4 mr-1" /> AI Import
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowImportDbc(true)}>
              <Upload className="h-4 w-4 mr-1" /> DBC
            </Button>
          </div>
        </div>
        <SignalGrid
          componentId={id}
          signals={data.signals}
          onRefresh={() => refetch()}
        />
      </section>

      {showStructuredImport && data && (
        <StructuredImportDialog
          open
          onClose={() => setShowStructuredImport(false)}
          title={`Structured Import — ${data.name}`}
          targetFields={MODBUS_TARGET_FIELDS}
          onImport={async (rows) => {
            // Convert mapped rows to component signals
            const signals = rows.map((row, i) => ({
              address: parseInt(row.address, 10) || 0,
              registerType: resolveRegisterType(row.registerType, row.address),
              dataType: resolveDataType(row.dataType, row.bit),
              name: (row.name || "").replace(/[^A-Za-z0-9_]/g, "_").substring(0, 100),
              description: row.description || row.name || "",
              unit: row.unit || null,
              scaleFactor: row.scale ? parseFloat(row.scale) : null,
              offset: null,
              readWrite: resolveAccess(row.access),
              bitPosition: row.bit && row.bit !== "--" ? parseInt(row.bit, 10) : null,
            }));
            await importMut.mutateAsync({ componentId: id, registers: signals });
            refetch();
            setShowStructuredImport(false);
          }}
        />
      )}

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
      <ConfirmDialog {...confirmProps} confirmLabel="Delete" />
    </div>
  );
}

function InheritedSignalsSection({ inherited, parentId, parentName }: { inherited: any[]; parentId: number; parentName: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <section className="px-8 py-4 space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
          Inherited Signals
          <span className="font-normal text-xs">({inherited.length} from {parentName})</span>
        </button>
        <button
          type="button"
          onClick={() => router.push(`/components/${parentId}`)}
          className="text-xs text-blue-600 hover:underline"
        >
          Open parent
        </button>
      </div>
      {open && (
        <div className="overflow-x-auto rounded-md border max-h-[300px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-2 py-1.5 font-medium w-12">Ch</th>
                <th className="px-2 py-1.5 font-medium w-12">IO</th>
                <th className="px-2 py-1.5 font-medium">Tag Suffix</th>
                <th className="px-2 py-1.5 font-medium">Description</th>
                <th className="px-2 py-1.5 font-medium w-24">Source</th>
              </tr>
            </thead>
            <tbody>
              {inherited.map((sig: any) => (
                <tr key={sig.id} className="border-b last:border-0 text-muted-foreground">
                  <td className="px-2 py-1 tabular-nums">{sig.channelOffset}</td>
                  <td className="px-2 py-1">{sig.ioType}</td>
                  <td className="px-2 py-1 font-mono">{sig.tagSuffix ?? "—"}</td>
                  <td className="px-2 py-1 truncate max-w-[300px]">{sig.description ?? "—"}</td>
                  <td className="px-2 py-1">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-600 border-blue-200">
                      inherited
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
