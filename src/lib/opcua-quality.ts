/**
 * Classify an OPC UA StatusCode into one of three severity tiers.
 *
 * The top 2 bits of the 32-bit StatusCode encode severity:
 *   00 → Good       (0x0000_0000 – 0x3FFF_FFFF)
 *   01 → Uncertain  (0x4000_0000 – 0x7FFF_FFFF)
 *   10 → Bad        (0x8000_0000 – 0xBFFF_FFFF)
 *   11 → reserved   (treated as Bad)
 *
 * Use `>>> 30` to coerce to uint32 first so values like 0x80000000
 * classify correctly under JS's signed 32-bit number semantics.
 */
export type OpcQuality = "good" | "uncertain" | "bad";

export function qualityFromStatusCode(code: number | null | undefined): OpcQuality {
  if (code == null) return "bad";
  const sev = (code >>> 30) & 0b11;
  if (sev === 0) return "good";
  if (sev === 1) return "uncertain";
  return "bad";
}

/** Tailwind text color for a value rendered with the given quality. */
export function qualityTextClass(q: OpcQuality): string {
  if (q === "good") return "text-foreground";
  if (q === "uncertain") return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

/** Tailwind background color for a status dot. */
export function qualityDotClass(q: OpcQuality): string {
  if (q === "good") return "bg-green-500";
  if (q === "uncertain") return "bg-amber-500";
  return "bg-red-500";
}

/** Tailwind background color for a status badge / pill. */
export function qualityBadgeClass(q: OpcQuality): string {
  if (q === "good") return "bg-green-500/15 text-green-700 dark:text-green-400";
  if (q === "uncertain") return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return "bg-red-500/15 text-red-700 dark:text-red-400";
}
