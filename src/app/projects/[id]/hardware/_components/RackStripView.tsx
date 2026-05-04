"use client";

import { useState } from "react";
import type { Plc, IoCard, Carrier, WagoFrontPanel } from "@/lib/types/hardware";
import { cn } from "@/lib/utils";

type Props = {
  plc: Plc;
  carrier?: Carrier | null;
  /**
   * Pixel height of the strip rendering. Module images render at their natural
   * aspect ratio scaled to this height; widths come out proportional. Default
   * 180 — tall enough to read LED labels, short enough to fit above CardList.
   */
  height?: number;
};

/**
 * Visual rack strip — renders the PLC controller + each IO card front-panel
 * image side-by-side at proportional sizes. Mirrors the physical "front of
 * the rack" view that operators see when standing at the cabinet.
 *
 * Data source: catalog.frontPanel JSON column on DeviceCatalog (controllers /
 * couplers) and ModuleCatalog (IO modules), populated by
 * `prisma/seed_wago_front_panels.ts` from local WAGO-IO-CHECK 3 imagery.
 *
 * If `carrier` is passed, only that carrier's cards are shown (with the
 * controller still rendered first as a visual anchor). Without `carrier`,
 * shows the controller + all local-bus carriers' cards in slot order.
 */
export function RackStripView({ plc, carrier, height = 180 }: Props) {
  const [zoom, setZoom] = useState<number>(height);

  // Build the ordered list: controller first, then either the named carrier's
  // cards or all local-bus carriers' cards.
  const carriers = carrier ? [carrier] : plc.carriers;
  const cards = carriers.flatMap((c) => [...c.cards].sort((a, b) => a.slotPosition - b.slotPosition));

  const controllerPanel = (plc.catalog as any)?.frontPanel as WagoFrontPanel | null | undefined;

  if (!controllerPanel?.image && cards.every((c) => !((c.catalog as any)?.frontPanel?.image))) {
    return null; // No imagery to render — silently hide the strip
  }

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Rack front view
        </span>
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-muted-foreground">Zoom</label>
          <input
            type="range"
            min={120}
            max={420}
            step={20}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1 w-32 cursor-pointer"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="flex items-end gap-px bg-neutral-900/5 dark:bg-neutral-100/5 rounded p-2 min-h-[100px]">
          {/* Controller anchor */}
          <ModuleRender
            label={plc.name}
            sublabel={plc.catalog?.articleNumber ?? null}
            panel={controllerPanel ?? null}
            height={zoom}
          />
          {/* Visual gap between controller and cards */}
          {cards.length > 0 && <div className="w-1" />}
          {cards.map((card) => (
            <ModuleRender
              key={card.id}
              label={`S${card.slotPosition + 1}`}
              sublabel={card.catalog?.articleNumber ?? null}
              panel={(card.catalog as any)?.frontPanel ?? null}
              height={zoom}
              cardType={card.cardType}
            />
          ))}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground italic">
        Renderings sourced from WAGO-IO-CHECK 3 local install. LED state shown
        is static (factory layout); live values not wired yet.
      </p>
    </div>
  );
}

function ModuleRender({
  label,
  sublabel,
  panel,
  height,
  cardType,
}: {
  label: string;
  sublabel: string | null;
  panel: WagoFrontPanel | null;
  height: number;
  cardType?: string;
}) {
  const img = panel?.image;
  if (!img) {
    // Fallback: small placeholder with article number text
    return (
      <div
        className="flex flex-col items-center justify-center bg-muted border rounded text-[10px] font-mono text-muted-foreground p-1 shrink-0"
        style={{ width: 40, height }}
        title={`${label} — ${sublabel ?? "no image"}${cardType ? ` (${cardType})` : ""}`}
      >
        <span className="opacity-50">{cardType ?? "?"}</span>
        <span className="text-[9px]">{sublabel ?? ""}</span>
      </div>
    );
  }

  // Scale to fixed height; width follows naturally
  const aspect = img.width / img.height;
  const renderedWidth = height * aspect;

  return (
    <div className="flex flex-col items-center shrink-0" title={`${label} — ${panel?.descriptions.en ?? sublabel}`}>
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.url}
          alt={panel?.descriptions.en ?? sublabel ?? label}
          width={renderedWidth}
          height={height}
          style={{ width: renderedWidth, height, imageRendering: "pixelated" }}
          className="object-contain"
          loading="lazy"
        />
      </div>
      <span className="text-[9px] font-mono text-muted-foreground mt-0.5">{label}</span>
      {sublabel && <span className="text-[9px] text-muted-foreground/60 -mt-0.5">{sublabel}</span>}
    </div>
  );
}
