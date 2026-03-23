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
} from "lucide-react";
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

  return (
    <>
      <tr className={[
        dirty ? "bg-amber-50 dark:bg-amber-950/20" : selected ? "bg-primary/5" : "",
        !local.active && !dirty ? "opacity-50" : "",
      ].filter(Boolean).join(" ") || undefined}>
        {/* Select checkbox */}
        <td className="px-2 py-1 w-9 align-middle text-center" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-input cursor-pointer"
            checked={selected}
            onChange={onToggleSelect}
          />
        </td>

        {/* Active checkbox */}
        <td className="px-2 py-1 align-middle text-center" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            title={local.active ? "Signal is active (used in component)" : "Signal is inactive"}
            className="h-3.5 w-3.5 rounded border-input cursor-pointer"
            checked={local.active}
            onChange={(e) => onChange({ active: e.target.checked })}
          />
        </td>

        {/* Signal type */}
        <td className="px-2 py-1 w-28">
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

        {/* Origin */}
        <td className="px-2 py-1 w-32">
          <select
            className="h-7 w-full rounded border border-input bg-background px-1.5 text-xs"
            value={local.origin ?? ""}
            onChange={(e) => onChange({ origin: (e.target.value || null) as SignalOrigin | null })}
          >
            <option value="">—</option>
            {SIGNAL_ORIGINS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </td>

        {/* Tag suffix */}
        <td className="px-2 py-1 w-36">
          <Input
            className="h-7 font-mono text-sm px-2"
            value={local.tagSuffix ?? ""}
            onChange={(e) => onChange({ tagSuffix: e.target.value || null })}
            placeholder="e.g. _RUN"
          />
        </td>

        {/* Description */}
        <td className="px-2 py-1">
          <Input
            className="h-7 text-sm px-2"
            value={local.description ?? ""}
            onChange={(e) => onChange({ description: e.target.value || null })}
            placeholder="Signal description"
          />
        </td>

        {/* Defaults summary + edit */}
        <td className="px-2 py-1 w-48">
          <button
            type="button"
            onClick={() => setDefaultsOpen(true)}
            className="flex w-full items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground text-left"
          >
            <Settings2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{defaultsSummary(local, inputTypes)}</span>
          </button>
        </td>

        {/* Alarms */}
        <td className="px-2 py-1 w-20 text-center">
          <button
            type="button"
            onClick={() => setAlarmsOpen(true)}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          >
            <Bell className="h-3 w-3" />
            {alarmCount > 0 && <span className="font-medium text-foreground">{alarmCount}</span>}
          </button>
        </td>

        {/* Bus config */}
        <td className="px-2 py-1 w-32">
          <button
            type="button"
            onClick={() => setBusOpen(true)}
            className="flex w-full items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground text-left"
          >
            <Network className="h-3 w-3 shrink-0" />
            <span className="truncate">{busSummary(local)}</span>
          </button>
        </td>

        {/* Actions */}
        <td className="px-2 py-1 w-24">
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

type GridColKey = "select" | "active" | "type" | "origin" | "tag" | "desc" | "defaults" | "alarms" | "bus" | "actions";

const COL_DEFAULTS: Record<GridColKey, number> = {
  select: 36, active: 56, type: 112, origin: 128, tag: 144, desc: 240,
  defaults: 192, alarms: 80, bus: 128, actions: 96,
};

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
  const [localEdits, setLocalEdits] = useState<Map<string, SignalRowState>>(new Map());
  const [editOriginals, setEditOriginals] = useState<Map<string, SignalRowState>>(new Map());
  const [newRows, setNewRows] = useState<NewRow[]>([]);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [rowSelection, setRowSelection] = useState<Set<string>>(new Set());
  const [colWidths, setColWidths] = useState<Record<GridColKey, number>>(() => {
    try {
      const stored = localStorage.getItem("mias-comp-signal-col-widths");
      if (stored) return { ...COL_DEFAULTS, ...JSON.parse(stored) };
    } catch {}
    return { ...COL_DEFAULTS };
  });
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
        localStorage.setItem("mias-comp-signal-col-widths", JSON.stringify(next));
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
    state: { sorting, columnFilters, grouping, expanded },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
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
    if (!confirm("Delete this signal?")) return;
    await deleteMutation.mutateAsync({ id: signalId });
    utils.components.componentById.invalidate({ id: componentId });
    onRefresh();
  }

  async function deleteSelected() {
    const selectedSavedKeys = Array.from(rowSelection).filter((k) =>
      signals.some((s) => String(s.id) === k)
    );
    if (selectedSavedKeys.length === 0) return;
    if (!confirm(`Delete ${selectedSavedKeys.length} signal${selectedSavedKeys.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    for (const key of selectedSavedKeys) {
      await deleteMutation.mutateAsync({ id: Number(key) });
    }
    setRowSelection(new Set());
    utils.components.componentById.invalidate({ id: componentId });
    onRefresh();
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
  const colCount = COLUMNS.length;
  const totalWidth = (Object.keys(COL_DEFAULTS) as GridColKey[]).reduce((s, k) => s + colWidths[k], 0);

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
            onClick={async () => {
              if (!confirm(`Delete ALL ${signals.length} signals from this component? This cannot be undone.`)) return;
              await purgeMutation.mutateAsync({ componentId });
              onRefresh();
            }}
          >
            Purge all
          </button>
        )}

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
            {(Object.keys(COL_DEFAULTS) as GridColKey[]).map((k) => (
              <col key={k} style={{ width: colWidths[k] }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-background">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b bg-muted/50 text-xs text-muted-foreground">
                {hg.headers.map((header) => {
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
              {(Object.keys(COL_DEFAULTS) as GridColKey[]).map((k) => {
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
    </div>
  );
}
