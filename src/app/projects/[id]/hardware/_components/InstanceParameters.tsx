"use client";

/**
 * Per-instance parameter values editor.
 *
 * Lists ComponentParameterDef rows declared on the instance's template,
 * shows current values from ComponentInstanceParameter, and lets the user
 * edit them inline. CURVE-typed parameters launch the reusable
 * <CurveEditor> dialog.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil } from "lucide-react";
import { trpc } from "@/trpc/client";
import { CurveEditor } from "@/components/curve-editor";
import type { ParamType } from "@/lib/enums";

type Props = {
  instanceId: number;
  componentId: number;
  projectId: number;
};

export function InstanceParameters({ instanceId, componentId, projectId }: Props) {
  const utils = trpc.useUtils();
  const { data: defs = [] } = trpc.components.paramDefList.useQuery({ componentId });
  const { data: values = [], refetch } = trpc.components.instanceParamList.useQuery({ instanceId });

  const upsert = trpc.components.instanceParamUpsert.useMutation({
    onSuccess: () => refetch(),
  });

  const [editingCurve, setEditingCurve] = useState<{ paramName: string; curveId: number | null } | null>(null);

  if (defs.length === 0) return null;

  const valueByName = new Map(values.map((v) => [v.paramName, v]));

  return (
    <div className="rounded-md border p-3 space-y-3 bg-muted/20">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Parameters</span>
      <div className="space-y-2">
        {defs.map((d) => {
          const v = valueByName.get(d.paramName);
          return (
            <ParameterRow
              key={d.id}
              def={d}
              value={v}
              onScalarChange={(val) =>
                upsert.mutate({
                  instanceId,
                  paramName: d.paramName,
                  scalarValue: val.scalarValue ?? null,
                  intValue: val.intValue ?? null,
                  stringValue: val.stringValue ?? null,
                  boolValue: val.boolValue ?? null,
                  curveId: v?.curveId ?? null,
                })
              }
              onEditCurve={() => setEditingCurve({ paramName: d.paramName, curveId: v?.curveId ?? null })}
            />
          );
        })}
      </div>

      {editingCurve && (
        <CurveEditor
          open
          onClose={() => setEditingCurve(null)}
          curveId={editingCurve.curveId}
          projectId={projectId}
          onSaved={async (curveId) => {
            // Bind the curve to the instance parameter (creates the value row if absent).
            await upsert.mutateAsync({
              instanceId,
              paramName: editingCurve.paramName,
              scalarValue: null,
              intValue: null,
              stringValue: null,
              boolValue: null,
              curveId,
            });
            await utils.components.instanceParamList.invalidate({ instanceId });
            setEditingCurve(null);
          }}
        />
      )}
    </div>
  );
}

type Def = {
  id: number;
  paramName: string;
  paramType: ParamType;
  required: boolean;
  defaultScalarValue: number | null;
  defaultIntValue: number | null;
  defaultStringValue: string | null;
  defaultBoolValue: boolean | null;
  description: string | null;
};

type Val = {
  paramName: string;
  scalarValue: number | null;
  intValue: number | null;
  stringValue: string | null;
  boolValue: boolean | null;
  curveId: number | null;
};

function ParameterRow({
  def,
  value,
  onScalarChange,
  onEditCurve,
}: {
  def: Def;
  value: Val | undefined;
  onScalarChange: (val: Partial<Val>) => void;
  onEditCurve: () => void;
}) {
  const inherited = !value;
  const display = inherited ? formatDefault(def) : formatValue(def, value);

  return (
    <div className="flex items-start gap-2 text-sm">
      <div className="w-40 shrink-0 pt-2">
        <code className="text-xs">{def.paramName}</code>
        {def.required && <span className="text-red-500 ml-0.5">*</span>}
        <div className="text-[10px] text-muted-foreground">
          <Badge variant="outline" className="text-[9px] mr-1">{def.paramType}</Badge>
          {def.description}
        </div>
      </div>
      <div className="flex-1">
        {def.paramType === "CURVE" ? (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onEditCurve}>
            <Pencil className="h-3 w-3 mr-1" />
            {value?.curveId ? `Edit curve #${value.curveId}` : "Add curve"}
          </Button>
        ) : def.paramType === "BOOL" ? (
          <Select
            value={value?.boolValue == null ? "__inherit__" : value.boolValue ? "true" : "false"}
            onValueChange={(v) =>
              onScalarChange({
                boolValue: v === "__inherit__" ? null : v === "true",
              })
            }
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__inherit__">(inherit default)</SelectItem>
              <SelectItem value="true">true</SelectItem>
              <SelectItem value="false">false</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={
              def.paramType === "STRING"
                ? value?.stringValue ?? ""
                : def.paramType === "INT"
                  ? value?.intValue?.toString() ?? ""
                  : value?.scalarValue?.toString() ?? ""
            }
            onChange={(e) => {
              const raw = e.target.value;
              if (def.paramType === "STRING") onScalarChange({ stringValue: raw || null });
              else if (def.paramType === "INT") onScalarChange({ intValue: raw === "" ? null : parseInt(raw, 10) });
              else onScalarChange({ scalarValue: raw === "" ? null : Number(raw) });
            }}
            type={def.paramType === "STRING" ? "text" : "number"}
            step={def.paramType === "SCALAR_REAL" ? "any" : undefined}
            placeholder={inherited ? `default: ${display ?? "—"}` : ""}
            className="h-8 text-xs font-mono"
          />
        )}
        {inherited && def.paramType !== "CURVE" && def.paramType !== "BOOL" && (
          <p className="text-[10px] text-muted-foreground mt-0.5">Using template default</p>
        )}
      </div>
    </div>
  );
}

function formatValue(def: Def, v: Val): string | null {
  switch (def.paramType) {
    case "SCALAR_REAL": return v.scalarValue?.toString() ?? null;
    case "INT": return v.intValue?.toString() ?? null;
    case "STRING": return v.stringValue;
    case "BOOL": return v.boolValue == null ? null : v.boolValue ? "true" : "false";
    case "CURVE": return v.curveId ? `curve #${v.curveId}` : null;
  }
}
function formatDefault(d: Def): string | null {
  switch (d.paramType) {
    case "SCALAR_REAL": return d.defaultScalarValue?.toString() ?? null;
    case "INT": return d.defaultIntValue?.toString() ?? null;
    case "STRING": return d.defaultStringValue;
    case "BOOL": return d.defaultBoolValue == null ? null : d.defaultBoolValue ? "true" : "false";
    case "CURVE": return null;
  }
}
