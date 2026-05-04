"use client";

import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, Info, RotateCcw, Save, AlertTriangle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

// Catalog shape mirrors module_commissioning.json (vendored from MIAS-ref).
type CatalogSetting = {
  name: string;
  data_type?: string;
  register_or_object?: string | null;
  value_range?: string | null;
  default_value?: string | number | boolean | null;
  mias_convention_value?: string | number | boolean | null;
  unit?: string | null;
  description?: string;
  writable_via?: string[];
  encoding_observed?: Record<string, string | number>;
};

type CatalogData = {
  module_class?: string;
  needs_commissioning?: boolean;
  iec_globals_path_pattern?: string | null;
  library_fb?: { codesys_v3_namespace?: string | null; config_fb?: string | null } | null;
  commissioning_settings?: CatalogSetting[];
  commissioning_constraints?: { affected_settings: string[]; rule: string; violation_consequence?: string }[];
  apply_method?: { requires_full_pfc_reboot?: boolean; requires_runtime_restart?: boolean; takes_effect_immediately?: boolean; save_to_eeprom_required?: boolean; notes?: string };
  source?: { verified_against_running_hardware?: boolean; verification_project?: string };
};

type Props =
  | { kind: "plc"; plcId: number; slotPosition?: never }
  | { kind: "ioCard"; ioCardId: number; slotPosition: number };

