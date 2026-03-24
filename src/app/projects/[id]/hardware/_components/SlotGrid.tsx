"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { ModulePickerDialog } from "./ModulePickerDialog";
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
  DI: "bg-blue-50 border-blue-200 text-blue-800",
  DO: "bg-green-50 border-green-200 text-green-800",
  AI: "bg-purple-50 border-purple-200 text-purple-800",
  AO: "bg-orange-50 border-orange-200 text-orange-800",
  MIXED: "bg-yellow-50 border-yellow-200 text-yellow-800",
  RELAY: "bg-red-50 border-red-200 text-red-800",
  SUPPLY: "bg-gray-50 border-gray-200 text-gray-700",
  COUNTER: "bg-teal-50 border-teal-200 text-teal-800",
  PWM: "bg-indigo-50 border-indigo-200 text-indigo-800",
  SERIAL: "bg-pink-50 border-pink-200 text-pink-800",
  IO_LINK: "bg-cyan-50 border-cyan-200 text-cyan-800",
};

export function SlotGrid({ carrierId, projectId, maxSlots, cards, onRefresh }: Props) {
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const deleteCard = trpc.projectHardware.cardDelete.useMutation({ onSuccess: onRefresh });

  const slotCount = maxSlots ?? Math.max(8, (cards.length > 0 ? Math.max(...cards.map((c) => c.slotPosition)) + 1 : 0));

  const cardsBySlot = new Map(cards.map((c) => [c.slotPosition, c]));

  return (
    <>
      <div className="space-y-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            Slot Grid — {slotCount} slots
          </span>
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
          {Array.from({ length: slotCount }, (_, i) => {
            const card = cardsBySlot.get(i);

            if (!card) {
              return (
                <button
                  key={i}
                  type="button"
                  className="relative flex flex-col items-center justify-center rounded-md border border-dashed border-input h-20 text-muted-foreground hover:border-foreground hover:text-foreground hover:bg-accent/30 transition-colors group"
                  onClick={() => setPickerSlot(i)}
                >
                  <Plus className="h-4 w-4 mb-0.5" />
                  <span className="text-xs">Slot {i + 1}</span>
                </button>
              );
            }

            const colorClass = CARD_TYPE_COLORS[card.catalog?.cardType ?? card.cardType] ?? "bg-gray-50 border-gray-200";

            return (
              <div
                key={i}
                className={cn(
                  "relative flex flex-col rounded-md border h-20 p-2 text-xs",
                  colorClass,
                )}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="font-mono font-semibold truncate">
                    {card.catalog?.articleNumber ?? card.cardType}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0 border-current">
                    {i + 1}
                  </Badge>
                </div>
                <span className="text-[10px] opacity-70 truncate">{card.catalog?.vendorName}</span>
                <div className="flex items-center gap-1 mt-auto text-[10px] opacity-70">
                  {card.catalog?.maxInputChannels != null && <span>↓{card.catalog.maxInputChannels}</span>}
                  {card.catalog?.maxOutputChannels != null && <span>↑{card.catalog.maxOutputChannels}</span>}
                  {card.name && <span className="truncate ml-auto italic">{card.name}</span>}
                </div>

                {/* Hover actions */}
                <div className="absolute inset-0 flex items-center justify-center gap-1 rounded-md bg-background/80 opacity-0 hover:opacity-100 transition-opacity">
                  {card.catalog && wagoDatasheetUrl(card.catalog.articleNumber) && (
                    <a
                      href={wagoDatasheetUrl(card.catalog.articleNumber)!}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="outline" className="h-7 text-xs">
                        <ExternalLink className="h-3 w-3 mr-1" /> Datasheet
                      </Button>
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs"
                    onClick={() => {
                      if (confirm("Remove this module?")) deleteCard.mutate({ id: card.id });
                    }}
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Remove
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {pickerSlot !== null && (
        <ModulePickerDialog
          projectId={projectId}
          carrierId={carrierId}
          slotPosition={pickerSlot}
          open
          onClose={() => setPickerSlot(null)}
          onAssigned={() => {
            onRefresh();
            utils.projectHardware.getHardware.invalidate();
          }}
        />
      )}
    </>
  );
}
