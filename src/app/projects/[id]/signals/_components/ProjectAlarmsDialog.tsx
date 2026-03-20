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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { trpc } from "@/trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";
import { ALARM_SEVERITIES, DISCRETE_ALARM_CONDITIONS, ANALOG_ALARM_CONDITIONS } from "@/lib/enums";

type SignalRow = inferRouterOutputs<AppRouter>["signal"]["list"][number];

type DiscreteAlarmRow = {
  condition: "ON_TRIGGER" | "OFF_TRIGGER";
  severity: "INFO" | "WARNING" | "ALARM" | "CRITICAL";
  delaySeconds: number;
  message: string | null;
};

type AnalogAlarmRow = {
  condition: "HIGH" | "HIGH_HIGH" | "LOW" | "LOW_LOW";
  setpoint: number;
  hysteresis: number;
  severity: "INFO" | "WARNING" | "ALARM" | "CRITICAL";
  delaySeconds: number;
  message: string | null;
};

const DISCRETE_CONDITIONS = [
  { value: "ON_TRIGGER", label: "On Trigger" },
  { value: "OFF_TRIGGER", label: "Off Trigger" },
] as const;

const ANALOG_CONDITIONS = [
  { value: "HIGH_HIGH", label: "High High" },
  { value: "HIGH", label: "High" },
  { value: "LOW", label: "Low" },
  { value: "LOW_LOW", label: "Low Low" },
] as const;

