"use client";

import { useState, useCallback, useRef, useEffect, useMemo, memo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
  type GroupingState,
  type ExpandedState,
  type VisibilityState,
  type ColumnOrderState,
  type Column,
  type Row,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { trpc } from "@/trpc/client";
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
import {
  Plus, Save, RotateCcw, Trash2, Settings2, Bell, Network,
  ChevronUp, ChevronDown, ChevronsUpDown, ChevronRight,
  Columns3, GripVertical,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { cn } from "@/lib/utils";
import { DefaultsDialog } from "./DefaultsDialog";
import { AlarmsDialog } from "./AlarmsDialog";
import { BusConfigDialog } from "./BusConfigDialog";
import { SIGNAL_ORIGINS, type SignalOrigin } from "@/lib/enums";

// ── Types ─────────────────────────────────────────────────────────────

export type DiscreteAlarmRow = {
  condition: "ON_TRIGGER" | "OFF_TRIGGER";
  severity: "INFO" | "WARNING" | "ALARM" | "CRITICAL";
  delaySeconds: number;
  message: string | null;
};

export type AnalogAlarmRow = {
  condition: "HIGH" | "HIGH_HIGH" | "LOW" | "LOW_LOW";
  setpoint: number;
  hysteresis: number;
  severity: "INFO" | "WARNING" | "ALARM" | "CRITICAL";
  delaySeconds: number;
  message: string | null;
};

type BusRawDataType = "BOOL"|"BYTE"|"WORD"|"DWORD"|"LWORD"|"INT"|"DINT"|"LINT"|"UINT"|"UDINT"|"ULINT"|"REAL"|"LREAL";

export type SignalRowState = {
  id?: number;
  channelOffset: number;
  ioType: "DI" | "DO" | "AI" | "AO";
  origin: SignalOrigin | null;
  tagSuffix: string | null;
  description: string | null;
  plcDataTypeId: number | null;
  rawDataType: BusRawDataType | null;
  byteOrder: "BIG_ENDIAN" | "LITTLE_ENDIAN" | null;
  canNodeId: number | null;
  canId: number | null;
  bitOffset: number | null;
  bitLength: number | null;
  isMuxIndicator: boolean;
  muxId: number | null;
  canopenIndex: number | null;
  canopenSubIndex: number | null;
  j1939Pgn: number | null;
  j1939Spn: number | null;
  modbusUnitId: number | null;
  modbusRegisterType: "COIL" | "DISCRETE_INPUT" | "HOLDING_REGISTER" | "INPUT_REGISTER" | null;
  modbusRegisterOffset: number | null;
  timeoutMs: number | null;
  // Discrete defaults
  defaultTrigger: "NO" | "NC" | null;
  defaultFilterTimeMs: number | null;
  defaultSwitchingType: "HIGH_SIDE" | "LOW_SIDE" | "BOTH" | null;
  defaultSignalVoltage: string | null;
  // Analog defaults
  defaultInputTypeId: number | null;
  defaultWireConfig: "TWO_WIRE" | "THREE_WIRE" | "FOUR_WIRE" | null;
  defaultScaleMin: number | null;
  defaultScaleMax: number | null;
  defaultRawMin: number | null;
  defaultRawMax: number | null;
  defaultRawZero: number | null;
  defaultClampLow: number | null;
  defaultClampHigh: number | null;
  defaultDeadband: number | null;
  defaultEuId: number | null;
  defaultDetectWireBreak: boolean;
  defaultDetectShortCircuit: boolean;
  defaultDetectOutOfRange: boolean;
  defaultNamurNe43: boolean;
  defaultSensorFailRaw: number | null;
  defaultSensorFailMargin: number | null;
  defaultSensorFailBehavior: string | null;
  defaultSensorFailDelayMs: number | null;
  defaultDeadbandRawMin: number | null;
  defaultDeadbandRawZero: number | null;
  defaultDeadbandRawMax: number | null;
  defaultUseTankLevel: boolean;
  defaultScalingFbOverride: string | null;
  // Alarm config defaults
  defaultAlarmGroup: string | null;
  defaultAlarmBlockMask: string | null;
  defaultCommBlockMask: string | null;
  defaultFatBlock: boolean;
  defaultSuppressionSt: string | null;
  defaultSpecialAlarmFb: string | null;
  defaultSpecialAlarmInput: string | null;
  defaultAnaToDigAlarm: boolean;
  // Code gen defaults
  defaultIsRetain: boolean;
  defaultIsPersistent: boolean;
  defaultLoggingEnabled: boolean;
  defaultFbNameOverride: string | null;
  defaultUseShortName: boolean;
  active: boolean;
  discreteAlarms: DiscreteAlarmRow[];
  analogAlarms: AnalogAlarmRow[];
};

type ServerSignal = {
  id: number;
  channelOffset: number;
  ioType: "DI" | "DO" | "AI" | "AO";
  origin: SignalOrigin | null;
  plcDataTypeId: number | null;
  plcDataTypeCatalog: { id: number; code: string } | null;
  rawDataType: BusRawDataType | null;
  byteOrder: "BIG_ENDIAN" | "LITTLE_ENDIAN" | null;
  canNodeId: number | null;
  canId: number | null;
  bitOffset: number | null;
  bitLength: number | null;
  isMuxIndicator: boolean;
  muxId: number | null;
  canopenIndex: number | null;
  canopenSubIndex: number | null;
  j1939Pgn: number | null;
  j1939Spn: number | null;
  modbusUnitId: number | null;
  modbusRegisterType: "COIL" | "DISCRETE_INPUT" | "HOLDING_REGISTER" | "INPUT_REGISTER" | null;
  modbusRegisterOffset: number | null;
  timeoutMs: number | null;
  tagSuffix: string | null;
  description: string | null;
  defaultTrigger: string | null;
  defaultFilterTimeMs: unknown;
  defaultSwitchingType: string | null;
  defaultSignalVoltage: string | null;
  defaultInputTypeId: number | null;
  defaultInputType: { id: number; code: string; name: string } | null;
  defaultWireConfig: string | null;
  defaultScaleMin: unknown;
  defaultScaleMax: unknown;
  defaultRawMin: unknown;
  defaultRawMax: unknown;
  defaultRawZero: unknown;
  defaultClampLow: unknown;
  defaultClampHigh: unknown;
  defaultDeadband: unknown;
  defaultEuId: number | null;
  defaultDetectWireBreak: boolean;
  defaultDetectShortCircuit: boolean;
  defaultDetectOutOfRange: boolean;
  defaultNamurNe43: boolean;
  defaultSensorFailRaw: unknown;
  defaultSensorFailMargin: unknown;
  defaultSensorFailBehavior: string | null;
  defaultSensorFailDelayMs: number | null;
  defaultDeadbandRawMin: unknown;
  defaultDeadbandRawZero: unknown;
  defaultDeadbandRawMax: unknown;
  defaultUseTankLevel: boolean;
  defaultScalingFbOverride: string | null;
  defaultAlarmGroup: string | null;
  defaultAlarmBlockMask: string | null;
  defaultCommBlockMask: string | null;
  defaultFatBlock: boolean;
  defaultSuppressionSt: string | null;
  defaultSpecialAlarmFb: string | null;
  defaultSpecialAlarmInput: string | null;
  defaultAnaToDigAlarm: boolean;
  defaultIsRetain: boolean;
  defaultIsPersistent: boolean;
  defaultLoggingEnabled: boolean;
  defaultFbNameOverride: string | null;
  defaultUseShortName: boolean;
  discreteAlarms: {
    condition: string;
    severity: string;
    delaySeconds: number;
    message: string | null;
  }[];
  active: boolean;
  analogAlarms: {
    condition: string;
    setpoint: unknown;
    hysteresis: unknown;
    severity: string;
    delaySeconds: number;
    message: string | null;
  }[];
};

function toRowState(s: ServerSignal): SignalRowState {
  return {
    id: s.id,
    channelOffset: s.channelOffset,
    ioType: s.ioType,
    origin: s.origin,
    plcDataTypeId: s.plcDataTypeId,
    rawDataType: s.rawDataType,
    byteOrder: s.byteOrder,
    canNodeId: s.canNodeId,
    canId: s.canId,
    bitOffset: s.bitOffset,
    bitLength: s.bitLength,
    isMuxIndicator: s.isMuxIndicator,
    muxId: s.muxId,
    canopenIndex: s.canopenIndex,
    canopenSubIndex: s.canopenSubIndex,
    j1939Pgn: s.j1939Pgn,
    j1939Spn: s.j1939Spn,
    modbusUnitId: s.modbusUnitId,
    modbusRegisterType: s.modbusRegisterType,
    modbusRegisterOffset: s.modbusRegisterOffset,
    timeoutMs: s.timeoutMs,
    tagSuffix: s.tagSuffix,
    description: s.description,
    defaultTrigger: (s.defaultTrigger as SignalRowState["defaultTrigger"]) ?? null,
    defaultFilterTimeMs: s.defaultFilterTimeMs != null ? Number(s.defaultFilterTimeMs) : null,
    defaultSwitchingType: (s.defaultSwitchingType as SignalRowState["defaultSwitchingType"]) ?? null,
    defaultSignalVoltage: s.defaultSignalVoltage ?? null,
    defaultInputTypeId: s.defaultInputTypeId,
    defaultWireConfig: (s.defaultWireConfig as SignalRowState["defaultWireConfig"]) ?? null,
    defaultScaleMin: s.defaultScaleMin != null ? Number(s.defaultScaleMin) : null,
    defaultScaleMax: s.defaultScaleMax != null ? Number(s.defaultScaleMax) : null,
    defaultRawMin: s.defaultRawMin != null ? Number(s.defaultRawMin) : null,
    defaultRawMax: s.defaultRawMax != null ? Number(s.defaultRawMax) : null,
    defaultRawZero: s.defaultRawZero != null ? Number(s.defaultRawZero) : null,
    defaultClampLow: s.defaultClampLow != null ? Number(s.defaultClampLow) : null,
    defaultClampHigh: s.defaultClampHigh != null ? Number(s.defaultClampHigh) : null,
    defaultDeadband: s.defaultDeadband != null ? Number(s.defaultDeadband) : null,
    defaultEuId: s.defaultEuId,
    defaultDetectWireBreak: s.defaultDetectWireBreak ?? false,
    defaultDetectShortCircuit: s.defaultDetectShortCircuit ?? false,
    defaultDetectOutOfRange: s.defaultDetectOutOfRange ?? false,
    defaultNamurNe43: s.defaultNamurNe43 ?? false,
    defaultSensorFailRaw: s.defaultSensorFailRaw != null ? Number(s.defaultSensorFailRaw) : null,
    defaultSensorFailMargin: s.defaultSensorFailMargin != null ? Number(s.defaultSensorFailMargin) : null,
    defaultSensorFailBehavior: s.defaultSensorFailBehavior ?? null,
    defaultSensorFailDelayMs: s.defaultSensorFailDelayMs ?? null,
    defaultDeadbandRawMin: s.defaultDeadbandRawMin != null ? Number(s.defaultDeadbandRawMin) : null,
    defaultDeadbandRawZero: s.defaultDeadbandRawZero != null ? Number(s.defaultDeadbandRawZero) : null,
    defaultDeadbandRawMax: s.defaultDeadbandRawMax != null ? Number(s.defaultDeadbandRawMax) : null,
    defaultUseTankLevel: s.defaultUseTankLevel ?? false,
    defaultScalingFbOverride: s.defaultScalingFbOverride ?? null,
    defaultAlarmGroup: s.defaultAlarmGroup ?? null,
    defaultAlarmBlockMask: s.defaultAlarmBlockMask ?? null,
    defaultCommBlockMask: s.defaultCommBlockMask ?? null,
    defaultFatBlock: s.defaultFatBlock ?? false,
    defaultSuppressionSt: s.defaultSuppressionSt ?? null,
    defaultSpecialAlarmFb: s.defaultSpecialAlarmFb ?? null,
    defaultSpecialAlarmInput: s.defaultSpecialAlarmInput ?? null,
    defaultAnaToDigAlarm: s.defaultAnaToDigAlarm ?? false,
    defaultIsRetain: s.defaultIsRetain ?? false,
    defaultIsPersistent: s.defaultIsPersistent ?? false,
    defaultLoggingEnabled: s.defaultLoggingEnabled ?? false,
    defaultFbNameOverride: s.defaultFbNameOverride ?? null,
    defaultUseShortName: s.defaultUseShortName ?? false,
    active: s.active,
    discreteAlarms: s.discreteAlarms.map((a) => ({
      condition: a.condition as DiscreteAlarmRow["condition"],
      severity: a.severity as DiscreteAlarmRow["severity"],
      delaySeconds: a.delaySeconds,
      message: a.message,
    })),
    analogAlarms: s.analogAlarms.map((a) => ({
      condition: a.condition as AnalogAlarmRow["condition"],
      setpoint: Number(a.setpoint),
      hysteresis: Number(a.hysteresis),
      severity: a.severity as AnalogAlarmRow["severity"],
      delaySeconds: a.delaySeconds,
      message: a.message,
    })),
  };
}

function emptyRow(componentId: number, nextOffset: number): SignalRowState & { _tempId: string; componentId: number } {
  return {
    _tempId: crypto.randomUUID(),
    componentId,
    channelOffset: nextOffset,
    ioType: "DI",
    active: true,
    origin: null,
    plcDataTypeId: null,
    rawDataType: null,
    byteOrder: null,
    canNodeId: null,
    canId: null,
    bitOffset: null,
    bitLength: null,
    isMuxIndicator: false,
    muxId: null,
    canopenIndex: null,
    canopenSubIndex: null,
    j1939Pgn: null,
    j1939Spn: null,
    modbusUnitId: null,
    modbusRegisterType: null,
    modbusRegisterOffset: null,
    timeoutMs: null,
    tagSuffix: null,
    description: null,
    defaultTrigger: null,
    defaultFilterTimeMs: null,
    defaultSwitchingType: null,
    defaultSignalVoltage: null,
    defaultInputTypeId: null,
    defaultWireConfig: null,
    defaultScaleMin: null,
    defaultScaleMax: null,
    defaultRawMin: null,
    defaultRawMax: null,
    defaultRawZero: null,
    defaultClampLow: null,
    defaultClampHigh: null,
    defaultDeadband: null,
    defaultEuId: null,
    defaultDetectWireBreak: false,
    defaultDetectShortCircuit: false,
    defaultDetectOutOfRange: false,
    defaultNamurNe43: false,
    defaultSensorFailRaw: null,
    defaultSensorFailMargin: null,
    defaultSensorFailBehavior: null,
    defaultSensorFailDelayMs: null,
    defaultDeadbandRawMin: null,
    defaultDeadbandRawZero: null,
    defaultDeadbandRawMax: null,
    defaultUseTankLevel: false,
    defaultScalingFbOverride: null,
    defaultAlarmGroup: null,
    defaultAlarmBlockMask: null,
    defaultCommBlockMask: null,
    defaultFatBlock: false,
    defaultSuppressionSt: null,
    defaultSpecialAlarmFb: null,
    defaultSpecialAlarmInput: null,
    defaultAnaToDigAlarm: false,
    defaultIsRetain: false,
    defaultIsPersistent: false,
    defaultLoggingEnabled: false,
    defaultFbNameOverride: null,
    defaultUseShortName: false,
    discreteAlarms: [],
    analogAlarms: [],
  };
}

function defaultsSummary(row: SignalRowState, inputTypes: { id: number; name: string }[]): string {
  if (row.ioType === "DI" || row.ioType === "DO") {
    const parts: string[] = [];
    if (row.defaultTrigger) parts.push(row.defaultTrigger);
    if (row.defaultFilterTimeMs != null) parts.push(`${row.defaultFilterTimeMs}ms`);
    return parts.join(" · ") || "—";
  } else {
    const parts: string[] = [];
    if (row.defaultInputTypeId != null) {
      const found = inputTypes.find((t) => t.id === row.defaultInputTypeId);
      parts.push(found ? found.name : `#${row.defaultInputTypeId}`);
    }
    if (row.defaultScaleMin != null && row.defaultScaleMax != null)
      parts.push(`${row.defaultScaleMin}–${row.defaultScaleMax}`);
    return parts.join(" · ") || "—";
  }
}

function busSummary(row: SignalRowState): string {
  const o = row.origin;
  // Detect protocol from origin OR from populated fields (origin may be null on templates)
  if (o === "CANOPEN" || (!o && (row.canopenIndex != null || row.canopenSubIndex != null))) {
    const parts: string[] = [];
    if (row.canopenIndex != null) parts.push(`0x${row.canopenIndex.toString(16).toUpperCase().padStart(4, "0")}`);
    if (row.canopenSubIndex != null) parts.push(`sub${row.canopenSubIndex}`);
    if (row.bitOffset != null) parts.push(`bit${row.bitOffset}`);
    return parts.join(" ") || "—";
  }
  if (o === "J1939" || (!o && (row.j1939Pgn != null || row.j1939Spn != null))) {
    const parts: string[] = [];
    if (row.j1939Pgn != null) parts.push(`PGN:${row.j1939Pgn}`);
    if (row.j1939Spn != null) parts.push(`SPN:${row.j1939Spn}`);
    return parts.join(" ") || "—";
  }
  if (o === "CANBUS" || (!o && row.canId != null)) {
    const parts: string[] = [];
    if (row.canId != null) parts.push(`0x${row.canId.toString(16).toUpperCase()}`);
    if (row.bitOffset != null && row.bitLength != null) parts.push(`b${row.bitOffset}+${row.bitLength}`);
    if (row.isMuxIndicator) parts.push("[MUX]");
    else if (row.muxId != null) parts.push(`m${row.muxId}`);
    return parts.join(" ") || "—";
  }
  if (o === "MODBUS_RTU" || o === "MODBUS_TCP" || row.modbusRegisterType != null || row.modbusRegisterOffset != null) {
    if (row.modbusRegisterOffset != null) {
      const abbr: Record<string, string> = { HOLDING_REGISTER: "HR", INPUT_REGISTER: "IR", COIL: "CO", DISCRETE_INPUT: "DI" };
      const prefix = row.modbusRegisterType ? (abbr[row.modbusRegisterType] ?? row.modbusRegisterType) : "";
      return `${prefix}:${row.modbusRegisterOffset}`;
    }
    return "—";
  }
  if (row.ioType) return row.ioType === "DO" || row.ioType === "AO" ? "← OUT" : "→ IN";
  return "—";
}

// ── Bulk edit helpers ──────────────────────────────────────────────────

// Never copy these to other rows
const SKIP_BULK_FIELDS = new Set<keyof SignalRowState>(["id", "channelOffset", "active"]);
// Only applicable to discrete signals
const DISC_ONLY_FIELDS = new Set<keyof SignalRowState>([
  "defaultTrigger", "defaultFilterTimeMs", "defaultSwitchingType", "discreteAlarms",
]);
// Only applicable to analog signals
const ANLG_ONLY_FIELDS = new Set<keyof SignalRowState>([
  "defaultInputTypeId", "defaultWireConfig", "defaultScaleMin", "defaultScaleMax", "defaultEuId", "analogAlarms",
]);

function computeSignalDiff(original: SignalRowState, updated: SignalRowState): Partial<SignalRowState> {
  const diff: Partial<SignalRowState> = {};
  for (const key of Object.keys(updated) as (keyof SignalRowState)[]) {
    if (SKIP_BULK_FIELDS.has(key)) continue;
    const a = original[key];
    const b = updated[key];
    // Deep-equal for arrays (alarms)
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      (diff as Record<string, unknown>)[key] = b;
    }
  }
  return diff;
}

function applySignalDiff(target: SignalRowState, diff: Partial<SignalRowState>): SignalRowState {
  const result = { ...target };
  const isDisc = target.ioType === "DI" || target.ioType === "DO";
  for (const key of Object.keys(diff) as (keyof SignalRowState)[]) {
    if (SKIP_BULK_FIELDS.has(key)) continue;
    if (DISC_ONLY_FIELDS.has(key) && !isDisc) continue;
    if (ANLG_ONLY_FIELDS.has(key) && isDisc) continue;
    (result as Record<string, unknown>)[key] = diff[key];
  }
  return result;
}

// ── Row component ────────────────────────────────────────────────────

type RowProps = {
  rowKey: string;
  saved: SignalRowState | null;
  local: SignalRowState;
  dirty: boolean;
  isSaving: boolean;
  selected: boolean;
  visibleColumns: GridColKey[];
  onToggleSelect: () => void;
  engineeringUnits: { id: number; symbol: string }[];
  inputTypes: { id: number; code: string; name: string }[];
  plcDataTypes: { id: number; code: string }[];
  onChange: (patch: Partial<SignalRowState>) => void;
  onSave: () => void;
  onDiscard: () => void;
  onDelete: () => void;
};

const SignalRow = memo(function SignalRow({
  local,
  dirty,
  isSaving,
  selected,
  visibleColumns,
  onToggleSelect,
  engineeringUnits,
  inputTypes,
  plcDataTypes,
  onChange,
  onSave,
  onDiscard,
  onDelete,
  saved,
}: RowProps) {
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const [alarmsOpen, setAlarmsOpen] = useState(false);
  const [busOpen, setBusOpen] = useState(false);

  const alarmCount =
    (local.ioType === "DI" || local.ioType === "DO")
      ? local.discreteAlarms.length
      : local.analogAlarms.length;

  const cellRenderers: Record<GridColKey, () => React.ReactNode> = {
    select: () => (
      <td key="select" className="px-2 py-1 w-9 align-middle text-center" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          className="h-3.5 w-3.5 rounded border-input cursor-pointer"
          checked={selected}
          onChange={onToggleSelect}
        />
      </td>
    ),
    active: () => (
      <td key="active" className="px-2 py-1 align-middle text-center" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          title={local.active ? "Signal is active (used in component)" : "Signal is inactive"}
          className="h-3.5 w-3.5 rounded border-input cursor-pointer"
          checked={local.active}
          onChange={(e) => onChange({ active: e.target.checked })}
        />
      </td>
    ),
    type: () => (
      <td key="type" className="px-2 py-1 w-28">
        <Select
          value={local.ioType}
          onValueChange={(v) => {
            const newIoType = v as "DI" | "DO" | "AI" | "AO";
            const wasDiscrete = local.ioType === "DI" || local.ioType === "DO";
            const isDiscrete = newIoType === "DI" || newIoType === "DO";
            const crossesBoundary = wasDiscrete !== isDiscrete;
            onChange({
              ioType: newIoType,
              ...(crossesBoundary ? {
                defaultTrigger: null,
                defaultFilterTimeMs: null,
                defaultSwitchingType: null,
                defaultInputTypeId: null,
                defaultWireConfig: null,
                defaultScaleMin: null,
                defaultScaleMax: null,
                discreteAlarms: [],
                analogAlarms: [],
              } : {}),
            });
          }}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DI">
              <Badge variant="secondary" className="font-normal">DI</Badge>
            </SelectItem>
            <SelectItem value="DO">
              <Badge variant="secondary" className="font-normal">DO</Badge>
            </SelectItem>
            <SelectItem value="AI">
              <Badge variant="outline" className="font-normal">AI</Badge>
            </SelectItem>
            <SelectItem value="AO">
              <Badge variant="outline" className="font-normal">AO</Badge>
            </SelectItem>
          </SelectContent>
        </Select>
      </td>
    ),
    origin: () => (
      <td key="origin" className="px-2 py-1 w-32">
        <Select
          value={local.origin ?? "__none__"}
          onValueChange={(v) => onChange({ origin: (v === "__none__" ? null : v) as SignalOrigin | null })}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">—</SelectItem>
            {SIGNAL_ORIGINS.map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
    ),
    tag: () => (
      <td key="tag" className="px-2 py-1 w-36">
        <Input
          className="h-7 font-mono text-sm px-2"
          value={local.tagSuffix ?? ""}
          onChange={(e) => onChange({ tagSuffix: e.target.value || null })}
          placeholder="e.g. _RUN"
        />
      </td>
    ),
    desc: () => (
      <td key="desc" className="px-2 py-1">
        <Input
          className="h-7 text-sm px-2"
          value={local.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value || null })}
          placeholder="Signal description"
        />
      </td>
    ),
    defaults: () => (
      <td key="defaults" className="px-2 py-1 w-48">
        <button
          type="button"
          onClick={() => setDefaultsOpen(true)}
          className="flex w-full items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground text-left"
        >
          <Settings2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{defaultsSummary(local, inputTypes)}</span>
        </button>
      </td>
    ),
    alarms: () => (
      <td key="alarms" className="px-2 py-1 w-20 text-center">
        <button
          type="button"
          onClick={() => setAlarmsOpen(true)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        >
          <Bell className="h-3 w-3" />
          {alarmCount > 0 && <span className="font-medium text-foreground">{alarmCount}</span>}
        </button>
      </td>
    ),
    bus: () => (
      <td key="bus" className="px-2 py-1 w-32">
        <button
          type="button"
          onClick={() => setBusOpen(true)}
          className="flex w-full items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground text-left"
        >
          <Network className="h-3 w-3 shrink-0" />
          <span className="truncate">{busSummary(local)}</span>
        </button>
      </td>
    ),
    // ── Discrete field cells ──
    trigger:     () => <td key="trigger" className="px-2 py-1 text-xs truncate">{local.defaultTrigger ?? "—"}</td>,
    filter:      () => <td key="filter" className="px-2 py-1 text-xs truncate">{local.defaultFilterTimeMs ?? "—"}</td>,
    switchType:  () => <td key="switchType" className="px-2 py-1 text-xs truncate">{local.defaultSwitchingType?.replace("_", " ") ?? "—"}</td>,
    sigVoltage:  () => <td key="sigVoltage" className="px-2 py-1 text-xs truncate">{local.defaultSignalVoltage ?? "—"}</td>,
    // ── Analog field cells ──
    itype:       () => <td key="itype" className="px-2 py-1 text-xs truncate">{inputTypes.find((t) => t.id === local.defaultInputTypeId)?.code ?? "—"}</td>,
    wire:        () => <td key="wire" className="px-2 py-1 text-xs truncate">{local.defaultWireConfig?.replace("_", " ") ?? "—"}</td>,
    eu:          () => <td key="eu" className="px-2 py-1 text-xs truncate">{engineeringUnits.find((u) => u.id === local.defaultEuId)?.symbol ?? "—"}</td>,
    smin:        () => <td key="smin" className="px-2 py-1 text-xs tabular-nums">{local.defaultScaleMin ?? "—"}</td>,
    smax:        () => <td key="smax" className="px-2 py-1 text-xs tabular-nums">{local.defaultScaleMax ?? "—"}</td>,
    rawMin:      () => <td key="rawMin" className="px-2 py-1 text-xs tabular-nums">{local.defaultRawMin ?? "—"}</td>,
    rawMax:      () => <td key="rawMax" className="px-2 py-1 text-xs tabular-nums">{local.defaultRawMax ?? "—"}</td>,
    rawZero:     () => <td key="rawZero" className="px-2 py-1 text-xs tabular-nums">{local.defaultRawZero ?? "—"}</td>,
    clampLow:    () => <td key="clampLow" className="px-2 py-1 text-xs tabular-nums">{local.defaultClampLow ?? "—"}</td>,
    clampHigh:   () => <td key="clampHigh" className="px-2 py-1 text-xs tabular-nums">{local.defaultClampHigh ?? "—"}</td>,
    deadband:    () => <td key="deadband" className="px-2 py-1 text-xs tabular-nums">{local.defaultDeadband ?? "—"}</td>,
    wireBreak:   () => <td key="wireBreak" className="px-2 py-1 text-xs text-center">{local.defaultDetectWireBreak ? "Yes" : "—"}</td>,
    shortCircuit:() => <td key="shortCircuit" className="px-2 py-1 text-xs text-center">{local.defaultDetectShortCircuit ? "Yes" : "—"}</td>,
    outOfRange:  () => <td key="outOfRange" className="px-2 py-1 text-xs text-center">{local.defaultDetectOutOfRange ? "Yes" : "—"}</td>,
    namurNe43:   () => <td key="namurNe43" className="px-2 py-1 text-xs text-center">{local.defaultNamurNe43 ? "Yes" : "—"}</td>,
    tankLevel:   () => <td key="tankLevel" className="px-2 py-1 text-xs text-center">{local.defaultUseTankLevel ? "Yes" : "—"}</td>,
    scalingFb:   () => <td key="scalingFb" className="px-2 py-1 text-xs truncate">{local.defaultScalingFbOverride ?? "—"}</td>,
    dbRawMin:    () => <td key="dbRawMin" className="px-2 py-1 text-xs tabular-nums">{local.defaultDeadbandRawMin ?? "—"}</td>,
    dbRawZero:   () => <td key="dbRawZero" className="px-2 py-1 text-xs tabular-nums">{local.defaultDeadbandRawZero ?? "—"}</td>,
    dbRawMax:    () => <td key="dbRawMax" className="px-2 py-1 text-xs tabular-nums">{local.defaultDeadbandRawMax ?? "—"}</td>,
    failRaw:     () => <td key="failRaw" className="px-2 py-1 text-xs tabular-nums">{local.defaultSensorFailRaw ?? "—"}</td>,
    failMargin:  () => <td key="failMargin" className="px-2 py-1 text-xs tabular-nums">{local.defaultSensorFailMargin ?? "—"}</td>,
    failBehavior:() => <td key="failBehavior" className="px-2 py-1 text-xs truncate">{local.defaultSensorFailBehavior ?? "—"}</td>,
    failDelay:   () => <td key="failDelay" className="px-2 py-1 text-xs tabular-nums">{local.defaultSensorFailDelayMs ?? "—"}</td>,
    // ── Alarm config field cells ──
    alarmGrp:    () => <td key="alarmGrp" className="px-2 py-1 text-xs text-center">{local.defaultAlarmGroup ?? "—"}</td>,
    alarmMask:   () => <td key="alarmMask" className="px-2 py-1 text-xs truncate">{local.defaultAlarmBlockMask ?? "—"}</td>,
    commMask:    () => <td key="commMask" className="px-2 py-1 text-xs truncate">{local.defaultCommBlockMask ?? "—"}</td>,
    fatBlk:      () => <td key="fatBlk" className="px-2 py-1 text-xs text-center">{local.defaultFatBlock ? "Yes" : "—"}</td>,
    suppression: () => <td key="suppression" className="px-2 py-1 text-xs truncate" title={local.defaultSuppressionSt ?? undefined}>{local.defaultSuppressionSt ?? "—"}</td>,
    specAlarmFb: () => <td key="specAlarmFb" className="px-2 py-1 text-xs truncate">{local.defaultSpecialAlarmFb ?? "—"}</td>,
    specAlarmIn: () => <td key="specAlarmIn" className="px-2 py-1 text-xs truncate">{local.defaultSpecialAlarmInput ?? "—"}</td>,
    anaDigAlarm: () => <td key="anaDigAlarm" className="px-2 py-1 text-xs text-center">{local.defaultAnaToDigAlarm ? "Yes" : "—"}</td>,
    // ── Code gen field cells ──
    isRetain:    () => <td key="isRetain" className="px-2 py-1 text-xs text-center">{local.defaultIsRetain ? "Yes" : "—"}</td>,
    isPersistent:() => <td key="isPersistent" className="px-2 py-1 text-xs text-center">{local.defaultIsPersistent ? "Yes" : "—"}</td>,
    logging:     () => <td key="logging" className="px-2 py-1 text-xs text-center">{local.defaultLoggingEnabled ? "Yes" : "—"}</td>,
    fbOverride:  () => <td key="fbOverride" className="px-2 py-1 text-xs truncate">{local.defaultFbNameOverride ?? "—"}</td>,
    shortName:   () => <td key="shortName" className="px-2 py-1 text-xs text-center">{local.defaultUseShortName ? "Yes" : "—"}</td>,
    // ── Bus field cells ──
    rawDataType: () => <td key="rawDataType" className="px-2 py-1 text-xs truncate">{local.rawDataType ?? "—"}</td>,
    byteOrder:   () => <td key="byteOrder" className="px-2 py-1 text-xs truncate">{local.byteOrder?.replace("_", " ") ?? "—"}</td>,
    canNodeId:   () => <td key="canNodeId" className="px-2 py-1 text-xs tabular-nums">{local.canNodeId ?? "—"}</td>,
    canId:       () => <td key="canId" className="px-2 py-1 text-xs tabular-nums">{local.canId ?? "—"}</td>,
    bitOffset:   () => <td key="bitOffset" className="px-2 py-1 text-xs tabular-nums">{local.bitOffset ?? "—"}</td>,
    bitLength:   () => <td key="bitLength" className="px-2 py-1 text-xs tabular-nums">{local.bitLength ?? "—"}</td>,
    muxIndicator:() => <td key="muxIndicator" className="px-2 py-1 text-xs text-center">{local.isMuxIndicator ? "Yes" : "—"}</td>,
    muxId:       () => <td key="muxId" className="px-2 py-1 text-xs tabular-nums">{local.muxId ?? "—"}</td>,
    canopenIdx:  () => <td key="canopenIdx" className="px-2 py-1 text-xs tabular-nums">{local.canopenIndex ?? "—"}</td>,
    canopenSub:  () => <td key="canopenSub" className="px-2 py-1 text-xs tabular-nums">{local.canopenSubIndex ?? "—"}</td>,
    j1939Pgn:    () => <td key="j1939Pgn" className="px-2 py-1 text-xs tabular-nums">{local.j1939Pgn ?? "—"}</td>,
    j1939Spn:    () => <td key="j1939Spn" className="px-2 py-1 text-xs tabular-nums">{local.j1939Spn ?? "—"}</td>,
    modbusUnit:  () => <td key="modbusUnit" className="px-2 py-1 text-xs tabular-nums">{local.modbusUnitId ?? "—"}</td>,
    modbusRegType:() => <td key="modbusRegType" className="px-2 py-1 text-xs truncate">{local.modbusRegisterType?.replace("_", " ") ?? "—"}</td>,
    modbusRegOfs:() => <td key="modbusRegOfs" className="px-2 py-1 text-xs tabular-nums">{local.modbusRegisterOffset ?? "—"}</td>,
    timeoutMs:   () => <td key="timeoutMs" className="px-2 py-1 text-xs tabular-nums">{local.timeoutMs ?? "—"}</td>,
    // ── Actions ──
    actions: () => (
      <td key="actions" className="px-2 py-1 w-24">
        <div className="flex items-center gap-1 justify-end">
          {dirty && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                title="Save row"
                onClick={onSave}
                disabled={isSaving}
              >
                <Save className="h-3.5 w-3.5 text-green-600" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                title="Discard changes"
                onClick={onDiscard}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {saved && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              title="Delete signal"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          )}
        </div>
      </td>
    ),
  };

  return (
    <>
      <tr className={[
        dirty ? "bg-amber-50 dark:bg-amber-950/20" : selected ? "bg-primary/5" : "",
        !local.active && !dirty ? "opacity-50" : "",
      ].filter(Boolean).join(" ") || undefined}>
        {visibleColumns.map((col) => cellRenderers[col]())}
      </tr>

      <DefaultsDialog
        open={defaultsOpen}
        onClose={() => setDefaultsOpen(false)}
        row={local}
        engineeringUnits={engineeringUnits}
        inputTypes={inputTypes}
        plcDataTypes={plcDataTypes}
        onChange={(patch) => onChange(patch)}
      />
      <AlarmsDialog
        open={alarmsOpen}
        onClose={() => setAlarmsOpen(false)}
        row={local}
        onChange={(patch) => onChange(patch)}
      />
      <BusConfigDialog
        open={busOpen}
        onClose={() => setBusOpen(false)}
        row={local}
        plcDataTypes={plcDataTypes}
        onChange={(patch) => onChange(patch)}
      />
    </>
  );
});

// ── TanStack column definitions ───────────────────────────────────────

type TableRow = {
  key: string;
  isNew: boolean;
  saved: SignalRowState | null;
  local: SignalRowState;
  dirty: boolean;
};

type GridColKey =
  | "select" | "active" | "type" | "origin" | "tag" | "desc"
  | "defaults" | "alarms" | "bus" | "actions"
  // Discrete fields
  | "trigger" | "filter" | "switchType" | "sigVoltage"
  // Analog fields
  | "itype" | "wire" | "eu" | "smin" | "smax"
  | "rawMin" | "rawMax" | "rawZero" | "clampLow" | "clampHigh" | "deadband"
  | "wireBreak" | "shortCircuit" | "outOfRange" | "namurNe43"
  | "tankLevel" | "scalingFb" | "dbRawMin" | "dbRawZero" | "dbRawMax"
  | "failRaw" | "failMargin" | "failBehavior" | "failDelay"
  // Alarm config fields
  | "alarmGrp" | "alarmMask" | "commMask" | "fatBlk" | "suppression" | "specAlarmFb" | "specAlarmIn" | "anaDigAlarm"
  // Code gen fields
  | "isRetain" | "isPersistent" | "logging" | "fbOverride" | "shortName"
  // Bus fields
  | "rawDataType" | "byteOrder" | "canNodeId" | "canId" | "bitOffset" | "bitLength"
  | "muxIndicator" | "muxId" | "canopenIdx" | "canopenSub"
  | "j1939Pgn" | "j1939Spn" | "modbusUnit" | "modbusRegType" | "modbusRegOfs" | "timeoutMs";

type ColDef = {
  key: GridColKey;
  label: string;
  defaultWidth: number;
  group?: string;
  disc?: true;
  anlg?: true;
  defaultHidden?: true;
};

const COL_DEFS: ColDef[] = [
  { key: "select",   label: "",         defaultWidth: 36 },
  { key: "active",   label: "Active",   defaultWidth: 56,  group: "Signal" },
  { key: "tag",      label: "Tag",      defaultWidth: 144, group: "Signal" },
  { key: "desc",     label: "Desc",     defaultWidth: 240, group: "Signal" },
  { key: "type",     label: "Type",     defaultWidth: 112, group: "Signal" },
  { key: "origin",   label: "Origin",   defaultWidth: 128, group: "Signal" },
  // Dialog buttons
  { key: "defaults", label: "Signal",   defaultWidth: 192, group: "Dialogs" },
  { key: "alarms",   label: "Alarms",   defaultWidth: 80,  group: "Dialogs" },
  { key: "bus",      label: "Bus",      defaultWidth: 128, group: "Dialogs" },
  // Discrete fields
  { key: "trigger",     label: "Trigger",      defaultWidth: 60,  group: "Discrete", disc: true, defaultHidden: true },
  { key: "filter",      label: "Filter (ms)",  defaultWidth: 70,  group: "Discrete", disc: true, defaultHidden: true },
  { key: "switchType",  label: "Switch Type",  defaultWidth: 80,  group: "Discrete", disc: true, defaultHidden: true },
  { key: "sigVoltage",  label: "Voltage",      defaultWidth: 72,  group: "Discrete", disc: true, defaultHidden: true },
  // Analog fields
  { key: "itype",       label: "Input Type",   defaultWidth: 90,  group: "Analog", anlg: true, defaultHidden: true },
  { key: "wire",        label: "Wire",         defaultWidth: 68,  group: "Analog", anlg: true, defaultHidden: true },
  { key: "eu",          label: "EU",           defaultWidth: 52,  group: "Analog", anlg: true, defaultHidden: true },
  { key: "smin",        label: "Scale Min",    defaultWidth: 68,  group: "Analog", anlg: true, defaultHidden: true },
  { key: "smax",        label: "Scale Max",    defaultWidth: 68,  group: "Analog", anlg: true, defaultHidden: true },
  { key: "rawMin",      label: "Raw Min",      defaultWidth: 68,  group: "Analog", anlg: true, defaultHidden: true },
  { key: "rawMax",      label: "Raw Max",      defaultWidth: 68,  group: "Analog", anlg: true, defaultHidden: true },
  { key: "rawZero",     label: "Raw Zero",     defaultWidth: 68,  group: "Analog", anlg: true, defaultHidden: true },
  { key: "clampLow",    label: "Clamp Low",    defaultWidth: 68,  group: "Analog", anlg: true, defaultHidden: true },
  { key: "clampHigh",   label: "Clamp High",   defaultWidth: 68,  group: "Analog", anlg: true, defaultHidden: true },
  { key: "deadband",    label: "Deadband",     defaultWidth: 68,  group: "Analog", anlg: true, defaultHidden: true },
  { key: "wireBreak",   label: "Wire Break",   defaultWidth: 72,  group: "Analog", anlg: true, defaultHidden: true },
  { key: "shortCircuit",label: "Short Circ.",  defaultWidth: 72,  group: "Analog", anlg: true, defaultHidden: true },
  { key: "outOfRange",  label: "Out of Range", defaultWidth: 80,  group: "Analog", anlg: true, defaultHidden: true },
  { key: "namurNe43",   label: "NAMUR",        defaultWidth: 72,  group: "Analog", anlg: true, defaultHidden: true },
  { key: "tankLevel",   label: "Tank Level",   defaultWidth: 72,  group: "Analog", anlg: true, defaultHidden: true },
  { key: "scalingFb",   label: "Scaling FB",   defaultWidth: 120, group: "Analog", anlg: true, defaultHidden: true },
  { key: "dbRawMin",    label: "DB Raw Min",   defaultWidth: 68,  group: "Analog", anlg: true, defaultHidden: true },
  { key: "dbRawZero",   label: "DB Raw Zero",  defaultWidth: 72,  group: "Analog", anlg: true, defaultHidden: true },
  { key: "dbRawMax",    label: "DB Raw Max",   defaultWidth: 68,  group: "Analog", anlg: true, defaultHidden: true },
  { key: "failRaw",     label: "Fail Raw",     defaultWidth: 68,  group: "Analog", anlg: true, defaultHidden: true },
  { key: "failMargin",  label: "Fail Margin",  defaultWidth: 72,  group: "Analog", anlg: true, defaultHidden: true },
  { key: "failBehavior",label: "Fail Behavior",defaultWidth: 90,  group: "Analog", anlg: true, defaultHidden: true },
  { key: "failDelay",   label: "Fail Delay",   defaultWidth: 80,  group: "Analog", anlg: true, defaultHidden: true },
  // Alarm config fields
  { key: "alarmGrp",    label: "Alarm Grp",    defaultWidth: 64,  group: "Alarms", defaultHidden: true },
  { key: "alarmMask",   label: "Block Mask",   defaultWidth: 72,  group: "Alarms", defaultHidden: true },
  { key: "commMask",    label: "Comm Mask",    defaultWidth: 72,  group: "Alarms", defaultHidden: true },
  { key: "fatBlk",      label: "FAT Block",    defaultWidth: 64,  group: "Alarms", defaultHidden: true },
  { key: "suppression", label: "Suppression",  defaultWidth: 120, group: "Alarms", defaultHidden: true },
  { key: "specAlarmFb", label: "Special FB",   defaultWidth: 120, group: "Alarms", defaultHidden: true },
  { key: "specAlarmIn", label: "Special Input", defaultWidth: 120, group: "Alarms", defaultHidden: true },
  { key: "anaDigAlarm", label: "Ana→Dig",      defaultWidth: 60,  group: "Alarms", defaultHidden: true },
  // Code gen fields
  { key: "isRetain",    label: "Retain",       defaultWidth: 56,  group: "CodeGen", defaultHidden: true },
  { key: "isPersistent",label: "Persistent",   defaultWidth: 72,  group: "CodeGen", defaultHidden: true },
  { key: "logging",     label: "Logging",      defaultWidth: 60,  group: "CodeGen", defaultHidden: true },
  { key: "fbOverride",  label: "FB Override",  defaultWidth: 120, group: "CodeGen", defaultHidden: true },
  { key: "shortName",   label: "Short Name",   defaultWidth: 72,  group: "CodeGen", defaultHidden: true },
  // Bus fields
  { key: "rawDataType", label: "Raw Type",     defaultWidth: 72,  group: "Bus", defaultHidden: true },
  { key: "byteOrder",   label: "Byte Order",   defaultWidth: 90,  group: "Bus", defaultHidden: true },
  { key: "canNodeId",   label: "CAN Node",     defaultWidth: 68,  group: "Bus", defaultHidden: true },
  { key: "canId",       label: "CAN ID",       defaultWidth: 72,  group: "Bus", defaultHidden: true },
  { key: "bitOffset",   label: "Bit Ofs",      defaultWidth: 56,  group: "Bus", defaultHidden: true },
  { key: "bitLength",   label: "Bit Len",      defaultWidth: 56,  group: "Bus", defaultHidden: true },
  { key: "muxIndicator",label: "Mux?",         defaultWidth: 44,  group: "Bus", defaultHidden: true },
  { key: "muxId",       label: "Mux ID",       defaultWidth: 56,  group: "Bus", defaultHidden: true },
  { key: "canopenIdx",  label: "CO Index",     defaultWidth: 72,  group: "Bus", defaultHidden: true },
  { key: "canopenSub",  label: "CO Sub",       defaultWidth: 56,  group: "Bus", defaultHidden: true },
  { key: "j1939Pgn",    label: "PGN",          defaultWidth: 72,  group: "Bus", defaultHidden: true },
  { key: "j1939Spn",    label: "SPN",          defaultWidth: 72,  group: "Bus", defaultHidden: true },
  { key: "modbusUnit",  label: "MB Unit",      defaultWidth: 64,  group: "Bus", defaultHidden: true },
  { key: "modbusRegType",label: "MB Reg Type", defaultWidth: 90,  group: "Bus", defaultHidden: true },
  { key: "modbusRegOfs",label: "MB Offset",    defaultWidth: 72,  group: "Bus", defaultHidden: true },
  { key: "timeoutMs",   label: "Timeout",      defaultWidth: 72,  group: "Bus", defaultHidden: true },
  // Actions
  { key: "actions",  label: "",         defaultWidth: 96 },
];

const COL_DEFAULTS: Record<GridColKey, number> = Object.fromEntries(COL_DEFS.map((d) => [d.key, d.defaultWidth])) as Record<GridColKey, number>;
const DEFAULT_HIDDEN = new Set<GridColKey>(COL_DEFS.filter((d) => d.defaultHidden).map((d) => d.key));
const DEFAULT_VISIBILITY: VisibilityState = Object.fromEntries([...DEFAULT_HIDDEN].map((k) => [k, false]));

const LS_COMP_COL_HIDDEN = "mias-comp-signal-col-hidden";
const LS_COMP_COL_ORDER = "mias-comp-signal-col-order";
const LS_COMP_COL_WIDTHS = "mias-comp-signal-col-widths";

const columnHelper = createColumnHelper<TableRow>();

function SortHeader({ column, label }: { column: Column<TableRow, unknown>; label: string }) {
  const sorted = column.getIsSorted();
  return (
    <button
      className="flex items-center gap-0.5 hover:text-foreground"
      onClick={column.getToggleSortingHandler()}
    >
      {label}
      {sorted === "asc"  ? <ChevronUp className="h-3 w-3 ml-0.5" /> :
       sorted === "desc" ? <ChevronDown className="h-3 w-3 ml-0.5" /> :
       <ChevronsUpDown className="h-3 w-3 ml-0.5 opacity-30" />}
    </button>
  );
}

/** Custom filter: "<empty>" matches null/blank, "!<empty>" matches non-empty, otherwise substring match. */
function emptyAwareFilter(row: Row<TableRow>, columnId: string, filterValue: string): boolean {
  const cellValue = row.getValue<string>(columnId) ?? "";
  const filter = filterValue.trim().toLowerCase();
  if (filter === "<empty>") return cellValue === "" || cellValue === "(none)";
  if (filter === "!<empty>") return cellValue !== "" && cellValue !== "(none)";
  return cellValue.toLowerCase().includes(filter);
}

const COLUMNS = [
  columnHelper.display({ id: "select",   header: "",            enableSorting: false }),
  columnHelper.display({ id: "active",   header: "Active",      enableSorting: false }),
  columnHelper.accessor((r) => r.local.ioType, {
    id: "type",
    header: ({ column }) => <SortHeader column={column} label="Type" />,
    enableGrouping: true,
    filterFn: emptyAwareFilter,
  }),
  columnHelper.accessor((r) => r.local.origin ?? "(none)", {
    id: "origin",
    header: ({ column }) => <SortHeader column={column} label="Origin" />,
    enableGrouping: true,
    filterFn: emptyAwareFilter,
  }),
  columnHelper.accessor((r) => r.local.tagSuffix ?? "", {
    id: "tag",
    header: ({ column }) => <SortHeader column={column} label="Tag Suffix" />,
    enableGrouping: false,
    filterFn: emptyAwareFilter,
  }),
  columnHelper.accessor((r) => r.local.description ?? "", {
    id: "desc",
    header: ({ column }) => <SortHeader column={column} label="Description" />,
    enableGrouping: false,
    filterFn: emptyAwareFilter,
  }),
  columnHelper.display({ id: "defaults", header: "Defaults", enableSorting: false }),
  columnHelper.display({ id: "alarms",   header: "Alarms",     enableSorting: false }),
  columnHelper.display({ id: "bus",      header: "Bus Config",  enableSorting: false }),
  // Discrete
  columnHelper.display({ id: "trigger",     header: "Trigger",      enableSorting: false }),
  columnHelper.display({ id: "filter",      header: "Filter (ms)",  enableSorting: false }),
  columnHelper.display({ id: "switchType",  header: "Switch Type",  enableSorting: false }),
  columnHelper.display({ id: "sigVoltage",  header: "Voltage",      enableSorting: false }),
  // Analog
  columnHelper.display({ id: "itype",       header: "Input Type",   enableSorting: false }),
  columnHelper.display({ id: "wire",        header: "Wire",         enableSorting: false }),
  columnHelper.display({ id: "eu",          header: "EU",           enableSorting: false }),
  columnHelper.display({ id: "smin",        header: "Scale Min",    enableSorting: false }),
  columnHelper.display({ id: "smax",        header: "Scale Max",    enableSorting: false }),
  columnHelper.display({ id: "rawMin",      header: "Raw Min",      enableSorting: false }),
  columnHelper.display({ id: "rawMax",      header: "Raw Max",      enableSorting: false }),
  columnHelper.display({ id: "rawZero",     header: "Raw Zero",     enableSorting: false }),
  columnHelper.display({ id: "clampLow",    header: "Clamp Low",    enableSorting: false }),
  columnHelper.display({ id: "clampHigh",   header: "Clamp High",   enableSorting: false }),
  columnHelper.display({ id: "deadband",    header: "Deadband",     enableSorting: false }),
  columnHelper.display({ id: "wireBreak",   header: "Wire Break",   enableSorting: false }),
  columnHelper.display({ id: "shortCircuit",header: "Short Circ.",  enableSorting: false }),
  columnHelper.display({ id: "outOfRange",  header: "Out of Range", enableSorting: false }),
  columnHelper.display({ id: "namurNe43",   header: "NAMUR",        enableSorting: false }),
  columnHelper.display({ id: "tankLevel",   header: "Tank Level",   enableSorting: false }),
  columnHelper.display({ id: "scalingFb",   header: "Scaling FB",   enableSorting: false }),
  columnHelper.display({ id: "dbRawMin",    header: "DB Raw Min",   enableSorting: false }),
  columnHelper.display({ id: "dbRawZero",   header: "DB Raw Zero",  enableSorting: false }),
  columnHelper.display({ id: "dbRawMax",    header: "DB Raw Max",   enableSorting: false }),
  columnHelper.display({ id: "failRaw",     header: "Fail Raw",     enableSorting: false }),
  columnHelper.display({ id: "failMargin",  header: "Fail Margin",  enableSorting: false }),
  columnHelper.display({ id: "failBehavior",header: "Fail Behavior",enableSorting: false }),
  columnHelper.display({ id: "failDelay",   header: "Fail Delay",   enableSorting: false }),
  // Alarm config
  columnHelper.display({ id: "alarmGrp",    header: "Alarm Grp",    enableSorting: false }),
  columnHelper.display({ id: "alarmMask",   header: "Block Mask",   enableSorting: false }),
  columnHelper.display({ id: "commMask",    header: "Comm Mask",    enableSorting: false }),
  columnHelper.display({ id: "fatBlk",      header: "FAT Block",    enableSorting: false }),
  columnHelper.display({ id: "suppression", header: "Suppression",  enableSorting: false }),
  columnHelper.display({ id: "specAlarmFb", header: "Special FB",   enableSorting: false }),
  columnHelper.display({ id: "specAlarmIn", header: "Special Input", enableSorting: false }),
  columnHelper.display({ id: "anaDigAlarm", header: "Ana→Dig",      enableSorting: false }),
  // Code gen
  columnHelper.display({ id: "isRetain",    header: "Retain",       enableSorting: false }),
  columnHelper.display({ id: "isPersistent",header: "Persistent",   enableSorting: false }),
  columnHelper.display({ id: "logging",     header: "Logging",      enableSorting: false }),
  columnHelper.display({ id: "fbOverride",  header: "FB Override",  enableSorting: false }),
  columnHelper.display({ id: "shortName",   header: "Short Name",   enableSorting: false }),
  // Bus
  columnHelper.display({ id: "rawDataType", header: "Raw Type",     enableSorting: false }),
  columnHelper.display({ id: "byteOrder",   header: "Byte Order",   enableSorting: false }),
  columnHelper.display({ id: "canNodeId",   header: "CAN Node",     enableSorting: false }),
  columnHelper.display({ id: "canId",       header: "CAN ID",       enableSorting: false }),
  columnHelper.display({ id: "bitOffset",   header: "Bit Ofs",      enableSorting: false }),
  columnHelper.display({ id: "bitLength",   header: "Bit Len",      enableSorting: false }),
  columnHelper.display({ id: "muxIndicator",header: "Mux?",         enableSorting: false }),
  columnHelper.display({ id: "muxId",       header: "Mux ID",       enableSorting: false }),
  columnHelper.display({ id: "canopenIdx",  header: "CO Index",     enableSorting: false }),
  columnHelper.display({ id: "canopenSub",  header: "CO Sub",       enableSorting: false }),
  columnHelper.display({ id: "j1939Pgn",    header: "PGN",          enableSorting: false }),
  columnHelper.display({ id: "j1939Spn",    header: "SPN",          enableSorting: false }),
  columnHelper.display({ id: "modbusUnit",  header: "MB Unit",      enableSorting: false }),
  columnHelper.display({ id: "modbusRegType",header: "MB Reg Type", enableSorting: false }),
  columnHelper.display({ id: "modbusRegOfs",header: "MB Offset",    enableSorting: false }),
  columnHelper.display({ id: "timeoutMs",   header: "Timeout",      enableSorting: false }),
  // Actions
  columnHelper.display({ id: "actions",  header: "",            enableSorting: false }),
];

// ── Grid ─────────────────────────────────────────────────────────────

type GridProps = {
  componentId: number;
  signals: ServerSignal[];
  onRefresh: () => void;
};

type NewRow = SignalRowState & { _tempId: string; componentId: number };

type GroupByOption = "none" | "type" | "origin";

export function SignalGrid({ componentId, signals, onRefresh }: GridProps) {
  const [confirmProps, confirmAction] = useConfirm();
  const [localEdits, setLocalEdits] = useState<Map<string, SignalRowState>>(new Map());
  const [editOriginals, setEditOriginals] = useState<Map<string, SignalRowState>>(new Map());
  const [newRows, setNewRows] = useState<NewRow[]>([]);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [rowSelection, setRowSelection] = useState<Set<string>>(new Set());
  const [colWidths, setColWidths] = useState<Record<GridColKey, number>>(() => {
    try {
      const stored = localStorage.getItem(LS_COMP_COL_WIDTHS);
      if (stored) return { ...COL_DEFAULTS, ...JSON.parse(stored) };
    } catch {}
    return { ...COL_DEFAULTS };
  });
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    try {
      const s = localStorage.getItem(LS_COMP_COL_HIDDEN);
      if (s) {
        const hidden = JSON.parse(s) as GridColKey[];
        // Start from all visible, then hide stored + defaults not explicitly shown
        const vis: VisibilityState = { ...DEFAULT_VISIBILITY };
        for (const k of hidden) vis[k] = false;
        return vis;
      }
    } catch {}
    return { ...DEFAULT_VISIBILITY };
  });
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() => {
    try {
      const s = localStorage.getItem(LS_COMP_COL_ORDER);
      if (s) {
        const parsed = JSON.parse(s) as GridColKey[];
        const allKeys = new Set(COL_DEFS.map((d) => d.key));
        const valid = parsed.filter((k) => allKeys.has(k));
        const missing = COL_DEFS.map((d) => d.key).filter((k) => !valid.includes(k));
        return [...valid, ...missing];
      }
    } catch {}
    return COL_DEFS.map((d) => d.key);
  });

  const colDefMap = useMemo(() => new Map(COL_DEFS.map((d) => [d.key, d])), []);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [groupBy, setGroupBy] = useState<GroupByOption>("none");
  const [grouping, setGrouping] = useState<GroupingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>(true);
  const gridRef = useRef<HTMLDivElement>(null);

  const onColResizeStart = useCallback((key: GridColKey, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[key];
    function onMove(me: MouseEvent) {
      setColWidths((prev) => {
        const next = { ...prev, [key]: Math.max(40, startWidth + me.clientX - startX) };
        localStorage.setItem(LS_COMP_COL_WIDTHS, JSON.stringify(next));
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
  }, [colWidths]);

  const utils = trpc.useUtils();
  const { data: euData = [] } = trpc.components.euList.useQuery();
  const { data: inputTypes = [] } = trpc.signal.analogInputTypes.useQuery();
  const { data: plcDataTypes = [] } = trpc.signal.plcDataTypeList.useQuery();
  const upsert = trpc.components.signalUpsert.useMutation();
  const bulkPatch = trpc.components.signalBulkPatch.useMutation();
  const deleteMutation = trpc.components.signalDelete.useMutation();
  const purgeMutation = trpc.components.signalPurge.useMutation();

  const nextOffset = Math.max(-1, ...signals.map((s) => s.channelOffset), ...newRows.map((r) => r.channelOffset)) + 1;

  // Build unified data array for TanStack
  const data = useMemo<TableRow[]>(() => {
    const savedRows = signals.map((s) => {
      const base = toRowState(s);
      const key = String(s.id);
      const local = localEdits.get(key) ?? base;
      return { key, isNew: false, saved: base, local, dirty: localEdits.has(key) };
    });
    const newRowsList = newRows.map((r) => ({
      key: r._tempId,
      isNew: true,
      saved: null,
      local: r as SignalRowState,
      dirty: true,
    }));
    return [...savedRows, ...newRowsList];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals, localEdits, newRows]);

  const scrollRef = useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data,
    columns: COLUMNS,
    state: { sorting, columnFilters, grouping, expanded, columnVisibility, columnOrder },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    groupedColumnMode: false,
    autoResetExpanded: false,
    autoResetPageIndex: false,
  });

  async function saveRow(key: string, row: SignalRowState & { componentId?: number }) {
    setSavingKeys((prev) => new Set(prev).add(key));
    try {
      await upsert.mutateAsync({
        id: row.id,
        componentId: row.id ? componentId : (row as NewRow).componentId,
        channelOffset: row.channelOffset,
        active: row.active,
        ioType: row.ioType,
        origin: row.origin as never,
        plcDataTypeId: row.plcDataTypeId,
        rawDataType: row.rawDataType as never,
        byteOrder: row.byteOrder as never,
        canNodeId: row.canNodeId,
        canId: row.canId,
        bitOffset: row.bitOffset,
        bitLength: row.bitLength,
        isMuxIndicator: row.isMuxIndicator,
        muxId: row.muxId,
        canopenIndex: row.canopenIndex,
        canopenSubIndex: row.canopenSubIndex,
        j1939Pgn: row.j1939Pgn,
        j1939Spn: row.j1939Spn,
        modbusUnitId: row.modbusUnitId,
        modbusRegisterType: row.modbusRegisterType as never,
        modbusRegisterOffset: row.modbusRegisterOffset,
        timeoutMs: row.timeoutMs,
        tagSuffix: row.tagSuffix,
        description: row.description,
        defaultTrigger: row.defaultTrigger as never,
        defaultFilterTimeMs: row.defaultFilterTimeMs,
        defaultSwitchingType: row.defaultSwitchingType as never,
        defaultSignalVoltage: row.defaultSignalVoltage,
        defaultInputTypeId: row.defaultInputTypeId,
        defaultWireConfig: row.defaultWireConfig as never,
        defaultScaleMin: row.defaultScaleMin,
        defaultScaleMax: row.defaultScaleMax,
        defaultRawMin: row.defaultRawMin,
        defaultRawMax: row.defaultRawMax,
        defaultRawZero: row.defaultRawZero,
        defaultClampLow: row.defaultClampLow,
        defaultClampHigh: row.defaultClampHigh,
        defaultDeadband: row.defaultDeadband,
        defaultEuId: row.defaultEuId,
        defaultDetectWireBreak: row.defaultDetectWireBreak,
        defaultDetectShortCircuit: row.defaultDetectShortCircuit,
        defaultDetectOutOfRange: row.defaultDetectOutOfRange,
        defaultNamurNe43: row.defaultNamurNe43,
        defaultSensorFailRaw: row.defaultSensorFailRaw,
        defaultSensorFailMargin: row.defaultSensorFailMargin,
        defaultSensorFailBehavior: row.defaultSensorFailBehavior,
        defaultSensorFailDelayMs: row.defaultSensorFailDelayMs,
        defaultDeadbandRawMin: row.defaultDeadbandRawMin,
        defaultDeadbandRawZero: row.defaultDeadbandRawZero,
        defaultDeadbandRawMax: row.defaultDeadbandRawMax,
        defaultUseTankLevel: row.defaultUseTankLevel,
        defaultScalingFbOverride: row.defaultScalingFbOverride,
        defaultAlarmGroup: row.defaultAlarmGroup,
        defaultAlarmBlockMask: row.defaultAlarmBlockMask,
        defaultCommBlockMask: row.defaultCommBlockMask,
        defaultFatBlock: row.defaultFatBlock,
        defaultSuppressionSt: row.defaultSuppressionSt,
        defaultSpecialAlarmFb: row.defaultSpecialAlarmFb,
        defaultSpecialAlarmInput: row.defaultSpecialAlarmInput,
        defaultAnaToDigAlarm: row.defaultAnaToDigAlarm,
        defaultIsRetain: row.defaultIsRetain,
        defaultIsPersistent: row.defaultIsPersistent,
        defaultLoggingEnabled: row.defaultLoggingEnabled,
        defaultFbNameOverride: row.defaultFbNameOverride,
        defaultUseShortName: row.defaultUseShortName,
        discreteAlarms: row.discreteAlarms,
        analogAlarms: row.analogAlarms,
      });

      // Bulk propagate changes to other selected rows via single API call
      const original = editOriginals.get(key);
      if (original && rowSelection.has(key) && rowSelection.size > 1 && row.id) {
        const diff = computeSignalDiff(original, row);
        if (Object.keys(diff).length > 0) {
          const otherIds = Array.from(rowSelection)
            .filter((k) => k !== key)
            .map((k) => signals.find((s) => String(s.id) === k)?.id)
            .filter((id): id is number => id != null);
          if (otherIds.length > 0) {
            // Strip alarm arrays — bulkPatch only handles scalar fields
            const { discreteAlarms: _da, analogAlarms: _aa, id: _id, channelOffset: _co, ...patchData } = diff as Record<string, unknown>;
            await bulkPatch.mutateAsync({
              ids: otherIds,
              data: patchData as any,
            });
            for (const otherKey of Array.from(rowSelection).filter((k) => k !== key)) {
              setLocalEdits((prev) => { const m = new Map(prev); m.delete(otherKey); return m; });
            }
          }
        }
      }

      setLocalEdits((prev) => { const m = new Map(prev); m.delete(key); return m; });
      setEditOriginals((prev) => { const m = new Map(prev); m.delete(key); return m; });
      setNewRows((prev) => prev.filter((r) => r._tempId !== key));
      utils.components.componentById.invalidate({ id: componentId });
      onRefresh();
    } finally {
      setSavingKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
    }
  }

  async function deleteRow(signalId: number) {
    confirmAction("Delete this signal?", async () => {
      await deleteMutation.mutateAsync({ id: signalId });
      utils.components.componentById.invalidate({ id: componentId });
      onRefresh();
    });
  }

  async function deleteSelected() {
    const selectedSavedKeys = Array.from(rowSelection).filter((k) =>
      signals.some((s) => String(s.id) === k)
    );
    if (selectedSavedKeys.length === 0) return;
    confirmAction(`Delete ${selectedSavedKeys.length} signal${selectedSavedKeys.length === 1 ? "" : "s"}? This cannot be undone.`, async () => {
      for (const key of selectedSavedKeys) {
        await deleteMutation.mutateAsync({ id: Number(key) });
      }
      setRowSelection(new Set());
      utils.components.componentById.invalidate({ id: componentId });
      onRefresh();
    });
  }

  // Click outside grid → save all dirty rows
  useEffect(() => {
    const hasDirty = localEdits.size > 0 || newRows.length > 0;
    if (!hasDirty) return;
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Element;
      const inGrid = gridRef.current?.contains(target) ?? false;
      const inDialog = !!target.closest('[role="dialog"]');
      if (inGrid || inDialog) return;
      localEdits.forEach((row, key) => {
        const base = signals.find((s) => String(s.id) === key);
        if (base) saveRow(key, { ...toRowState(base as ServerSignal), ...row });
      });
      newRows.forEach((row) => saveRow(row._tempId, row));
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localEdits, newRows]);

  function addRow() {
    setNewRows((prev) => [...prev, emptyRow(componentId, nextOffset)]);
  }

  function changeGroupBy(next: GroupByOption) {
    setGroupBy(next);
    setGrouping(next === "none" ? [] : [next === "type" ? "type" : "origin"]);
    setExpanded(true);
  }

  function makeOnChange(key: string, isNew: boolean, saved: SignalRowState | null) {
    return (patch: Partial<SignalRowState>) => {
      if (isNew) {
        setNewRows((prev) => prev.map((r) => r._tempId === key ? { ...r, ...patch } : r));
      } else {
        setLocalEdits((prev) => {
          const current = prev.get(key) ?? saved!;
          // Record the original state the first time this row is edited
          if (!prev.has(key) && !editOriginals.has(key)) {
            setEditOriginals((eo) => {
              if (eo.has(key)) return eo;
              const m = new Map(eo);
              m.set(key, saved!);
              return m;
            });
          }
          const m = new Map(prev);
          m.set(key, { ...current, ...patch });
          return m;
        });
      }
    };
  }

  const visibleKeys = table.getRowModel().rows
    .filter((r) => !r.getIsGrouped())
    .map((r) => r.original.key);
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((k) => rowSelection.has(k));
  const someVisibleSelected = visibleKeys.some((k) => rowSelection.has(k));

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setRowSelection((prev) => {
        const s = new Set(prev);
        visibleKeys.forEach((k) => s.delete(k));
        return s;
      });
    } else {
      setRowSelection((prev) => {
        const s = new Set(prev);
        visibleKeys.forEach((k) => s.add(k));
        return s;
      });
    }
  }

  const selectedCount = rowSelection.size;
  const visibleLeafColumns = table.getVisibleLeafColumns();
  const visibleColKeys = useMemo(() => visibleLeafColumns.map((c) => c.id as GridColKey), [visibleLeafColumns]);
  const colCount = visibleLeafColumns.length;
  const totalWidth = visibleColKeys.reduce((s, k) => s + colWidths[k], 0);

  const flatRows = useMemo(() => table.getRowModel().rows.filter((r) => !r.getIsGrouped()), [table.getRowModel().rows]);
  const ROW_HEIGHT = 37;
  const rowVirtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const FILTER_COLS = new Set<GridColKey>(["type", "origin", "tag", "desc"]);

  // Which rows are actively being edited AND selected (for the bulk hint)
  const editingSelectedCount = Array.from(localEdits.keys()).filter((k) => rowSelection.has(k)).length;

  return (
    <div className="space-y-3" ref={gridRef}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 text-xs flex-wrap">
        <span className="text-muted-foreground">{flatRows.length} signal{flatRows.length !== 1 ? "s" : ""}</span>
        {signals.length > 0 && (
          <button
            className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
            onClick={() => {
              confirmAction(`Delete ALL ${signals.length} signals from this component? This cannot be undone.`, async () => {
                await purgeMutation.mutateAsync({ componentId });
                onRefresh();
              });
            }}
          >
            Purge all
          </button>
        )}

        <div className="ml-auto">
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs">
                <Columns3 className="h-3.5 w-3.5 mr-1" /> Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 max-h-[400px] overflow-y-auto p-2" onDragOver={(e) => {
              const el = e.currentTarget as HTMLElement;
              const rect = el.getBoundingClientRect();
              const y = e.clientY - rect.top;
              if (y < 40) el.scrollTop -= 6;
              else if (y > rect.height - 40) el.scrollTop += 6;
            }}>
              <div className="space-y-px">
                {columnOrder.filter((k) => k !== "select" && k !== "actions").map((key) => {
                  const d = colDefMap.get(key as GridColKey);
                  if (!d) return null;
                  const col = table.getColumn(key);
                  if (!col) return null;
                  return (
                    <div
                      key={key}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", key); (e.currentTarget as HTMLElement).style.opacity = "0.4"; }}
                      onDragEnd={(e) => { (e.currentTarget as HTMLElement).style.opacity = ""; }}
                      onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add("border-t-2", "border-primary"); }}
                      onDragLeave={(e) => { (e.currentTarget as HTMLElement).classList.remove("border-t-2", "border-primary"); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        (e.currentTarget as HTMLElement).classList.remove("border-t-2", "border-primary");
                        const from = e.dataTransfer.getData("text/plain");
                        if (from === key) return;
                        setColumnOrder((prev) => {
                          const next = prev.filter((k) => k !== from);
                          next.splice(next.indexOf(key), 0, from);
                          localStorage.setItem(LS_COMP_COL_ORDER, JSON.stringify(next));
                          return next;
                        });
                      }}
                      className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-accent cursor-grab active:cursor-grabbing"
                    >
                      <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-input shrink-0"
                        checked={col.getIsVisible()}
                        onChange={() => {
                          col.toggleVisibility();
                          // Persist: collect all hidden columns after toggle
                          const next = { ...columnVisibility, [key]: !col.getIsVisible() };
                          const hidden = Object.entries(next).filter(([, v]) => v === false).map(([k]) => k);
                          localStorage.setItem(LS_COMP_COL_HIDDEN, JSON.stringify(hidden));
                        }}
                      />
                      <span className={cn("flex-1 text-sm truncate flex items-center gap-1", (d.disc || d.anlg) && "text-muted-foreground")}>
                        {key === "defaults" && <Settings2 className="h-3 w-3 shrink-0" />}
                        {key === "alarms" && <Bell className="h-3 w-3 shrink-0" />}
                        {key === "bus" && <Network className="h-3 w-3 shrink-0" />}
                        {d.group && <span className="text-[10px] text-muted-foreground/60">{d.group}/</span>}
                        {d.label || key}
                        {d.disc && <span className="text-[10px] text-blue-500">DI/DO</span>}
                        {d.anlg && <span className="text-[10px] text-purple-500">AI/AO</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {selectedCount > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="font-medium">{selectedCount} selected</span>
            {editingSelectedCount > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                — changes will apply to all {selectedCount} rows
              </span>
            )}
            <Button
              size="sm"
              variant="destructive"
              className="h-6 text-xs px-2"
              onClick={deleteSelected}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete selected
            </Button>
            <button
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setRowSelection(new Set())}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="rounded-md border overflow-auto max-h-[70vh]" ref={scrollRef}>
        <table className="text-sm" style={{ width: totalWidth, tableLayout: "fixed" }}>
          <colgroup>
            {visibleColKeys.map((k) => (
              <col key={k} style={{ width: colWidths[k] }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-background">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b bg-muted/50 text-xs text-muted-foreground">
                {hg.headers.filter((h) => h.column.getIsVisible()).map((header) => {
                  const key = header.id as GridColKey;
                  return (
                    <th
                      key={header.id}
                      style={{ width: colWidths[key], minWidth: colWidths[key] }}
                      className="relative px-2 py-2 text-left font-medium whitespace-nowrap select-none overflow-hidden"
                    >
                      {key === "select" ? (
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-input cursor-pointer"
                          checked={allVisibleSelected}
                          ref={(el) => { if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected; }}
                          onChange={toggleSelectAll}
                        />
                      ) : header.isPlaceholder ? null : (
                        typeof header.column.columnDef.header === "function"
                          ? header.column.columnDef.header(header.getContext())
                          : header.column.columnDef.header
                      )}
                      {key !== "actions" && key !== "select" && key !== "active" && (
                        <div
                          className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/30 z-10"
                          onMouseDown={(e) => { e.stopPropagation(); onColResizeStart(key, e); }}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
            {/* Filter row */}
            <tr className="border-b bg-muted/30">
              {visibleColKeys.map((k) => {
                if (!FILTER_COLS.has(k)) return <th key={k} className="px-1 py-0.5" />;
                const col = table.getColumn(k);
                const filterVal = (col?.getFilterValue() as string) ?? "";
                return (
                  <th key={k} className="px-1 py-0.5">
                    <input
                      className="w-full rounded border border-input bg-background px-1.5 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="Filter... (<empty>)"
                      value={filterVal}
                      onChange={(e) => col?.setFilterValue(e.target.value || undefined)}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="text-center text-muted-foreground py-8">
                  {columnFilters.length > 0 ? "No signals match the filters." : "No signals yet. Add the first one below."}
                </td>
              </tr>
            ) : groupBy !== "none" ? (
              // Grouped mode — full render (no virtualization)
              table.getRowModel().rows.map((row) => {
                if (row.getIsGrouped()) {
                  const groupVal = String(row.getValue(row.groupingColumnId!));
                  const label = groupVal === "(none)" ? "(no origin)" : groupVal;
                  return (
                    <tr key={row.id} className="bg-muted/30 border-b">
                      <td colSpan={colCount} className="px-3 py-1.5">
                        <button
                          onClick={() => row.toggleExpanded()}
                          className="flex items-center gap-2 text-xs font-medium text-foreground hover:opacity-70"
                        >
                          {row.getIsExpanded()
                            ? <ChevronDown className="h-3.5 w-3.5" />
                            : <ChevronRight className="h-3.5 w-3.5" />}
                          <span>{label}</span>
                          <span className="text-muted-foreground font-normal">({row.subRows.length})</span>
                        </button>
                      </td>
                    </tr>
                  );
                }
                const { key, isNew, saved, local, dirty } = row.original;
                return (
                  <SignalRow
                    key={key}
                    rowKey={key}
                    saved={saved}
                    local={local}
                    dirty={dirty}
                    isSaving={savingKeys.has(key)}
                    selected={rowSelection.has(key)}
                    visibleColumns={visibleColKeys}
                    onToggleSelect={() => {
                      setRowSelection((prev) => {
                        const s = new Set(prev);
                        if (s.has(key)) s.delete(key); else s.add(key);
                        return s;
                      });
                    }}
                    engineeringUnits={euData}
                    inputTypes={inputTypes}
                    plcDataTypes={plcDataTypes}
                    onChange={makeOnChange(key, isNew, saved)}
                    onSave={() => saveRow(key, local)}
                    onDiscard={() => {
                      if (isNew) setNewRows((prev) => prev.filter((r) => r._tempId !== key));
                      else { setLocalEdits((prev) => { const m = new Map(prev); m.delete(key); return m; }); setEditOriginals((prev) => { const m = new Map(prev); m.delete(key); return m; }); }
                    }}
                    onDelete={() => deleteRow(Number(key))}
                  />
                );
              })
            ) : (
              // Flat mode — virtualized
              <>
                {rowVirtualizer.getTotalSize() > 0 && (
                  <tr style={{ height: rowVirtualizer.getVirtualItems()[0]?.start ?? 0 }}><td /></tr>
                )}
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = flatRows[virtualRow.index];
                  if (!row) return null;

                const { key, isNew, saved, local, dirty } = row.original;
                return (
                  <SignalRow
                    key={key}
                    rowKey={key}
                    saved={saved}
                    local={local}
                    dirty={dirty}
                    isSaving={savingKeys.has(key)}
                    selected={rowSelection.has(key)}
                    visibleColumns={visibleColKeys}
                    onToggleSelect={() => {
                      setRowSelection((prev) => {
                        const s = new Set(prev);
                        if (s.has(key)) s.delete(key); else s.add(key);
                        return s;
                      });
                    }}
                    engineeringUnits={euData}
                    inputTypes={inputTypes}
                    plcDataTypes={plcDataTypes}
                    onChange={makeOnChange(key, isNew, saved)}
                    onSave={() => saveRow(key, local)}
                    onDiscard={() => {
                      if (isNew) setNewRows((prev) => prev.filter((r) => r._tempId !== key));
                      else { setLocalEdits((prev) => { const m = new Map(prev); m.delete(key); return m; }); setEditOriginals((prev) => { const m = new Map(prev); m.delete(key); return m; }); }
                    }}
                    onDelete={() => deleteRow(Number(key))}
                  />
                );
                })}
                {rowVirtualizer.getTotalSize() > 0 && (
                  <tr style={{ height: rowVirtualizer.getTotalSize() - (rowVirtualizer.getVirtualItems().at(-1)?.end ?? 0) }}><td /></tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      <Button variant="outline" size="sm" onClick={addRow}>
        <Plus className="mr-1 h-3.5 w-3.5" />
        Add Signal
      </Button>
      <ConfirmDialog {...confirmProps} confirmLabel="Delete" />
    </div>
  );
}
