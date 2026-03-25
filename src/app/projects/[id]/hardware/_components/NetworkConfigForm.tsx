"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CAN_MODES, SERIAL_PARITY } from "@/lib/enums";
import type { Bus } from "@/lib/types/hardware";

type Props = {
  network: Bus;
  isSerial: boolean;
  isCan: boolean;
  isEthernet: boolean;
  onSaved: () => void;
};

export function NetworkConfigForm({ network, isSerial, isCan, isEthernet, onSaved }: Props) {
  const [role, setRole] = useState(network.role);
  const [nodeAddress, setNodeAddress] = useState(String(network.nodeAddress ?? ""));
  const [description, setDescription] = useState(network.description ?? "");
  const [baudRateKbit, setBaudRateKbit] = useState(String(network.baudRateKbit ?? ""));
  const [serialParity, setSerialParity] = useState(network.serialParity ?? "");
  const [serialStopBits, setSerialStopBits] = useState(String(network.serialStopBits ?? ""));
  const [ipPort, setIpPort] = useState(String(network.ipPort ?? ""));
  const [canMode, setCanMode] = useState(network.canMode ?? "");
  const [canHeartbeatMs, setCanHeartbeatMs] = useState(String(network.canHeartbeatMs ?? ""));
  const [canSyncPeriodMs, setCanSyncPeriodMs] = useState(String(network.canSyncPeriodMs ?? ""));
  const [cyclePeriodMs, setCyclePeriodMs] = useState(String(network.cyclePeriodMs ?? ""));

  const update = trpc.projectHardware.busUpdate.useMutation({ onSuccess: onSaved });

  // sel class removed — using shadcn Select instead

  return (
    <div className="space-y-4 rounded-md border p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Bus Configuration
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Name</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-8 text-sm"
            placeholder="e.g. Field devices bus"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Role</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["MASTER", "SLAVE", "ADAPTER", "SCANNER"].map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Node Address</Label>
          <Input
            type="number"
            value={nodeAddress}
            onChange={(e) => setNodeAddress(e.target.value)}
            className="h-8 text-sm"
            placeholder="optional"
          />
        </div>
      </div>

      {isSerial && (
        <>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">
            Serial Parameters
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Baud Rate (kbit/s)</Label>
              <Input
                type="number"
                value={baudRateKbit}
                onChange={(e) => setBaudRateKbit(e.target.value)}
                className="h-8 text-sm"
                placeholder="e.g. 115"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Parity</Label>
              <Select value={serialParity || "__none__"} onValueChange={(v) => setSerialParity(v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— none —</SelectItem>
                  {SERIAL_PARITY.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Stop Bits</Label>
              <Select value={serialStopBits || "__none__"} onValueChange={(v) => setSerialStopBits(v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </>
      )}

      {isCan && (
        <>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">
            CAN Parameters
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Baud Rate (kbit/s)</Label>
              <Input
                type="number"
                value={baudRateKbit}
                onChange={(e) => setBaudRateKbit(e.target.value)}
                className="h-8 text-sm"
                placeholder="e.g. 500"
              />
            </div>
            {network.protocol === "CANBUS" && (
              <div className="space-y-1">
                <Label className="text-xs">CAN Mode</Label>
                <Select value={canMode || "__none__"} onValueChange={(v) => setCanMode(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— none —</SelectItem>
                    {CAN_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Heartbeat (ms)</Label>
              <Input
                type="number"
                value={canHeartbeatMs}
                onChange={(e) => setCanHeartbeatMs(e.target.value)}
                className="h-8 text-sm"
                placeholder="e.g. 1000"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sync Period (ms)</Label>
              <Input
                type="number"
                value={canSyncPeriodMs}
                onChange={(e) => setCanSyncPeriodMs(e.target.value)}
                className="h-8 text-sm"
                placeholder="e.g. 100"
              />
            </div>
          </div>
        </>
      )}

      {isEthernet && (
        <>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">
            TCP Parameters
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">TCP Port</Label>
              <Input
                type="number"
                value={ipPort}
                onChange={(e) => setIpPort(e.target.value)}
                className="h-8 text-sm"
                placeholder="e.g. 502"
              />
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Cycle Period (ms)</Label>
          <Input
            type="number"
            value={cyclePeriodMs}
            onChange={(e) => setCyclePeriodMs(e.target.value)}
            className="h-8 text-sm"
            placeholder="optional"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={update.isPending}
          onClick={() =>
            update.mutate({
              id: network.id,
              role: role as Parameters<typeof update.mutate>[0]["role"],
              nodeAddress: nodeAddress ? Number(nodeAddress) : null,
              description: description || null,
              baudRateKbit: baudRateKbit ? Number(baudRateKbit) : null,
              serialParity: (serialParity || null) as Parameters<typeof update.mutate>[0]["serialParity"],
              serialStopBits: serialStopBits ? Number(serialStopBits) : null,
              ipPort: ipPort ? Number(ipPort) : null,
              canMode: (canMode || null) as Parameters<typeof update.mutate>[0]["canMode"],
              canHeartbeatMs: canHeartbeatMs ? Number(canHeartbeatMs) : null,
              canSyncPeriodMs: canSyncPeriodMs ? Number(canSyncPeriodMs) : null,
              cyclePeriodMs: cyclePeriodMs ? Number(cyclePeriodMs) : null,
            })
          }
        >
          {update.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
