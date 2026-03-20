"use client";

import React, { use, useState, useMemo, useCallback, useRef, useEffect, memo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
import { Plus, Check, X, Trash2, Settings2, Upload, Download, Layers, ChevronUp, ChevronDown, ChevronRight, ChevronsUpDown, Network, Bell, RotateCcw, FileSpreadsheet, FileCode, Columns3, Cpu, GripVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { AddEditSignalDialog } from "./_components/AddEditSignalDialog";
import { ImportSignalsDialog } from "./_components/ImportSignalsDialog";
import { ImportMpvDialog } from "./_components/ImportMpvDialog";
import { AddFromComponentDialog } from "./_components/AddFromComponentDialog";
import { ProjectBusConfigDialog } from "./_components/ProjectBusConfigDialog";
import { ProjectAlarmsDialog } from "./_components/ProjectAlarmsDialog";
import { ProjectDetailsDialog } from "./_components/ProjectDetailsDialog";
import { ProjectHardwareDialog } from "./_components/ProjectHardwareDialog";
import { ComponentGroup } from "./_components/ComponentGroup";
import { CreateComponentDialog } from "./_components/CreateComponentDialog";
import { ExportLegacyDialog } from "./_components/ExportDialog";
import { StructuredImportDialog, type TargetField } from "@/components/structured-import-dialog";

const SIGNAL_TARGET_FIELDS: TargetField[] = [
  { key: "description", label: "Description", required: true },
  { key: "tag", label: "Tag" },
  { key: "ioType", label: "I/O Type (DI/DO/AI/AO)" },
  { key: "system", label: "System" },
  { key: "subsystem", label: "Subsystem" },
  { key: "element", label: "Element" },
  { key: "signalFunction", label: "Signal Function" },
  { key: "instrumentTag", label: "Instrument Tag" },
  { key: "signalClassification", label: "Signal Classification" },
  { key: "cabinet", label: "Cabinet" },
  { key: "trigger", label: "Logic/Trigger (NO/NC)" },
  { key: "unit", label: "Unit" },
  { key: "rangeLow", label: "Range Low" },
  { key: "rangeHigh", label: "Range High" },
  { key: "supplierName", label: "Supplier Name" },
  { key: "supplierSensorType", label: "Supplier Sensor Type" },
  { key: "notes", label: "Notes" },
];

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
  notes: string;
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
  // Additional discrete
  switchingType: string;
  signalVoltage: string;
  // Additional analog
  rawMin: string;
  rawMax: string;
  rawZero: string;
  clampLow: string;
  clampHigh: string;
  deadband: string;
};

// ── Column definitions (ordered to match Excel sheet 2) ──────────────────────

type ColKey =
  | "select" | "system" | "component" | "desc" | "tag"
  | "card" | "ch" | "io" | "origin" | "network" | "bus" | "signal" | "detail" | "hw" | "canid" | "alarms" | "rev"
  // Detail fields
  | "notes" | "isRetain" | "isPersistent" | "logging" | "fbOverride" | "shortName"
  // Discrete signal fields
  | "trigger" | "filter" | "switchType" | "sigVoltage" | "discPlcType"
  // Analog signal fields
  | "itype" | "wire" | "eu" | "smin" | "smax" | "dtype"
  | "rawMin" | "rawMax" | "rawZero" | "clampLow" | "clampHigh" | "deadband"
  | "wireBreak" | "shortCircuit" | "outOfRange" | "namurNe43"
  | "tankLevel" | "scalingFb" | "dbRawMin" | "dbRawZero" | "dbRawMax"
  | "failRaw" | "failMargin" | "failBehavior" | "failDelay"
  // Alarm config fields
  | "alarmGrp" | "alarmMask" | "commMask" | "fatBlk" | "suppression" | "specAlarmFb" | "specAlarmIn" | "anaDigAlarm"
  // Bus fields
  | "rawDataType" | "byteOrder" | "canNodeId" | "bitOffset" | "bitLength"
  | "muxIndicator" | "muxId" | "canopenIdx" | "canopenSub"
  | "j1939Pgn" | "j1939Spn" | "modbusUnit" | "modbusRegType" | "modbusRegOfs" | "timeoutMs"
  | "gvl" | "drawing" | "cabinet" | "actions";

type ColDef = {
  key: ColKey;
  label: string;
  defaultWidth: number;
  disc?: true;
  anlg?: true;
  /** Hidden by default (user must enable via column selector) */
  defaultHidden?: true;
  /** Group label for popover sections */
  group?: string;
};

const COL_DEFS: ColDef[] = [
  { key: "select",    label: "",           defaultWidth: 36 },
  // Signal identification
  { key: "tag",       label: "Tag",        defaultWidth: 100, group: "Signal" },
  { key: "desc",      label: "Description",defaultWidth: 200, group: "Signal" },
  { key: "io",        label: "IO",         defaultWidth: 52,  group: "Signal" },
  { key: "rev",       label: "Rev",        defaultWidth: 44,  group: "Signal" },
  { key: "signal",    label: "Signal",     defaultWidth: 44,  group: "Signal" },
  // Hardware / location
  { key: "origin",    label: "Origin",     defaultWidth: 90,  group: "Hardware" },
  { key: "card",      label: "Card",       defaultWidth: 200, group: "Hardware" },
  { key: "ch",        label: "Ch",         defaultWidth: 36,  group: "Hardware" },
  { key: "network",   label: "Network",    defaultWidth: 140, group: "Hardware" },
  { key: "cabinet",   label: "Cabinet",    defaultWidth: 68,  group: "Hardware" },
  { key: "drawing",   label: "Drawing",    defaultWidth: 80,  group: "Hardware" },
  { key: "hw",        label: "HW",         defaultWidth: 44,  group: "Hardware" },
  // Classification
  { key: "system",    label: "System",     defaultWidth: 72,  group: "Detail" },
  { key: "component", label: "Component",  defaultWidth: 88,  group: "Detail" },
  { key: "gvl",       label: "GVL",        defaultWidth: 80,  group: "Detail" },
  { key: "detail",    label: "Detail",     defaultWidth: 44,  group: "Detail" },
  // Bus
  { key: "bus",       label: "Bus",        defaultWidth: 44,  group: "Bus" },
  { key: "canid",     label: "CAN ID",     defaultWidth: 72,  defaultHidden: true, group: "Bus" },
  // Alarms
  { key: "alarms",    label: "Alarms",     defaultWidth: 58,  group: "Alarms" },
  // Discrete detail fields — hidden by default (covered by Signal dialog)
  { key: "trigger",    label: "Trigger",      defaultWidth: 60,  disc: true, defaultHidden: true, group: "Discrete" },
  { key: "filter",     label: "Filter ms",    defaultWidth: 70,  disc: true, defaultHidden: true, group: "Discrete" },
  { key: "switchType", label: "Switch Type",  defaultWidth: 80,  disc: true, defaultHidden: true, group: "Discrete" },
  { key: "sigVoltage", label: "Voltage",      defaultWidth: 72,  disc: true, defaultHidden: true, group: "Discrete" },
  { key: "discPlcType",label: "PLC Type",     defaultWidth: 72,  disc: true, defaultHidden: true, group: "Discrete" },
  // Analog detail fields — hidden by default (covered by Signal dialog)
  { key: "itype",      label: "Input Type",   defaultWidth: 90,  anlg: true, defaultHidden: true, group: "Analog" },
  { key: "wire",       label: "Wire",         defaultWidth: 68,  anlg: true, defaultHidden: true, group: "Analog" },
  { key: "eu",         label: "EU",           defaultWidth: 52,  anlg: true, defaultHidden: true, group: "Analog" },
  { key: "smin",       label: "Scale Min",    defaultWidth: 68,  anlg: true, defaultHidden: true, group: "Analog" },
  { key: "smax",       label: "Scale Max",    defaultWidth: 68,  anlg: true, defaultHidden: true, group: "Analog" },
  { key: "dtype",      label: "PLC Type",     defaultWidth: 72,  anlg: true, defaultHidden: true, group: "Analog" },
  { key: "rawMin",     label: "Raw Min",      defaultWidth: 68,  anlg: true, defaultHidden: true, group: "Analog" },
  { key: "rawMax",     label: "Raw Max",      defaultWidth: 68,  anlg: true, defaultHidden: true, group: "Analog" },
  { key: "rawZero",    label: "Raw Zero",     defaultWidth: 68,  anlg: true, defaultHidden: true, group: "Analog" },
  { key: "clampLow",   label: "Clamp Low",    defaultWidth: 68,  anlg: true, defaultHidden: true, group: "Analog" },
  { key: "clampHigh",  label: "Clamp High",   defaultWidth: 68,  anlg: true, defaultHidden: true, group: "Analog" },
  { key: "deadband",   label: "Deadband",     defaultWidth: 68,  anlg: true, defaultHidden: true, group: "Analog" },
  { key: "wireBreak",  label: "Wire Break",   defaultWidth: 72,  anlg: true, defaultHidden: true, group: "Analog" },
  { key: "shortCircuit",label: "Short Circ",  defaultWidth: 72,  anlg: true, defaultHidden: true, group: "Analog" },
  { key: "outOfRange", label: "Out of Range", defaultWidth: 80,  anlg: true, defaultHidden: true, group: "Analog" },
  { key: "namurNe43",  label: "NAMUR NE43",   defaultWidth: 72,  anlg: true, defaultHidden: true, group: "Analog" },
  { key: "tankLevel",  label: "Tank Level",   defaultWidth: 72,  anlg: true, defaultHidden: true, group: "Analog" },
  { key: "scalingFb",  label: "Scaling FB",   defaultWidth: 120, anlg: true, defaultHidden: true, group: "Analog" },
  { key: "dbRawMin",   label: "DB Raw Min",   defaultWidth: 68,  anlg: true, defaultHidden: true, group: "Analog" },
  { key: "dbRawZero",  label: "DB Raw Zero",  defaultWidth: 72,  anlg: true, defaultHidden: true, group: "Analog" },
  { key: "dbRawMax",   label: "DB Raw Max",   defaultWidth: 68,  anlg: true, defaultHidden: true, group: "Analog" },
  { key: "failRaw",    label: "Fail Raw",     defaultWidth: 68,  anlg: true, defaultHidden: true, group: "Analog" },
  { key: "failMargin", label: "Fail Margin",  defaultWidth: 72,  anlg: true, defaultHidden: true, group: "Analog" },
  { key: "failBehavior",label: "Fail Behavior",defaultWidth: 90, anlg: true, defaultHidden: true, group: "Analog" },
  { key: "failDelay",  label: "Fail Delay ms",defaultWidth: 80,  anlg: true, defaultHidden: true, group: "Analog" },
  // Individual bus fields — hidden by default (covered by Bus dialog)
  { key: "rawDataType",  label: "Raw Type",   defaultWidth: 72,  defaultHidden: true, group: "Bus" },
  { key: "byteOrder",    label: "Byte Order", defaultWidth: 90,  defaultHidden: true, group: "Bus" },
  { key: "canNodeId",    label: "CAN Node",   defaultWidth: 68,  defaultHidden: true, group: "Bus" },
  { key: "bitOffset",    label: "Bit Ofs",    defaultWidth: 56,  defaultHidden: true, group: "Bus" },
  { key: "bitLength",    label: "Bit Len",    defaultWidth: 56,  defaultHidden: true, group: "Bus" },
  { key: "muxIndicator", label: "Mux?",       defaultWidth: 44,  defaultHidden: true, group: "Bus" },
  { key: "muxId",        label: "Mux ID",     defaultWidth: 56,  defaultHidden: true, group: "Bus" },
  { key: "canopenIdx",   label: "CO Index",   defaultWidth: 72,  defaultHidden: true, group: "Bus" },
  { key: "canopenSub",   label: "CO Sub",     defaultWidth: 56,  defaultHidden: true, group: "Bus" },
  { key: "j1939Pgn",     label: "J1939 PGN",  defaultWidth: 72,  defaultHidden: true, group: "Bus" },
  { key: "j1939Spn",     label: "J1939 SPN",  defaultWidth: 72,  defaultHidden: true, group: "Bus" },
  { key: "modbusUnit",   label: "MB Unit",    defaultWidth: 64,  defaultHidden: true, group: "Bus" },
  { key: "modbusRegType",label: "MB Reg Type", defaultWidth: 90, defaultHidden: true, group: "Bus" },
  { key: "modbusRegOfs", label: "MB Offset",  defaultWidth: 72,  defaultHidden: true, group: "Bus" },
  { key: "timeoutMs",    label: "Timeout ms",  defaultWidth: 72, defaultHidden: true, group: "Bus" },
  // Detail fields — hidden by default (covered by Detail dialog)
  { key: "notes",       label: "Notes",        defaultWidth: 120, defaultHidden: true, group: "Detail" },
  { key: "isRetain",    label: "Retain",       defaultWidth: 56,  defaultHidden: true, group: "Detail" },
  { key: "isPersistent",label: "Persistent",   defaultWidth: 72,  defaultHidden: true, group: "Detail" },
  { key: "logging",     label: "Logging",      defaultWidth: 60,  defaultHidden: true, group: "Detail" },
  { key: "fbOverride",  label: "FB Override",  defaultWidth: 120, defaultHidden: true, group: "Detail" },
  { key: "shortName",   label: "Short Name",   defaultWidth: 72,  defaultHidden: true, group: "Detail" },
  // Alarm config fields — hidden by default (covered by Alarms dialog)
  { key: "alarmGrp",    label: "Alarm Grp",    defaultWidth: 64,  defaultHidden: true, group: "Alarms" },
  { key: "alarmMask",   label: "Block Mask",   defaultWidth: 72,  defaultHidden: true, group: "Alarms" },
  { key: "commMask",    label: "Comm Mask",    defaultWidth: 72,  defaultHidden: true, group: "Alarms" },
  { key: "fatBlk",      label: "FAT Block",    defaultWidth: 64,  defaultHidden: true, group: "Alarms" },
  { key: "suppression", label: "Suppression",  defaultWidth: 120, defaultHidden: true, group: "Alarms" },
  { key: "specAlarmFb", label: "Special FB",   defaultWidth: 120, defaultHidden: true, group: "Alarms" },
  { key: "specAlarmIn", label: "Special Input", defaultWidth: 120, defaultHidden: true, group: "Alarms" },
  { key: "anaDigAlarm", label: "Ana→Dig",      defaultWidth: 60,  defaultHidden: true, group: "Alarms" },
  { key: "actions",   label: "",           defaultWidth: 56 },
];

const DEFAULT_HIDDEN = new Set<ColKey>(COL_DEFS.filter((d) => d.defaultHidden).map((d) => d.key));
const LS_COL_ORDER = "mias-signal-col-order";

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
    notes: "",
    trigger: "NO", filterTimeMs: "", switchingType: "", signalVoltage: "",
    inputTypeId: null, wireConfig: "", engineeringUnitId: null, scaleMin: "", scaleMax: "", plcDataTypeId: null,
    rawMin: "", rawMax: "", rawZero: "", clampLow: "", clampHigh: "", deadband: "",
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
    notes: signal.notes ?? "",
    trigger: signal.discreteSignal?.trigger ?? "NO",
    filterTimeMs: signal.discreteSignal?.filterTimeMs != null
      ? String(Number(signal.discreteSignal.filterTimeMs)) : "",
    switchingType: signal.discreteSignal?.switchingType ?? "",
    signalVoltage: signal.discreteSignal?.signalVoltage ?? "",
    inputTypeId: signal.analogSignal?.inputTypeId ?? null,
    wireConfig: (signal.analogSignal?.wireConfig ?? "") as EditValues["wireConfig"],
    engineeringUnitId: signal.analogSignal?.engineeringUnitId ?? null,
    scaleMin: signal.analogSignal?.scaleMin != null ? String(Number(signal.analogSignal.scaleMin)) : "",
    scaleMax: signal.analogSignal?.scaleMax != null ? String(Number(signal.analogSignal.scaleMax)) : "",
    plcDataTypeId: signal.analogSignal?.plcDataTypeId ?? null,
    rawMin: signal.analogSignal?.rawMin != null ? String(Number(signal.analogSignal.rawMin)) : "",
    rawMax: signal.analogSignal?.rawMax != null ? String(Number(signal.analogSignal.rawMax)) : "",
    rawZero: signal.analogSignal?.rawZero != null ? String(Number(signal.analogSignal.rawZero)) : "",
    clampLow: signal.analogSignal?.clampLow != null ? String(Number(signal.analogSignal.clampLow)) : "",
    clampHigh: signal.analogSignal?.clampHigh != null ? String(Number(signal.analogSignal.clampHigh)) : "",
    deadband: signal.analogSignal?.deadband != null ? String(Number(signal.analogSignal.deadband)) : "",
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
    notes: v.notes || null,
    trigger: v.trigger,
    filterTimeMs: v.filterTimeMs !== "" ? Number(v.filterTimeMs) : null,
    switchingType: (v.switchingType || null) as any,
    signalVoltage: v.signalVoltage || null,
    inputTypeId: v.inputTypeId,
    wireConfig: (v.wireConfig || null) as "TWO_WIRE" | "THREE_WIRE" | "FOUR_WIRE" | null | undefined,
    engineeringUnitId: v.engineeringUnitId,
    scaleMin: v.scaleMin !== "" ? Number(v.scaleMin) : null,
    scaleMax: v.scaleMax !== "" ? Number(v.scaleMax) : null,
    plcDataTypeId: v.plcDataTypeId,
    rawMin: v.rawMin !== "" ? Number(v.rawMin) : null,
    rawMax: v.rawMax !== "" ? Number(v.rawMax) : null,
    rawZero: v.rawZero !== "" ? Number(v.rawZero) : null,
    clampLow: v.clampLow !== "" ? Number(v.clampLow) : null,
    clampHigh: v.clampHigh !== "" ? Number(v.clampHigh) : null,
    deadband: v.deadband !== "" ? Number(v.deadband) : null,
  };
}

