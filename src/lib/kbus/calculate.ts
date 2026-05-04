// K-bus capacity calculator (TIER 1: cycle-time math).
//
// Implements the Beckhoff formula
//   T_cyc_us = N_cycles × (600 + N_DI × 2.5 + N_AI × 32 + N_AO × 42)
// summed across modules, with per-module operating-mode multipliers.
//
// Cost table + schemas live in MIAS-ref:
//   docs/schemas/kbus-calc-{input,output}.schema.json
//   docs/databases/wago/kbus_module_costs.json   (copied to data/kbus/)
//
// TIER 2 (CPU-load prediction) is left as a `null` field on the output;
// MIAS-ref will fill it in once empirical data closes the open NOTIFs.

import costsJson from "../../../data/kbus/kbus_module_costs.json";

// ── Cost table types ──────────────────────────────────────────────────────

type ControllerCost = {
  kind: "controller";
  label: string;
  kbus_cycle_ms_min: number;
  kbus_cycle_ms_default: number;
  kbus_cycle_ms_max: number;
  output_watchdog_ms: number;
  io_modules_max_per_node: number;
  io_modules_max_per_node_with_extension: number;
};

type ModeMultiplier = { value: number | null; source: string };

type ModuleCost = {
  kind: "digital" | "analog_in" | "analog_out" | "specialty_mailbox" | "specialty_serial";
  label: string;
  channels_di?: number;
  channels_ai?: number;
  channels_ao?: number;
  channels_do?: number;
  process_image_bytes?:
    | number
    | {
        options?: number[];
        default_documented?: number | null;
        convention_used_by_mias?: number;
      };
  mailbox_window_bytes?: { options: number[]; convention_used_by_mias: number };
  operating_modes?: string[];
  operating_mode_multipliers?: Record<string, ModeMultiplier>;
  n_cycles_required: number;
  byte_cost_us?: number | null;
  byte_cost_us_note?: string;
};

type CostTable = {
  formula: { name: string; expression_us: string; precision: string };
  controllers: Record<string, ControllerCost>;
  modules: Record<string, ModuleCost>;
  extension_modules: Record<string, { kbus_cost_us: number; label: string }>;
};

const COSTS = costsJson as unknown as CostTable;

// First-cut placeholder for specialty modules (PI > 6 B) when the cost table
// hasn't published a per-byte coefficient yet. Conservative — see
// `byte_cost_us_note` on each specialty module entry.
const SPECIALTY_BYTE_COST_US_PLACEHOLDER = 100;

// ── Public input/output types (match MIAS-ref schemas) ────────────────────

export type KbusModuleInput = {
  /** wago:NNN-NNN form. Must resolve in COSTS.modules or COSTS.extension_modules. */
  part: string;
  slot?: number;
  /** Override for configurable PI size (required for parts with no documented default). */
  process_image_bytes?: number;
  /** 750-658 only. */
  mailbox_window_bytes?: number;
  /** 750-658 only. Mapped / Sniffer / Transparent. */
  operating_mode?: string;
};

export type KbusInput = {
  controller: string;
  kbus_cycle_ms: number;
  kbus_mode?: "asynchronous" | "synchronous";
  kbus_extension_hops?: number;
  modules: KbusModuleInput[];
  project_label?: string;
};

export type KbusWarningLevel = "info" | "warn" | "error";

export type KbusWarning = {
  level: KbusWarningLevel;
  code: string;
  message: string;
  context?: Record<string, unknown>;
};

export type KbusModuleBreakdown = {
  part: string;
  slot: number | null;
  n_cycles: number;
  n_DI: number;
  n_AI: number;
  n_AO: number;
  specialty_bytes: number | null;
  operating_mode: string | null;
  mode_multiplier: number | null;
  us_contribution: number;
};

export type KbusOutput = {
  computed_min_cycle_us: number;
  configured_cycle_us: number;
  headroom_to_configured_us: number;
  headroom_to_watchdog_us: number;
  warnings: KbusWarning[];
  module_breakdown: KbusModuleBreakdown[];
  tier2_estimated_kbus_cpu_pct: number | null;
  tier2_disclaimer: string;
  /** The input as resolved (defaults filled in, overrides applied). */
  input_echo: KbusInput;
};

// ── Calculator ────────────────────────────────────────────────────────────

