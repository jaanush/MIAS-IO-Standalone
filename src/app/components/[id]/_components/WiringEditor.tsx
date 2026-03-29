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
import { Plus, Trash2, ChevronRight, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";
import { WIRING_SOURCE_TYPES } from "@/lib/enums";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";

const NONE = "__none__";

type Signal = {
  id: number;
  channelOffset: number;
  tagSuffix: string | null;
  description: string | null;
  ioType: string;
};

type Param = {
  id: number;
  recipeId: number;
  parameterName: string;
  direction: string;
  sourceType: string;
  channelOffset: number | null;
  signalTag: string | null;
  literalValue: string | null;
  expression: string | null;
  sortOrder: number;
};

type Recipe = {
  id: number;
  componentId: number | null;
  fbName: string;
  targetGvl: string;
  instanceNamePattern: string;
  description: string | null;
  sortOrder: number;
  params: Param[];
};

type Props = {
  componentId: number;
  functionBlock: string | null;
  recipes: Recipe[];
  signals: Signal[];
  onRefresh: () => void;
};

export function WiringEditor({ componentId, functionBlock, recipes, signals, onRefresh }: Props) {
  const [confirmProps, confirmAction] = useConfirm();
  const [showCreate, setShowCreate] = useState(false);

  const { data: fbDefs = [] } = trpc.components.fbDefinitionsForComponent.useQuery({ componentId });
  const hasFbDefs = fbDefs.length > 0;

  return (
    <div className="px-8 py-6 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Wiring Recipes
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {recipes.length} recipe{recipes.length !== 1 ? "s" : ""}
            {functionBlock && <span> · FB: <span className="font-mono">{functionBlock}</span></span>}
            {hasFbDefs && <span> · {fbDefs.reduce((n, d) => n + d.parameters.length, 0)} FB pins available</span>}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Recipe
        </Button>
      </div>

      {recipes.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground text-sm">
          <p>No wiring recipes defined.</p>
          <p className="mt-1 text-xs">
            Wiring recipes define how FB parameters map to component signals.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              signals={signals}
              fbDefs={fbDefs}
              onRefresh={onRefresh}
              onConfirm={confirmAction}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateRecipeDialog
          open
          onClose={() => setShowCreate(false)}
          componentId={componentId}
          functionBlock={functionBlock}
          onCreated={onRefresh}
        />
      )}

      <ConfirmDialog {...confirmProps} confirmLabel="Delete" />
    </div>
  );
}

// ── Recipe Card ──────────────────────────────────────────────────────

type FbDef = {
  id: number;
  name: string;
  parameters: { id: number; name: string; direction: string; dataType: string }[];
};

