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
import type { DiscreteAlarmRow, AnalogAlarmRow, SignalRowState } from "./SignalGrid";

const SEVERITIES = ["INFO", "WARNING", "ALARM", "CRITICAL"] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  row: SignalRowState;
  onChange: (patch: Pick<SignalRowState, "discreteAlarms" | "analogAlarms">) => void;
};

export function AlarmsDialog({ open, onClose, row, onChange }: Props) {
  const [discrete, setDiscrete] = useState<DiscreteAlarmRow[]>([]);
  const [analog, setAnalog] = useState<AnalogAlarmRow[]>([]);

  useEffect(() => {
    if (open) {
      setDiscrete(row.discreteAlarms.map((a) => ({ ...a })));
      setAnalog(row.analogAlarms.map((a) => ({ ...a })));
    }
  }, [open, row]);

  function handleSave() {
    onChange({ discreteAlarms: discrete, analogAlarms: analog });
    onClose();
  }

  const isDiscrete = row.ioType === "DI" || row.ioType === "DO";

  // ── Discrete alarms ───────────────────────────────────────────────
  const DISCRETE_CONDITIONS = [
    { value: "ON_TRIGGER", label: "On Trigger" },
    { value: "OFF_TRIGGER", label: "Off Trigger" },
  ] as const;

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

  // ── Analog alarms ─────────────────────────────────────────────────
  const ANALOG_CONDITIONS = [
    { value: "HIGH_HIGH", label: "High High" },
    { value: "HIGH", label: "High" },
    { value: "LOW", label: "Low" },
    { value: "LOW_LOW", label: "Low Low" },
  ] as const;

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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Alarm Defaults
            {row.tagSuffix && (
              <span className="ml-2 text-muted-foreground font-normal text-sm">— {row.tagSuffix}</span>
            )}
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
                      onValueChange={(v) => updateDiscrete(i, { condition: v as DiscreteAlarmRow["condition"] })}
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
                    <Button variant="ghost" size="icon" onClick={() => setDiscrete((p) => p.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Severity</Label>
                      <Select
                        value={alarm.severity}
                        onValueChange={(v) => updateDiscrete(i, { severity: v as typeof SEVERITIES[number] })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
                      onValueChange={(v) => updateAnalog(i, { condition: v as AnalogAlarmRow["condition"] })}
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
                    <Button variant="ghost" size="icon" onClick={() => setAnalog((p) => p.filter((_, j) => j !== i))}>
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
                        onValueChange={(v) => updateAnalog(i, { severity: v as typeof SEVERITIES[number] })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
