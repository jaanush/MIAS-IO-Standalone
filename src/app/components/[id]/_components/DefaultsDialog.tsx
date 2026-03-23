"use client";

import { useEffect, useState } from "react";
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
import type { SignalRowState } from "./SignalGrid";

const NONE = "__none__";
const sel = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

type InputType = { id: number; code: string; name: string };
type Eu = { id: number; symbol: string };
type PlcDt = { id: number; code: string };

type Props = {
  open: boolean;
  onClose: () => void;
  row: SignalRowState;
  engineeringUnits: Eu[];
  inputTypes: InputType[];
  plcDataTypes: PlcDt[];
  onChange: (patch: Partial<SignalRowState>) => void;
};

export function DefaultsDialog({ open, onClose, row, engineeringUnits, inputTypes, plcDataTypes, onChange }: Props) {
  const [local, setLocal] = useState<Partial<SignalRowState>>({});

  useEffect(() => {
    if (open) setLocal({});
  }, [open]);

  function patch(key: keyof SignalRowState, value: unknown) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  function get<K extends keyof SignalRowState>(key: K): SignalRowState[K] {
    return (key in local ? local[key] : row[key]) as SignalRowState[K];
  }

  function handleSave() {
    onChange(local);
    onClose();
  }

  const isDiscrete = row.ioType === "DI" || row.ioType === "DO";

  const numField = (label: string, key: keyof SignalRowState) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type="number" step="any" value={String(get(key) ?? "")} onChange={(e) => patch(key, e.target.value === "" ? null : Number(e.target.value))} />
    </div>
  );

  const checkField = (label: string, key: keyof SignalRowState) => (
    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
      <input type="checkbox" className="h-4 w-4 rounded border-input cursor-pointer" checked={!!get(key)} onChange={(e) => patch(key, e.target.checked)} />
      {label}
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isDiscrete ? "Discrete" : "Analog"} Signal Config
            {row.tagSuffix && <span className="ml-2 text-muted-foreground font-normal text-sm">— {row.tagSuffix}</span>}
          </DialogTitle>
        </DialogHeader>

        {/* Shared fields */}
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tag Suffix</Label>
              <Input
                value={get("tagSuffix") ?? ""}
                onChange={(e) => patch("tagSuffix", e.target.value || null)}
                placeholder="e.g. Speed"
              />
            </div>
            <div className="space-y-1">
              <Label>IO Type</Label>
              <select className={sel} value={get("ioType")} onChange={(e) => patch("ioType", e.target.value)}>
                <option value="DI">DI — Digital Input</option>
                <option value="DO">DO — Digital Output</option>
                <option value="AI">AI — Analog Input</option>
                <option value="AO">AO — Analog Output</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Input
              value={get("description") ?? ""}
              onChange={(e) => patch("description", e.target.value || null)}
              placeholder="Signal description"
            />
          </div>
        </div>

        {isDiscrete ? (
          <div className="space-y-4 py-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Discrete Defaults</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Trigger</Label>
                <select className={sel} value={get("defaultTrigger") ?? NONE} onChange={(e) => patch("defaultTrigger", e.target.value === NONE ? null : e.target.value)}>
                  <option value={NONE}>— none —</option>
                  <option value="NO">NO (Normally Open)</option>
                  <option value="NC">NC (Normally Closed)</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Switching Type</Label>
                <select className={sel} value={get("defaultSwitchingType") ?? NONE} onChange={(e) => patch("defaultSwitchingType", e.target.value === NONE ? null : e.target.value)}>
                  <option value={NONE}>— none —</option>
                  <option value="HIGH_SIDE">High Side</option>
                  <option value="LOW_SIDE">Low Side</option>
                  <option value="BOTH">Both</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Filter Time (ms)</Label>
                <Input type="number" step="0.001" value={get("defaultFilterTimeMs") ?? ""} onChange={(e) => patch("defaultFilterTimeMs", e.target.value === "" ? null : Number(e.target.value))} placeholder="e.g. 3" />
              </div>
              <div className="space-y-1">
                <Label>PLC Data Type</Label>
                <select className={sel} value={get("plcDataTypeId") != null ? String(get("plcDataTypeId")) : NONE} onChange={(e) => patch("plcDataTypeId", e.target.value === NONE ? null : Number(e.target.value))}>
                  <option value={NONE}>— none —</option>
                  {plcDataTypes.map((t) => <option key={t.id} value={String(t.id)}>{t.code}</option>)}
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Analog Defaults</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Input Type</Label>
                <select className={sel} value={get("defaultInputTypeId") != null ? String(get("defaultInputTypeId")) : NONE} onChange={(e) => patch("defaultInputTypeId", e.target.value === NONE ? null : Number(e.target.value))}>
                  <option value={NONE}>— none —</option>
                  {inputTypes.map((t) => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Wire Config</Label>
                <select className={sel} value={get("defaultWireConfig") ?? NONE} onChange={(e) => patch("defaultWireConfig", e.target.value === NONE ? null : e.target.value)}>
                  <option value={NONE}>— none —</option>
                  <option value="TWO_WIRE">2-wire</option>
                  <option value="THREE_WIRE">3-wire</option>
                  <option value="FOUR_WIRE">4-wire</option>
                </select>
              </div>
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Scaling</p>
            <div className="grid grid-cols-2 gap-3">
              {numField("Scale Min", "defaultScaleMin")}
              {numField("Scale Max", "defaultScaleMax")}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {numField("Raw Min", "defaultRawMin")}
              {numField("Raw Zero", "defaultRawZero")}
              {numField("Raw Max", "defaultRawMax")}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {numField("Clamp Low", "defaultClampLow")}
              {numField("Clamp High", "defaultClampHigh")}
            </div>
            {numField("Deadband", "defaultDeadband")}
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Deadband Raw</p>
            <div className="grid grid-cols-3 gap-3">
              {numField("DB Raw Min", "defaultDeadbandRawMin")}
              {numField("DB Raw Zero", "defaultDeadbandRawZero")}
              {numField("DB Raw Max", "defaultDeadbandRawMax")}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Engineering Unit</Label>
                <select className={sel} value={get("defaultEuId") != null ? String(get("defaultEuId")) : NONE} onChange={(e) => patch("defaultEuId", e.target.value === NONE ? null : Number(e.target.value))}>
                  <option value={NONE}>— none —</option>
                  {engineeringUnits.map((eu) => <option key={eu.id} value={String(eu.id)}>{eu.symbol}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>PLC Data Type</Label>
                <select className={sel} value={get("plcDataTypeId") != null ? String(get("plcDataTypeId")) : NONE} onChange={(e) => patch("plcDataTypeId", e.target.value === NONE ? null : Number(e.target.value))}>
                  <option value={NONE}>— none —</option>
                  {plcDataTypes.map((t) => <option key={t.id} value={String(t.id)}>{t.code}</option>)}
                </select>
              </div>
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Diagnostics</p>
            <div className="grid grid-cols-2 gap-3">
              {checkField("Detect Wire Break", "defaultDetectWireBreak")}
              {checkField("Detect Short Circuit", "defaultDetectShortCircuit")}
              {checkField("Detect Out of Range", "defaultDetectOutOfRange")}
              {checkField("NAMUR NE43", "defaultNamurNe43")}
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Sensor Fail</p>
            <div className="grid grid-cols-2 gap-3">
              {numField("Fail Raw", "defaultSensorFailRaw")}
              {numField("Fail Margin", "defaultSensorFailMargin")}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Fail Behavior</Label>
                <select className={sel} value={get("defaultSensorFailBehavior") ?? NONE} onChange={(e) => patch("defaultSensorFailBehavior", e.target.value === NONE ? null : e.target.value)}>
                  <option value={NONE}>— none —</option>
                  <option value="HOLD_LAST">Hold Last</option>
                  <option value="GO_LOW">Go Low</option>
                  <option value="GO_HIGH">Go High</option>
                  <option value="GO_SAFE">Go Safe</option>
                </select>
              </div>
              {numField("Fail Delay (ms)", "defaultSensorFailDelayMs")}
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">Code Generation</p>
            <div className="grid grid-cols-2 gap-3">
              {checkField("Use Tank Level FB", "defaultUseTankLevel")}
              <div className="space-y-1">
                <Label>Scaling FB Override</Label>
                <Input value={get("defaultScalingFbOverride") ?? ""} onChange={(e) => patch("defaultScalingFbOverride", e.target.value || null)} placeholder="e.g. FB_AnalogueIn_DeadBand" />
              </div>
            </div>
          </div>
        )}

        {/* Alarm config defaults */}
        <div className="space-y-4 py-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Alarm Config Defaults</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Alarm Group</Label>
              <Input value={get("defaultAlarmGroup") ?? ""} onChange={(e) => patch("defaultAlarmGroup", e.target.value || null)} placeholder="A/B/C" maxLength={1} />
            </div>
            <div className="space-y-1">
              <Label>Block Mask</Label>
              <Input value={get("defaultAlarmBlockMask") ?? ""} onChange={(e) => patch("defaultAlarmBlockMask", e.target.value || null)} placeholder="00000" maxLength={5} />
            </div>
            <div className="space-y-1">
              <Label>Comm Mask</Label>
              <Input value={get("defaultCommBlockMask") ?? ""} onChange={(e) => patch("defaultCommBlockMask", e.target.value || null)} placeholder="00000" maxLength={5} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Special Alarm FB</Label>
              <Input value={get("defaultSpecialAlarmFb") ?? ""} onChange={(e) => patch("defaultSpecialAlarmFb", e.target.value || null)} placeholder="FB name" />
            </div>
            <div className="space-y-1">
              <Label>Special Alarm Input</Label>
              <Input value={get("defaultSpecialAlarmInput") ?? ""} onChange={(e) => patch("defaultSpecialAlarmInput", e.target.value || null)} placeholder="ST expression" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Suppression ST</Label>
            <Input value={get("defaultSuppressionSt") ?? ""} onChange={(e) => patch("defaultSuppressionSt", e.target.value || null)} placeholder="e.g. NOT GVL_Modes.bEngineRunning" />
          </div>
          <div className="flex gap-4">
            {checkField("FAT Block", "defaultFatBlock")}
            {checkField("Analog→Digital Alarm", "defaultAnaToDigAlarm")}
          </div>
        </div>

        {/* Code gen defaults */}
        <div className="space-y-4 py-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Code Gen Defaults</p>
          <div className="grid grid-cols-2 gap-3">
            {checkField("Retain", "defaultIsRetain")}
            {checkField("Persistent", "defaultIsPersistent")}
            {checkField("Logging", "defaultLoggingEnabled")}
            {checkField("Short Name", "defaultUseShortName")}
          </div>
          <div className="space-y-1">
            <Label>FB Name Override</Label>
            <Input value={get("defaultFbNameOverride") ?? ""} onChange={(e) => patch("defaultFbNameOverride", e.target.value || null)} placeholder="e.g. FB_PumpStation_01" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