export function CommissioningPanel(props: Props) {
  const isPlc = props.kind === "plc";
  const [expanded, setExpanded] = useState(false);

  // Lazy-load: only fetch catalog + overrides when the user actually opens
  // the panel. With 50+ cards in a typical project we can't afford to fire
  // a query per card on page load.
  const plcQuery = trpc.projectHardware.plcCommissioningList.useQuery(
    { plcId: isPlc ? props.plcId : 0 },
    { enabled: isPlc && expanded },
  );
  const cardQuery = trpc.projectHardware.ioCardCommissioningList.useQuery(
    { ioCardId: !isPlc ? props.ioCardId : 0 },
    { enabled: !isPlc && expanded },
  );
  const data = isPlc ? plcQuery.data : cardQuery.data;
  const isLoading = isPlc ? plcQuery.isLoading : cardQuery.isLoading;

  const utils = trpc.useUtils();
  const refetchAll = () => {
    if (isPlc) utils.projectHardware.plcCommissioningList.invalidate({ plcId: props.plcId });
    else utils.projectHardware.ioCardCommissioningList.invalidate({ ioCardId: props.ioCardId });
  };

  const plcSet = trpc.projectHardware.plcCommissioningSet.useMutation({ onSuccess: refetchAll });
  const plcClear = trpc.projectHardware.plcCommissioningClear.useMutation({ onSuccess: refetchAll });
  const cardSet = trpc.projectHardware.ioCardCommissioningSet.useMutation({ onSuccess: refetchAll });
  const cardClear = trpc.projectHardware.ioCardCommissioningClear.useMutation({ onSuccess: refetchAll });

  const setOverride = (name: string, value: string, notes: string | null) => {
    if (isPlc) plcSet.mutate({ plcId: props.plcId, name, value, notes });
    else cardSet.mutate({ ioCardId: props.ioCardId, name, value, notes });
  };
  const clearOverride = (name: string) => {
    if (isPlc) plcClear.mutate({ plcId: props.plcId, name });
    else cardClear.mutate({ ioCardId: props.ioCardId, name });
  };

  const saving =
    plcSet.isPending || plcClear.isPending || cardSet.isPending || cardClear.isPending;

  const catalog = (data?.catalog?.commissioningData as CatalogData | null) ?? null;
  const overrides = data?.commissioning ?? [];
  const overrideMap = new Map(overrides.map((o) => [o.name, o]));
  const settings = catalog?.commissioning_settings ?? [];
  const overrideCount = overrides.length;

  // When the panel is collapsed we have no `data` (lazy-loaded) — show a
  // generic header. Once opened, the query fires and the row count updates.

  return (
    <div className="rounded-md border">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="font-semibold uppercase tracking-wide text-xs text-muted-foreground">
          Commissioning
        </span>
        {data?.catalog && (
          <span className="text-xs text-muted-foreground font-mono">
            {data.catalog.vendorName?.toLowerCase()}:{data.catalog.articleNumber}
          </span>
        )}
        {catalog?.module_class && (
          <Badge variant="outline" className="text-[10px]">{catalog.module_class}</Badge>
        )}
        <span className="flex-1" />
        {expanded && (
          <span className="text-xs text-muted-foreground">
            {settings.length} setting{settings.length !== 1 ? "s" : ""}
            {overrideCount > 0 && (
              <span className="ml-2 text-amber-600 dark:text-amber-400">
                · {overrideCount} override{overrideCount !== 1 ? "s" : ""}
              </span>
            )}
          </span>
        )}
        {catalog?.source?.verified_against_running_hardware && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild><span><Badge variant="outline" className="text-[10px] border-green-500/50 text-green-700 dark:text-green-400">verified</Badge></span></TooltipTrigger>
              <TooltipContent side="top">Verified against running hardware{catalog.source?.verification_project ? ` (${catalog.source.verification_project})` : ""}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </button>

      {expanded && isLoading && (
        <div className="border-t p-3 text-xs text-muted-foreground">Loading commissioning data…</div>
      )}

      {expanded && !isLoading && !catalog && (
        <div className="border-t p-3 text-xs text-muted-foreground italic">
          No commissioning catalog data for this part. (Run <code className="font-mono">npx tsx prisma/seed_commissioning_catalog.ts</code> if you expect data here.)
        </div>
      )}

      {expanded && !isLoading && catalog && (
        <div className="border-t p-3 space-y-3">
          {catalog.apply_method && (
            <div className="text-xs text-muted-foreground space-y-0.5">
              <span className="font-semibold uppercase tracking-wide">Apply method:</span>{" "}
              {catalog.apply_method.takes_effect_immediately && <span className="mr-2">immediate</span>}
              {catalog.apply_method.save_to_eeprom_required && <span className="mr-2">EEPROM save</span>}
              {catalog.apply_method.requires_runtime_restart && <span className="mr-2">runtime restart</span>}
              {catalog.apply_method.requires_full_pfc_reboot && (
                <span className="mr-2 text-amber-600 dark:text-amber-400">full PFC reboot</span>
              )}
              {catalog.apply_method.notes && (
                <p className="text-[11px] text-muted-foreground/80 italic">{catalog.apply_method.notes}</p>
              )}
            </div>
          )}

          {settings.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              {catalog.needs_commissioning === false
                ? "Module ships factory-ready — no commissioning required."
                : "No commissionable settings in catalog."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Setting</TableHead>
                  <TableHead className="w-[35%]">Effective value</TableHead>
                  <TableHead className="w-[25%]">Source / actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settings.map((s) => (
                  <SettingRow
                    key={s.name}
                    setting={s}
                    override={overrideMap.get(s.name) ?? null}
                    onSet={setOverride}
                    onClear={clearOverride}
                    saving={saving}
                  />
                ))}
              </TableBody>
            </Table>
          )}

          {(catalog?.commissioning_constraints?.length ?? 0) > 0 && (
            <div className="text-xs space-y-1 mt-2">
              <span className="font-semibold uppercase tracking-wide text-muted-foreground">Constraints:</span>
              <ul className="space-y-0.5">
                {catalog!.commissioning_constraints!.map((c, i) => (
                  <li key={i} className="text-muted-foreground">
                    <span className="font-mono text-[10px] mr-1">{c.affected_settings.join(" + ")}:</span>
                    {c.rule}
                    {c.violation_consequence && (
                      <span className="block text-[11px] italic ml-3 text-amber-600 dark:text-amber-400">
                        ⚠ {c.violation_consequence}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SettingRow({
  setting,
  override,
  onSet,
  onClear,
  saving,
}: {
  setting: CatalogSetting;
  override: { name: string; value: string; notes: string | null } | null;
  onSet: (name: string, value: string, notes: string | null) => void;
  onClear: (name: string) => void;
  saving: boolean;
}) {
  const writableFromIec = setting.writable_via?.includes("Library FB input") ?? false;
  const miasConvention =
    setting.mias_convention_value != null ? String(setting.mias_convention_value) : null;
  const defaultValue = setting.default_value != null ? String(setting.default_value) : null;
  const fallback = miasConvention ?? defaultValue;
  const effective = override?.value ?? fallback;
  const fallbackSource = override ? "override" : miasConvention ? "MIAS convention" : defaultValue ? "factory default" : "unset";

  // Parse value_range "A | B | C" into enum options when data_type is ENUM.
  const enumOptions = useMemo(() => {
    if (setting.data_type !== "ENUM" || !setting.value_range) return null;
    return setting.value_range
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [setting.data_type, setting.value_range]);

  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState<string>(effective ?? "");
  const [draftNotes, setDraftNotes] = useState<string>(override?.notes ?? "");

  useEffect(() => {
    if (!editing) {
      setDraftValue(effective ?? "");
      setDraftNotes(override?.notes ?? "");
    }
  }, [effective, override?.notes, editing]);

  const inputId = `commission-${setting.name}`;
  const ChangeInput = enumOptions ? (
    <Select value={draftValue} onValueChange={setDraftValue} disabled={saving}>
      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={fallback ?? "Select…"} /></SelectTrigger>
      <SelectContent>
        {enumOptions.map((opt) => (
          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : setting.data_type === "BOOL" ? (
    <Select value={draftValue} onValueChange={setDraftValue} disabled={saving}>
      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={fallback ?? "Select…"} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="true">true</SelectItem>
        <SelectItem value="false">false</SelectItem>
      </SelectContent>
    </Select>
  ) : (
    <Input
      id={inputId}
      type={setting.data_type && /INT$|UINT|REAL/.test(setting.data_type) ? "number" : "text"}
      className="h-8 text-xs"
      value={draftValue}
      placeholder={fallback ?? ""}
      onChange={(e) => setDraftValue(e.target.value)}
      disabled={saving}
    />
  );

  return (
    <TableRow className={cn(override && "bg-amber-50/50 dark:bg-amber-950/20")}>
      <TableCell className="align-top">
        <div className="flex items-start gap-1.5">
          <span className="font-medium text-xs">{setting.name}</span>
          {!writableFromIec && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span><Lock className="h-3 w-3 text-muted-foreground mt-0.5" /></span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm">
                  Operator-only — IEC commissioner cannot write this. Set via {setting.writable_via?.join(" or ") ?? "operator interface"}.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {setting.description && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span><Info className="h-3 w-3 text-muted-foreground mt-0.5" /></span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-md">
                  <p className="text-xs">{setting.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex flex-wrap gap-1 mt-1 text-[10px] text-muted-foreground">
          {setting.data_type && <span className="font-mono">{setting.data_type}</span>}
          {setting.unit && <span>· {setting.unit}</span>}
          {setting.register_or_object && <span>· {setting.register_or_object}</span>}
          {setting.value_range && <span className="italic">· {setting.value_range}</span>}
        </div>
      </TableCell>

      <TableCell className="align-top">
        {editing ? (
          <div className="space-y-1.5">
            {ChangeInput}
            <Input
              className="h-7 text-[11px]"
              placeholder="Notes (optional)"
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
              disabled={saving}
            />
          </div>
        ) : (
          <div className="space-y-0.5">
            <span className={cn("text-xs font-mono", override && "font-semibold text-amber-700 dark:text-amber-400")}>
              {effective ?? <em className="opacity-50">unset</em>}
            </span>
            {miasConvention && miasConvention !== effective && (
              <div className="text-[10px] text-muted-foreground">
                MIAS convention: <span className="font-mono">{miasConvention}</span>
              </div>
            )}
            {defaultValue && defaultValue !== effective && defaultValue !== miasConvention && (
              <div className="text-[10px] text-muted-foreground">
                Factory default: <span className="font-mono">{defaultValue}</span>
              </div>
            )}
            {override?.notes && (
              <div className="text-[10px] italic text-muted-foreground">{override.notes}</div>
            )}
          </div>
        )}
      </TableCell>

      <TableCell className="align-top">
        <div className="flex items-center gap-1 flex-wrap">
          <Badge variant={override ? "default" : "outline"} className="text-[10px]">
            {fallbackSource}
          </Badge>
          {editing ? (
            <>
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs"
                disabled={saving || draftValue.trim() === ""}
                onClick={() => {
                  onSet(setting.name, draftValue.trim(), draftNotes.trim() || null);
                  setEditing(false);
                }}
              >
                <Save className="h-3 w-3 mr-1" /> Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                disabled={saving}
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={saving}
                onClick={() => {
                  setDraftValue(effective ?? "");
                  setDraftNotes(override?.notes ?? "");
                  setEditing(true);
                }}
              >
                {override ? "Edit" : "Override"}
              </Button>
              {override && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  disabled={saving}
                  onClick={() => onClear(setting.name)}
                  title="Clear override (revert to MIAS convention / default)"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              )}
            </>
          )}
        </div>
        {!writableFromIec && override && (
          <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 mt-1">
            <AlertTriangle className="h-3 w-3" />
            Operator-only — IEC commissioner won&apos;t write this
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
