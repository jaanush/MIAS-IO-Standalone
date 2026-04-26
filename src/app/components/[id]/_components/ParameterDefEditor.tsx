"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { trpc } from "@/trpc/client";
import { PARAM_TYPES, type ParamType } from "@/lib/enums";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";

type ParamDef = {
  id: number;
  componentId: number;
  paramName: string;
  paramType: ParamType;
  required: boolean;
  defaultScalarValue: number | null;
  defaultIntValue: number | null;
  defaultStringValue: string | null;
  defaultBoolValue: boolean | null;
  description: string | null;
  sortOrder: number;
};

type Props = {
  componentId: number;
  defs: ParamDef[];
  onRefresh: () => void;
};

export function ParameterDefEditor({ componentId, defs, onRefresh }: Props) {
  const [confirmProps, confirmAction] = useConfirm();
  const [editing, setEditing] = useState<ParamDef | "new" | null>(null);

  const deleteDef = trpc.components.paramDefDelete.useMutation({ onSuccess: onRefresh });

  return (
    <div className="px-8 py-6 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Component Parameters
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Per-instance configuration declared on this template.
            {defs.length > 0 && <> · {defs.length} defined</>}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4 mr-1" /> Add Parameter
        </Button>
      </div>

      {defs.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground text-sm">
          <p>No parameters defined.</p>
          <p className="mt-1 text-xs">
            Declare per-instance configuration here (e.g. <span className="font-mono">maxVolume_m3</span>, <span className="font-mono">numberOfStrings</span>).
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-left px-3 py-2 font-medium">Type</th>
                <th className="text-left px-3 py-2 font-medium">Required</th>
                <th className="text-left px-3 py-2 font-medium">Default</th>
                <th className="text-left px-3 py-2 font-medium">Description</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {defs.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{d.paramName}</td>
                  <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{d.paramType}</Badge></td>
                  <td className="px-3 py-2">{d.required ? "yes" : "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{formatDefault(d) ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{d.description ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(d)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => confirmAction(`Delete parameter ${d.paramName}?`, async () => {
                        await deleteDef.mutateAsync({ id: d.id });
                      })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ParamDefDialog
          open
          onClose={() => setEditing(null)}
          componentId={componentId}
          existing={editing === "new" ? null : editing}
          onSaved={onRefresh}
        />
      )}

      <ConfirmDialog {...confirmProps} confirmLabel="Delete" />
    </div>
  );
}

function formatDefault(d: ParamDef): string | null {
  switch (d.paramType) {
    case "SCALAR_REAL":
      return d.defaultScalarValue?.toString() ?? null;
    case "INT":
      return d.defaultIntValue?.toString() ?? null;
    case "STRING":
      return d.defaultStringValue ?? null;
    case "BOOL":
      return d.defaultBoolValue == null ? null : d.defaultBoolValue ? "true" : "false";
    case "CURVE":
      return "(curve)";
  }
}

function ParamDefDialog({
  open,
  onClose,
  componentId,
  existing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  componentId: number;
  existing: ParamDef | null;
  onSaved: () => void;
}) {
  const [paramName, setParamName] = useState(existing?.paramName ?? "");
  const [paramType, setParamType] = useState<ParamType>(existing?.paramType ?? "SCALAR_REAL");
  const [required, setRequired] = useState(existing?.required ?? false);
  const [defaultStr, setDefaultStr] = useState<string>(() => {
    if (!existing) return "";
    if (existing.paramType === "SCALAR_REAL") return existing.defaultScalarValue?.toString() ?? "";
    if (existing.paramType === "INT") return existing.defaultIntValue?.toString() ?? "";
    if (existing.paramType === "STRING") return existing.defaultStringValue ?? "";
    if (existing.paramType === "BOOL") return existing.defaultBoolValue ? "true" : "false";
    return "";
  });
  const [description, setDescription] = useState(existing?.description ?? "");

  const upsert = trpc.components.paramDefUpsert.useMutation({
    onSuccess: () => { onSaved(); onClose(); },
  });

  function handleSave() {
    const base: Parameters<typeof upsert.mutate>[0] = {
      id: existing?.id,
      componentId,
      paramName,
      paramType,
      required,
      description: description || null,
      sortOrder: existing?.sortOrder ?? 0,
      defaultScalarValue: null,
      defaultIntValue: null,
      defaultStringValue: null,
      defaultBoolValue: null,
    };
    if (defaultStr.trim() !== "") {
      if (paramType === "SCALAR_REAL") base.defaultScalarValue = Number(defaultStr);
      else if (paramType === "INT") base.defaultIntValue = parseInt(defaultStr, 10);
      else if (paramType === "STRING") base.defaultStringValue = defaultStr;
      else if (paramType === "BOOL") base.defaultBoolValue = defaultStr === "true";
    }
    upsert.mutate(base);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Parameter" : "New Parameter"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input
              value={paramName}
              onChange={(e) => setParamName(e.target.value)}
              className="font-mono"
              placeholder="e.g. maxVolume_m3"
              disabled={!!existing}
            />
            {existing && <p className="text-[10px] text-muted-foreground">Name cannot be changed (used as the unique key for instance values)</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={paramType} onValueChange={(v) => setParamType(v as ParamType)} disabled={!!existing}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PARAM_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {existing && <p className="text-[10px] text-muted-foreground">Type cannot be changed; recreate the parameter if needed</p>}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="required"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="required" className="text-xs cursor-pointer">Required (instance must specify a value)</Label>
          </div>
          {paramType !== "CURVE" && (
            <div className="space-y-1">
              <Label className="text-xs">Default value</Label>
              {paramType === "BOOL" ? (
                <Select value={defaultStr || "__none__"} onValueChange={(v) => setDefaultStr(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="(none)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">(none)</SelectItem>
                    <SelectItem value="true">true</SelectItem>
                    <SelectItem value="false">false</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={defaultStr}
                  onChange={(e) => setDefaultStr(e.target.value)}
                  className="font-mono"
                  type={paramType === "SCALAR_REAL" || paramType === "INT" ? "number" : "text"}
                  step={paramType === "SCALAR_REAL" ? "any" : undefined}
                  placeholder="optional"
                />
              )}
            </div>
          )}
          {paramType === "CURVE" && (
            <p className="text-[10px] text-muted-foreground">
              Curve points are entered per-instance, not on the template.
            </p>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Tank max volume in cubic metres"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!paramName || upsert.isPending}>
            {upsert.isPending ? "Saving…" : existing ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