function RecipeCard({
  recipe,
  signals,
  fbDefs,
  onRefresh,
  onConfirm,
}: {
  recipe: Recipe;
  signals: Signal[];
  fbDefs: FbDef[];
  onRefresh: () => void;
  onConfirm: (msg: string, fn: () => Promise<void>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingParam, setEditingParam] = useState<Param | null>(null);
  const [addingParam, setAddingParam] = useState(false);

  const deleteMut = trpc.components.wiringRecipeDelete.useMutation({ onSuccess: onRefresh });
  const deleteParamMut = trpc.components.wiringParamDelete.useMutation({ onSuccess: onRefresh });
  const upsertParam = trpc.components.wiringParamUpsert.useMutation({ onSuccess: onRefresh });

  // Find matching FB definition for this recipe
  const matchingFb = fbDefs.find((d) => d.name === recipe.fbName);
  const existingParamNames = new Set(recipe.params.map((p) => p.parameterName));
  const newPins = matchingFb?.parameters.filter((p) => !existingParamNames.has(p.name)) ?? [];

  async function handleImportFromFb() {
    if (!matchingFb) return;
    // Import all pins that don't already exist as params
    for (const pin of newPins) {
      const dir = pin.direction === "VAR_OUTPUT" ? "OUTPUT" : "INPUT";
      await upsertParam.mutateAsync({
        recipeId: recipe.id,
        parameterName: pin.name,
        direction: dir,
        sourceType: "SIGNAL",
        sortOrder: 0,
      });
    }
  }

  return (
    <div className="border rounded-md">
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent/30 transition-colors cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded((v) => !v); } }}
      >
        <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform", expanded && "rotate-90")} />
        <span className="font-mono text-sm font-medium">{recipe.fbName}</span>
        <span className="text-xs text-muted-foreground">→ {recipe.targetGvl}</span>
        <span className="text-xs text-muted-foreground truncate flex-1">{recipe.description ?? ""}</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {recipe.params.length} param{recipe.params.length !== 1 ? "s" : ""}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onConfirm(`Delete recipe "${recipe.fbName}"?`, async () => {
              await deleteMut.mutateAsync({ id: recipe.id });
            });
          }}
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </Button>
      </div>

      {/* Expanded: parameter list */}
      {expanded && (
        <div className="border-t px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Parameters ({recipe.params.length})
            </p>
            <div className="flex gap-2">
              {newPins.length > 0 && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleImportFromFb} disabled={upsertParam.isPending}>
                  <Plus className="h-3 w-3 mr-1" /> Import {newPins.length} FB Pins
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddingParam(true)}>
                <Plus className="h-3 w-3 mr-1" /> Add Parameter
              </Button>
            </div>
          </div>

          {recipe.params.length > 0 ? (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="px-2 py-1.5 font-medium">Parameter</th>
                    <th className="px-2 py-1.5 font-medium w-16">Dir</th>
                    <th className="px-2 py-1.5 font-medium w-24">Source</th>
                    <th className="px-2 py-1.5 font-medium">Value / Signal</th>
                    <th className="px-2 py-1.5 w-14"></th>
                  </tr>
                </thead>
                <tbody>
                  {recipe.params.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-2 py-1 font-mono">{p.parameterName}</td>
                      <td className="px-2 py-1">
                        <Badge variant="outline" className={cn("text-[10px] px-1 py-0",
                          p.direction === "INPUT" ? "text-blue-600 border-blue-200" : "text-emerald-600 border-emerald-200"
                        )}>
                          {p.direction}
                        </Badge>
                      </td>
                      <td className="px-2 py-1 text-muted-foreground">{p.sourceType}</td>
                      <td className="px-2 py-1 font-mono truncate max-w-[200px]">
                        {p.sourceType === "LITERAL" && p.literalValue}
                        {p.sourceType === "EXPRESSION" && p.expression}
                        {(p.sourceType === "SIGNAL" || p.sourceType === "SIGNAL_RAW" || p.sourceType === "SIGNAL_SENSOR_FAULT") && (
                          p.channelOffset != null
                            ? signals.find((s) => s.channelOffset === p.channelOffset)?.tagSuffix ?? `ch:${p.channelOffset}`
                            : p.signalTag ?? "—"
                        )}
                        {p.sourceType === "INSTANCE_FB" && "{{instance.fb}}"}
                      </td>
                      <td className="px-2 py-1 flex gap-1">
                        <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setEditingParam(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => deleteParamMut.mutate({ id: p.id })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-2">No parameters defined.</p>
          )}

          <p className="text-[11px] text-muted-foreground">
            Instance name pattern: <span className="font-mono">{recipe.instanceNamePattern}</span>
          </p>
        </div>
      )}

      {(editingParam || addingParam) && (
        <ParamDialog
          open
          onClose={() => { setEditingParam(null); setAddingParam(false); }}
          recipeId={recipe.id}
          param={editingParam}
          signals={signals}
          onSaved={onRefresh}
        />
      )}
    </div>
  );
}

// ── Create Recipe Dialog ─────────────────────────────────────────────

