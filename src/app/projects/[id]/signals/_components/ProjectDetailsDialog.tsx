"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const NONE = "__none__";
const sel = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

type SignalRow = {
  id: number;
  signalType: "DISCRETE" | "ANALOG";
  discreteSignal?: {
    trigger?: string;
    filterTimeMs?: unknown;
    switchingType?: string | null;
    signalVoltage?: string | null;
    plcDataType?: { id: number; code: string } | null;
    plcDataTypeId?: number | null;
  } | null;
  analogSignal?: {
    inputType?: { id: number; name: string } | null;
    inputTypeId?: number | null;
    wireConfig?: string | null;
    rawMin?: unknown;
    rawMax?: unknown;
    rawZero?: unknown;
    scaleMin?: unknown;
    scaleMax?: unknown;
    clampLow?: unknown;
    clampHigh?: unknown;
    deadband?: unknown;
    engineeringUnit?: { id: number; symbol: string } | null;
    engineeringUnitId?: number | null;
    plcDataTypeCatalog?: { id: number; code: string } | null;
    plcDataTypeId?: number | null;
    detectWireBreak?: boolean;
    detectShortCircuit?: boolean;
    detectOutOfRange?: boolean;
    namurNe43?: boolean;
    useTankLevel?: boolean;
    scalingFbOverride?: string | null;
    deadbandRawMin?: unknown;
    deadbandRawZero?: unknown;
    deadbandRawMax?: unknown;
    sensorFailRaw?: unknown;
    sensorFailMargin?: unknown;
    sensorFailBehavior?: string | null;
    sensorFailDelayMs?: number | null;
  } | null;
};

type Props = {
  open: boolean;
  signal: SignalRow;
  onClose: () => void;
  onSaved: () => void;
};

function num(v: unknown): number | null {
  return v != null ? Number(v) : null;
}

