"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Copy } from "lucide-react";
import { trpc } from "@/trpc/client";
import { PdoCard } from "./PdoCard";
import { PdoCreateDialog } from "./PdoCreateDialog";

type PdoSignal = {
  id: number;
  channelOffset: number;
  tagSuffix: string | null;
  description: string | null;
  ioType: string;
  rawDataType: string | null;
  bitOffset: number | null;
  bitLength: number | null;
  canopenIndex: number | null;
  canopenSubIndex: number | null;
};

type ComponentSignal = PdoSignal & { pdoConfigId?: number | null };

type Props = {
  componentId: number;
  hasParent: boolean;
  signals: ComponentSignal[];
  onRefresh: () => void;
};

function formatHex(n: number | null): string {
  if (n == null) return "—";
  return `0x${n.toString(16).toUpperCase().padStart(3, "0")}`;
}

export function PdoConfigSection({ componentId, hasParent, signals, onRefresh }: Props) {
  const [showCreate, setShowCreate] = useState(false);

  // Use effective PDOs (includes inherited from parent chain)
  const { data: effectivePdos = [], refetch: refetchPdos } = trpc.components.effectivePdoConfigs.useQuery(
    { componentId },
  );

  const createMut = trpc.components.pdoCreate.useMutation({
    onSuccess: () => { refetchPdos(); onRefresh(); },
  });

  function handleRefresh() {
    refetchPdos();
    onRefresh();
  }

  /** Override an inherited PDO: copy params to own component */
  function handleOverride(pdo: typeof effectivePdos[number]) {
    createMut.mutate({
      componentId,
      direction: pdo.direction as "TPDO" | "RPDO",
      pdoNumber: pdo.pdoNumber,
      cobId: pdo.cobId,
      transmissionType: pdo.transmissionType,
      eventTimerMs: pdo.eventTimerMs,
      inhibitTimeUs: pdo.inhibitTimeUs,
      syncWindowUs: pdo.syncWindowUs,
      nodeId: pdo.nodeId,
      description: pdo.description ? `${pdo.description} (overridden)` : null,
    });
  }

  const tpdos = effectivePdos.filter((p) => p.direction === "TPDO");
  const rpdos = effectivePdos.filter((p) => p.direction === "RPDO");

  // Build allSignals with pdoConfigId for the signal picker
  const allSignals: ComponentSignal[] = signals.map((s) => ({
    ...s,
    pdoConfigId: (s as any).pdoConfigId ?? null,
  }));

  function renderPdoGroup(label: string, pdos: typeof effectivePdos) {
    if (pdos.length === 0) return null;
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="space-y-2">
          {pdos.map((pdo) =>
            (pdo as any).inherited ? (
              <InheritedPdoRow
                key={`inh-${pdo.direction}-${pdo.pdoNumber}`}
                pdo={pdo}
                onOverride={() => handleOverride(pdo)}
                isOverriding={createMut.isPending}
              />
            ) : (
              <PdoCard
                key={pdo.id}
                pdo={pdo as any}
                allSignals={allSignals}
                onRefresh={handleRefresh}
              />
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="px-8 py-6 space-y-4">
      <div className="flex items-center justify-between max-w-5xl">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            PDO Configuration
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tpdos.length} TPDO{tpdos.length !== 1 ? "s" : ""} · {rpdos.length} RPDO{rpdos.length !== 1 ? "s" : ""}
            {hasParent && effectivePdos.some((p) => (p as any).inherited) && (
              <span className="ml-1">(includes inherited)</span>
            )}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add PDO
        </Button>
      </div>

      <div className="max-w-5xl space-y-6">
        {renderPdoGroup("TPDO — Device → PLC", tpdos)}
        {renderPdoGroup("RPDO — PLC → Device", rpdos)}

        {effectivePdos.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">
            No PDOs configured. Add TPDOs (device → PLC) and RPDOs (PLC → device) to define how signals are packed into CAN frames.
          </p>
        )}
      </div>

      {showCreate && (
        <PdoCreateDialog
          open
          onClose={() => setShowCreate(false)}
          componentId={componentId}
          existingPdos={effectivePdos.map((p) => ({ direction: p.direction, pdoNumber: p.pdoNumber }))}
          onCreated={handleRefresh}
        />
      )}
    </section>
  );
}

/** Read-only row for an inherited PDO with an "Override" button */
function InheritedPdoRow({
  pdo,
  onOverride,
  isOverriding,
}: {
  pdo: { direction: string; pdoNumber: number; cobId: number | null; description: string | null; sourceComponentName?: string; signals: any[] };
  onOverride: () => void;
  isOverriding: boolean;
}) {
  const totalBits = pdo.signals.reduce((sum: number, s: any) => sum + (s.bitLength ?? 0), 0);

  return (
    <div className="border rounded-md border-dashed opacity-80">
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="w-4" /> {/* spacer matching chevron */}
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono bg-muted text-muted-foreground border-muted-foreground/30">
          {pdo.direction} {pdo.pdoNumber}
        </Badge>
        <span className="text-xs text-muted-foreground font-mono">{formatHex(pdo.cobId)}</span>
        <span className="text-xs text-muted-foreground truncate flex-1">{pdo.description ?? ""}</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-600 border-blue-200">
          inherited{(pdo as any).sourceComponentName ? ` from ${(pdo as any).sourceComponentName}` : ""}
        </Badge>
        <span className="text-xs tabular-nums text-muted-foreground">{pdo.signals.length} signals · {Math.ceil(totalBits / 8)}/8 bytes</span>
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-[11px] px-2"
          onClick={onOverride}
          disabled={isOverriding}
        >
          <Copy className="h-3 w-3 mr-1" /> Override
        </Button>
      </div>
    </div>
  );
}