function CreateRecipeDialog({
  open,
  onClose,
  componentId,
  functionBlock,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  componentId: number;
  functionBlock: string | null;
  onCreated: () => void;
}) {
  const [fbName, setFbName] = useState(functionBlock ?? "");
  const [targetGvl, setTargetGvl] = useState("GVL_CAN");
  const [instanceNamePattern, setInstanceNamePattern] = useState("{{instance.tag}}");
  const [description, setDescription] = useState("");

  const create = trpc.components.wiringRecipeCreate.useMutation({
    onSuccess: () => { onCreated(); onClose(); },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Wiring Recipe</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Function Block Name</Label>
            <Input value={fbName} onChange={(e) => setFbName(e.target.value)} className="font-mono" placeholder="e.g. FB_Pump" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Target GVL</Label>
            <Input value={targetGvl} onChange={(e) => setTargetGvl(e.target.value)} className="font-mono" placeholder="e.g. GVL_CAN" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Instance Name Pattern</Label>
            <Input value={instanceNamePattern} onChange={(e) => setInstanceNamePattern(e.target.value)} className="font-mono" />
            <p className="text-[10px] text-muted-foreground">Variables: {"{{instance.tag}}"}, {"{{instance.name}}"}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => create.mutate({ componentId, fbName, targetGvl, instanceNamePattern, description: description || null })} disabled={!fbName || create.isPending}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Parameter Edit Dialog ────────────────────────────────────────────

function ParamDialog({
  open,
  onClose,
  recipeId,
  param,
  signals,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  recipeId: number;
  param: Param | null; // null = adding new
  signals: Signal[];
  onSaved: () => void;
}) {
  const [parameterName, setParameterName] = useState(param?.parameterName ?? "");
  const [direction, setDirection] = useState(param?.direction ?? "INPUT");
  const [sourceType, setSourceType] = useState(param?.sourceType ?? "SIGNAL");
  const [channelOffset, setChannelOffset] = useState(param?.channelOffset != null ? String(param.channelOffset) : "");
  const [signalTag, setSignalTag] = useState(param?.signalTag ?? "");
  const [literalValue, setLiteralValue] = useState(param?.literalValue ?? "");
  const [expression, setExpression] = useState(param?.expression ?? "");

  const upsert = trpc.components.wiringParamUpsert.useMutation({
    onSuccess: () => { onSaved(); onClose(); },
  });

  function handleSave() {
    upsert.mutate({
      recipeId,
      parameterName,
      direction,
      sourceType: sourceType as any,
      channelOffset: channelOffset ? Number(channelOffset) : null,
      signalTag: signalTag || null,
      literalValue: literalValue || null,
      expression: expression || null,
      sortOrder: param?.sortOrder ?? 0,
    });
  }

  const isSignalSource = sourceType === "SIGNAL" || sourceType === "SIGNAL_RAW" || sourceType === "SIGNAL_SENSOR_FAULT";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{param ? "Edit Parameter" : "Add Parameter"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Parameter Name</Label>
              <Input value={parameterName} onChange={(e) => setParameterName(e.target.value)} className="font-mono" placeholder="e.g. Speed_reference_RPM" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Direction</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INPUT">INPUT</SelectItem>
                  <SelectItem value="OUTPUT">OUTPUT</SelectItem>
                  <SelectItem value="VAR_IN_OUT">VAR_IN_OUT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Source Type</Label>
            <Select value={sourceType} onValueChange={setSourceType}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {WIRING_SOURCE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isSignalSource && (
            <div className="space-y-1">
              <Label className="text-xs">Signal (by channel offset)</Label>
              <Select
                value={channelOffset || NONE}
                onValueChange={(v) => {
                  setChannelOffset(v === NONE ? "" : v);
                  const sig = signals.find((s) => String(s.channelOffset) === v);
                  if (sig?.tagSuffix) setSignalTag(`{{instance.tag}}_${sig.tagSuffix}`);
                }}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="Select signal…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— none (use tag pattern) —</SelectItem>
                  {signals.map((s) => (
                    <SelectItem key={s.id} value={String(s.channelOffset)}>
                      {s.channelOffset}: {s.tagSuffix ?? "(unnamed)"} ({s.ioType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="space-y-1 mt-2">
                <Label className="text-xs">Or tag pattern</Label>
                <Input value={signalTag} onChange={(e) => setSignalTag(e.target.value)} className="font-mono text-xs" placeholder={"{{instance.tag}}_SpeedRPM"} />
              </div>
            </div>
          )}

          {sourceType === "LITERAL" && (
            <div className="space-y-1">
              <Label className="text-xs">Literal Value</Label>
              <Input value={literalValue} onChange={(e) => setLiteralValue(e.target.value)} className="font-mono" placeholder="e.g. TRUE, 0, 3000" />
            </div>
          )}

          {sourceType === "EXPRESSION" && (
            <div className="space-y-1">
              <Label className="text-xs">Expression</Label>
              <Input value={expression} onChange={(e) => setExpression(e.target.value)} className="font-mono" placeholder={"e.g. {{instance.tag}}_DataConfig"} />
              <p className="text-[10px] text-muted-foreground">Variables: {"{{instance.tag}}"}, {"{{instance.name}}"}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!parameterName || upsert.isPending}>
            {upsert.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
