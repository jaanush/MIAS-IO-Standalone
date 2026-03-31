"use client";

import { useState, useRef, useMemo } from "react";
import { trpc } from "@/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ExternalLink, GripVertical, Zap, AlertTriangle } from "lucide-react";
import { ModulePickerDialog } from "./ModulePickerDialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, wagoDatasheetUrl } from "@/lib/utils";
import type { IoCard } from "@/lib/types/hardware";

type Props = {
  carrierId: number;
  projectId: number;
  maxSlots: number | null;
  cards: IoCard[];
  onRefresh: () => void;
};

const CARD_TYPE_COLORS: Record<string, string> = {
  DI: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300",
  DO: "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300",
  AI: "bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-300",
  AO: "bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-300",
  MIXED: "bg-yellow-50 border-yellow-200 text-yellow-800",
  RELAY: "bg-red-50 border-red-200 text-red-800",
  SUPPLY: "bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-900/30 dark:border-gray-700 dark:text-gray-400",
  COUNTER: "bg-teal-50 border-teal-200 text-teal-800",
  PWM: "bg-indigo-50 border-indigo-200 text-indigo-800",
  SERIAL: "bg-pink-50 border-pink-200 text-pink-800 dark:bg-pink-950/30 dark:border-pink-800 dark:text-pink-300",
  IO_LINK: "bg-cyan-50 border-cyan-200 text-cyan-800",
};

function SubgroupHeader({ sg, cards, onAddModule, onDrop }: { sg: string; cards: IoCard[]; onAddModule: () => void; onDrop: () => void }) {
  const supplyCards = cards.filter((c) => c.cardType === "SUPPLY");
  const consumerCards = cards.filter((c) => c.cardType !== "SUPPLY");

  const totalDrawMa = consumerCards.reduce((sum, c) => sum + (c.catalog?.busCurrentConsumptionMa ?? 0), 0);
  // Supply cards also draw from bus but provide field power — show their draw separately
  const supplyDrawMa = supplyCards.reduce((sum, c) => sum + (c.catalog?.busCurrentConsumptionMa ?? 0), 0);
  const totalBusDrawMa = totalDrawMa + supplyDrawMa;

  // Count card types in this subgroup
  const typeCounts = new Map<string, number>();
  for (const c of cards) {
    const t = c.cardType;
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  }

  return (
    <div
      className="rounded-t-md border border-b-0 bg-muted/60 px-3 py-1.5 flex items-center gap-3 transition-colors"
      onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add("!bg-primary/20"); }}
      onDragLeave={(e) => { (e.currentTarget as HTMLElement).classList.remove("!bg-primary/20"); }}
      onDrop={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).classList.remove("!bg-primary/20"); onDrop(); }}
    >
      <span className="text-xs font-bold uppercase tracking-widest">Group {sg}</span>
      <span className="text-[10px] text-muted-foreground">
        {cards.length} card{cards.length !== 1 ? "s" : ""}
      </span>
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        {[...typeCounts.entries()].map(([type, count]) => (
          <Badge key={type} variant="outline" className="text-[9px] px-1 py-0 font-normal border-muted-foreground/30">
            {type} {count}
          </Badge>
        ))}
      </div>
      <span className="flex-1" />
      {totalBusDrawMa > 0 && (
        <span className="flex items-center gap-1 text-[10px] tabular-nums text-muted-foreground" title="Total bus current consumption">
          <Zap className="h-3 w-3" />
          {totalBusDrawMa} mA
        </span>
      )}
      <button
        type="button"
        className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        onClick={onAddModule}
      >
        <Plus className="h-3 w-3" /> Module
      </button>
    </div>
  );
}

