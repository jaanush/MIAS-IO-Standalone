"use client";

import { useState } from "react";
import type { Plc, IoCard, Carrier, WagoFrontPanel } from "@/lib/types/hardware";
import { cn } from "@/lib/utils";

type Props = {
  /** Parent PLC. Required when no carrier is passed (rendered as the rack
   *  anchor). Optional when a carrier is passed — the carrier's coupler
   *  front-panel becomes the anchor instead of the PLC controller. */
  plc?: Plc | null;
  /** Single carrier to render. When set, only this carrier's cards are
   *  shown, anchored by the carrier's coupler image (or the PLC controller
   *  if `plc` is also passed and the carrier is the local-bus carrier). */
  carrier?: Carrier | null;
  /**
   * Pixel height of the strip rendering. Module images render at their natural
   * aspect ratio scaled to this height; widths come out proportional. Default
   * 180 — tall enough to read LED labels, short enough to fit above CardList.
   */
  height?: number;
};

/**
 * Visual rack strip — renders an anchor (PLC controller or coupler) + each
 * IO card front-panel image side-by-side at proportional sizes. Mirrors the
 * physical "front of the rack" view operators see at the cabinet.
 *
 * Data source: catalog.frontPanel JSON column on DeviceCatalog (controllers /
 * couplers) and ModuleCatalog (IO modules), populated by
 * `prisma/seed_wago_front_panels.ts` from local WAGO-IO-CHECK 3 imagery.
 *
 * Modes:
 *   <RackStripView plc={plc} />                — PLC controller anchor + ALL local carriers' cards (PlcDetail)
 *   <RackStripView carrier={c} />              — coupler anchor + that carrier's cards (CarrierDetail, remote)
 *   <RackStripView plc={plc} carrier={c} />    — coupler/PLC anchor + that carrier's cards (CarrierDetail, local)
 */
export function RackStripView({ plc, carrier, height = 180 }: Props) {
  const [zoom, setZoom] = useState<number>(height);

  // Card set: a single named carrier's cards, or all local carriers if only PLC is given.
  const carriers = carrier ? [carrier] : (plc?.carriers ?? []);
  const cards = carriers.flatMap((c) => [...c.cards].sort((a, b) => a.slotPosition - b.slotPosition));

  // Anchor: prefer carrier's catalog (coupler) when a carrier is named — that's
  // what's physically on the leftmost rail of the distributed-IO unit. Fall
  // back to PLC controller for the PLC-level view.
  const anchorIsCarrier = !!carrier && carrier.catalog != null;
  const anchorPanel = anchorIsCarrier
    ? ((carrier!.catalog as any)?.frontPanel as WagoFrontPanel | null | undefined)
    : ((plc?.catalog as any)?.frontPanel as WagoFrontPanel | null | undefined);
  const anchorLabel = anchorIsCarrier ? carrier!.name : (plc?.name ?? "");
  const anchorSublabel = anchorIsCarrier
    ? (carrier!.catalog?.articleNumber ?? null)
    : (plc?.catalog?.articleNumber ?? null);

  if (!anchorPanel?.image && cards.every((c) => !((c.catalog as any)?.frontPanel?.image))) {
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
          {/* Anchor (PLC controller or carrier coupler) */}
          <ModuleRender
            label={anchorLabel}
            sublabel={anchorSublabel}
            panel={anchorPanel ?? null}
            height={zoom}
          />
          {/* Visual gap between anchor and cards */}
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
