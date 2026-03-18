"use client";

import { use, useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
  type RowSelectionState,
  type FilterFn,
  type Column,
} from "@tanstack/react-table";
import { trpc } from "@/trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, X, Trash2, Settings2, Upload, Layers, ChevronUp, ChevronDown, ChevronRight, ChevronsUpDown, Network, Bell, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddEditSignalDialog } from "./_components/AddEditSignalDialog";
import { ImportSignalsDialog } from "./_components/ImportSignalsDialog";
import { AddFromComponentDialog } from "./_components/AddFromComponentDialog";
import { ProjectBusConfigDialog } from "./_components/ProjectBusConfigDialog";
import { ProjectAlarmsDialog } from "./_components/ProjectAlarmsDialog";
import { ComponentGroup } from "./_components/ComponentGroup";
import { CreateComponentDialog } from "./_components/CreateComponentDialog";

type SignalRow = inferRouterOutputs<AppRouter>["signal"]["list"][number];
type CardInfo = inferRouterOutputs<AppRouter>["signal"]["cardsForProject"][number];
type EUInfo = inferRouterOutputs<AppRouter>["signal"]["engineeringUnits"][number];
type PlcDataTypeInfo = inferRouterOutputs<AppRouter>["signal"]["plcDataTypeList"][number];
type InputTypeInfo = inferRouterOutputs<AppRouter>["signal"]["analogInputTypes"][number];
type SystemInfo = inferRouterOutputs<AppRouter>["signal"]["systemList"][number];
type GvlInfo = inferRouterOutputs<AppRouter>["signal"]["gvlList"][number];

type EditValues = {
  tag: string;
  description: string;
  signalType: "DISCRETE" | "ANALOG";
  origin: string;
  ioCardId: number | null;
  channelPosition: string;
  direction: "INPUT" | "OUTPUT" | "";
  systemId: number | null;
  componentTag: string;
  drawingRef: string;
  cabinetLocation: string;
  gvlId: number | null;
  // Discrete
  trigger: "NO" | "NC";
  filterTimeMs: string;
  // Analog
  inputTypeId: number | null;
  wireConfig: "TWO_WIRE" | "THREE_WIRE" | "FOUR_WIRE" | "";
  engineeringUnitId: number | null;
  scaleMin: string;
  scaleMax: string;
  plcDataTypeId: number | null;
};

// ── Column definitions (ordered to match Excel sheet 2) ──────────────────────

type ColKey =
  | "select" | "system" | "component" | "desc" | "tag"
  | "card" | "ch" | "io" | "origin" | "bus" | "canid" | "alarms"
  | "trigger" | "filter" | "itype" | "wire" | "eu" | "smin" | "smax" | "dtype"
  | "gvl" | "drawing" | "cabinet" | "actions";

type ColDef = {
  key: ColKey;
  label: string;
  defaultWidth: number;
  disc?: true;
  anlg?: true;
};

const COL_DEFS: ColDef[] = [
  { key: "select",    label: "",           defaultWidth: 36 },
  { key: "system",    label: "System",     defaultWidth: 72 },
  { key: "component", label: "Component",  defaultWidth: 88 },
  { key: "desc",      label: "Description",defaultWidth: 200 },
  { key: "tag",       label: "Tag",        defaultWidth: 100 },
  { key: "card",      label: "Card",       defaultWidth: 200 },
  { key: "ch",        label: "Ch",         defaultWidth: 36 },
  { key: "io",        label: "IO",         defaultWidth: 52 },
  { key: "origin",    label: "Origin",     defaultWidth: 90 },
  { key: "bus",       label: "Bus",        defaultWidth: 44 },
  { key: "canid",     label: "CAN ID",     defaultWidth: 72 },
  { key: "alarms",    label: "Alarms",     defaultWidth: 58 },
  { key: "trigger",   label: "Trigger",    defaultWidth: 60,  disc: true },
  { key: "filter",    label: "Filter ms",  defaultWidth: 70,  disc: true },
  { key: "itype",     label: "Input",      defaultWidth: 90,  anlg: true },
  { key: "wire",      label: "Wire",       defaultWidth: 68,  anlg: true },
  { key: "eu",        label: "EU",         defaultWidth: 52,  anlg: true },
  { key: "smin",      label: "Scale Min",  defaultWidth: 68,  anlg: true },
  { key: "smax",      label: "Scale Max",  defaultWidth: 68,  anlg: true },
  { key: "dtype",     label: "PLC Type",   defaultWidth: 72,  anlg: true },
  { key: "gvl",       label: "GVL",        defaultWidth: 80 },
  { key: "drawing",   label: "Drawing",    defaultWidth: 80 },
  { key: "cabinet",   label: "Cabinet",    defaultWidth: 68 },
  { key: "actions",   label: "",           defaultWidth: 56 },
];

// ── Label maps ────────────────────────────────────────────────────────────────

const WIRE_CONFIG_LABELS: Record<string, string> = {
  TWO_WIRE: "2-Wire", THREE_WIRE: "3-Wire", FOUR_WIRE: "4-Wire",
};

const TYPE_COLORS: Record<string, string> = {
  DI:    "bg-blue-50 border-blue-200 text-blue-800",
  DO:    "bg-green-50 border-green-200 text-green-800",
  AI:    "bg-purple-50 border-purple-200 text-purple-800",
  AO:    "bg-orange-50 border-orange-200 text-orange-800",
  MIXED: "bg-yellow-50 border-yellow-200 text-yellow-800",
  RELAY: "bg-red-50 border-red-200 text-red-800",
  DISC:  "bg-blue-50 border-blue-100 text-blue-600",
  ANLG:  "bg-purple-50 border-purple-100 text-purple-600",
};

import { SIGNAL_ORIGINS, type SignalOrigin } from "@/lib/enums";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSignalIoCode(signal: SignalRow): string {
  const dir = signal.direction ?? (
    signal.ioCard?.catalog?.cardType === "DI" || signal.ioCard?.catalog?.cardType === "AI" ? "INPUT" :
    signal.ioCard?.catalog?.cardType === "DO" || signal.ioCard?.catalog?.cardType === "AO" ? "OUTPUT" : null
  );
  if (signal.signalType === "DISCRETE") return dir === "OUTPUT" ? "DO" : "DI";
  return dir === "OUTPUT" ? "AO" : "AI";
}

function nextAvailableChannel(signals: SignalRow[], cardId: number, excludeId?: number): number {
  const used = new Set(
    signals
      .filter((s) => s.ioCardId === cardId && s.id !== excludeId && s.channelPosition != null)
      .map((s) => s.channelPosition as number)
  );
  let ch = 0;
  while (used.has(ch)) ch++;
  return ch;
}

function deriveFromCard(card: CardInfo, isNew: boolean): Partial<EditValues> {
  const ct = card.cardType;
  const derived: Partial<EditValues> = {};
  if (ct === "DI" || ct === "AI") derived.direction = "INPUT";
  else if (ct === "DO" || ct === "AO" || ct === "RELAY") derived.direction = "OUTPUT";
  if ((ct === "DI" || ct === "DO" || ct === "RELAY") && card.filterTimeMs != null) {
    derived.filterTimeMs = String(Number(card.filterTimeMs));
  }
  if (isNew) {
    if (ct === "DI" || ct === "DO" || ct === "RELAY") derived.signalType = "DISCRETE";
    else if (ct === "AI" || ct === "AO") derived.signalType = "ANALOG";
  }
  return derived;
}