export function ProjectDetailsDialog({ open, signal, onClose, onSaved }: Props) {
  const isDisc = signal.signalType === "DISCRETE";
  const ds = signal.discreteSignal;
  const as = signal.analogSignal;

  // Shared
  const [tag, setTag] = useState((signal as any).tag ?? "");
  const [direction, setDirection] = useState<string | null>((signal as any).direction ?? null);

  // Discrete
  const [trigger, setTrigger] = useState(ds?.trigger ?? "NO");
  const [filterTimeMs, setFilterTimeMs] = useState(num(ds?.filterTimeMs));
  const [switchingType, setSwitchingType] = useState<string | null>(ds?.switchingType ?? null);
  const [signalVoltage, setSignalVoltage] = useState<string | null>(ds?.signalVoltage ?? null);
  const [discPlcDtId, setDiscPlcDtId] = useState<number | null>(ds?.plcDataType?.id ?? ds?.plcDataTypeId ?? null);

  // Analog
  const { data: inputTypes = [] } = trpc.signal.analogInputTypes.useQuery(undefined, { enabled: !isDisc });
  const { data: units = [] } = trpc.signal.engineeringUnits.useQuery(undefined, { enabled: !isDisc });
  const { data: plcDataTypes = [] } = trpc.signal.plcDataTypeList.useQuery();

  const [inputTypeId, setInputTypeId] = useState<number | null>(as?.inputType?.id ?? as?.inputTypeId ?? null);
  const [wireConfig, setWireConfig] = useState<string | null>(as?.wireConfig ?? null);
  const [rawMin, setRawMin] = useState(num(as?.rawMin));
  const [rawMax, setRawMax] = useState(num(as?.rawMax));
  const [rawZero, setRawZero] = useState(num(as?.rawZero));
  const [scaleMin, setScaleMin] = useState(num(as?.scaleMin));
  const [scaleMax, setScaleMax] = useState(num(as?.scaleMax));
  const [clampLow, setClampLow] = useState(num(as?.clampLow));
  const [clampHigh, setClampHigh] = useState(num(as?.clampHigh));
  const [deadband, setDeadband] = useState(num(as?.deadband));
  const [euId, setEuId] = useState<number | null>(as?.engineeringUnit?.id ?? as?.engineeringUnitId ?? null);
  const [anaPlcDtId, setAnaPlcDtId] = useState<number | null>(as?.plcDataTypeCatalog?.id ?? as?.plcDataTypeId ?? null);
  const [detectWireBreak, setDetectWireBreak] = useState(as?.detectWireBreak ?? false);
  const [detectShortCircuit, setDetectShortCircuit] = useState(as?.detectShortCircuit ?? false);
  const [detectOutOfRange, setDetectOutOfRange] = useState(as?.detectOutOfRange ?? false);
  const [namurNe43, setNamurNe43] = useState(as?.namurNe43 ?? false);
  const [useTankLevel, setUseTankLevel] = useState(as?.useTankLevel ?? false);
  const [scalingFbOverride, setScalingFbOverride] = useState<string | null>(as?.scalingFbOverride ?? null);
  const [deadbandRawMin, setDeadbandRawMin] = useState(num(as?.deadbandRawMin));
  const [deadbandRawZero, setDeadbandRawZero] = useState(num(as?.deadbandRawZero));
  const [deadbandRawMax, setDeadbandRawMax] = useState(num(as?.deadbandRawMax));
  const [sensorFailRaw, setSensorFailRaw] = useState(num(as?.sensorFailRaw));
  const [sensorFailMargin, setSensorFailMargin] = useState(num(as?.sensorFailMargin));
  const [sensorFailBehavior, setSensorFailBehavior] = useState<string | null>(as?.sensorFailBehavior ?? null);
  const [sensorFailDelayMs, setSensorFailDelayMs] = useState<number | null>(as?.sensorFailDelayMs ?? null);

  const update = trpc.signal.update.useMutation({ onSuccess: () => onSaved() });

  function handleSave() {
    const shared = { tag: tag || null, direction: direction as any };
    if (isDisc) {
      update.mutate({
        id: signal.id,
        ...shared,
        trigger: trigger as any,
        filterTimeMs,
        switchingType: switchingType as any,
        signalVoltage,
        plcDataTypeId: discPlcDtId,
      });
    } else {
      update.mutate({
        id: signal.id,
        ...shared,
        inputTypeId,
        wireConfig: wireConfig as any,
        rawMin, rawMax, rawZero,
        scaleMin, scaleMax,
        clampLow, clampHigh,
        deadband,
        engineeringUnitId: euId,
        plcDataTypeId: anaPlcDtId,
        useTankLevel,
        scalingFbOverride,
        deadbandRawMin, deadbandRawZero, deadbandRawMax,
        sensorFailRaw, sensorFailMargin,
        sensorFailBehavior: sensorFailBehavior as any,
        sensorFailDelayMs,
      });
    }
  }

  const numInput = (label: string, value: number | null, onChange: (v: number | null) => void, placeholder?: string) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type="number" step="any" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} placeholder={placeholder} />
    </div>
  );

  const check = (label: string, checked: boolean, onChange: (v: boolean) => void) => (
    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
      <input type="checkbox" className="h-4 w-4 rounded border-input cursor-pointer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isDisc ? "Discrete" : "Analog"} Signal Config</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Tag</Label>
            <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. TI-101" />
          </div>
          <div className="space-y-1">
            <Label>IO Direction</Label>
            <select className={sel} value={direction ?? NONE} onChange={(e) => setDirection(e.target.value === NONE ? null : e.target.value)}>
              <option value={NONE}>— auto —</option>
              <option value="INPUT">Input ({isDisc ? "DI" : "AI"})</option>
              <option value="OUTPUT">Output ({isDisc ? "DO" : "AO"})</option>
            </select>
          </div>
        </div>

        {isDisc ? (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Trigger</Label>
                <select className={sel} value={trigger} onChange={(e) => setTrigger(e.target.value)}>
                  <option value="NO">NO (Normally Open)</option>
                  <option value="NC">NC (Normally Closed)</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Switching Type</Label>
                <select className={sel} value={switchingType ?? NONE} onChange={(e) => setSwitchingType(e.target.value === NONE ? null : e.target.value)}>
                  <option value={NONE}>— none —</option>
                  <option value="HIGH_SIDE">High Side</option>
                  <option value="LOW_SIDE">Low Side</option>
                  <option value="BOTH">Both</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {numInput("Filter Time (ms)", filterTimeMs, setFilterTimeMs, "e.g. 3")}
              <div className="space-y-1">
                <Label>Signal Voltage</Label>
                <Input value={signalVoltage ?? ""} onChange={(e) => setSignalVoltage(e.target.value || null)} placeholder="e.g. 24V DC" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>PLC Data Type</Label>
              <select className={sel} value={discPlcDtId != null ? String(discPlcDtId) : NONE} onChange={(e) => setDiscPlcDtId(e.target.value === NONE ? null : Number(e.target.value))}>
                <option value={NONE}>— none —</option>
                {plcDataTypes.map((t) => <option key={t.id} value={String(t.id)}>{t.code}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Input */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Input Type</Label>
                <select className={sel} value={inputTypeId != null ? String(inputTypeId) : NONE} onChange={(e) => setInputTypeId(e.target.value === NONE ? null : Number(e.target.value))}>
                  <option value={NONE}>— none —</option>
                  {inputTypes.map((t) => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Wire Config</Label>
                <select className={sel} value={wireConfig ?? NONE} onChange={(e) => setWireConfig(e.target.value === NONE ? null : e.target.value)}>
                  <option value={NONE}>— none —</option>
                  <option value="TWO_WIRE">2-wire</option>
                  <option value="THREE_WIRE">3-wire</option>
                  <option value="FOUR_WIRE">4-wire</option>
                </select>
              </div>
            </div>

            {/* Scaling */}
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Scaling</p>
            <div className="grid grid-cols-2 gap-3">
              {numInput("Scale Min", scaleMin, setScaleMin, "0")}
              {numInput("Scale Max", scaleMax, setScaleMax, "100")}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {numInput("Raw Min", rawMin, setRawMin)}
              {numInput("Raw Zero", rawZero, setRawZero)}
              {numInput("Raw Max", rawMax, setRawMax)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {numInput("Clamp Low", clampLow, setClampLow)}
              {numInput("Clamp High", clampHigh, setClampHigh)}
            </div>
            {numInput("Deadband", deadband, setDeadband)}

            {/* Deadband raw */}
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Deadband Raw Values</p>
            <div className="grid grid-cols-3 gap-3">
              {numInput("DB Raw Min", deadbandRawMin, setDeadbandRawMin)}
              {numInput("DB Raw Zero", deadbandRawZero, setDeadbandRawZero)}
              {numInput("DB Raw Max", deadbandRawMax, setDeadbandRawMax)}
            </div>

            {/* EU + PLC type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Engineering Unit</Label>
                <select className={sel} value={euId != null ? String(euId) : NONE} onChange={(e) => setEuId(e.target.value === NONE ? null : Number(e.target.value))}>
                  <option value={NONE}>— none —</option>
                  {units.map((eu) => <option key={eu.id} value={String(eu.id)}>{eu.symbol}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>PLC Data Type</Label>
                <select className={sel} value={anaPlcDtId != null ? String(anaPlcDtId) : NONE} onChange={(e) => setAnaPlcDtId(e.target.value === NONE ? null : Number(e.target.value))}>
                  <option value={NONE}>— none —</option>
                  {plcDataTypes.map((t) => <option key={t.id} value={String(t.id)}>{t.code}</option>)}
                </select>
              </div>
            </div>

            {/* Diagnostics */}
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Diagnostics</p>
            <div className="grid grid-cols-2 gap-3">
              {check("Detect Wire Break", detectWireBreak, setDetectWireBreak)}
              {check("Detect Short Circuit", detectShortCircuit, setDetectShortCircuit)}
              {check("Detect Out of Range", detectOutOfRange, setDetectOutOfRange)}
              {check("NAMUR NE43", namurNe43, setNamurNe43)}
            </div>

            {/* Sensor fail */}
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Sensor Fail</p>
            <div className="grid grid-cols-2 gap-3">
              {numInput("Fail Raw Value", sensorFailRaw, setSensorFailRaw)}
              {numInput("Fail Margin", sensorFailMargin, setSensorFailMargin)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Fail Behavior</Label>
                <select className={sel} value={sensorFailBehavior ?? NONE} onChange={(e) => setSensorFailBehavior(e.target.value === NONE ? null : e.target.value)}>
                  <option value={NONE}>— none —</option>
                  <option value="HOLD_LAST">Hold Last</option>
                  <option value="GO_LOW">Go Low</option>
                  <option value="GO_HIGH">Go High</option>
                  <option value="GO_SAFE">Go Safe</option>
                </select>
              </div>
              {numInput("Fail Delay (ms)", sensorFailDelayMs, setSensorFailDelayMs)}
            </div>

            {/* Code gen */}
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Code Generation</p>
            <div className="grid grid-cols-2 gap-3">
              {check("Use Tank Level FB", useTankLevel, setUseTankLevel)}
              <div className="space-y-1">
                <Label>Scaling FB Override</Label>
                <Input value={scalingFbOverride ?? ""} onChange={(e) => setScalingFbOverride(e.target.value || null)} placeholder="e.g. FB_AnalogueIn_DeadBand" />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