type Props = {
  signal: SignalRow;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function ProjectAlarmsDialog({ signal, open, onClose, onSaved }: Props) {
  const [discrete, setDiscrete] = useState<DiscreteAlarmRow[]>([]);
  const [analog, setAnalog] = useState<AnalogAlarmRow[]>([]);

  // Alarm config fields (from signal base table)
  const [alarmGroup, setAlarmGroup] = useState<string>(signal.alarmGroup ?? "");
  const [alarmBlockMask, setAlarmBlockMask] = useState<string>(signal.alarmBlockMask ?? "");
  const [commBlockMask, setCommBlockMask] = useState<string>(signal.commBlockMask ?? "");
  const [fatBlock, setFatBlock] = useState(signal.fatBlock ?? false);
  const [suppressionSt, setSuppressionSt] = useState<string>(signal.suppressionSt ?? "");
  const [specialAlarmFb, setSpecialAlarmFb] = useState<string>(signal.specialAlarmFb ?? "");
  const [specialAlarmInput, setSpecialAlarmInput] = useState<string>(signal.specialAlarmInput ?? "");
  const [anaToDigAlarm, setAnaToDigAlarm] = useState(signal.anaToDigAlarm ?? false);

  const isDiscrete = signal.signalType === "DISCRETE";

  useEffect(() => {
    if (open) {
      setAlarmGroup(signal.alarmGroup ?? "");
      setAlarmBlockMask(signal.alarmBlockMask ?? "");
      setCommBlockMask(signal.commBlockMask ?? "");
      setFatBlock(signal.fatBlock ?? false);
      setSuppressionSt(signal.suppressionSt ?? "");
      setSpecialAlarmFb(signal.specialAlarmFb ?? "");
      setSpecialAlarmInput(signal.specialAlarmInput ?? "");
      setAnaToDigAlarm(signal.anaToDigAlarm ?? false);
      if (signal.discreteSignal?.alarms) {
        setDiscrete(
          signal.discreteSignal.alarms.map((a) => ({
            condition: a.condition,
            severity: a.severity,
            delaySeconds: a.delaySeconds,
            message: a.message ?? null,
          }))
        );
      } else {
        setDiscrete([]);
      }
      if (signal.analogSignal?.alarms) {
        setAnalog(
          signal.analogSignal.alarms.map((a) => ({
            condition: a.condition,
            setpoint: Number(a.setpoint),
            hysteresis: Number(a.hysteresis),
            severity: a.severity,
            delaySeconds: a.delaySeconds,
            message: a.message ?? null,
          }))
        );
      } else {
        setAnalog([]);
      }
    }
  }, [open, signal]);

  const upsert = trpc.signal.signalAlarmUpsert.useMutation();
  const updateSignal = trpc.signal.update.useMutation();

  async function handleSave() {
    await Promise.all([
      upsert.mutateAsync({
        signalId: signal.id,
        discreteAlarms: discrete,
        analogAlarms: analog,
      }),
      updateSignal.mutateAsync({
        id: signal.id,
        alarmGroup: alarmGroup || null,
        alarmBlockMask: alarmBlockMask || null,
        commBlockMask: commBlockMask || null,
        fatBlock,
        suppressionSt: suppressionSt || null,
        specialAlarmFb: specialAlarmFb || null,
        specialAlarmInput: specialAlarmInput || null,
        anaToDigAlarm,
      }),
    ]);
    onSaved();
  }

  const saving = upsert.isPending || updateSignal.isPending;

  // ── Discrete alarms ──────────────────────────────────────────────
  const usedDiscreteConditions = new Set(discrete.map((a) => a.condition));
  const availableDiscreteConditions = DISCRETE_CONDITIONS.filter(
    (c) => !usedDiscreteConditions.has(c.value)
  );

  function addDiscreteAlarm() {
    const next = availableDiscreteConditions[0];
    if (!next) return;
    setDiscrete((prev) => [
      ...prev,
      { condition: next.value, severity: "ALARM", delaySeconds: 0, message: null },
    ]);
  }

  function updateDiscrete(index: number, patch: Partial<DiscreteAlarmRow>) {
    setDiscrete((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  // ── Analog alarms ────────────────────────────────────────────────
  const usedAnalogConditions = new Set(analog.map((a) => a.condition));
  const availableAnalogConditions = ANALOG_CONDITIONS.filter(
    (c) => !usedAnalogConditions.has(c.value)
  );

  function addAnalogAlarm() {
    const next = availableAnalogConditions[0];
    if (!next) return;
    setAnalog((prev) => [
      ...prev,
      { condition: next.value, setpoint: 0, hysteresis: 0, severity: "ALARM", delaySeconds: 0, message: null },
    ]);
  }

  function updateAnalog(index: number, patch: Partial<AnalogAlarmRow>) {
    setAnalog((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  const signalLabel = signal.tag ?? signal.description ?? `#${signal.id}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Alarms
            <span className="ml-2 text-muted-foreground font-normal text-sm">— {signalLabel}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Alarm configuration */}
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Configuration</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Alarm Group</Label>
              <Input value={alarmGroup} onChange={(e) => setAlarmGroup(e.target.value)} placeholder="A/B/C" maxLength={1} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Block Mask</Label>
              <Input value={alarmBlockMask} onChange={(e) => setAlarmBlockMask(e.target.value)} placeholder="00000" maxLength={5} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Comm Mask</Label>
              <Input value={commBlockMask} onChange={(e) => setCommBlockMask(e.target.value)} placeholder="00000" maxLength={5} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Special Alarm FB</Label>
              <Input value={specialAlarmFb} onChange={(e) => setSpecialAlarmFb(e.target.value)} placeholder="e.g. FB_Alarm_FollowSetpoint" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Special Alarm Input</Label>
              <Input value={specialAlarmInput} onChange={(e) => setSpecialAlarmInput(e.target.value)} placeholder="ST expression" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Suppression ST Expression</Label>
            <Input value={suppressionSt} onChange={(e) => setSuppressionSt(e.target.value)} placeholder="e.g. NOT GVL_Modes.bEngineRunning" />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
              <input type="checkbox" className="h-3.5 w-3.5 rounded border-input" checked={fatBlock} onChange={(e) => setFatBlock(e.target.checked)} />
              FAT Block
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
              <input type="checkbox" className="h-3.5 w-3.5 rounded border-input" checked={anaToDigAlarm} onChange={(e) => setAnaToDigAlarm(e.target.checked)} />
              Analog→Digital Alarm
            </label>
          </div>

          <hr className="border-border" />

          {/* Alarm definitions */}
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Alarm Definitions</p>
          {isDiscrete ? (
            <>
              {discrete.map((alarm, i) => (
                <div key={i} className="rounded-md border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <Select
                      value={alarm.condition}
                      onValueChange={(v) =>
                        updateDiscrete(i, { condition: v as DiscreteAlarmRow["condition"] })
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DISCRETE_CONDITIONS.map((c) => (
                          <SelectItem
                            key={c.value}
                            value={c.value}
                            disabled={usedDiscreteConditions.has(c.value) && alarm.condition !== c.value}
                          >
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDiscrete((p) => p.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Severity</Label>
                      <Select
                        value={alarm.severity}
                        onValueChange={(v) =>
                          updateDiscrete(i, { severity: v as typeof ALARM_SEVERITIES[number] })
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ALARM_SEVERITIES.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Delay (s)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={alarm.delaySeconds}
                        onChange={(e) => updateDiscrete(i, { delaySeconds: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Message</Label>
                    <Input
                      value={alarm.message ?? ""}
                      onChange={(e) => updateDiscrete(i, { message: e.target.value || null })}
                      placeholder="Alarm message…"
                    />
                  </div>
                </div>
              ))}

              {availableDiscreteConditions.length > 0 && (
                <Button variant="outline" size="sm" onClick={addDiscreteAlarm}>
                  <Plus className="mr-1 h-3 w-3" /> Add Alarm
                </Button>
              )}
            </>
          ) : (
            <>
              {analog.map((alarm, i) => (
                <div key={i} className="rounded-md border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <Select
                      value={alarm.condition}
                      onValueChange={(v) =>
                        updateAnalog(i, { condition: v as AnalogAlarmRow["condition"] })
                      }
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ANALOG_CONDITIONS.map((c) => (
                          <SelectItem
                            key={c.value}
                            value={c.value}
                            disabled={usedAnalogConditions.has(c.value) && alarm.condition !== c.value}
                          >
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setAnalog((p) => p.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Setpoint</Label>
                      <Input
                        type="number"
                        value={alarm.setpoint}
                        onChange={(e) => updateAnalog(i, { setpoint: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Hysteresis</Label>
                      <Input
                        type="number"
                        min={0}
                        value={alarm.hysteresis}
                        onChange={(e) => updateAnalog(i, { hysteresis: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Severity</Label>
                      <Select
                        value={alarm.severity}
                        onValueChange={(v) =>
                          updateAnalog(i, { severity: v as typeof ALARM_SEVERITIES[number] })
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ALARM_SEVERITIES.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Delay (s)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={alarm.delaySeconds}
                        onChange={(e) => updateAnalog(i, { delaySeconds: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Message</Label>
                    <Input
                      value={alarm.message ?? ""}
                      onChange={(e) => updateAnalog(i, { message: e.target.value || null })}
                      placeholder="Alarm message…"
                    />
                  </div>
                </div>
              ))}

              {availableAnalogConditions.length > 0 && (
                <Button variant="outline" size="sm" onClick={addAnalogAlarm}>
                  <Plus className="mr-1 h-3 w-3" /> Add Alarm
                </Button>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