function defaultEditValues(signal?: SignalRow): EditValues {
  if (!signal) return {
    tag: "", description: "", signalType: "DISCRETE", origin: "IEC",
    ioCardId: null, channelPosition: "",
    direction: "", systemId: null, componentTag: "", drawingRef: "", cabinetLocation: "", gvlId: null,
    trigger: "NO", filterTimeMs: "",
    inputTypeId: null, wireConfig: "", engineeringUnitId: null, scaleMin: "", scaleMax: "", plcDataTypeId: null,
  };
  return {
    tag: signal.tag ?? "",
    description: signal.description ?? "",
    signalType: signal.signalType,
    origin: signal.origin,
    ioCardId: signal.ioCardId ?? null,
    channelPosition: signal.channelPosition != null ? String(signal.channelPosition) : "",
    direction: signal.direction ?? "",
    systemId: signal.systemId ?? null,
    componentTag: signal.componentTag ?? "",
    drawingRef: signal.drawingRef ?? "",
    cabinetLocation: signal.cabinetLocation ?? "",
    gvlId: signal.gvlId ?? null,
    trigger: signal.discreteSignal?.trigger ?? "NO",
    filterTimeMs: signal.discreteSignal?.filterTimeMs != null
      ? String(Number(signal.discreteSignal.filterTimeMs)) : "",
    inputTypeId: signal.analogSignal?.inputTypeId ?? null,
    wireConfig: (signal.analogSignal?.wireConfig ?? "") as EditValues["wireConfig"],
    engineeringUnitId: signal.analogSignal?.engineeringUnitId ?? null,
    scaleMin: signal.analogSignal?.scaleMin != null ? String(Number(signal.analogSignal.scaleMin)) : "",
    scaleMax: signal.analogSignal?.scaleMax != null ? String(Number(signal.analogSignal.scaleMax)) : "",
    plcDataTypeId: signal.analogSignal?.plcDataTypeId ?? null,
  };
}

function buildPayload(v: EditValues) {
  return {
    tag: v.tag || null,
    description: v.description || null,
    origin: v.origin as SignalOrigin,
    ioCardId: v.ioCardId,
    channelPosition: v.channelPosition !== "" ? Number(v.channelPosition) : null,
    direction: (v.direction || null) as "INPUT" | "OUTPUT" | null | undefined,
    systemId: v.systemId,
    componentTag: v.componentTag || null,
    drawingRef: v.drawingRef || null,
    cabinetLocation: v.cabinetLocation || null,
    gvlId: v.gvlId,
    trigger: v.trigger,
    filterTimeMs: v.filterTimeMs !== "" ? Number(v.filterTimeMs) : null,
    inputTypeId: v.inputTypeId,
    wireConfig: (v.wireConfig || null) as "TWO_WIRE" | "THREE_WIRE" | "FOUR_WIRE" | null | undefined,
    engineeringUnitId: v.engineeringUnitId,
    scaleMin: v.scaleMin !== "" ? Number(v.scaleMin) : null,
    scaleMax: v.scaleMax !== "" ? Number(v.scaleMax) : null,
    plcDataTypeId: v.plcDataTypeId,
  };
}

// ── Column resizing ───────────────────────────────────────────────────────────

function useColumnWidths() {
  const [widths, setWidths] = useState<Record<ColKey, number>>(
    () => Object.fromEntries(COL_DEFS.map((d) => [d.key, d.defaultWidth])) as Record<ColKey, number>
  );

  const onResizeStart = useCallback((key: ColKey, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = widths[key];
    function onMove(me: MouseEvent) {
      setWidths((prev) => ({ ...prev, [key]: Math.max(32, startWidth + me.clientX - startX) }));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widths]);

  return { widths, onResizeStart };
}

// ── Cell helpers ──────────────────────────────────────────────────────────────

function Na() {
  return (
    <td className="px-2 py-1 align-middle text-center">
      <span className="text-xs text-muted-foreground/25">—</span>
    </td>
  );
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-2 py-1 align-middle overflow-hidden", className)}>{children}</td>;
}

// ── Display row ───────────────────────────────────────────────────────────────

function DisplayRow({ signal, selected, onToggleSelect, onEdit, onAdvanced, onDelete, onBusConfig, onAlarms, onRevert, isRevertPending }: {
  signal: SignalRow;
  selected: boolean;
  onToggleSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEdit: () => void; onAdvanced: () => void; onDelete: () => void;
  onBusConfig: () => void;
  onAlarms: () => void;
  onRevert?: () => void;
  isRevertPending?: boolean;
}) {
  const ioCode = getSignalIoCode(signal);
  const typeColor = TYPE_COLORS[ioCode] ?? "bg-muted border-border text-muted-foreground";
  const isDisc = signal.signalType === "DISCRETE";
  const isAnlg = signal.signalType === "ANALOG";

  const hardware = signal.ioCard
    ? `${signal.ioCard.carrier.plc.name} / ${signal.ioCard.carrier.name} / Slot ${signal.ioCard.slotPosition + 1}`
    : null;

  return (
    <tr
      className={cn(
        "border-b border-border/40 cursor-pointer group",
        selected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-accent/30"
      )}
      onClick={onEdit}
    >
      <td className="px-2 py-1 align-middle" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          className="h-3.5 w-3.5 rounded border-input cursor-pointer"
          checked={selected}
          onChange={onToggleSelect}
        />
      </td>
      <Td><span className="text-xs text-muted-foreground truncate block" title={signal.system?.name}>{signal.system?.name ?? "—"}</span></Td>
      <Td><span className="text-xs text-muted-foreground truncate block">{signal.componentTag ?? "—"}</span></Td>
      <Td><span className="block truncate text-sm" title={signal.description ?? undefined}>{signal.description ?? ""}</span></Td>
      <Td>
        {signal.tag
          ? <span className="font-mono text-xs truncate block">{signal.tag}</span>
          : <span className="text-muted-foreground/40 text-xs italic">—</span>}
      </Td>
      <Td>
        {signal.origin === "IEC"
          ? hardware
            ? <span className="text-xs block truncate">{hardware}</span>
            : <span className="text-xs text-muted-foreground/40">—</span>
          : <span className="text-xs text-muted-foreground italic">Via network</span>}
      </Td>
      <Td className="text-center">
        <span className="text-xs tabular-nums">
          {signal.origin === "IEC" && signal.channelPosition != null ? signal.channelPosition : ""}
        </span>
      </Td>
      <Td>
        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 font-medium", typeColor)}>
          {ioCode}
        </Badge>
      </Td>
      <Td><span className="text-xs text-muted-foreground truncate block">{signal.origin}</span></Td>
      <Td className="text-center">
        {signal.origin !== "IEC" && signal.origin !== "INTERNAL" ? (
          <button
            type="button"
            title={signal.busSignal ? "Edit bus config" : "Add bus config"}
            className={cn(
              "rounded p-0.5 transition-colors",
              signal.busSignal
                ? "text-blue-600 hover:bg-blue-50"
                : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent"
            )}
            onClick={(e) => { e.stopPropagation(); onBusConfig(); }}
          >
            <Network className="h-3.5 w-3.5" />
          </button>
        ) : <span className="text-xs text-muted-foreground/25">—</span>}
      </Td>
      {/* CAN ID (resolved = raw + instance offset) */}
      <Td className="text-center">
        {(() => {
          const rawCanId = signal.busSignal?.canId ?? signal.instanceSignal?.componentSignal?.canId ?? null;
          if (rawCanId == null) return <span className="text-xs text-muted-foreground/25">—</span>;
          const offset = signal.instanceSignal?.instance?.canIdOffset ?? 0;
          const resolved = rawCanId + offset;
          return (
            <span
              className="font-mono text-xs tabular-nums"
              title={offset !== 0 ? `Raw: 0x${rawCanId.toString(16).toUpperCase()} + offset ${offset >= 0 ? "+" : ""}${offset}` : undefined}
            >
              {`0x${resolved.toString(16).toUpperCase()}`}
            </span>
          );
        })()}
      </Td>

      {/* Alarms */}
      <Td className="text-center">
        {(() => {
          const count = isDisc
            ? (signal.discreteSignal?.alarms?.length ?? 0)
            : (signal.analogSignal?.alarms?.length ?? 0);
          return (
            <button
              type="button"
              title={count > 0 ? `${count} alarm${count === 1 ? "" : "s"}` : "No alarms"}
              className="flex items-center justify-center gap-0.5 rounded p-0.5 transition-colors hover:bg-accent"
              onClick={(e) => { e.stopPropagation(); onAlarms(); }}
            >
              <Bell className={cn("h-3.5 w-3.5", count > 0 ? "text-amber-500" : "text-muted-foreground/30")} />
              {count > 0 && (
                <span className="text-[10px] font-medium text-amber-600 tabular-nums">{count}</span>
              )}
            </button>
          );
        })()}
      </Td>

      {/* Discrete-only */}
      {isDisc ? (
        <>
          <Td><span className="text-xs">{signal.discreteSignal?.trigger ?? "—"}</span></Td>
          <Td>
            <span className="text-xs text-muted-foreground">
              {signal.discreteSignal?.filterTimeMs != null
                ? `${Number(signal.discreteSignal.filterTimeMs)} ms` : "—"}
            </span>
          </Td>
        </>
      ) : <><Na /><Na /></>}

      {/* Analog-only */}
      {isAnlg ? (
        <>
          <Td><span className="text-xs truncate block">{signal.analogSignal?.inputType?.name ?? "—"}</span></Td>
          <Td>
            <span className="text-xs text-muted-foreground">
              {signal.analogSignal?.wireConfig
                ? (WIRE_CONFIG_LABELS[signal.analogSignal.wireConfig] ?? signal.analogSignal.wireConfig)
                : "—"}
            </span>
          </Td>
          <Td><span className="text-xs text-muted-foreground">{signal.analogSignal?.engineeringUnit?.symbol ?? "—"}</span></Td>
          <Td className="text-right"><span className="text-xs tabular-nums">{signal.analogSignal?.scaleMin != null ? Number(signal.analogSignal.scaleMin) : "—"}</span></Td>
          <Td className="text-right"><span className="text-xs tabular-nums">{signal.analogSignal?.scaleMax != null ? Number(signal.analogSignal.scaleMax) : "—"}</span></Td>
          <Td>
            {(() => {
              const euType = signal.analogSignal?.engineeringUnit?.plcDataTypeCatalog?.code;
              const sigType = signal.analogSignal?.plcDataTypeCatalog?.code;
              const resolved = euType ?? sigType;
              return resolved
                ? <span className={cn("text-xs font-mono", euType && "text-purple-600")} title={euType ? "From EU" : undefined}>{resolved}</span>
                : <span className="text-xs text-muted-foreground/40">—</span>;
            })()}
          </Td>
        </>
      ) : <><Na /><Na /><Na /><Na /><Na /><Na /></>}

      <Td><span className="text-xs text-muted-foreground truncate block">{signal.gvl?.name ?? "—"}</span></Td>
      <Td><span className="text-xs text-muted-foreground truncate block">{signal.drawingRef ?? "—"}</span></Td>
      <Td><span className="text-xs text-muted-foreground">{signal.cabinetLocation ?? "—"}</span></Td>
      <Td>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {signal.instanceSignal?.templateDirty && onRevert && (
            <button type="button" title="Revert to component template defaults"
              className="rounded p-1 hover:bg-accent text-amber-500 hover:text-amber-600 disabled:opacity-50"
              disabled={isRevertPending}
              onClick={(e) => { e.stopPropagation(); onRevert(); }}
            ><RotateCcw className="h-3.5 w-3.5" /></button>
          )}
          <button type="button" title="Advanced"
            className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); onAdvanced(); }}
          ><Settings2 className="h-3.5 w-3.5" /></button>
          <button type="button" title="Delete"
            className="rounded p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete signal "${signal.tag ?? signal.description ?? `#${signal.id}`}"?`)) onDelete();
            }}
          ><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </Td>
    </tr>
  );
}