export function calculateKbus(input: KbusInput): KbusOutput {
  const warnings: KbusWarning[] = [];
  const breakdown: KbusModuleBreakdown[] = [];

  const controller = COSTS.controllers[input.controller];
  if (!controller) {
    return {
      computed_min_cycle_us: 0,
      configured_cycle_us: input.kbus_cycle_ms * 1000,
      headroom_to_configured_us: input.kbus_cycle_ms * 1000,
      headroom_to_watchdog_us: 100_000 - 0,
      warnings: [
        {
          level: "error",
          code: "CONTROLLER_NOT_IN_COST_TABLE",
          message: `Controller part '${input.controller}' is not in the K-bus cost table. Add it to MIAS-ref/docs/databases/wago/kbus_module_costs.json.`,
          context: { controller: input.controller },
        },
      ],
      module_breakdown: [],
      tier2_estimated_kbus_cpu_pct: null,
      tier2_disclaimer: "Controller unknown — cannot compute.",
      input_echo: input,
    };
  }

  // Validate cycle-ms range against controller bounds.
  if (
    input.kbus_cycle_ms < controller.kbus_cycle_ms_min ||
    input.kbus_cycle_ms > controller.kbus_cycle_ms_max
  ) {
    warnings.push({
      level: "warn",
      code: "CYCLE_OUT_OF_RANGE",
      message: `Configured K-bus cycle (${input.kbus_cycle_ms} ms) is outside the controller's documented range (${controller.kbus_cycle_ms_min}..${controller.kbus_cycle_ms_max} ms).`,
      context: {
        configured: input.kbus_cycle_ms,
        min: controller.kbus_cycle_ms_min,
        max: controller.kbus_cycle_ms_max,
      },
    });
  }

  // Module-count limits (the calculator counts non-extension modules; extension
  // pairs only multiply the allowed total, they don't contribute themselves).
  const moduleCount = input.modules.filter(
    (m) => !COSTS.extension_modules[m.part],
  ).length;
  const extHops = input.kbus_extension_hops ?? 0;
  const maxAllowed =
    extHops > 0
      ? controller.io_modules_max_per_node_with_extension
      : controller.io_modules_max_per_node;
  if (moduleCount > maxAllowed) {
    warnings.push({
      level: "error",
      code: "MODULE_LIMIT_EXCEEDED",
      message: `${moduleCount} modules exceeds the controller limit of ${maxAllowed} (${
        extHops > 0 ? "with extension" : "without extension"
      }).`,
      context: { count: moduleCount, limit: maxAllowed, extensionHops: extHops },
    });
  }

  // First pass: any module on the chain with > 6 B PI forces N_cycles ≥ 2 for
  // every other module too, per Beckhoff. Compute N_cycles globally.
  let nCyclesGlobal = 1;
  for (const m of input.modules) {
    const cost = COSTS.modules[m.part];
    if (!cost) continue; // handled in pass 2
    const pi = resolvePi(cost, m);
    const need = cost.n_cycles_required ?? (pi > 6 ? 2 : 1);
    if (need > nCyclesGlobal) nCyclesGlobal = need;
  }

  // Pass 2: per-module channel/byte cost. The Beckhoff formula is
  //   T_cyc_us = N_cycles × (600 + Σ_modules channel_or_byte_cost × multiplier)
  // i.e. the 600 µs base is paid ONCE per traversal (it's the bus-protocol
  // overhead for one K-bus cycle), and we sum the channel costs over the
  // whole chain. Multipliers (e.g. for 750-658 in Transparent mode) scale
  // only the affected module's channel/byte cost — they don't multiply the
  // bus-level 600 µs.
  let chainChannelUs = 0;
  for (const m of input.modules) {
    if (COSTS.extension_modules[m.part]) {
      breakdown.push({
        part: m.part,
        slot: m.slot ?? null,
        n_cycles: 0,
        n_DI: 0,
        n_AI: 0,
        n_AO: 0,
        specialty_bytes: null,
        operating_mode: null,
        mode_multiplier: 0,
        us_contribution: 0,
      });
      continue;
    }
    const cost = COSTS.modules[m.part];
    if (!cost) {
      warnings.push({
        level: "warn",
        code: "MODULE_NOT_IN_COST_TABLE",
        message: `Module '${m.part}' is not in the K-bus cost table — its contribution is excluded from the cycle-time estimate. Add it to MIAS-ref upstream.`,
        context: { part: m.part, slot: m.slot ?? null },
      });
      breakdown.push({
        part: m.part,
        slot: m.slot ?? null,
        n_cycles: 0,
        n_DI: 0,
        n_AI: 0,
        n_AO: 0,
        specialty_bytes: null,
        operating_mode: null,
        mode_multiplier: null,
        us_contribution: 0,
      });
      continue;
    }

    const nDI = cost.channels_di ?? 0;
    const nAI = cost.channels_ai ?? 0;
    const nAO = cost.channels_ao ?? 0;
    const pi = resolvePi(cost, m);

    // Operating-mode multiplier (specialty modules with multiple modes).
    let multiplier = 1.0;
    let modeUsed: string | null = null;
    if (cost.operating_mode_multipliers) {
      modeUsed = m.operating_mode ?? defaultMode(cost);
      const mm = cost.operating_mode_multipliers[modeUsed];
      if (!mm) {
        warnings.push({
          level: "warn",
          code: "OPERATING_MODE_UNKNOWN",
          message: `Operating mode '${modeUsed}' for '${m.part}' is not in the cost table.`,
          context: { part: m.part, slot: m.slot ?? null, mode: modeUsed },
        });
      } else if (mm.value == null) {
        warnings.push({
          level: "warn",
          code: "MODE_MULTIPLIER_MISSING",
          message: `'${m.part}' is in '${modeUsed}' mode but the K-bus cost multiplier is not yet quantified upstream. Cycle-time estimate is optimistic — treat with caution.`,
          context: { part: m.part, slot: m.slot ?? null, mode: modeUsed, source: mm.source },
        });
        // Conservative: still include the module at multiplier 1.0 so it isn't
        // silently zero. The warning makes the optimism explicit.
      } else {
        multiplier = mm.value;
      }
    }

    // Per-cycle channel/byte cost for this module.
    let perCycleUs = 0;
    let specialtyBytes: number | null = null;
    if (cost.kind === "digital" || cost.kind === "analog_in" || cost.kind === "analog_out") {
      perCycleUs = nDI * 2.5 + nAI * 32 + nAO * 42;
    } else if (cost.kind === "specialty_mailbox" || cost.kind === "specialty_serial") {
      // Specialty modules don't decompose into channels — fall back to a
      // per-byte placeholder for PI > 6 B until upstream publishes
      // authoritative coefficients.
      specialtyBytes = pi;
      const byteCost = cost.byte_cost_us ?? SPECIALTY_BYTE_COST_US_PLACEHOLDER;
      perCycleUs = pi > 6 ? pi * byteCost : 0;
    }

    const moduleChainContribUs = perCycleUs * multiplier;
    chainChannelUs += moduleChainContribUs;

    breakdown.push({
      part: m.part,
      slot: m.slot ?? null,
      n_cycles: nCyclesGlobal,
      n_DI: nDI,
      n_AI: nAI,
      n_AO: nAO,
      specialty_bytes: specialtyBytes,
      operating_mode: modeUsed,
      mode_multiplier: multiplier,
      // This module's own contribution to T_cyc — its channel cost
      // accounting for N_cycles and its mode multiplier. Does NOT include
      // any share of the 600 µs traversal overhead, which is bus-level.
      us_contribution: nCyclesGlobal * moduleChainContribUs,
    });
  }

  // Apply the canonical Beckhoff formula. 600 µs is per-cycle (paid once
  // per traversal), the channel-cost sum is the chain-wide aggregate.
  const totalUs = nCyclesGlobal * (600 + chainChannelUs);

  const configuredUs = input.kbus_cycle_ms * 1000;
  const watchdogUs = controller.output_watchdog_ms * 1000;

  const headroomToConfigured = configuredUs - totalUs;
  const headroomToWatchdog = watchdogUs - totalUs;

  if (headroomToConfigured < 0) {
    warnings.push({
      level: "warn",
      code: "CYCLE_INEFFECTIVE",
      message: `Computed minimum cycle (${(totalUs / 1000).toFixed(2)} ms) exceeds configured cycle (${input.kbus_cycle_ms} ms). The bus runs flat-out at T_cyc_min and the configured value is ineffective.`,
      context: {
        computed_us: totalUs,
        configured_us: configuredUs,
        deficit_us: -headroomToConfigured,
      },
    });
  }
  if (headroomToWatchdog < 0) {
    warnings.push({
      level: "error",
      code: "WATCHDOG_VIOLATION",
      message: `Computed minimum cycle (${(totalUs / 1000).toFixed(2)} ms) exceeds the output watchdog (${controller.output_watchdog_ms} ms). Outputs will fault on every cycle.`,
      context: {
        computed_us: totalUs,
        watchdog_us: watchdogUs,
        deficit_us: -headroomToWatchdog,
      },
    });
  }

  return {
    computed_min_cycle_us: totalUs,
    configured_cycle_us: configuredUs,
    headroom_to_configured_us: headroomToConfigured,
    headroom_to_watchdog_us: headroomToWatchdog,
    warnings,
    module_breakdown: breakdown,
    tier2_estimated_kbus_cpu_pct: null,
    tier2_disclaimer:
      "TIER 2 CPU-load prediction is gated on more empirical data — see open NOTIFs in MIAS-ref. The TIER 1 cycle-time bound above is precise to ~10% per Beckhoff (specialty modules use a placeholder per-byte cost; warnings flag this).",
    input_echo: input,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function resolvePi(cost: ModuleCost, m: KbusModuleInput): number {
  const pi = cost.process_image_bytes;
  if (typeof pi === "number") return pi;
  if (m.process_image_bytes != null) {
    if (pi?.options && !pi.options.includes(m.process_image_bytes)) {
      // Caller should validate; calculator uses the value verbatim and
      // reports the issue once during the upstream validation pass.
    }
    return m.process_image_bytes;
  }
  if (pi?.default_documented != null) return pi.default_documented;
  if (pi?.convention_used_by_mias != null) return pi.convention_used_by_mias;
  return 0;
}

function defaultMode(cost: ModuleCost): string {
  // Prefer "Mapped" if present (cheapest), otherwise the first operating mode.
  if (cost.operating_modes?.includes("Mapped")) return "Mapped";
  return cost.operating_modes?.[0] ?? "default";
}