// ── Column resizing ───────────────────────────────────────────────────────────

const LS_COL_WIDTHS = "mias-signal-col-widths";
const LS_COL_HIDDEN = "mias-signal-col-hidden";

const defaultWidths = () => Object.fromEntries(COL_DEFS.map((d) => [d.key, d.defaultWidth])) as Record<ColKey, number>;

function useColumnWidths() {
  const [widths, setWidths] = useState<Record<ColKey, number>>(defaultWidths);

  // Load persisted widths after hydration
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_COL_WIDTHS);
      if (stored) {
        const parsed = JSON.parse(stored);
        setWidths((prev) => ({ ...prev, ...parsed }));
      }
    } catch {}
  }, []);

  const onResizeStart = useCallback((key: ColKey, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = widths[key];
    function onMove(me: MouseEvent) {
      setWidths((prev) => {
        const next = { ...prev, [key]: Math.max(32, startWidth + me.clientX - startX) };
        localStorage.setItem(LS_COL_WIDTHS, JSON.stringify(next));
        return next;
      });
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

const DisplayRow = memo(function DisplayRow({ signal, selected, onToggleSelect, onEdit, onSignal, onDetail, onHardware, onDelete, onBusConfig, onAlarms, onRevert, isRevertPending, visibleCols }: {
  signal: SignalRow;
  selected: boolean;
  onToggleSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEdit: () => void; onSignal: () => void; onDetail: () => void; onHardware: () => void; onDelete: () => void;
  onBusConfig: () => void;
  onAlarms: () => void;
  onRevert?: () => void;
  isRevertPending?: boolean;
  visibleCols: ColDef[];
}) {
  const ioCode = getSignalIoCode(signal);
  const typeColor = TYPE_COLORS[ioCode] ?? "bg-muted border-border text-muted-foreground";
  const isDisc = signal.signalType === "DISCRETE";
  const isAnlg = signal.signalType === "ANALOG";
  const bs = signal.busSignal;

  const hardware = signal.ioCard
    ? `${signal.ioCard.carrier.plc.name} / ${signal.ioCard.carrier.name} / Slot ${signal.ioCard.slotPosition + 1}`
    : null;

  const dash = <span className="text-xs text-muted-foreground/25">—</span>;
  const num = (v: unknown) => v != null ? <span className="text-xs font-mono tabular-nums">{Number(v)}</span> : dash;
  const txt = (v: string | null | undefined) => v ? <span className="text-xs truncate block">{v}</span> : dash;

  function renderCell(key: ColKey) {
    switch (key) {
      case "select": return <td key={key} className="px-2 py-1 align-middle" onClick={(e) => e.stopPropagation()}><input type="checkbox" className="h-3.5 w-3.5 rounded border-input cursor-pointer" checked={selected} onChange={onToggleSelect} /></td>;
      case "system": return <Td key={key}><span className="text-xs text-muted-foreground truncate block" title={signal.system?.name}>{signal.system?.name ?? "—"}</span></Td>;
      case "component": return <Td key={key}><span className="text-xs text-muted-foreground truncate block">{signal.componentTag ?? "—"}</span></Td>;
      case "desc": return <Td key={key}><span className="block truncate text-sm" title={signal.description ?? undefined}>{signal.description ?? ""}</span></Td>;
      case "tag": return <Td key={key}>{signal.tag ? <span className="font-mono text-xs truncate block">{signal.tag}</span> : <span className="text-muted-foreground/40 text-xs italic">—</span>}</Td>;
      case "card": return <Td key={key}>{signal.origin === "IEC" ? (hardware ? <span className="text-xs block truncate">{hardware}</span> : <span className="text-xs text-muted-foreground/40">—</span>) : <span className="text-xs text-muted-foreground italic">Via network</span>}</Td>;
      case "ch": return <Td key={key} className="text-center"><span className="text-xs tabular-nums">{signal.origin === "IEC" && signal.channelPosition != null ? signal.channelPosition : ""}</span></Td>;
      case "io": return <Td key={key}><Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 font-medium", typeColor)}>{ioCode}</Badge></Td>;
      case "origin": return <Td key={key}><span className="text-xs text-muted-foreground truncate block">{signal.origin}</span></Td>;
      case "network": {
        const net = bs?.plcNetwork ?? signal.instanceSignal?.instance?.network;
        return <Td key={key}>{net ? <span className="text-xs truncate block" title={net.description ?? undefined}>{net.protocol}{net.description ? ` — ${net.description}` : ""}</span> : dash}</Td>;
      }
      case "bus": return <Td key={key} className="text-center">{signal.origin !== "IEC" && signal.origin !== "INTERNAL" ? <button type="button" title={bs ? "Edit bus config" : "Add bus config"} className={cn("rounded p-0.5 transition-colors", bs ? "text-blue-600 hover:bg-blue-50" : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent")} onClick={(e) => { e.stopPropagation(); onBusConfig(); }}><Network className="h-3.5 w-3.5" /></button> : dash}</Td>;
      case "rev": return <Td key={key} className="text-center"><span className="text-xs font-mono text-muted-foreground">{signal.revision ?? "—"}</span></Td>;
      case "signal": return <Td key={key} className="text-center"><button type="button" title="Signal config" className="rounded p-0.5 transition-colors text-muted-foreground hover:text-foreground hover:bg-accent" onClick={(e) => { e.stopPropagation(); onSignal(); }}><Settings2 className="h-3.5 w-3.5" /></button></Td>;
      case "detail": return <Td key={key} className="text-center"><button type="button" title="Detail (classification, code gen)" className="rounded p-0.5 transition-colors text-muted-foreground hover:text-foreground hover:bg-accent" onClick={(e) => { e.stopPropagation(); onDetail(); }}><FileCode className="h-3.5 w-3.5" /></button></Td>;
      case "hw": return <Td key={key} className="text-center"><button type="button" title="Hardware assignment" className="rounded p-0.5 transition-colors text-muted-foreground hover:text-foreground hover:bg-accent" onClick={(e) => { e.stopPropagation(); onHardware(); }}><Cpu className="h-3.5 w-3.5" /></button></Td>;
      case "canid": {
        const rawCanId = bs?.canId ?? signal.instanceSignal?.componentSignal?.canId ?? null;
        if (rawCanId == null) return <Td key={key} className="text-center">{dash}</Td>;
        const offset = signal.instanceSignal?.instance?.canIdOffset ?? 0;
        const resolved = rawCanId + offset;
        return <Td key={key} className="text-center"><span className="font-mono text-xs tabular-nums" title={offset !== 0 ? `Raw: 0x${rawCanId.toString(16).toUpperCase()} + offset ${offset >= 0 ? "+" : ""}${offset}` : undefined}>{`0x${resolved.toString(16).toUpperCase()}`}</span></Td>;
      }
      case "alarms": {
        const count = isDisc ? (signal.discreteSignal?.alarms?.length ?? 0) : (signal.analogSignal?.alarms?.length ?? 0);
        return <Td key={key} className="text-center"><button type="button" title={count > 0 ? `${count} alarm${count === 1 ? "" : "s"}` : "No alarms"} className="flex items-center justify-center gap-0.5 rounded p-0.5 transition-colors hover:bg-accent" onClick={(e) => { e.stopPropagation(); onAlarms(); }}><Bell className={cn("h-3.5 w-3.5", count > 0 ? "text-amber-500" : "text-muted-foreground/30")} />{count > 0 && <span className="text-[10px] font-medium text-amber-600 tabular-nums">{count}</span>}</button></Td>;
      }
      // Discrete-only
      // Discrete fields
      case "trigger": return isDisc ? <Td key={key}><span className="text-xs">{signal.discreteSignal?.trigger ?? "—"}</span></Td> : <Na key={key} />;
      case "filter": return isDisc ? <Td key={key}><span className="text-xs text-muted-foreground">{signal.discreteSignal?.filterTimeMs != null ? `${Number(signal.discreteSignal.filterTimeMs)} ms` : "—"}</span></Td> : <Na key={key} />;
      case "switchType": return isDisc ? <Td key={key}>{txt(signal.discreteSignal?.switchingType)}</Td> : <Na key={key} />;
      case "sigVoltage": return isDisc ? <Td key={key}>{txt(signal.discreteSignal?.signalVoltage)}</Td> : <Na key={key} />;
      case "discPlcType": return isDisc ? <Td key={key}>{txt(signal.discreteSignal?.plcDataType?.code)}</Td> : <Na key={key} />;
      // Analog fields
      case "itype": return isAnlg ? <Td key={key}><span className="text-xs truncate block">{signal.analogSignal?.inputType?.name ?? "—"}</span></Td> : <Na key={key} />;
      case "wire": return isAnlg ? <Td key={key}><span className="text-xs text-muted-foreground">{signal.analogSignal?.wireConfig ? (WIRE_CONFIG_LABELS[signal.analogSignal.wireConfig] ?? signal.analogSignal.wireConfig) : "—"}</span></Td> : <Na key={key} />;
      case "eu": return isAnlg ? <Td key={key}><span className="text-xs text-muted-foreground">{signal.analogSignal?.engineeringUnit?.symbol ?? "—"}</span></Td> : <Na key={key} />;
      case "smin": return isAnlg ? <Td key={key} className="text-right"><span className="text-xs tabular-nums">{signal.analogSignal?.scaleMin != null ? Number(signal.analogSignal.scaleMin) : "—"}</span></Td> : <Na key={key} />;
      case "smax": return isAnlg ? <Td key={key} className="text-right"><span className="text-xs tabular-nums">{signal.analogSignal?.scaleMax != null ? Number(signal.analogSignal.scaleMax) : "—"}</span></Td> : <Na key={key} />;
      case "dtype": return isAnlg ? <Td key={key}>{(() => { const euType = signal.analogSignal?.engineeringUnit?.plcDataTypeCatalog?.code; const sigType = signal.analogSignal?.plcDataTypeCatalog?.code; const resolved = euType ?? sigType; return resolved ? <span className={cn("text-xs font-mono", euType && "text-purple-600")} title={euType ? "From EU" : undefined}>{resolved}</span> : dash; })()}</Td> : <Na key={key} />;
      case "rawMin": return isAnlg ? <Td key={key} className="text-right">{num(signal.analogSignal?.rawMin)}</Td> : <Na key={key} />;
      case "rawMax": return isAnlg ? <Td key={key} className="text-right">{num(signal.analogSignal?.rawMax)}</Td> : <Na key={key} />;
      case "rawZero": return isAnlg ? <Td key={key} className="text-right">{num(signal.analogSignal?.rawZero)}</Td> : <Na key={key} />;
      case "clampLow": return isAnlg ? <Td key={key} className="text-right">{num(signal.analogSignal?.clampLow)}</Td> : <Na key={key} />;
      case "clampHigh": return isAnlg ? <Td key={key} className="text-right">{num(signal.analogSignal?.clampHigh)}</Td> : <Na key={key} />;
      case "deadband": return isAnlg ? <Td key={key} className="text-right">{num(signal.analogSignal?.deadband)}</Td> : <Na key={key} />;
      case "wireBreak": return isAnlg ? <Td key={key}>{signal.analogSignal?.detectWireBreak ? <span className="text-xs">Yes</span> : dash}</Td> : <Na key={key} />;
      case "shortCircuit": return isAnlg ? <Td key={key}>{signal.analogSignal?.detectShortCircuit ? <span className="text-xs">Yes</span> : dash}</Td> : <Na key={key} />;
      case "outOfRange": return isAnlg ? <Td key={key}>{signal.analogSignal?.detectOutOfRange ? <span className="text-xs">Yes</span> : dash}</Td> : <Na key={key} />;
      case "namurNe43": return isAnlg ? <Td key={key}>{signal.analogSignal?.namurNe43 ? <span className="text-xs">Yes</span> : dash}</Td> : <Na key={key} />;
      case "tankLevel": return isAnlg ? <Td key={key}>{signal.analogSignal?.useTankLevel ? <span className="text-xs">Yes</span> : dash}</Td> : <Na key={key} />;
      case "scalingFb": return isAnlg ? <Td key={key}>{txt(signal.analogSignal?.scalingFbOverride)}</Td> : <Na key={key} />;
      case "dbRawMin": return isAnlg ? <Td key={key} className="text-right">{num(signal.analogSignal?.deadbandRawMin)}</Td> : <Na key={key} />;
      case "dbRawZero": return isAnlg ? <Td key={key} className="text-right">{num(signal.analogSignal?.deadbandRawZero)}</Td> : <Na key={key} />;
      case "dbRawMax": return isAnlg ? <Td key={key} className="text-right">{num(signal.analogSignal?.deadbandRawMax)}</Td> : <Na key={key} />;
      case "failRaw": return isAnlg ? <Td key={key} className="text-right">{num(signal.analogSignal?.sensorFailRaw)}</Td> : <Na key={key} />;
      case "failMargin": return isAnlg ? <Td key={key} className="text-right">{num(signal.analogSignal?.sensorFailMargin)}</Td> : <Na key={key} />;
      case "failBehavior": return isAnlg ? <Td key={key}>{txt(signal.analogSignal?.sensorFailBehavior)}</Td> : <Na key={key} />;
      case "failDelay": return isAnlg ? <Td key={key} className="text-right">{num(signal.analogSignal?.sensorFailDelayMs)}</Td> : <Na key={key} />;
      // Individual bus fields
      case "rawDataType": return <Td key={key}>{txt(bs?.rawDataType)}</Td>;
      case "byteOrder": return <Td key={key}>{txt(bs?.byteOrder === "BIG_ENDIAN" ? "BE" : bs?.byteOrder === "LITTLE_ENDIAN" ? "LE" : null)}</Td>;
      case "canNodeId": return <Td key={key}>{num(bs?.nodeId)}</Td>;
      case "bitOffset": return <Td key={key}>{num(bs?.bitOffset)}</Td>;
      case "bitLength": return <Td key={key}>{num(bs?.bitLength)}</Td>;
      case "muxIndicator": return <Td key={key}>{bs?.isMuxIndicator ? <span className="text-xs">Yes</span> : dash}</Td>;
      case "muxId": return <Td key={key}>{num(bs?.muxId)}</Td>;
      case "canopenIdx": return <Td key={key}>{bs?.canopenIndex != null ? <span className="text-xs font-mono">0x{bs.canopenIndex.toString(16).toUpperCase().padStart(4, "0")}</span> : dash}</Td>;
      case "canopenSub": return <Td key={key}>{num(bs?.canopenSubIndex)}</Td>;
      case "j1939Pgn": return <Td key={key}>{num(bs?.j1939Pgn)}</Td>;
      case "j1939Spn": return <Td key={key}>{num(bs?.j1939Spn)}</Td>;
      case "modbusUnit": return <Td key={key}>{num(bs?.unitId)}</Td>;
      case "modbusRegType": return <Td key={key}>{txt(bs?.registerType ? ({ HOLDING_REGISTER: "HR", INPUT_REGISTER: "IR", COIL: "CO", DISCRETE_INPUT: "DI" }[bs.registerType] ?? bs.registerType) : null)}</Td>;
      case "modbusRegOfs": return <Td key={key}>{num(bs?.registerOffset)}</Td>;
      case "timeoutMs": return <Td key={key}>{num(bs?.timeoutMs)}</Td>;
      // Detail fields
      case "notes": return <Td key={key}>{txt(signal.notes)}</Td>;
      case "isRetain": return <Td key={key}>{signal.isRetain ? <span className="text-xs">Yes</span> : dash}</Td>;
      case "isPersistent": return <Td key={key}>{signal.isPersistent ? <span className="text-xs">Yes</span> : dash}</Td>;
      case "logging": return <Td key={key}>{signal.loggingEnabled ? <span className="text-xs">Yes</span> : dash}</Td>;
      case "fbOverride": return <Td key={key}>{txt(signal.fbNameOverride)}</Td>;
      case "shortName": return <Td key={key}>{signal.useShortName ? <span className="text-xs">Yes</span> : dash}</Td>;
      // Alarm config fields
      case "alarmGrp": return <Td key={key}>{txt(signal.alarmGroup)}</Td>;
      case "alarmMask": return <Td key={key}>{txt(signal.alarmBlockMask)}</Td>;
      case "commMask": return <Td key={key}>{txt(signal.commBlockMask)}</Td>;
      case "fatBlk": return <Td key={key}>{signal.fatBlock ? <span className="text-xs">Yes</span> : dash}</Td>;
      case "suppression": return <Td key={key}>{txt(signal.suppressionSt)}</Td>;
      case "specAlarmFb": return <Td key={key}>{txt(signal.specialAlarmFb)}</Td>;
      case "specAlarmIn": return <Td key={key}>{txt(signal.specialAlarmInput)}</Td>;
      case "anaDigAlarm": return <Td key={key}>{signal.anaToDigAlarm ? <span className="text-xs">Yes</span> : dash}</Td>;
      case "gvl": return <Td key={key}><span className="text-xs text-muted-foreground truncate block">{signal.gvl?.name ?? "—"}</span></Td>;
      case "drawing": return <Td key={key}><span className="text-xs text-muted-foreground truncate block">{signal.drawingRef ?? "—"}</span></Td>;
      case "cabinet": return <Td key={key}><span className="text-xs text-muted-foreground">{signal.cabinetLocation ?? "—"}</span></Td>;
      case "actions": return <Td key={key}>
        <div className="flex items-center gap-0.5">
          {onRevert && (
            <button type="button" title="Revert to component template defaults"
              className={cn("rounded p-1 hover:bg-accent disabled:opacity-50", signal.instanceSignal?.templateDirty ? "text-amber-500 hover:text-amber-600" : "text-muted-foreground/25")}
              disabled={isRevertPending || !signal.instanceSignal?.templateDirty} onClick={(e) => { e.stopPropagation(); onRevert(); }}
            ><RotateCcw className="h-3.5 w-3.5" /></button>
          )}
          <button type="button" title="Delete"
            className="rounded p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); if (confirm(`Delete signal "${signal.tag ?? signal.description ?? `#${signal.id}`}"?`)) onDelete(); }}
          ><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </Td>;
      default: return null;
    }
  }

  return (
    <tr
      className={cn(
        "border-b border-border/40 cursor-pointer group",
        selected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-accent/30"
      )}
      onClick={onEdit}
    >
      {visibleCols.map((d) => renderCell(d.key))}
    </tr>
  );
});

// ── Edit row ──────────────────────────────────────────────────────────────────

function EditRow({
  values, cards, units, inputTypes, plcDataTypes, systems, gvls,
  signals, editingId, isNew, isSaving, visibleCols,
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
  visibleCols: ColDef[];
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

  const gray = <td className="px-2 py-1 align-middle text-center"><span className="text-xs text-muted-foreground/25">—</span></td>;

  function renderCell(key: ColKey) {
    switch (key) {
      case "select": return <td key={key} className="px-2 py-1 align-middle"><span className="block h-3.5 w-3.5" /></td>;
      case "tag": return <Td key={key}><input className={inp} value={values.tag} onChange={(e) => onChange({ tag: e.target.value })} placeholder="TAG" /></Td>;
      case "desc": return <Td key={key}><input className={inp} value={values.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="Description" autoFocus={isNew} /></Td>;
      case "io": return <Td key={key}>
        <select className={sel}
          value={`${values.signalType === "DISCRETE" ? "D" : "A"}${values.direction === "OUTPUT" ? "O" : "I"}`}
          onChange={(e) => {
            const code = e.target.value;
            const signalType: "DISCRETE" | "ANALOG" = code.startsWith("D") ? "DISCRETE" : "ANALOG";
            const direction: "INPUT" | "OUTPUT" = code.endsWith("O") ? "OUTPUT" : "INPUT";
            const defaultPdt = signalType === "DISCRETE" ? (plcDataTypes.find((d) => d.code === "BOOL")?.id ?? null) : (plcDataTypes.find((d) => d.code === "REAL")?.id ?? null);
            onChange({ signalType, direction, plcDataTypeId: defaultPdt });
          }}
        >
          <option value="DI">DI</option><option value="DO">DO</option><option value="AI">AI</option><option value="AO">AO</option>
        </select>
      </Td>;
      case "origin": return <Td key={key}><select className={sel} value={values.origin} onChange={(e) => onChange({ origin: e.target.value })}>{SIGNAL_ORIGINS.map((o) => <option key={o} value={o}>{o}</option>)}</select></Td>;
      case "card": return <Td key={key}>{values.origin === "IEC" ? <select className={sel} value={values.ioCardId ?? ""} onChange={handleCardChange}><option value="">— Unassigned —</option>{cards.map((c) => <option key={c.id} value={c.id}>{c.path}{c.articleNumber ? ` — ${c.articleNumber}` : ""}</option>)}</select> : <span className="text-xs text-muted-foreground italic">Via network</span>}</Td>;
      case "ch": return <Td key={key}>{values.origin === "IEC" ? <input className={cn(inp, "text-center")} type="number" min={0} value={values.channelPosition} onChange={(e) => onChange({ channelPosition: e.target.value })} placeholder="0" /> : <span className="text-xs text-muted-foreground">—</span>}</Td>;
      case "network": return <React.Fragment key={key}>{gray}</React.Fragment>;
      case "cabinet": return <Td key={key}><input className={inp} value={values.cabinetLocation} onChange={(e) => onChange({ cabinetLocation: e.target.value })} placeholder="A01" /></Td>;
      case "drawing": return <Td key={key}><input className={inp} value={values.drawingRef} onChange={(e) => onChange({ drawingRef: e.target.value })} placeholder="625-E01" /></Td>;
      case "system": return <Td key={key}><select className={sel} value={values.systemId ?? ""} onChange={(e) => onChange({ systemId: e.target.value ? Number(e.target.value) : null })}><option value="">—</option>{systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Td>;
      case "component": return <Td key={key}><input className={inp} value={values.componentTag} onChange={(e) => onChange({ componentTag: e.target.value })} placeholder="625-M01" /></Td>;
      case "gvl": return <Td key={key}><select className={sel} value={values.gvlId ?? ""} onChange={(e) => onChange({ gvlId: e.target.value ? Number(e.target.value) : null })}><option value="">—</option>{gvls.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Td>;
      // Discrete
      case "trigger": return isDisc ? <Td key={key}><select className={sel} value={values.trigger} onChange={(e) => onChange({ trigger: e.target.value as "NO" | "NC" })}><option value="NO">NO</option><option value="NC">NC</option></select></Td> : <React.Fragment key={key}>{gray}</React.Fragment>;
      case "filter": return isDisc ? <Td key={key}><input className={cn(inp, "text-right")} type="number" min={0} value={values.filterTimeMs} onChange={(e) => onChange({ filterTimeMs: e.target.value })} placeholder="ms" /></Td> : <React.Fragment key={key}>{gray}</React.Fragment>;
      // Analog
      case "itype": return isAnlg ? <Td key={key}><select className={sel} value={values.inputTypeId ?? ""} onChange={(e) => {
        const typeId = e.target.value ? Number(e.target.value) : null;
        const selectedType = inputTypes.find((t) => t.id === typeId);
        const update: Partial<EditValues> = { inputTypeId: typeId };
        if (selectedType?.code === "PT100" || selectedType?.code === "PT1000") { const degUnit = units.find((u) => u.symbol === "°C"); if (degUnit) update.engineeringUnitId = degUnit.id; }
        onChange(update);
      }}><option value="">—</option>{inputTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Td> : <React.Fragment key={key}>{gray}</React.Fragment>;
      case "wire": return isAnlg ? <Td key={key}><select className={sel} value={values.wireConfig} onChange={(e) => onChange({ wireConfig: e.target.value as EditValues["wireConfig"] })}><option value="">—</option><option value="TWO_WIRE">2-Wire</option><option value="THREE_WIRE">3-Wire</option><option value="FOUR_WIRE">4-Wire</option></select></Td> : <React.Fragment key={key}>{gray}</React.Fragment>;
      case "eu": return isAnlg ? <Td key={key}><select className={sel} value={values.engineeringUnitId ?? ""} onChange={(e) => onChange({ engineeringUnitId: e.target.value ? Number(e.target.value) : null })}><option value="">—</option>{units.map((u) => <option key={u.id} value={u.id}>{u.symbol}</option>)}</select></Td> : <React.Fragment key={key}>{gray}</React.Fragment>;
      case "smin": return isAnlg ? <Td key={key}><input className={cn(inp, "text-right")} type="number" value={values.scaleMin} onChange={(e) => onChange({ scaleMin: e.target.value })} placeholder="min" /></Td> : <React.Fragment key={key}>{gray}</React.Fragment>;
      case "smax": return isAnlg ? <Td key={key}><input className={cn(inp, "text-right")} type="number" value={values.scaleMax} onChange={(e) => onChange({ scaleMax: e.target.value })} placeholder="max" /></Td> : <React.Fragment key={key}>{gray}</React.Fragment>;
      case "dtype": return isAnlg ? <Td key={key}>{(() => {
        const euTypeId = values.engineeringUnitId ? (units.find((u) => u.id === values.engineeringUnitId)?.plcDataTypeId ?? null) : null;
        const euTypeCode = euTypeId ? (plcDataTypes.find((t) => t.id === euTypeId)?.code ?? null) : null;
        return euTypeCode ? <span className="text-xs font-mono text-purple-600 px-1" title="Overridden by EU">{euTypeCode}</span> : <select className={sel} value={values.plcDataTypeId ?? ""} onChange={(e) => onChange({ plcDataTypeId: e.target.value ? Number(e.target.value) : null })}><option value="">—</option>{plcDataTypes.map((t) => <option key={t.id} value={t.id}>{t.code}</option>)}</select>;
      })()}</Td> : <React.Fragment key={key}>{gray}</React.Fragment>;
      // Additional editable fields
      case "notes": return <Td key={key}><input className={inp} value={values.notes} onChange={(e) => onChange({ notes: e.target.value })} placeholder="Notes…" /></Td>;
      case "switchType": return isDisc ? <Td key={key}><select className={sel} value={values.switchingType} onChange={(e) => onChange({ switchingType: e.target.value })}><option value="">—</option><option value="HIGH_SIDE">High</option><option value="LOW_SIDE">Low</option><option value="BOTH">Both</option></select></Td> : <React.Fragment key={key}>{gray}</React.Fragment>;
      case "sigVoltage": return isDisc ? <Td key={key}><input className={inp} value={values.signalVoltage} onChange={(e) => onChange({ signalVoltage: e.target.value })} placeholder="24V" /></Td> : <React.Fragment key={key}>{gray}</React.Fragment>;
      case "discPlcType": return isDisc ? <Td key={key}><select className={sel} value={values.plcDataTypeId ?? ""} onChange={(e) => onChange({ plcDataTypeId: e.target.value ? Number(e.target.value) : null })}><option value="">—</option>{plcDataTypes.map((t) => <option key={t.id} value={t.id}>{t.code}</option>)}</select></Td> : <React.Fragment key={key}>{gray}</React.Fragment>;
      case "rawMin": return isAnlg ? <Td key={key}><input className={cn(inp, "text-right")} type="number" value={values.rawMin} onChange={(e) => onChange({ rawMin: e.target.value })} /></Td> : <React.Fragment key={key}>{gray}</React.Fragment>;
      case "rawMax": return isAnlg ? <Td key={key}><input className={cn(inp, "text-right")} type="number" value={values.rawMax} onChange={(e) => onChange({ rawMax: e.target.value })} /></Td> : <React.Fragment key={key}>{gray}</React.Fragment>;
      case "rawZero": return isAnlg ? <Td key={key}><input className={cn(inp, "text-right")} type="number" value={values.rawZero} onChange={(e) => onChange({ rawZero: e.target.value })} /></Td> : <React.Fragment key={key}>{gray}</React.Fragment>;
      case "clampLow": return isAnlg ? <Td key={key}><input className={cn(inp, "text-right")} type="number" value={values.clampLow} onChange={(e) => onChange({ clampLow: e.target.value })} /></Td> : <React.Fragment key={key}>{gray}</React.Fragment>;
      case "clampHigh": return isAnlg ? <Td key={key}><input className={cn(inp, "text-right")} type="number" value={values.clampHigh} onChange={(e) => onChange({ clampHigh: e.target.value })} /></Td> : <React.Fragment key={key}>{gray}</React.Fragment>;
      case "deadband": return isAnlg ? <Td key={key}><input className={cn(inp, "text-right")} type="number" value={values.deadband} onChange={(e) => onChange({ deadband: e.target.value })} /></Td> : <React.Fragment key={key}>{gray}</React.Fragment>;
      // Actions
      case "actions": return <Td key={key}>
        <div className="flex items-center gap-1">
          <button type="button" className="rounded p-1 hover:bg-green-100 text-green-700 disabled:opacity-40" onClick={() => onSave(valuesRef.current)} disabled={isSaving} title="Save (Enter)"><Check className="h-4 w-4" /></button>
          <button type="button" className="rounded p-1 hover:bg-accent text-muted-foreground" onClick={onCancel} title="Cancel (Esc)"><X className="h-4 w-4" /></button>
        </div>
      </Td>;
      // Dialog buttons and read-only columns → gray placeholder in edit mode
      default: return <React.Fragment key={key}>{gray}</React.Fragment>;
    }
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
      {visibleCols.map((d) => renderCell(d.key))}
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

/** Text filter: "<empty>" matches null/blank, "!<empty>" matches non-empty, otherwise substring. */
const emptyAwareText: FilterFn<SignalRow> = (row, columnId, filterValue) => {
  const cellValue = String(row.getValue(columnId) ?? "");
  const filter = String(filterValue).trim().toLowerCase();
  if (filter === "<empty>") return cellValue === "";
  if (filter === "!<empty>") return cellValue !== "";
  return cellValue.toLowerCase().includes(filter);
};

/** Faceted filter: "__empty__" matches blank, otherwise exact match. */
const emptyAwareFacet: FilterFn<SignalRow> = (row, columnId, filterValue) => {
  const cellValue = String(row.getValue(columnId) ?? "");
  if (filterValue === "__empty__") return cellValue === "";
  return cellValue === String(filterValue);
};

const SIGNAL_COLUMNS = [
  columnHelper.display({ id: "select", enableSorting: false, enableColumnFilter: false }),
  columnHelper.accessor((r) => r.system?.name ?? "", { id: "system", filterFn: emptyAwareText }),
  columnHelper.accessor((r) => r.componentTag ?? "", { id: "component", filterFn: emptyAwareText }),
  columnHelper.accessor((r) => r.description ?? "", { id: "desc", filterFn: emptyAwareText }),
  columnHelper.accessor((r) => r.tag ?? "", { id: "tag", filterFn: emptyAwareText }),
  columnHelper.accessor((r) => r.ioCard ? `${r.ioCard.carrier.plc.name}/${r.ioCard.carrier.name}` : "", { id: "card", filterFn: emptyAwareText }),
  columnHelper.accessor((r) => r.channelPosition ?? null, { id: "ch", enableColumnFilter: false }),
  columnHelper.accessor((r) => getSignalIoCode(r), { id: "io", filterFn: emptyAwareFacet }),
  columnHelper.accessor((r) => r.origin, { id: "origin", filterFn: emptyAwareFacet }),
  columnHelper.accessor((r) => {
    const net = r.busSignal?.plcNetwork ?? r.instanceSignal?.instance?.network;
    if (!net) return "";
    const parts: string[] = [net.protocol];
    if (net.description) parts.push(net.description);
    return parts.join(" — ");
  }, { id: "network", filterFn: emptyAwareText }),
  columnHelper.display({ id: "bus", enableSorting: false, enableColumnFilter: false }),
  columnHelper.accessor((r) => r.revision ?? "", { id: "rev", filterFn: emptyAwareFacet }),
  columnHelper.display({ id: "signal", enableSorting: false, enableColumnFilter: false }),
  columnHelper.display({ id: "detail", enableSorting: false, enableColumnFilter: false }),
  columnHelper.display({ id: "hw", enableSorting: false, enableColumnFilter: false }),
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
  // Discrete detail fields
  columnHelper.accessor((r) => r.discreteSignal?.trigger ?? "", { id: "trigger", filterFn: emptyAwareFacet }),
  columnHelper.accessor((r) => r.discreteSignal?.filterTimeMs != null ? Number(r.discreteSignal.filterTimeMs) : null, { id: "filter", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.discreteSignal?.switchingType ?? "", { id: "switchType", filterFn: emptyAwareFacet }),
  columnHelper.accessor((r) => r.discreteSignal?.signalVoltage ?? "", { id: "sigVoltage", filterFn: emptyAwareText }),
  columnHelper.accessor((r) => r.discreteSignal?.plcDataType?.code ?? "", { id: "discPlcType", filterFn: emptyAwareFacet }),
  // Analog detail fields
  columnHelper.accessor((r) => r.analogSignal?.inputType?.name ?? "", { id: "itype", filterFn: emptyAwareFacet }),
  columnHelper.accessor((r) => r.analogSignal?.wireConfig ?? "", { id: "wire", filterFn: emptyAwareFacet }),
  columnHelper.accessor((r) => r.analogSignal?.engineeringUnit?.symbol ?? "", { id: "eu", filterFn: emptyAwareFacet }),
  columnHelper.accessor((r) => r.analogSignal?.scaleMin != null ? Number(r.analogSignal.scaleMin) : null, { id: "smin", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.analogSignal?.scaleMax != null ? Number(r.analogSignal.scaleMax) : null, { id: "smax", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.analogSignal?.plcDataTypeCatalog?.code ?? r.analogSignal?.engineeringUnit?.plcDataTypeCatalog?.code ?? "", { id: "dtype", filterFn: emptyAwareFacet }),
  columnHelper.accessor((r) => r.analogSignal?.rawMin != null ? Number(r.analogSignal.rawMin) : null, { id: "rawMin", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.analogSignal?.rawMax != null ? Number(r.analogSignal.rawMax) : null, { id: "rawMax", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.analogSignal?.rawZero != null ? Number(r.analogSignal.rawZero) : null, { id: "rawZero", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.analogSignal?.clampLow != null ? Number(r.analogSignal.clampLow) : null, { id: "clampLow", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.analogSignal?.clampHigh != null ? Number(r.analogSignal.clampHigh) : null, { id: "clampHigh", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.analogSignal?.deadband != null ? Number(r.analogSignal.deadband) : null, { id: "deadband", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.analogSignal?.detectWireBreak ? "Yes" : "", { id: "wireBreak", filterFn: emptyAwareFacet }),
  columnHelper.accessor((r) => r.analogSignal?.detectShortCircuit ? "Yes" : "", { id: "shortCircuit", filterFn: emptyAwareFacet }),
  columnHelper.accessor((r) => r.analogSignal?.detectOutOfRange ? "Yes" : "", { id: "outOfRange", filterFn: emptyAwareFacet }),
  columnHelper.accessor((r) => r.analogSignal?.namurNe43 ? "Yes" : "", { id: "namurNe43", filterFn: emptyAwareFacet }),
  columnHelper.accessor((r) => r.analogSignal?.useTankLevel ? "Yes" : "", { id: "tankLevel", filterFn: emptyAwareFacet }),
  columnHelper.accessor((r) => r.analogSignal?.scalingFbOverride ?? "", { id: "scalingFb", filterFn: emptyAwareText }),
  columnHelper.accessor((r) => r.analogSignal?.deadbandRawMin != null ? Number(r.analogSignal.deadbandRawMin) : null, { id: "dbRawMin", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.analogSignal?.deadbandRawZero != null ? Number(r.analogSignal.deadbandRawZero) : null, { id: "dbRawZero", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.analogSignal?.deadbandRawMax != null ? Number(r.analogSignal.deadbandRawMax) : null, { id: "dbRawMax", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.analogSignal?.sensorFailRaw != null ? Number(r.analogSignal.sensorFailRaw) : null, { id: "failRaw", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.analogSignal?.sensorFailMargin != null ? Number(r.analogSignal.sensorFailMargin) : null, { id: "failMargin", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.analogSignal?.sensorFailBehavior ?? "", { id: "failBehavior", filterFn: emptyAwareFacet }),
  columnHelper.accessor((r) => r.analogSignal?.sensorFailDelayMs ?? null, { id: "failDelay", enableColumnFilter: false }),
  // Individual bus fields (hidden by default)
  columnHelper.accessor((r) => r.busSignal?.rawDataType ?? "", { id: "rawDataType", filterFn: emptyAwareFacet }),
  columnHelper.accessor((r) => r.busSignal?.byteOrder ?? "", { id: "byteOrder", filterFn: emptyAwareFacet }),
  columnHelper.accessor((r) => r.busSignal?.nodeId ?? null, { id: "canNodeId", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.busSignal?.bitOffset ?? null, { id: "bitOffset", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.busSignal?.bitLength ?? null, { id: "bitLength", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.busSignal?.isMuxIndicator ? "Yes" : "", { id: "muxIndicator", filterFn: emptyAwareFacet }),
  columnHelper.accessor((r) => r.busSignal?.muxId ?? null, { id: "muxId", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.busSignal?.canopenIndex ?? null, { id: "canopenIdx", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.busSignal?.canopenSubIndex ?? null, { id: "canopenSub", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.busSignal?.j1939Pgn ?? null, { id: "j1939Pgn", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.busSignal?.j1939Spn ?? null, { id: "j1939Spn", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.busSignal?.unitId ?? null, { id: "modbusUnit", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.busSignal?.registerType ?? "", { id: "modbusRegType", filterFn: emptyAwareFacet }),
  columnHelper.accessor((r) => r.busSignal?.registerOffset ?? null, { id: "modbusRegOfs", enableColumnFilter: false }),
  columnHelper.accessor((r) => r.busSignal?.timeoutMs ?? null, { id: "timeoutMs", enableColumnFilter: false }),
  // Detail fields
  columnHelper.accessor((r) => r.notes ?? "", { id: "notes", filterFn: emptyAwareText }),
  columnHelper.accessor((r) => r.isRetain ? "Yes" : "", { id: "isRetain", filterFn: emptyAwareFacet }),
  columnHelper.accessor((r) => r.isPersistent ? "Yes" : "", { id: "isPersistent", filterFn: emptyAwareFacet }),
  columnHelper.accessor((r) => r.loggingEnabled ? "Yes" : "", { id: "logging", filterFn: emptyAwareFacet }),
  columnHelper.accessor((r) => r.fbNameOverride ?? "", { id: "fbOverride", filterFn: emptyAwareText }),
  columnHelper.accessor((r) => r.useShortName ? "Yes" : "", { id: "shortName", filterFn: emptyAwareFacet }),
  // Alarm config fields
  columnHelper.accessor((r) => r.alarmGroup ?? "", { id: "alarmGrp", filterFn: emptyAwareFacet }),
  columnHelper.accessor((r) => r.alarmBlockMask ?? "", { id: "alarmMask", filterFn: emptyAwareText }),
  columnHelper.accessor((r) => r.commBlockMask ?? "", { id: "commMask", filterFn: emptyAwareText }),
  columnHelper.accessor((r) => r.fatBlock ? "Yes" : "", { id: "fatBlk", filterFn: emptyAwareFacet }),
  columnHelper.accessor((r) => r.suppressionSt ?? "", { id: "suppression", filterFn: emptyAwareText }),
  columnHelper.accessor((r) => r.specialAlarmFb ?? "", { id: "specAlarmFb", filterFn: emptyAwareText }),
  columnHelper.accessor((r) => r.specialAlarmInput ?? "", { id: "specAlarmIn", filterFn: emptyAwareText }),
  columnHelper.accessor((r) => r.anaToDigAlarm ? "Yes" : "", { id: "anaDigAlarm", filterFn: emptyAwareFacet }),
  columnHelper.accessor((r) => r.gvl?.name ?? "", { id: "gvl", filterFn: emptyAwareText }),
  columnHelper.accessor((r) => r.drawingRef ?? "", { id: "drawing", filterFn: emptyAwareText }),
  columnHelper.accessor((r) => r.cabinetLocation ?? "", { id: "cabinet", filterFn: emptyAwareText }),
  columnHelper.display({ id: "actions", enableSorting: false, enableColumnFilter: false }),
];

// ── Column filter inputs ──────────────────────────────────────────────────────

// Columns with text filter (free-text substring match)
const TEXT_FILTER_COLS = new Set<ColKey>(["system", "component", "desc", "tag", "card", "network", "sigVoltage", "scalingFb", "notes", "fbOverride", "alarmMask", "commMask", "suppression", "specAlarmFb", "specAlarmIn", "gvl", "drawing", "cabinet"]);
// Columns with faceted select filter (dynamic values from data)
const FACET_FILTER_COLS = new Set<ColKey>(["io", "origin", "rev", "trigger", "switchType", "discPlcType", "itype", "wire", "eu", "dtype", "wireBreak", "shortCircuit", "outOfRange", "namurNe43", "tankLevel", "failBehavior", "rawDataType", "byteOrder", "muxIndicator", "modbusRegType", "isRetain", "isPersistent", "logging", "shortName", "alarmGrp", "fatBlk", "anaDigAlarm"]);

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
        placeholder="Filter… (<empty>)"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  if (FACET_FILTER_COLS.has(colKey)) {
    // Build options from faceted unique values (only values present in current data)
    const facetMap = column.getFacetedUniqueValues();
    const emptyCount = facetMap.get("") ?? facetMap.get(null as any) ?? 0;
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
        {emptyCount > 0 && <option value="__empty__">(empty) ({emptyCount})</option>}
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

function RevisionBadge({ projectId }: { projectId: number }) {
  const { data } = trpc.signal.projectRevision.useQuery({ projectId });
  const utils = trpc.useUtils();
  const bump = trpc.signal.revisionBump.useMutation({
    onSuccess: () => {
      utils.signal.projectRevision.invalidate({ projectId });
      utils.signal.list.invalidate({ projectId });
    },
  });
  const rev = data?.currentRevision ?? "A";
  return (
    <div className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
      <span className="text-muted-foreground">Rev</span>
      <span className="font-mono font-semibold">{rev}</span>
      <button
        type="button"
        className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        onClick={() => { if (confirm(`Bump revision from ${rev} to next?`)) bump.mutate({ projectId }); }}
        disabled={bump.isPending}
      >
        Bump
      </button>
    </div>
  );
}

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
  const [defaultsSignal, setDefaultsSignal] = useState<SignalRow | null>(null);
  const [hardwareSignal, setHardwareSignal] = useState<SignalRow | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showImportMpv, setShowImportMpv] = useState(false);
  const [showAddFromComponent, setShowAddFromComponent] = useState(false);
  const [showStructuredImport, setShowStructuredImport] = useState(false);
  const [showExportLegacy, setShowExportLegacy] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<Set<ColKey>>(DEFAULT_HIDDEN);
  const [columnOrder, setColumnOrder] = useState<ColKey[]>(() => COL_DEFS.map((d) => d.key));

  // Load persisted hidden columns + order after hydration
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_COL_HIDDEN);
      if (stored) setHiddenColumns(new Set(JSON.parse(stored)));
    } catch {}
    try {
      const stored = localStorage.getItem(LS_COL_ORDER);
      if (stored) {
        const parsed = JSON.parse(stored) as ColKey[];
        // Merge: keep stored order, append any new columns not in the stored set
        const allKeys = new Set(COL_DEFS.map((d) => d.key));
        const valid = parsed.filter((k) => allKeys.has(k));
        const missing = COL_DEFS.map((d) => d.key).filter((k) => !valid.includes(k));
        setColumnOrder([...valid, ...missing]);
      }
    } catch {}
  }, []);
  const [showCreateComponent, setShowCreateComponent] = useState(false);
  const [grouped, setGrouped] = useState(true);
  const [groupCollapseKey, setGroupCollapseKey] = useState(0);

  const { widths, onResizeStart } = useColumnWidths();
  const scrollRef = useRef<HTMLDivElement>(null);

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
      const inGrid = scrollRef.current?.contains(target) ?? false;
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
  const bulkUpdate = trpc.signal.bulkUpdate.useMutation({
    onSuccess: () => utils.signal.list.invalidate({ projectId }),
  });
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
  const bulkCreate = trpc.signal.bulkCreate.useMutation({
    onSuccess: () => utils.signal.list.invalidate({ projectId }),
  });
  const bulkDel = trpc.signal.bulkDelete.useMutation({
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

    // Map EditValues diff keys to bulkUpdate data keys
    const data: Record<string, unknown> = {};
    if (diff.direction !== undefined) data.direction = diff.direction || null;
    if (diff.systemId !== undefined) data.systemId = diff.systemId;
    if (diff.componentTag !== undefined) data.componentTag = diff.componentTag || null;
    if (diff.drawingRef !== undefined) data.drawingRef = diff.drawingRef || null;
    if (diff.cabinetLocation !== undefined) data.cabinetLocation = diff.cabinetLocation || null;
    if (diff.gvlId !== undefined) data.gvlId = diff.gvlId;
    if (diff.origin !== undefined) data.origin = diff.origin;
    if (diff.trigger !== undefined) data.trigger = diff.trigger;
    if (diff.inputTypeId !== undefined) data.inputTypeId = diff.inputTypeId;
    if (diff.wireConfig !== undefined) data.wireConfig = diff.wireConfig || null;
    if (diff.engineeringUnitId !== undefined) data.engineeringUnitId = diff.engineeringUnitId;
    if (diff.plcDataTypeId !== undefined) data.plcDataTypeId = diff.plcDataTypeId;

    if (Object.keys(data).length > 0) {
      await bulkUpdate.mutateAsync({ ids: otherIds, data });
    }
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
    await bulkDel.mutateAsync({ ids: selectedIds });
  }

  function clearFilters() {
    setColumnFilters([]);
    setGlobalFilter("");
  }

  const colDefMap = useMemo(() => new Map(COL_DEFS.map((d) => [d.key, d])), []);
  // Pin select first and actions last — everything else follows columnOrder
  const orderedColDefs = useMemo(() => {
    const middle = columnOrder.filter((k) => k !== "select" && k !== "actions").map((k) => colDefMap.get(k)!).filter(Boolean);
    return [colDefMap.get("select" as ColKey)!, ...middle, colDefMap.get("actions" as ColKey)!].filter(Boolean);
  }, [columnOrder, colDefMap]);
  const visibleCols = useMemo(() => orderedColDefs.filter((d) => !hiddenColumns.has(d.key)), [orderedColDefs, hiddenColumns]);
  const totalWidth = visibleCols.reduce((sum, d) => sum + widths[d.key], 0);

  const flatRows = useMemo(() => !grouped ? table.getRowModel().rows : [], [grouped, table.getRowModel().rows]);
  const ROW_HEIGHT = 33; // px — matches py-1 + border on each row
  const rowVirtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15,
  });
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
          <RevisionBadge projectId={projectId} />
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline">
                <Columns3 className="h-4 w-4 mr-1" /> Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 max-h-[420px] overflow-y-auto p-2" onDragOver={(e) => {
              // Auto-scroll when dragging near edges
              const el = e.currentTarget as HTMLElement;
              const rect = el.getBoundingClientRect();
              const y = e.clientY - rect.top;
              const edge = 40;
              if (y < edge) el.scrollTop -= 6;
              else if (y > rect.height - edge) el.scrollTop += 6;
            }}>
              {(() => {
                const DIALOG_ICONS: Record<string, React.ReactNode> = {
                  bus: <Network className="h-3 w-3 shrink-0" />,
                  signal: <Settings2 className="h-3 w-3 shrink-0" />,
                  detail: <FileCode className="h-3 w-3 shrink-0" />,
                  hw: <Cpu className="h-3 w-3 shrink-0" />,
                  alarms: <Bell className="h-3 w-3 shrink-0" />,
                };
                const reorderable = columnOrder.filter((k) => k !== "select" && k !== "actions");
                let dragKey: string | null = null;
                return (
                  <div className="space-y-px">
                    {reorderable.map((key) => {
                      const d = colDefMap.get(key);
                      if (!d) return null;
                      const prefix = d.group ? <span className="text-[10px] text-muted-foreground/60 mr-0.5">{d.group}/</span> : null;
                      return (
                        <div
                          key={key}
                          draggable
                          onDragStart={(e) => { dragKey = key; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", key); (e.currentTarget as HTMLElement).style.opacity = "0.4"; }}
                          onDragEnd={(e) => { (e.currentTarget as HTMLElement).style.opacity = ""; }}
                          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; const el = e.currentTarget as HTMLElement; el.classList.add("border-t-2", "border-primary"); }}
                          onDragLeave={(e) => { const el = e.currentTarget as HTMLElement; el.classList.remove("border-t-2", "border-primary"); }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const el = e.currentTarget as HTMLElement;
                            el.classList.remove("border-t-2", "border-primary");
                            const from = e.dataTransfer.getData("text/plain") as ColKey;
                            const to = key;
                            if (from === to) return;
                            setColumnOrder((prev) => {
                              const next = prev.filter((k) => k !== from);
                              const toIdx = next.indexOf(to);
                              next.splice(toIdx, 0, from);
                              localStorage.setItem(LS_COL_ORDER, JSON.stringify(next));
                              return next;
                            });
                          }}
                          className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-accent cursor-grab active:cursor-grabbing"
                        >
                          <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-input shrink-0"
                            checked={!hiddenColumns.has(d.key)}
                            onChange={() => {
                              setHiddenColumns((prev) => {
                                const next = new Set(prev);
                                if (next.has(d.key)) next.delete(d.key);
                                else next.add(d.key);
                                localStorage.setItem(LS_COL_HIDDEN, JSON.stringify([...next]));
                                return next;
                              });
                            }}
                          />
                          <span className={cn("flex-1 text-sm truncate flex items-center gap-1", (d.disc || d.anlg) && "text-muted-foreground")}>
                            {DIALOG_ICONS[key]}
                            {prefix}
                            {d.label || key}
                            {d.disc && <span className="text-[10px] text-blue-500">DI/DO</span>}
                            {d.anlg && <span className="text-[10px] text-purple-500">AI/AO</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </PopoverContent>
          </Popover>
          <Button
            size="sm"
            variant={grouped ? "secondary" : "ghost"}
            onClick={() => { setGrouped((g) => !g); setGroupCollapseKey((k) => k + 1); }}
            title={grouped ? "Switch to flat view" : "Switch to grouped view"}
          >
            <Layers className="h-4 w-4 mr-1" />
            {grouped ? "Grouped" : "Flat"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Upload className="h-4 w-4 mr-1" /> Import
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowImport(true)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Wulkan
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowImportMpv(true)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                MPV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowStructuredImport(true)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Structured
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowExportLegacy(true)}>
                <FileCode className="h-4 w-4 mr-2" />
                MIAS-Legacy
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="outline" onClick={() => setShowAddFromComponent(true)}>
            <Layers className="h-4 w-4 mr-1" /> Add Component
          </Button>
          <Button size="sm" onClick={startNew} disabled={isAddingNew}>
            <Plus className="h-4 w-4 mr-1" /> Add Signal
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto min-w-0" ref={scrollRef}>
        <table className="border-collapse text-sm" style={{ width: totalWidth, tableLayout: "fixed" }}>
          <colgroup>
            {visibleCols.map((d) => <col key={d.key} style={{ width: widths[d.key] }} />)}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-background">
            {/* Sort header row */}
            <tr className="border-b">
              {visibleCols.map((d) => {
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
              {visibleCols.map((d) => {
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
              <EditRow visibleCols={visibleCols}
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
                    key={`${group.instanceId}-${groupCollapseKey}`}
                    defaultCollapsed
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
                          <EditRow visibleCols={visibleCols}
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
                        <DisplayRow visibleCols={visibleCols}
                          key={signal.id}
                          signal={signal}
                          selected={row.getIsSelected()}
                          onToggleSelect={row.getToggleSelectedHandler()}
                          onEdit={() => startEdit(signal)}
                          onDetail={() => setAdvancedSignal(signal)}
                          onDelete={() => del.mutate({ id: signal.id })}
                          onBusConfig={() => setBusConfigSignal(signal)}
                          onSignal={() => setDefaultsSignal(signal)}
                          onHardware={() => setHardwareSignal(signal)}
                          onAlarms={() => setAlarmSignal(signal)}
                          onRevert={signal.instanceSignal ? () => signalRevert.mutate({ signalId: signal.id }) : undefined}
                          isRevertPending={signalRevert.isPending}
                        />
                      );
                    })}
                  />
                ) : (
                  <ComponentGroup
                    key={`ungrouped-${groupCollapseKey}`}
                    defaultCollapsed
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
                          <EditRow visibleCols={visibleCols}
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
                        <DisplayRow visibleCols={visibleCols}
                          key={signal.id}
                          signal={signal}
                          selected={row.getIsSelected()}
                          onToggleSelect={row.getToggleSelectedHandler()}
                          onEdit={() => startEdit(signal)}
                          onDetail={() => setAdvancedSignal(signal)}
                          onDelete={() => del.mutate({ id: signal.id })}
                          onBusConfig={() => setBusConfigSignal(signal)}
                          onSignal={() => setDefaultsSignal(signal)}
                          onHardware={() => setHardwareSignal(signal)}
                          onAlarms={() => setAlarmSignal(signal)}
                        />
                      );
                    })}
                  />
                )
              )
            ) : (
              // Flat view — virtualized
              <tbody>
                {rowVirtualizer.getTotalSize() > 0 && (
                  <tr style={{ height: rowVirtualizer.getVirtualItems()[0]?.start ?? 0 }}><td /></tr>
                )}
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = flatRows[virtualRow.index];
                  if (!row) return null;
                  const signal = row.original;
                  if (editingId === signal.id && editValues) {
                    return (
                      <EditRow visibleCols={visibleCols}
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
                    <DisplayRow visibleCols={visibleCols}
                      key={signal.id}
                      signal={signal}
                      selected={row.getIsSelected()}
                      onToggleSelect={row.getToggleSelectedHandler()}
                      onEdit={() => startEdit(signal)}
                      onDetail={() => setAdvancedSignal(signal)}
                      onDelete={() => del.mutate({ id: signal.id })}
                      onBusConfig={() => setBusConfigSignal(signal)}
                          onSignal={() => setDefaultsSignal(signal)}
                          onHardware={() => setHardwareSignal(signal)}
                      onAlarms={() => setAlarmSignal(signal)}
                      onRevert={signal.instanceSignal ? () => signalRevert.mutate({ signalId: signal.id }) : undefined}
                      isRevertPending={signalRevert.isPending}
                    />
                  );
                })}
                {rowVirtualizer.getTotalSize() > 0 && (
                  <tr style={{ height: rowVirtualizer.getTotalSize() - (rowVirtualizer.getVirtualItems().at(-1)?.end ?? 0) }}><td /></tr>
                )}
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

      {defaultsSignal && (
        <ProjectDetailsDialog
          open
          signal={defaultsSignal}
          onClose={() => setDefaultsSignal(null)}
          onSaved={() => {
            utils.signal.list.invalidate({ projectId });
            setDefaultsSignal(null);
          }}
        />
      )}

      {hardwareSignal && (
        <ProjectHardwareDialog
          projectId={projectId}
          open
          signal={hardwareSignal}
          onClose={() => setHardwareSignal(null)}
          onSaved={() => {
            utils.signal.list.invalidate({ projectId });
            setHardwareSignal(null);
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

      {showImportMpv && (
        <ImportMpvDialog
          projectId={projectId}
          open
          onClose={() => setShowImportMpv(false)}
          onImported={() => {
            utils.signal.list.invalidate({ projectId });
            setShowImportMpv(false);
          }}
        />
      )}

      {showExportLegacy && (
        <ExportLegacyDialog
          projectId={projectId}
          open
          onClose={() => setShowExportLegacy(false)}
        />
      )}

      {showStructuredImport && (
        <StructuredImportDialog
          open
          onClose={() => setShowStructuredImport(false)}
          title="Structured Signal Import"
          targetFields={SIGNAL_TARGET_FIELDS}
          onImport={async (rows) => {
            const signals = rows.map((row) => {
              const ioType = (row.ioType ?? "").toUpperCase();
              const isDiscrete = ioType === "DI" || ioType === "DO";
              const isOutput = ioType === "DO" || ioType === "AO";
              return {
                signalType: (isDiscrete ? "DISCRETE" : "ANALOG") as "DISCRETE" | "ANALOG",
                origin: "IEC" as const,
                tag: row.tag || row.description?.replace(/[^A-Za-z0-9\s]/g, "").trim().replace(/\s+/g, "_").substring(0, 150) || null,
                description: row.description || null,
                direction: (isOutput ? "OUTPUT" : "INPUT") as "INPUT" | "OUTPUT",
                instrumentTag: row.instrumentTag || null,
                signalClassification: row.signalClassification || null,
                subsystem: row.subsystem || null,
                element: row.element || null,
                signalFunction: row.signalFunction || null,
                supplierName: row.supplierName || null,
                supplierSensorType: row.supplierSensorType || null,
                cabinetLocation: row.cabinet || null,
                notes: row.notes || null,
                trigger: ((row.trigger ?? "").toUpperCase().includes("NC") ? "NC" : "NO") as "NO" | "NC",
                scaleMin: row.rangeLow ? parseFloat(row.rangeLow) : null,
                scaleMax: row.rangeHigh ? parseFloat(row.rangeHigh) : null,
              };
            });
            await bulkCreate.mutateAsync({ projectId, signals });
            utils.signal.list.invalidate({ projectId });
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
