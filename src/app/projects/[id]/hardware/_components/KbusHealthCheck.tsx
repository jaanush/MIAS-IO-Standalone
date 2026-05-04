"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Info, AlertTriangle, AlertOctagon, CheckCircle2 } from "lucide-react";
import type { Plc } from "@/lib/types/hardware";
import { calculateKbus, type KbusOutput, type KbusWarning } from "@/lib/kbus/calculate";
import { buildKbusInputForPlc } from "@/lib/kbus/from-hardware";

type Props = { plc: Plc };

/**
 * K-bus health check — shown on every local-carrier detail view. Aggregates
 * the entire local K-bus chain on the parent PLC (all carriers with
 * busId == null) and runs the TIER 1 cycle-time calculator. Warnings appear
 * inline; the per-module breakdown is collapsible.
 *
 * Calculator inputs and the cost table are owned by MIAS-ref; this component
 * is the UI surface only.
 */
export function KbusHealthCheck({ plc }: Props) {
  const result = useMemo(() => buildKbusInputForPlc(plc), [plc]);
  const output: KbusOutput | null = useMemo(
    () => (result.ok ? calculateKbus(result.input) : null),
    [result],
  );
  const [expanded, setExpanded] = useState(false);

  if (!result.ok) {
    return (
      <div className="space-y-1 rounded-md border border-dashed border-muted-foreground/30 px-3 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          <span>K-bus health check not applicable: {reasonLabel(result.reason)}</span>
        </div>
      </div>
    );
  }

  const o = output!;
  const computedMs = o.computed_min_cycle_us / 1000;
  const configuredMs = o.configured_cycle_us / 1000;
  const watchdogMs = (o.computed_min_cycle_us + o.headroom_to_watchdog_us) / 1000;

  const overallLevel = highestLevel(o.warnings);
  const headerStyle = levelStyles(overallLevel);
  const HeaderIcon = headerIcon(overallLevel);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        K-bus Health
      </h3>

      <div className={`rounded-md border ${headerStyle.border} ${headerStyle.bg}`}>
        {/* Header row */}
        <button
          className="flex w-full items-center justify-between px-3 py-2 text-left"
          onClick={() => setExpanded((e) => !e)}
        >
          <div className="flex items-center gap-2">
            <HeaderIcon className={`h-4 w-4 ${headerStyle.icon}`} />
            <span className={`text-sm font-medium ${headerStyle.text}`}>
              {overallLabel(overallLevel, o.warnings.length)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {computedMs.toFixed(2)} / {configuredMs.toFixed(0)} ms
            </span>
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </div>
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="space-y-3 border-t border-current/10 px-3 py-2">
            {/* Cycle-time bars */}
            <div className="space-y-1.5">
              <CycleBar
                label="Computed minimum"
                value={computedMs}
                limit={watchdogMs}
                tone={tone(overallLevel)}
              />
              <CycleBar
                label="Configured"
                value={configuredMs}
                limit={watchdogMs}
                tone="muted"
              />
              <CycleBar label="Output watchdog" value={watchdogMs} limit={watchdogMs} tone="muted" />
            </div>

            {/* Headroom badges */}
            <div className="flex flex-wrap gap-2 text-xs">
              <Headroom label="vs configured" us={o.headroom_to_configured_us} />
              <Headroom label="vs watchdog" us={o.headroom_to_watchdog_us} />
              <span className="text-muted-foreground">
                {o.module_breakdown.length} modules • {o.input_echo.kbus_extension_hops ?? 0} extension hops
              </span>
            </div>

            {/* Warnings list */}
            {o.warnings.length > 0 && (
              <ul className="space-y-1.5">
                {o.warnings.map((w, i) => (
                  <WarningRow key={i} w={w} />
                ))}
              </ul>
            )}

            {/* Per-module breakdown */}
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Per-module breakdown
              </summary>
              <table className="mt-1.5 w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-0.5 font-normal">Slot</th>
                    <th className="py-0.5 font-normal">Part</th>
                    <th className="py-0.5 font-normal text-right">µs</th>
                    <th className="py-0.5 font-normal text-right">DI/AI/AO</th>
                    <th className="py-0.5 font-normal">Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {o.module_breakdown.map((m, i) => (
                    <tr key={i} className="border-t border-border/40">
                      <td className="py-0.5 tabular-nums">{m.slot ?? "—"}</td>
                      <td className="py-0.5 font-mono">{m.part}</td>
                      <td className="py-0.5 text-right tabular-nums">
                        {m.us_contribution > 0 ? m.us_contribution.toFixed(0) : "—"}
                      </td>
                      <td className="py-0.5 text-right tabular-nums">
                        {m.n_DI || m.n_AI || m.n_AO
                          ? `${m.n_DI}/${m.n_AI}/${m.n_AO}`
                          : m.specialty_bytes != null
                          ? `${m.specialty_bytes} B`
                          : "—"}
                      </td>
                      <td className="py-0.5">
                        {m.operating_mode}
                        {m.mode_multiplier != null && m.mode_multiplier !== 1 && (
                          <span className="text-muted-foreground"> ×{m.mode_multiplier.toFixed(1)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>

            <p className="text-xs text-muted-foreground italic">
              {o.tier2_disclaimer}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function WarningRow({ w }: { w: KbusWarning }) {
  const Icon = headerIcon(w.level);
  const styles = levelStyles(w.level);
  return (
    <li className={`flex items-start gap-1.5 text-xs ${styles.text}`}>
      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${styles.icon}`} />
      <div>
        <span className="font-mono text-muted-foreground">[{w.code}]</span>{" "}
        <span>{w.message}</span>
      </div>
    </li>
  );
}

function CycleBar({
  label,
  value,
  limit,
  tone,
}: {
  label: string;
  value: number;
  limit: number;
  tone: "good" | "warn" | "error" | "muted";
}) {
  const pct = limit > 0 ? Math.min(100, (value / limit) * 100) : 0;
  const barColor = {
    good: "bg-emerald-500/60",
    warn: "bg-amber-500/60",
    error: "bg-destructive/70",
    muted: "bg-muted-foreground/30",
  }[tone];
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{value.toFixed(2)} ms</span>
      </div>
      <div className="h-1 w-full rounded bg-muted/40">
        <div className={`h-1 rounded ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Headroom({ label, us }: { label: string; us: number }) {
  const ms = us / 1000;
  const negative = us < 0;
  const cls = negative
    ? "border-destructive/40 bg-destructive/10 text-destructive"
    : ms < 1
    ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs tabular-nums ${cls}`}>
      {label}: {negative ? "" : "+"}
      {ms.toFixed(2)} ms
    </span>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────

function highestLevel(warnings: KbusWarning[]): "info" | "warn" | "error" {
  if (warnings.some((w) => w.level === "error")) return "error";
  if (warnings.some((w) => w.level === "warn")) return "warn";
  return "info";
}

function levelStyles(level: "info" | "warn" | "error") {
  switch (level) {
    case "error":
      return {
        border: "border-destructive/40",
        bg: "bg-destructive/5",
        text: "text-destructive",
        icon: "text-destructive",
      };
    case "warn":
      return {
        border: "border-amber-500/40",
        bg: "bg-amber-500/5",
        text: "text-amber-700 dark:text-amber-300",
        icon: "text-amber-500",
      };
    default:
      return {
        border: "border-emerald-500/40",
        bg: "bg-emerald-500/5",
        text: "text-emerald-700 dark:text-emerald-300",
        icon: "text-emerald-500",
      };
  }
}

function tone(level: "info" | "warn" | "error"): "good" | "warn" | "error" {
  return level === "info" ? "good" : level;
}

function headerIcon(level: "info" | "warn" | "error") {
  return level === "error" ? AlertOctagon : level === "warn" ? AlertTriangle : CheckCircle2;
}

function overallLabel(level: "info" | "warn" | "error", count: number): string {
  if (level === "error") return `K-bus violation (${count} issue${count === 1 ? "" : "s"})`;
  if (level === "warn") return `K-bus warning (${count} issue${count === 1 ? "" : "s"})`;
  return "K-bus chain healthy";
}

function reasonLabel(r: "no-controller-catalog" | "no-local-carriers" | "no-cards"): string {
  switch (r) {
    case "no-controller-catalog":
      return "no PLC catalog match (cost table only knows WAGO PFC controllers)";
    case "no-local-carriers":
      return "no local I/O carriers on this PLC";
    case "no-cards":
      return "no I/O modules configured yet";
  }
}