export function CardList({ carrierId, projectId, maxSlots, cards, onRefresh }: Props) {
  const [confirmProps, confirmAction] = useConfirm();
  const [pickerSubgroup, setPickerSubgroup] = useState<string | null>(null);
  const dragIdRef = useRef<number | null>(null);
  const utils = trpc.useUtils();

  const deleteCard = trpc.projectHardware.cardDelete.useMutation({ onSuccess: onRefresh });
  const reorderCards = trpc.projectHardware.cardReorder.useMutation({ onSuccess: onRefresh });
  const updateCard = trpc.projectHardware.cardUpdate.useMutation({ onSuccess: onRefresh });
  const moveSubgroup = trpc.projectHardware.cardMoveSubgroup.useMutation({ onSuccess: onRefresh });

  const { data: typeCodes = [], isLoading: typeCodesLoading } = trpc.hardware.moduleTypeCodeList.useQuery();

  const sortedCards = [...cards].sort((a, b) => a.slotPosition - b.slotPosition);

  // Group cards by subgroup letter
  const subgroups = useMemo(() => {
    const map = new Map<string, IoCard[]>();
    for (const card of sortedCards) {
      const sg = card.subgroup ?? "A";
      const arr = map.get(sg);
      if (arr) arr.push(card); else map.set(sg, [card]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [sortedCards]);

  function handleDrop(targetId: number) {
    const fromId = dragIdRef.current;
    if (!fromId || fromId === targetId) return;

    const fromCard = sortedCards.find((c) => c.id === fromId);
    const targetCard = sortedCards.find((c) => c.id === targetId);
    if (!fromCard || !targetCard) return;

    const fromSg = fromCard.subgroup ?? "A";
    const targetSg = targetCard.subgroup ?? "A";

    if (fromSg !== targetSg) {
      // Cross-subgroup move — server handles instance renumbering
      moveSubgroup.mutate({ id: fromId, targetSubgroup: targetSg });
    } else {
      // Same subgroup — just reorder
      const oldIndex = sortedCards.indexOf(fromCard);
      const newIndex = sortedCards.indexOf(targetCard);
      const reordered = [...sortedCards];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);
      reorderCards.mutate({
        carrierId,
        cardOrder: reordered.map((c, i) => ({ id: c.id, slotPosition: i })),
      });
    }
  }

  function handleDropOnHeader(targetSg: string) {
    const fromId = dragIdRef.current;
    if (!fromId) return;
    const fromCard = sortedCards.find((c) => c.id === fromId);
    if (!fromCard) return;
    const fromSg = fromCard.subgroup ?? "A";
    if (fromSg === targetSg) return;
    moveSubgroup.mutate({ id: fromId, targetSubgroup: targetSg });
  }

  const nextSlotPosition = sortedCards.length > 0 ? Math.max(...sortedCards.map((c) => c.slotPosition)) + 1 : 0;

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            I/O Modules — {cards.length} card{cards.length !== 1 ? "s" : ""}
          </span>
        </div>

        {subgroups.length > 0 ? (
          <div className="space-y-4">
            {subgroups.map(([sg, sgCards]) => (
              <div key={sg}>
                <SubgroupHeader sg={sg} cards={sgCards} onAddModule={() => setPickerSubgroup(sg)} onDrop={() => handleDropOnHeader(sg)} />
                <div className="border border-t-0 rounded-b-md divide-y divide-border/50">
                  {sgCards.map((card) => {
                    const colorClass = CARD_TYPE_COLORS[card.catalog?.cardType ?? card.cardType] ?? "";
                    const validCodes = typeCodes.filter((t) => t.cardType === card.cardType);
                    const drawMa = card.catalog?.busCurrentConsumptionMa;
                    const missingCode = !card.typeCode;

                    return (
                      <div
                        key={card.id}
                        draggable
                        onDragStart={(e) => { dragIdRef.current = card.id; e.dataTransfer.effectAllowed = "move"; (e.currentTarget as HTMLElement).style.opacity = "0.4"; }}
                        onDragEnd={(e) => { (e.currentTarget as HTMLElement).style.opacity = ""; dragIdRef.current = null; }}
                        onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add("!bg-primary/10"); }}
                        onDragLeave={(e) => { (e.currentTarget as HTMLElement).classList.remove("!bg-primary/10"); }}
                        onDrop={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).classList.remove("!bg-primary/10"); handleDrop(card.id); }}
                        className={cn("flex items-center gap-2 px-2 py-1.5 text-sm cursor-grab active:cursor-grabbing", colorClass)}
                      >
                        <GripVertical className="h-3.5 w-3.5 shrink-0 opacity-40" />

                        {/* Identifier: subgroup + type code + instance */}
                        <div className="flex items-center gap-0.5 shrink-0 w-20">
                          <span className="text-xs font-mono font-bold opacity-50">{card.subgroup ?? ""}</span>
                          <div onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={card.typeCode ?? ""}
                              disabled={typeCodesLoading}
                              onValueChange={(v) => { if (v) updateCard.mutate({ id: card.id, typeCode: v }); }}
                            >
                              <SelectTrigger className="h-6 w-10 text-xs font-mono font-bold">
                                <SelectValue placeholder="-" />
                              </SelectTrigger>
                              <SelectContent>
                                {validCodes.length > 0 ? (
                                  validCodes.map((tc) => (
                                    <SelectItem key={tc.code} value={tc.code}>{tc.code}</SelectItem>
                                  ))
                                ) : (
                                  card.typeCode && <SelectItem value={card.typeCode}>{card.typeCode}</SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <Input
                            type="number"
                            min={1}
                            max={99}
                            className="h-6 w-10 text-xs font-mono text-center px-0.5 border-current/20 bg-transparent"
                            value={card.instanceNumber ?? ""}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (!isNaN(v) && v >= 1 && v <= 99) updateCard.mutate({ id: card.id, instanceNumber: v });
                            }}
                          />
                        </div>

                        {/* Missing type code warning */}
                        {missingCode && (
                          <span title={`No type code — add one for ${card.cardType} in Misc > Module Type Codes`} className="text-amber-500 shrink-0">
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </span>
                        )}

                        {/* Article number */}
                        <span className="font-mono font-semibold truncate text-xs">
                          {card.catalog?.articleNumber ?? card.cardType}
                        </span>

                        {/* Card type badge */}
                        <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0 border-current/30">
                          {card.cardType}
                        </Badge>

                        {/* Channel counts */}
                        <span className="text-[10px] opacity-70 shrink-0">
                          {card.catalog?.maxInputChannels != null && `↓${card.catalog.maxInputChannels}`}
                          {card.catalog?.maxOutputChannels != null && ` ↑${card.catalog.maxOutputChannels}`}
                        </span>

                        {/* Short description */}
                        {card.catalog?.description && (
                          <span className="text-[10px] opacity-50 truncate max-w-[200px]" title={card.catalog.description}>
                            {card.catalog.description}
                          </span>
                        )}

                        <span className="flex-1" />

                        {/* Bus current draw */}
                        {drawMa != null && drawMa > 0 && (
                          <span className="text-[10px] tabular-nums opacity-50 shrink-0">{drawMa}mA</span>
                        )}

                        {/* Slot position (informational) */}
                        <span className="text-[10px] opacity-30 shrink-0">S{card.slotPosition + 1}</span>

                        {/* Datasheet */}
                        {card.catalog && wagoDatasheetUrl(card.catalog.articleNumber) && (
                          <a
                            href={wagoDatasheetUrl(card.catalog.articleNumber)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="opacity-40 hover:opacity-70"
                            title="Datasheet"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}

                        {/* Remove */}
                        <button
                          type="button"
                          className="opacity-40 hover:text-destructive hover:opacity-100 shrink-0"
                          title="Remove module"
                          onClick={(e) => { e.stopPropagation(); confirmAction("Remove this module?", () => deleteCard.mutate({ id: card.id })); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-4 text-center">No modules assigned yet.</p>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            // Next subgroup letter: find highest existing and increment
            const existing = subgroups.map(([sg]) => sg).filter((s) => /^[A-Z]$/.test(s));
            const next = existing.length > 0
              ? String.fromCharCode(Math.max(...existing.map((s) => s.charCodeAt(0))) + 1)
              : "A";
            setPickerSubgroup(next);
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Group
        </Button>
      </div>

      {pickerSubgroup !== null && (
        <ModulePickerDialog
          projectId={projectId}
          carrierId={carrierId}
          slotPosition={nextSlotPosition}
          subgroup={pickerSubgroup}
          open
          onClose={() => setPickerSubgroup(null)}
          onAssigned={() => {
            onRefresh();
            utils.projectHardware.getHardware.invalidate();
          }}
        />
      )}
      <ConfirmDialog {...confirmProps} confirmLabel="Delete" />
    </>
  );
}
