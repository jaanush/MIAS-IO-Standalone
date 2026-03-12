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

  const isDiscrete = signal.signalType === "DISCRETE";

  useEffect(() => {
    if (open) {
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

  const upsert = trpc.signal.signalAlarmUpsert.useMutation({
    onSuccess: () => {
      onSaved();
    },
  });

  function handleSave() {
    upsert.mutate({
      signalId: signal.id,
      discreteAlarms: discrete,
      analogAlarms: analog,
    });
  }

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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Alarms
            <span className="ml-2 text-muted-foreground font-normal text-sm">— {signalLabel}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
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
          <Button variant="outline" onClick={onClose} disabled={upsert.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
