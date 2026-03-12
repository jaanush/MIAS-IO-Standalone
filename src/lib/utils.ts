import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Build a WAGO wagoweb datasheet URL from an article number.
 * Pattern: https://www.wago.com/wagoweb/documentation/{series}/eng_dat/d0{series}{part4}_00000000_0en.pdf
 * Only works for WAGO 750/751/753/767 series articles.
 * Returns null for non-WAGO or unrecognized formats.
 */
export function wagoDatasheetUrl(articleNumber: string): string | null {
  // Strip variant suffix (e.g. "750-8212/025-000" → "750-8212")
  const base = articleNumber.split("/")[0];
  const match = base.match(/^(\d{3})-(\d+)$/);
  if (!match) return null;
  const series = match[1];
  const part = match[2];
  if (!["750", "751", "753", "767"].includes(series)) return null;
  const digits = `0${series}${part.padStart(4, "0")}`;
  return `https://www.wago.com/wagoweb/documentation/${series}/eng_dat/d${digits}_00000000_0en.pdf`;
}