// ── Edit row ──────────────────────────────────────────────────────────────────

function EditRow({
  values, cards, units, inputTypes, plcDataTypes, systems, gvls,
  signals, editingId, isNew, isSaving,
  onChange, onSave, onBlurSave, onCancel,
}: {
  values: EditValues;
  cards: CardInfo[];
  units: EUInfo[];
  inputTypes: InputTypeInfo[];
  plcDataTypes: PlcDataTypeInfo[];
  systems: SystemInfo[];
  gvls: GvlInfo[];
  signals: SignalRow[];
  editingId?: number;
  isNew?: boolean;
  isSaving?: boolean;
  onChange: (v: Partial<EditValues>) => void;
  onSave: (vals: EditValues) => void;
  onBlurSave: (vals: EditValues) => void;
  onCancel: () => void;
}) {
  const inp = "h-7 w-full rounded border border-input bg-background px-1.5 text-xs focus:outline-hidden focus:ring-1 focus:ring-ring";
  const sel = "h-7 w-full rounded border border-input bg-background px-1 text-xs focus:outline-hidden focus:ring-1 focus:ring-ring";
  const isDisc = values.signalType === "DISCRETE";
  const isAnlg = values.signalType === "ANALOG";

  const valuesRef = useRef(values);
  valuesRef.current = values;

  function handleCardChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const cardId = e.target.value ? Number(e.target.value) : null;
    const ch = cardId != null ? String(nextAvailableChannel(signals, cardId, editingId)) : "";
    const card = cards.find((c) => c.id === cardId);
    const derived = card ? deriveFromCard(card, !!isNew) : { direction: "", filterTimeMs: "" };
    let defaultPdt: number | null | undefined;
    if (isNew && card) {
      const ct = card.cardType;
      if (ct === "DI" || ct === "DO" || ct === "RELAY") {
        defaultPdt = plcDataTypes.find((d) => d.code === "BOOL")?.id ?? null;
      } else if (ct === "AI" || ct === "AO") {
        defaultPdt = plcDataTypes.find((d) => d.code === "REAL")?.id ?? null;
      }
    }
    const update: Partial<EditValues> = { ioCardId: cardId, channelPosition: ch, ...(derived as Partial<EditValues>) };
    if (defaultPdt !== undefined) update.plcDataTypeId = defaultPdt;
    onChange(update);
  }

  function handleRowBlur(e: React.FocusEvent<HTMLTableRowElement>) {
    const row = e.currentTarget;
    const snap = valuesRef.current;
    setTimeout(() => {
      if (!row.contains(document.activeElement)) {
        onBlurSave(snap);
      }
    }, 150);
  }

  function GrayCell() {
    return <td className="px-2 py-1 align-middle text-center"><span className="text-xs text-muted-foreground/25">—</span></td>;
  }

  return (
    <tr
      className="border-b border-border bg-accent/20"
      onBlur={handleRowBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSave(valuesRef.current); }
        if (e.key === "Escape") onCancel();
      }}
    >
      {/* Checkbox placeholder — not selectable in edit mode */}
      <td className="px-2 py-1 align-middle">
        <span className="block h-3.5 w-3.5" />
      </td>
      {/* System */}
      <Td>
        <select className={sel} value={values.systemId ?? ""} onChange={(e) => onChange({ systemId: e.target.value ? Number(e.target.value) : null })}>
          <option value="">—</option>
          {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Td>
      {/* Component */}
      <Td><input className={inp} value={values.componentTag} onChange={(e) => onChange({ componentTag: e.target.value })} placeholder="e.g. 625-M01" /></Td>
      {/* Description */}
      <Td><input className={inp} value={values.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="Description" autoFocus={isNew} /></Td>
      {/* Tag */}
      <Td><input className={inp} value={values.tag} onChange={(e) => onChange({ tag: e.target.value })} placeholder="TAG" /></Td>
      {/* Card */}
      <Td>
        {values.origin === "IEC" ? (
          <select className={sel} value={values.ioCardId ?? ""} onChange={handleCardChange}>
            <option value="">— Unassigned —</option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.path}{c.articleNumber ? ` — ${c.articleNumber}` : ""}{c.description ? `: ${c.description}` : ""}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-muted-foreground italic">Via network</span>
        )}
      </Td>
      {/* Ch */}
      <Td>
        {values.origin === "IEC"
          ? <input className={cn(inp, "text-center")} type="number" min={0} value={values.channelPosition} onChange={(e) => onChange({ channelPosition: e.target.value })} placeholder="0" />
          : <span className="text-xs text-muted-foreground">—</span>}
      </Td>
      {/* IO type (combined signal type + direction) */}
      <Td>
        <select
          className={sel}
          value={`${values.signalType === "DISCRETE" ? "D" : "A"}${values.direction === "OUTPUT" ? "O" : "I"}`}
          onChange={(e) => {
            const code = e.target.value;
            const signalType: "DISCRETE" | "ANALOG" = code.startsWith("D") ? "DISCRETE" : "ANALOG";
            const direction: "INPUT" | "OUTPUT" = code.endsWith("O") ? "OUTPUT" : "INPUT";
            const defaultPdt = signalType === "DISCRETE"
              ? (plcDataTypes.find((d) => d.code === "BOOL")?.id ?? null)
              : (plcDataTypes.find((d) => d.code === "REAL")?.id ?? null);
            onChange({ signalType, direction, plcDataTypeId: defaultPdt });
          }}
        >
          <option value="DI">DI</option>
          <option value="DO">DO</option>
          <option value="AI">AI</option>
          <option value="AO">AO</option>
        </select>
      </Td>
      {/* Origin */}
      <Td>
        <select className={sel} value={values.origin} onChange={(e) => onChange({ origin: e.target.value })}>
          {SIGNAL_ORIGINS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </Td>
      {/* Bus */}
      <GrayCell />
      {/* CAN ID */}
      <GrayCell />
      {/* Alarms */}
      <GrayCell />
      {/* Discrete-only */}
      {isDisc ? (
        <>
          <Td>
            <select className={sel} value={values.trigger} onChange={(e) => onChange({ trigger: e.target.value as "NO" | "NC" })}>
              <option value="NO">NO</option>
              <option value="NC">NC</option>
            </select>
          </Td>
          <Td><input className={cn(inp, "text-right")} type="number" min={0} value={values.filterTimeMs} onChange={(e) => onChange({ filterTimeMs: e.target.value })} placeholder="ms" /></Td>
        </>
      ) : <><GrayCell /><GrayCell /></>}
      {/* Analog-only */}
      {isAnlg ? (
        <>
          <Td>
            <select className={sel} value={values.inputTypeId ?? ""} onChange={(e) => {
              const typeId = e.target.value ? Number(e.target.value) : null;
              const selectedType = inputTypes.find((t) => t.id === typeId);
              const update: Partial<EditValues> = { inputTypeId: typeId };
              if (selectedType?.code === "PT100" || selectedType?.code === "PT1000") {
                const degUnit = units.find((u) => u.symbol === "°C");
                if (degUnit) update.engineeringUnitId = degUnit.id;
              }
              onChange(update);
            }}>
              <option value="">—</option>
              {inputTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Td>
          <Td>
            <select className={sel} value={values.wireConfig} onChange={(e) => onChange({ wireConfig: e.target.value as EditValues["wireConfig"] })}>
              <option value="">—</option>
              <option value="TWO_WIRE">2-Wire</option>
              <option value="THREE_WIRE">3-Wire</option>
              <option value="FOUR_WIRE">4-Wire</option>
            </select>
          </Td>
          <Td>
            <select className={sel} value={values.engineeringUnitId ?? ""} onChange={(e) => onChange({ engineeringUnitId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">—</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.symbol}</option>)}
            </select>
          </Td>
          <Td><input className={cn(inp, "text-right")} type="number" value={values.scaleMin} onChange={(e) => onChange({ scaleMin: e.target.value })} placeholder="min" /></Td>
          <Td><input className={cn(inp, "text-right")} type="number" value={values.scaleMax} onChange={(e) => onChange({ scaleMax: e.target.value })} placeholder="max" /></Td>
          <Td>
            {(() => {
              const euTypeId = values.engineeringUnitId
                ? (units.find((u) => u.id === values.engineeringUnitId)?.plcDataTypeId ?? null)
                : null;
              const euTypeCode = euTypeId
                ? (plcDataTypes.find((t) => t.id === euTypeId)?.code ?? null)
                : null;
              return euTypeCode ? (
                <span className="text-xs font-mono text-purple-600 px-1" title="Overridden by EU">{euTypeCode}</span>
              ) : (
                <select
                  className={sel}
                  value={values.plcDataTypeId ?? ""}
                  onChange={(e) => onChange({ plcDataTypeId: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">—</option>
                  {plcDataTypes.map((t) => <option key={t.id} value={t.id}>{t.code}</option>)}
                </select>
              );
            })()}
          </Td>
        </>
      ) : <><GrayCell /><GrayCell /><GrayCell /><GrayCell /><GrayCell /><GrayCell /></>}
      {/* GVL */}
      <Td>
        <select className={sel} value={values.gvlId ?? ""} onChange={(e) => onChange({ gvlId: e.target.value ? Number(e.target.value) : null })}>
          <option value="">—</option>
          {gvls.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </Td>
      {/* Drawing */}
      <Td><input className={inp} value={values.drawingRef} onChange={(e) => onChange({ drawingRef: e.target.value })} placeholder="625-E01" /></Td>
      {/* Cabinet */}
      <Td><input className={inp} value={values.cabinetLocation} onChange={(e) => onChange({ cabinetLocation: e.target.value })} placeholder="A01" /></Td>
      {/* Actions */}
      <Td>
        <div className="flex items-center gap-1">
          <button type="button" className="rounded p-1 hover:bg-green-100 text-green-700 disabled:opacity-40" onClick={() => onSave(valuesRef.current)} disabled={isSaving} title="Save (Enter)">
            <Check className="h-4 w-4" />
          </button>
          <button type="button" className="rounded p-1 hover:bg-accent text-muted-foreground" onClick={onCancel} title="Cancel (Esc)">
            <X className="h-4 w-4" />
          </button>
        </div>
      </Td>
    </tr>
  );
}

// ── TanStack column definitions ───────────────────────────────────────────────

const columnHelper = createColumnHelper<SignalRow>();

const globalFilterFn: FilterFn<SignalRow> = (row, _colId, filterValue: string) => {
  if (!filterValue) return true;
  const q = filterValue.toLowerCase();
  const s = row.original;
  return (
    (s.tag ?? "").toLowerCase().includes(q) ||
    (s.description ?? "").toLowerCase().includes(q) ||
    (s.system?.name ?? "").toLowerCase().includes(q) ||
    (s.componentTag ?? "").toLowerCase().includes(q) ||
    (s.origin ?? "").toLowerCase().includes(q) ||
    (s.ioCard ? `${s.ioCard.carrier.plc.name} ${s.ioCard.carrier.name}`.toLowerCase().includes(q) : false)
  );
};

const SIGNAL_COLUMNS = [
  columnHelper.display({ id: "select", enableSorting: false, enableColumnFilter: false }),
  columnHelper.accessor((r) => r.system?.name ?? "", { id: "system", filterFn: "includesString" }),
  columnHelper.accessor((r) => r.componentTag ?? "", { id: "component", filterFn: "includesString" }),
  columnHelper.accessor((r) => r.description ?? "", { id: "desc", filterFn: "includesString" }),
  columnHelper.accessor((r) => r.tag ?? "", { id: "tag", filterFn: "includesString" }),
  columnHelper.accessor((r) => r.ioCard ? `${r.ioCard.carrier.plc.name}/${r.ioCard.carrier.name}` : "", { id: "card", filterFn: "includesString" }),
  columnHelper.accessor((r) => r.channelPosition ?? null, { id: "ch", enableColumnFilter: false }),
  columnHelper.accessor((r) => getSignalIoCode(r), { id: "io", filterFn: "equalsString" }),
  columnHelper.accessor((r) => r.origin, { id: "origin", filterFn: "equalsString" }),
  columnHelper.display({ id: "bus", enableSorting: false, enableColumnFilter: false }),
  columnHelper.accessor(
    (r) => {
      const rawCanId = r.busSignal?.canId ?? r.instanceSignal?.componentSignal?.canId ?? null;
      if (rawCanId == null) return null;
      return rawCanId + (r.instanceSignal?.instance?.canIdOffset ?? 0);
    },
    { id: "canid", enableColumnFilter: false }
  ),
  columnHelper.accessor(
    (r) =>
      r.signalType === "DISCRETE"
        ? (r.discreteSignal?.alarms?.length ?? 0)
        : (r.analogSignal?.alarms?.length ?? 0),
    { id: "alarms", enableColumnFilter: false }
  ),
  columnHelper.accessor((r) => r.discreteSignal?.trigger ?? "", { id: "trigger", filterFn: "equalsString" }),
  columnHelper.accessor((r) => r.discreteSignal?.filterTimeMs != null ? Number(r.discreteSignal.filterTimeMs) : null, { id: "filter", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.analogSignal?.inputType?.name ?? "", { id: "itype", filterFn: "equalsString" }),
  columnHelper.accessor((r) => r.analogSignal?.wireConfig ?? "", { id: "wire", filterFn: "equalsString" }),
  columnHelper.accessor((r) => r.analogSignal?.engineeringUnit?.symbol ?? "", { id: "eu", filterFn: "equalsString" }),
  columnHelper.accessor((r) => r.analogSignal?.scaleMin != null ? Number(r.analogSignal.scaleMin) : null, { id: "smin", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.analogSignal?.scaleMax != null ? Number(r.analogSignal.scaleMax) : null, { id: "smax", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.analogSignal?.plcDataTypeCatalog?.code ?? r.analogSignal?.engineeringUnit?.plcDataTypeCatalog?.code ?? "", { id: "dtype", filterFn: "equalsString" }),
  columnHelper.accessor((r) => r.gvl?.name ?? "", { id: "gvl", filterFn: "includesString" }),
  columnHelper.accessor((r) => r.drawingRef ?? "", { id: "drawing", filterFn: "includesString" }),
  columnHelper.accessor((r) => r.cabinetLocation ?? "", { id: "cabinet", filterFn: "includesString" }),
  columnHelper.display({ id: "actions", enableSorting: false, enableColumnFilter: false }),
];

// ── Column filter inputs ──────────────────────────────────────────────────────

// Columns with text filter (free-text substring match)
const TEXT_FILTER_COLS = new Set<ColKey>(["system", "component", "desc", "tag", "card", "gvl", "drawing", "cabinet"]);
// Columns with faceted select filter (dynamic values from data)
const FACET_FILTER_COLS = new Set<ColKey>(["io", "origin", "trigger", "itype", "wire", "eu", "dtype"]);

function FilterCell({
  colKey, column, value, onChange,
}: {
  colKey: ColKey;
  column: Column<SignalRow, unknown>;
  value: string;
  onChange: (v: string) => void;
}) {
  const base = "h-6 w-full rounded border border-input bg-background text-xs focus:outline-hidden focus:ring-1 focus:ring-ring";

  if (TEXT_FILTER_COLS.has(colKey)) {
    return (
      <input
        className={cn(base, "px-1.5")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Filter…"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  if (FACET_FILTER_COLS.has(colKey)) {
    // Build options from faceted unique values (only values present in current data)
    const facetMap = column.getFacetedUniqueValues();
    const facetOptions = Array.from(facetMap.keys())
      .filter((v) => v !== "" && v != null)
      .sort()
      .map((v) => ({ value: String(v), label: String(v) }));

    return (
      <select
        className={cn(base, "px-0.5")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
      >
        <option value="">All ({facetMap.get("") != null ? facetMap.size - 1 : facetMap.size})</option>
        {facetOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label} ({facetMap.get(o.value) ?? 0})
          </option>
        ))}
      </select>
    );
  }

  return null;
}

// ── Bulk edit helpers ─────────────────────────────────────────────────────────

// Fields that should never be copied to other rows (hardware assignment or unique identifiers)
const SKIP_BULK_FIELDS = new Set<keyof EditValues>(["signalType", "ioCardId", "channelPosition", "tag"]);
// Fields only valid for DISCRETE signals
const DISC_ONLY_FIELDS = new Set<keyof EditValues>(["trigger", "filterTimeMs"]);
// Fields only valid for ANALOG signals
const ANLG_ONLY_FIELDS = new Set<keyof EditValues>(["inputTypeId", "wireConfig", "engineeringUnitId", "scaleMin", "scaleMax"]);

function computeDiff(original: EditValues, updated: EditValues): Partial<EditValues> {
  const diff: Partial<EditValues> = {};
  for (const key of Object.keys(updated) as (keyof EditValues)[]) {
    if (updated[key] !== original[key]) {
      (diff as Record<string, unknown>)[key] = updated[key];
    }
  }
  return diff;
}

function applyDiff(target: EditValues, diff: Partial<EditValues>): EditValues {
  const result = { ...target };
  for (const key of Object.keys(diff) as (keyof EditValues)[]) {
    if (SKIP_BULK_FIELDS.has(key)) continue;
    if (DISC_ONLY_FIELDS.has(key) && target.signalType !== "DISCRETE") continue;
    if (ANLG_ONLY_FIELDS.has(key) && target.signalType !== "ANALOG") continue;
    (result as Record<string, unknown>)[key] = diff[key];
  }
  return result;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProjectSignalsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const projectId = Number(id);
  const utils = trpc.useUtils();

  const { data: signals = [], isLoading } = trpc.signal.list.useQuery({ projectId });
  const { data: cards = [] } = trpc.signal.cardsForProject.useQuery({ projectId });
  const { data: units = [] } = trpc.signal.engineeringUnits.useQuery();
  const { data: inputTypes = [] } = trpc.signal.analogInputTypes.useQuery();
  const { data: plcDataTypes = [] } = trpc.signal.plcDataTypeList.useQuery();
  const { data: systems = [] } = trpc.signal.systemList.useQuery();
  const { data: gvls = [] } = trpc.signal.gvlList.useQuery();
  const { data: networks = [] } = trpc.signal.networksForProject.useQuery({ projectId });

  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<EditValues | null>(null);
  const [editOriginalValues, setEditOriginalValues] = useState<EditValues | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newValues, setNewValues] = useState<EditValues>(defaultEditValues());
  const [advancedSignal, setAdvancedSignal] = useState<SignalRow | null>(null);
  const [busConfigSignal, setBusConfigSignal] = useState<SignalRow | null>(null);
  const [alarmSignal, setAlarmSignal] = useState<SignalRow | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showAddFromComponent, setShowAddFromComponent] = useState(false);
  const [showCreateComponent, setShowCreateComponent] = useState(false);
  const [grouped, setGrouped] = useState(true);

  const { widths, onResizeStart } = useColumnWidths();
  const gridRef = useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data: signals,
    columns: SIGNAL_COLUMNS,
    state: { sorting, columnFilters, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    globalFilterFn,
    getRowId: (row) => String(row.id),
    enableRowSelection: true,
    autoResetPageIndex: false,
  });

  type SignalGroup =
    | { type: "instance"; instanceId: number; instanceName: string; componentId: number; componentName: string; canIdOffset: number | null; minCanIdOffset: number | null; functionBlock: string | null; functionBlockOverride: string | null; busProtocol: string | null; plcNetworkId: number | null; networkLabel: string | null; anyDirty: boolean; rows: ReturnType<typeof table.getRowModel>["rows"] }
    | { type: "ungrouped"; rows: ReturnType<typeof table.getRowModel>["rows"] };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const signalGroups = useMemo((): SignalGroup[] | null => {
    if (!grouped) return null;
    const rows = table.getRowModel().rows;

    const instanceMap = new Map<number, {
      instanceId: number;
      instanceName: string;
      componentId: number;
      componentName: string;
      canIdOffset: number | null;
      minCanIdOffset: number | null;
      functionBlock: string | null;
      functionBlockOverride: string | null;
      busProtocol: string | null;
      plcNetworkId: number | null;
      networkLabel: string | null;
      rows: typeof rows;
      flags: boolean[];
    }>();
    const ungroupedRows: typeof rows = [];

    for (const row of rows) {
      const inst = row.original.instanceSignal?.instance;
      if (inst) {
        if (!instanceMap.has(inst.id)) {
          const net = inst.network;
          instanceMap.set(inst.id, {
            instanceId: inst.id,
            instanceName: inst.name,
            componentId: inst.component.id,
            componentName: inst.component.name,
            canIdOffset: inst.canIdOffset ?? null,
            minCanIdOffset: inst.component.minCanIdOffset ?? null,
            functionBlock: inst.component.functionBlock ?? null,
            functionBlockOverride: inst.functionBlockOverride ?? null,
            busProtocol: inst.component.busProtocol ?? null,
            plcNetworkId: inst.plcNetworkId ?? null,
            networkLabel: net ? `${net.plc.name} — ${net.description ?? net.protocol}` : null,
            rows: [],
            flags: [],
          });
        }
        const entry = instanceMap.get(inst.id)!;
        entry.rows.push(row);
        entry.flags.push(row.original.instanceSignal!.templateDirty);
      } else {
        ungroupedRows.push(row);
      }
    }

    const groups: SignalGroup[] = Array.from(instanceMap.values())
      .sort((a, b) => a.instanceName.localeCompare(b.instanceName))
      .map((g) => ({
        type: "instance" as const,
        instanceId: g.instanceId,
        instanceName: g.instanceName,
        componentId: g.componentId,
        componentName: g.componentName,
        canIdOffset: g.canIdOffset,
        minCanIdOffset: g.minCanIdOffset,
        functionBlock: g.functionBlock,
        functionBlockOverride: g.functionBlockOverride,
        busProtocol: g.busProtocol,
        plcNetworkId: g.plcNetworkId,
        networkLabel: g.networkLabel,
        anyDirty: g.flags.some(Boolean),
        rows: g.rows,
      }));

    if (ungroupedRows.length > 0) {
      groups.push({ type: "ungrouped", rows: ungroupedRows });
    }

    return groups;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grouped, table.getRowModel().rows]);

  const selectedIds = Object.keys(rowSelection).map(Number);
  const selectedCount = selectedIds.length;
  const totalFiltered = table.getRowModel().rows.length;
  const hasFilters = columnFilters.length > 0 || !!globalFilter;

  // Click outside grid → save and exit edit mode
  useEffect(() => {
    if (!editingId && !isAddingNew) return;
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Element;
      const inGrid = gridRef.current?.contains(target) ?? false;
      const inDialog = !!target.closest('[role="dialog"]');
      if (inGrid || inDialog) return;
      if (editingId && editValues) {
        const capturedId = editingId;
        const capturedOriginal = editOriginalValues;
        const capturedSelection = { ...rowSelection };
        updateSilent.mutateAsync({ id: capturedId, ...buildPayload(editValues) }).then(() => {
          if (capturedOriginal && capturedSelection[String(capturedId)] && Object.keys(capturedSelection).length > 1) {
            bulkApplyDiff(capturedId, computeDiff(capturedOriginal, editValues), capturedSelection);
          }
        });
        setEditingId(null);
        setEditValues(null);
        setEditOriginalValues(null);
      }
      if (isAddingNew) {
        create.mutate({ projectId, signalType: newValues.signalType, ...buildPayload(newValues) });
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, isAddingNew, editValues, newValues, editOriginalValues, rowSelection]);

  const update = trpc.signal.update.useMutation({
    onSuccess: () => {
      utils.signal.list.invalidate({ projectId });
      setEditingId(null);
      setEditValues(null);
      setEditOriginalValues(null);
    },
  });
  const updateSilent = trpc.signal.update.useMutation({
    onSuccess: () => { utils.signal.list.invalidate({ projectId }); },
  });
  const bulkUpdate = trpc.signal.update.useMutation();
  const create = trpc.signal.create.useMutation({
    onSuccess: () => {
      utils.signal.list.invalidate({ projectId });
      setIsAddingNew(false);
      setNewValues(defaultEditValues());
    },
  });
  const del = trpc.signal.delete.useMutation({
    onSuccess: () => utils.signal.list.invalidate({ projectId }),
  });
  const bulkDel = trpc.signal.delete.useMutation({
    onSuccess: () => {
      utils.signal.list.invalidate({ projectId });
      setRowSelection({});
    },
  });
  const renameInstance = trpc.signal.componentInstanceUpdate.useMutation({
    onSuccess: () => utils.signal.list.invalidate({ projectId }),
  });
  const instanceRevert = trpc.signal.instanceRevert.useMutation({
    onSuccess: () => utils.signal.list.invalidate({ projectId }),
  });
  const signalRevert = trpc.signal.signalRevert.useMutation({
    onSuccess: () => utils.signal.list.invalidate({ projectId }),
  });
  const disconnectInstance = trpc.signal.componentInstanceDelete.useMutation({
    onSuccess: () => utils.signal.list.invalidate({ projectId }),
  });
  const updateNetwork = trpc.signal.instanceNetworkUpdate.useMutation({
    onSuccess: () => utils.signal.list.invalidate({ projectId }),
  });

  function startEdit(signal: SignalRow) {
    setIsAddingNew(false);
    setEditingId(signal.id);
    const vals = defaultEditValues(signal);
    setEditValues(vals);
    setEditOriginalValues(vals);
  }

  async function bulkApplyDiff(editedId: number, diff: Partial<EditValues>, selectionSnapshot: RowSelectionState) {
    const otherIds = Object.keys(selectionSnapshot).map(Number).filter((id) => id !== editedId);
    if (otherIds.length === 0 || Object.keys(diff).length === 0) return;
    for (const sid of otherIds) {
      const s = signals.find((r) => r.id === sid);
      if (!s) continue;
      const updated = applyDiff(defaultEditValues(s), diff);
      await bulkUpdate.mutateAsync({ id: sid, signalType: updated.signalType, ...buildPayload(updated) });
    }
    utils.signal.list.invalidate({ projectId });
  }

  function startNew() {
    setEditingId(null);
    setEditValues(null);
    setNewValues({ ...defaultEditValues(), plcDataTypeId: boolTypeId });
    setIsAddingNew(true);
  }

  async function saveEdit(vals: EditValues) {
    if (editingId == null) return;
    const capturedId = editingId;
    const capturedOriginal = editOriginalValues;
    const capturedSelection = { ...rowSelection };
    await update.mutateAsync({ id: capturedId, signalType: vals.signalType, ...buildPayload(vals) });
    if (capturedOriginal && capturedSelection[String(capturedId)] && Object.keys(capturedSelection).length > 1) {
      await bulkApplyDiff(capturedId, computeDiff(capturedOriginal, vals), capturedSelection);
    }
  }

  async function blurSaveEdit(id: number, vals: EditValues) {
    const capturedOriginal = editOriginalValues;
    const capturedSelection = { ...rowSelection };
    await updateSilent.mutateAsync({ id, ...buildPayload(vals) });
    if (capturedOriginal && capturedSelection[String(id)] && Object.keys(capturedSelection).length > 1) {
      await bulkApplyDiff(id, computeDiff(capturedOriginal, vals), capturedSelection);
    }
  }

  function saveNew(vals: EditValues) {
    create.mutate({ projectId, signalType: vals.signalType, ...buildPayload(vals) });
  }

  async function deleteSelected() {
    if (!confirm(`Delete ${selectedCount} signal${selectedCount === 1 ? "" : "s"}? This cannot be undone.`)) return;
    // Delete sequentially to avoid constraint issues
    for (const id of selectedIds) {
      await bulkDel.mutateAsync({ id });
    }
  }

  function clearFilters() {
    setColumnFilters([]);
    setGlobalFilter("");
  }

  const totalWidth = COL_DEFS.reduce((sum, d) => sum + widths[d.key], 0);
  const boolTypeId = plcDataTypes.find((t) => t.code === "BOOL")?.id ?? null;

  const editRowProps = {
    cards, units, inputTypes, plcDataTypes, systems, gvls, signals,
  };

  // Check if all visible rows are selected
  const allVisibleSelected = table.getIsAllRowsSelected();
  const someVisibleSelected = table.getIsSomeRowsSelected();

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="border-b px-4 py-2 flex items-center gap-3 shrink-0 flex-wrap">
        <Input
          placeholder="Search tag, description, hardware…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="h-8 w-72 text-sm"
        />
        <span className="text-xs text-muted-foreground">
          {hasFilters ? `${totalFiltered} of ${signals.length}` : `${signals.length}`} signals
        </span>
        {hasFilters && (
          <button
            className="text-xs text-muted-foreground hover:text-foreground underline"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        )}
        {selectedCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">{selectedCount} selected</span>
            {editingId != null && rowSelection[String(editingId)] && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                — changes will apply to all {selectedCount} rows
              </span>
            )}
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs"
              onClick={deleteSelected}
              disabled={bulkDel.isPending}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setShowCreateComponent(true)}
            >
              <Layers className="h-3.5 w-3.5 mr-1" />
              Create component
            </Button>
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setRowSelection({})}
            >
              Clear
            </button>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant={grouped ? "secondary" : "ghost"}
            onClick={() => setGrouped((g) => !g)}
            title={grouped ? "Switch to flat view" : "Switch to grouped view"}
          >
            <Layers className="h-4 w-4 mr-1" />
            {grouped ? "Grouped" : "Flat"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-1" /> Import
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowAddFromComponent(true)}>
            <Layers className="h-4 w-4 mr-1" /> From Component
          </Button>
          <Button size="sm" onClick={startNew} disabled={isAddingNew}>
            <Plus className="h-4 w-4 mr-1" /> Add Signal
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto min-w-0" ref={gridRef}>
        <table className="border-collapse text-sm" style={{ width: totalWidth, tableLayout: "fixed" }}>
          <colgroup>
            {COL_DEFS.map((d) => <col key={d.key} style={{ width: widths[d.key] }} />)}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-background">
            {/* Sort header row */}
            <tr className="border-b">
              {COL_DEFS.map((d) => {
                const col = table.getColumn(d.key);
                const sorted = col?.getIsSorted();
                const canSort = col?.getCanSort() ?? false;
                const isSortNone = d.key === "select" || d.key === "actions";
                return (
                  <th
                    key={d.key}
                    style={{ width: widths[d.key], minWidth: widths[d.key], maxWidth: widths[d.key] }}
                    className={cn(
                      "relative px-2 py-2 text-left text-xs font-medium whitespace-nowrap select-none overflow-hidden",
                      d.disc || d.anlg ? "text-muted-foreground/60" : "text-muted-foreground"
                    )}
                  >
                    {d.key === "select" ? (
                      // Select-all checkbox
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-input cursor-pointer"
                        checked={allVisibleSelected}
                        ref={(el) => { if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected; }}
                        onChange={table.getToggleAllRowsSelectedHandler()}
                      />
                    ) : canSort && !isSortNone ? (
                      <button
                        className="flex items-center gap-0.5 hover:text-foreground w-full text-left"
                        onClick={col?.getToggleSortingHandler()}
                      >
                        {d.disc && <span className="text-[9px] text-blue-400 font-bold mr-0.5">D·</span>}
                        {d.anlg && <span className="text-[9px] text-purple-400 font-bold mr-0.5">A·</span>}
                        {d.label}
                        {sorted === "asc" ? <ChevronUp className="h-3 w-3 ml-0.5 shrink-0" /> :
                         sorted === "desc" ? <ChevronDown className="h-3 w-3 ml-0.5 shrink-0" /> :
                         <ChevronsUpDown className="h-3 w-3 ml-0.5 shrink-0 opacity-30" />}
                      </button>
                    ) : (
                      <>
                        {d.disc && <span className="text-[9px] text-blue-400 font-bold mr-0.5">D·</span>}
                        {d.anlg && <span className="text-[9px] text-purple-400 font-bold mr-0.5">A·</span>}
                        {d.label}
                      </>
                    )}
                    {d.key !== "select" && d.key !== "actions" && (
                      <div
                        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/30 z-10"
                        onMouseDown={(e) => { e.stopPropagation(); onResizeStart(d.key, e); }}
                      />
                    )}
                  </th>
                );
              })}
            </tr>
            {/* Column filter row */}
            <tr className="border-b bg-muted/30">
              {COL_DEFS.map((d) => {
                const col = table.getColumn(d.key);
                const hasFilter = TEXT_FILTER_COLS.has(d.key) || FACET_FILTER_COLS.has(d.key);
                if (!hasFilter || !col) {
                  return <th key={d.key} className="px-1 py-0.5" />;
                }
                const filterVal = (col.getFilterValue() as string) ?? "";
                return (
                  <th key={d.key} className="px-1 py-0.5">
                    <FilterCell
                      colKey={d.key}
                      column={col}
                      value={filterVal}
                      onChange={(v) => col.setFilterValue(v || undefined)}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isAddingNew && (
              <EditRow
                values={newValues}
                {...editRowProps}
                isNew
                isSaving={create.isPending}
                onChange={(v) => setNewValues((prev) => ({ ...prev, ...v }))}
                onSave={saveNew}
                onBlurSave={saveNew}
                onCancel={() => setIsAddingNew(false)}
              />
            )}

            {isLoading ? (
              <tr><td colSpan={COL_DEFS.length} className="py-16 text-center text-sm text-muted-foreground">Loading…</td></tr>
            ) : table.getRowModel().rows.length === 0 && !isAddingNew ? (
              <tr><td colSpan={COL_DEFS.length} className="py-16 text-center text-sm text-muted-foreground">
                {hasFilters ? "No signals match the filters." : "No signals yet — click Add Signal to create one."}
              </td></tr>
            ) : null}
          </tbody>

          {!isLoading && table.getRowModel().rows.length > 0 && (
            signalGroups ? (
              // Grouped view — ComponentGroup renders its own <tbody> elements
              signalGroups.map((group) =>
                group.type === "instance" ? (
                  <ComponentGroup
                    key={group.instanceId}
                    instanceId={group.instanceId}
                    instanceName={group.instanceName}
                    componentId={group.componentId}
                    componentName={group.componentName}
                    canIdOffset={group.canIdOffset}
                    minCanIdOffset={group.minCanIdOffset}
                    functionBlock={group.functionBlock}
                    functionBlockOverride={group.functionBlockOverride}
                    busProtocol={group.busProtocol}
                    plcNetworkId={group.plcNetworkId}
                    networkLabel={group.networkLabel}
                    networks={networks.filter((n) => !group.busProtocol || n.protocol === group.busProtocol)}
                    anyDirty={group.anyDirty}
                    signalCount={group.rows.length}
                    colCount={COL_DEFS.length}
                    groupSelected={group.rows.length > 0 && group.rows.every((r) => rowSelection[r.id])}
                    groupIndeterminate={group.rows.some((r) => rowSelection[r.id]) && !group.rows.every((r) => rowSelection[r.id])}
                    onSelectGroup={(sel) => setRowSelection((prev) => {
                      const next = { ...prev };
                      group.rows.forEach((r) => sel ? (next[r.id] = true) : delete next[r.id]);
                      return next;
                    })}
                    onRename={(name) => renameInstance.mutate({ instanceId: group.instanceId, name })}
                    onUpdateOffset={(offset) => renameInstance.mutate({ instanceId: group.instanceId, canIdOffset: offset })}
                    onUpdateFbOverride={(fb) => renameInstance.mutate({ instanceId: group.instanceId, functionBlockOverride: fb })}
                    onUpdateNetwork={(id) => updateNetwork.mutate({ instanceId: group.instanceId, plcNetworkId: id })}
                    onRevert={() => instanceRevert.mutate({ instanceId: group.instanceId })}
                    onDisconnect={() => disconnectInstance.mutate({ instanceId: group.instanceId })}
                    isRenamePending={renameInstance.isPending}
                    isRevertPending={instanceRevert.isPending}
                    isDisconnectPending={disconnectInstance.isPending}
                    isNetworkUpdatePending={updateNetwork.isPending}
                    renderRows={() => group.rows.map((row) => {
                      const signal = row.original;
                      if (editingId === signal.id && editValues) {
                        return (
                          <EditRow
                            key={signal.id}
                            values={editValues}
                            {...editRowProps}
                            editingId={signal.id}
                            isSaving={update.isPending}
                            onChange={(v) => setEditValues((prev) => prev ? { ...prev, ...v } : prev)}
                            onSave={saveEdit}
                            onBlurSave={(vals) => blurSaveEdit(signal.id, vals)}
                            onCancel={() => { setEditingId(null); setEditValues(null); setEditOriginalValues(null); }}
                          />
                        );
                      }
                      return (
                        <DisplayRow
                          key={signal.id}
                          signal={signal}
                          selected={row.getIsSelected()}
                          onToggleSelect={row.getToggleSelectedHandler()}
                          onEdit={() => startEdit(signal)}
                          onAdvanced={() => setAdvancedSignal(signal)}
                          onDelete={() => del.mutate({ id: signal.id })}
                          onBusConfig={() => setBusConfigSignal(signal)}
                          onAlarms={() => setAlarmSignal(signal)}
                          onRevert={signal.instanceSignal ? () => signalRevert.mutate({ signalId: signal.id }) : undefined}
                          isRevertPending={signalRevert.isPending}
                        />
                      );
                    })}
                  />
                ) : (
                  <ComponentGroup
                    key="ungrouped"
                    instanceId={null}
                    instanceName="Misc signals"
                    componentId={null}
                    componentName={null}
                    canIdOffset={null}
                    minCanIdOffset={null}
                    functionBlock={null}
                    functionBlockOverride={null}
                    busProtocol={null}
                    plcNetworkId={null}
                    networkLabel={null}
                    networks={[]}
                    anyDirty={false}
                    signalCount={group.rows.length}
                    colCount={COL_DEFS.length}
                    groupSelected={group.rows.length > 0 && group.rows.every((r) => rowSelection[r.id])}
                    groupIndeterminate={group.rows.some((r) => rowSelection[r.id]) && !group.rows.every((r) => rowSelection[r.id])}
                    onSelectGroup={(sel) => setRowSelection((prev) => {
                      const next = { ...prev };
                      group.rows.forEach((r) => sel ? (next[r.id] = true) : delete next[r.id]);
                      return next;
                    })}
                    onRename={() => {}}
                    onUpdateOffset={() => {}}
                    onUpdateFbOverride={() => {}}
                    onUpdateNetwork={() => {}}
                    onRevert={() => {}}
                    onDisconnect={() => {}}
                    isRenamePending={false}
                    isRevertPending={false}
                    isDisconnectPending={false}
                    isNetworkUpdatePending={false}
                    renderRows={() => group.rows.map((row) => {
                      const signal = row.original;
                      if (editingId === signal.id && editValues) {
                        return (
                          <EditRow
                            key={signal.id}
                            values={editValues}
                            {...editRowProps}
                            editingId={signal.id}
                            isSaving={update.isPending}
                            onChange={(v) => setEditValues((prev) => prev ? { ...prev, ...v } : prev)}
                            onSave={saveEdit}
                            onBlurSave={(vals) => blurSaveEdit(signal.id, vals)}
                            onCancel={() => { setEditingId(null); setEditValues(null); setEditOriginalValues(null); }}
                          />
                        );
                      }
                      return (
                        <DisplayRow
                          key={signal.id}
                          signal={signal}
                          selected={row.getIsSelected()}
                          onToggleSelect={row.getToggleSelectedHandler()}
                          onEdit={() => startEdit(signal)}
                          onAdvanced={() => setAdvancedSignal(signal)}
                          onDelete={() => del.mutate({ id: signal.id })}
                          onBusConfig={() => setBusConfigSignal(signal)}
                          onAlarms={() => setAlarmSignal(signal)}
                        />
                      );
                    })}
                  />
                )
              )
            ) : (
              // Flat view
              <tbody>
                {table.getRowModel().rows.map((row) => {
                  const signal = row.original;
                  if (editingId === signal.id && editValues) {
                    return (
                      <EditRow
                        key={signal.id}
                        values={editValues}
                        {...editRowProps}
                        editingId={signal.id}
                        isSaving={update.isPending}
                        onChange={(v) => setEditValues((prev) => prev ? { ...prev, ...v } : prev)}
                        onSave={saveEdit}
                        onBlurSave={(vals) => blurSaveEdit(signal.id, vals)}
                        onCancel={() => { setEditingId(null); setEditValues(null); setEditOriginalValues(null); }}
                      />
                    );
                  }
                  return (
                    <DisplayRow
                      key={signal.id}
                      signal={signal}
                      selected={row.getIsSelected()}
                      onToggleSelect={row.getToggleSelectedHandler()}
                      onEdit={() => startEdit(signal)}
                      onAdvanced={() => setAdvancedSignal(signal)}
                      onDelete={() => del.mutate({ id: signal.id })}
                      onBusConfig={() => setBusConfigSignal(signal)}
                      onAlarms={() => setAlarmSignal(signal)}
                      onRevert={signal.instanceSignal ? () => signalRevert.mutate({ signalId: signal.id }) : undefined}
                      isRevertPending={signalRevert.isPending}
                    />
                  );
                })}
              </tbody>
            )
          )}
        </table>
      </div>

      {busConfigSignal && (
        <ProjectBusConfigDialog
          open
          signal={busConfigSignal}
          networks={networks}
          onClose={() => setBusConfigSignal(null)}
          onSaved={() => {
            utils.signal.list.invalidate({ projectId });
            setBusConfigSignal(null);
          }}
        />
      )}

      {alarmSignal && (
        <ProjectAlarmsDialog
          signal={alarmSignal}
          open={true}
          onClose={() => setAlarmSignal(null)}
          onSaved={() => {
            utils.signal.list.invalidate({ projectId });
            setAlarmSignal(null);
          }}
        />
      )}

      {advancedSignal && (
        <AddEditSignalDialog
          projectId={projectId}
          signal={advancedSignal}
          open
          onClose={() => setAdvancedSignal(null)}
          onSaved={() => {
            utils.signal.list.invalidate({ projectId });
            setAdvancedSignal(null);
          }}
        />
      )}

      {showImport && (
        <ImportSignalsDialog
          projectId={projectId}
          open
          onClose={() => setShowImport(false)}
          onImported={() => {
            utils.signal.list.invalidate({ projectId });
            setShowImport(false);
          }}
        />
      )}

      {showAddFromComponent && (
        <AddFromComponentDialog
          projectId={projectId}
          open
          onClose={() => setShowAddFromComponent(false)}
          onAdded={() => {
            utils.signal.list.invalidate({ projectId });
            setShowAddFromComponent(false);
          }}
        />
      )}

      <CreateComponentDialog
        open={showCreateComponent}
        projectId={projectId}
        signalIds={selectedIds}
        onCreated={(_componentId, _instanceId) => {
          utils.signal.list.invalidate({ projectId });
          setRowSelection({});
          setShowCreateComponent(false);
        }}
        onCancel={() => setShowCreateComponent(false)}
      />
    </div>
  );
}
