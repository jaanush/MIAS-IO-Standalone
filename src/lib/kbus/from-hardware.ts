// Bridge from the MIAS-IO hardware-tree types to the K-bus calculator input.
//
// Maps `vendorName` + `articleNumber` to the cost-table key (`wago:NNN-NNN`),
// resolves the 750-658 process-image-size from the bus the card hosts (the
// FR-020 `Bus.processImageBytes` field), and defaults the 750-658 operating
// mode to "Transparent" — that's the actual mode every current MIAS rack
// runs (per MIAS-ref `Techdata/PLC/wago_pfc200_kbus_capacity.md` §typical
// configuration), which surfaces the MODE_MULTIPLIER_MISSING warning until
// the upstream cost coefficient lands.

import type { Plc, Carrier, IoCard, Bus } from "@/lib/types/hardware";
import type { KbusInput, KbusModuleInput } from "./calculate";

export type KbusInputBuildResult =
  | { ok: true; input: KbusInput }
  | { ok: false; reason: KbusSkipReason };

export type KbusSkipReason =
  | "no-controller-catalog"
  | "no-local-carriers"
  | "no-cards";

/**
 * Build a calculator input for one PLC's local K-bus chain (every carrier
 * with `busId == null`, in slot order). Returns `{ ok: false }` for cases
 * where the calculator simply doesn't apply (no PFC catalog match, no local
 * I/O, etc.) so the caller can render an empty state without erroring.
 */
export function buildKbusInputForPlc(
  plc: Plc,
  /** Optional override of the configured K-bus cycle. Falls back to plc.kbusCycleTimeMs, then 10 ms. */
  cycleMsOverride?: number | null,
): KbusInputBuildResult {
  const controllerKey = catalogKey(plc.catalog);
  if (!controllerKey) return { ok: false, reason: "no-controller-catalog" };

  const localCarriers = plc.carriers.filter((c) => isLocalCarrier(c));
  if (localCarriers.length === 0) return { ok: false, reason: "no-local-carriers" };

  // Pre-build a card.id → Bus map so we can resolve 750-658 PI from the bus
  // the card hosts. The hardware tree carries every bus reachable from the
  // PLC under `plc.buses`.
  const cardToBus = new Map<number, Bus>();
  for (const bus of plc.buses ?? []) {
    if (bus.ioCardId != null) cardToBus.set(bus.ioCardId, bus);
  }

  const modules: KbusModuleInput[] = [];
  for (const carrier of localCarriers) {
    for (const card of carrier.cards) {
      const m = mapCardToModule(card, cardToBus);
      if (m) modules.push(m);
    }
  }

  if (modules.length === 0) return { ok: false, reason: "no-cards" };

  const cycleMs =
    cycleMsOverride ?? (plc as { kbusCycleTimeMs?: number | null }).kbusCycleTimeMs ?? 10;

  return {
    ok: true,
    input: {
      controller: controllerKey,
      kbus_cycle_ms: cycleMs,
      // Async is the WAGO factory default and what every MIAS PFC runs today.
      kbus_mode: "asynchronous",
      kbus_extension_hops: countExtensionHops(modules),
      modules,
      project_label: plc.name,
    },
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────

function isLocalCarrier(carrier: Carrier): boolean {
  // Local K-bus carrier = no upstream bus; remote couplers carry a busId.
  return carrier.busId == null;
}

function catalogKey(catalog: { articleNumber: string; vendorName: string } | null): string | null {
  if (!catalog) return null;
  const vendor = catalog.vendorName?.toLowerCase().trim();
  if (!vendor) return null;
  // Today the cost table only lists WAGO controllers/modules; if a project
  // uses a non-WAGO controller, the calculator emits CONTROLLER_NOT_IN_COST_TABLE.
  return `${vendor}:${catalog.articleNumber}`;
}

function mapCardToModule(card: IoCard, cardToBus: Map<number, Bus>): KbusModuleInput | null {
  const key = catalogKey(card.catalog);
  if (!key) return null;

  const m: KbusModuleInput = { part: key, slot: card.slotPosition + 1 };

  // 750-658 PI override comes from the bus the card hosts (FR-020).
  if (card.catalog?.articleNumber === "750-658") {
    const bus = cardToBus.get(card.id);
    const pi = (bus as { processImageBytes?: number | null } | undefined)?.processImageBytes;
    if (pi != null) m.process_image_bytes = pi;
    // Operating mode: MIAS racks today run Transparent. Surface the missing
    // multiplier explicitly via the calculator's MODE_MULTIPLIER_MISSING
    // warning rather than silently picking "Mapped".
    m.operating_mode = "Transparent";
  }

  return m;
}

function countExtensionHops(modules: KbusModuleInput[]): number {
  // 750-628 is the head of an extension segment; 750-627 is its tail.
  // Each pair = 1 hop; count the heads.
  return modules.filter((m) => m.part === "wago:750-628").length;
}
