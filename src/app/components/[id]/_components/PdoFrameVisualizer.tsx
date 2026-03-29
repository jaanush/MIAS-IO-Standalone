"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type MappedSignal = {
  tagSuffix: string | null;
  bitOffset: number;
  bitLength: number;
  canopenIndex: number | null;
  canopenSubIndex: number | null;
};

type Props = {
  signals: MappedSignal[];
  /** Total frame bits — 64 for classic CAN, 512 for CAN FD */
  frameBits?: number;
};

const COLORS = [
  "bg-blue-500/70",
  "bg-emerald-500/70",
  "bg-amber-500/70",
  "bg-purple-500/70",
  "bg-rose-500/70",
  "bg-cyan-500/70",
  "bg-orange-500/70",
  "bg-indigo-500/70",
];

function formatIndex(index: number | null, sub: number | null): string {
  if (index == null) return "—";
  const hex = `0x${index.toString(16).toUpperCase().padStart(4, "0")}`;
  return sub != null ? `${hex}:${sub}` : hex;
}

export function PdoFrameVisualizer({ signals, frameBits = 64 }: Props) {
  const totalBytes = frameBits / 8;
  const totalBitsUsed = signals.reduce((sum, s) => sum + s.bitLength, 0);

  // Build a bit-occupancy map to detect overlaps
  const bitMap = new Uint8Array(frameBits); // 0 = empty, 1 = occupied, 2+ = overlap
  for (const sig of signals) {
    for (let b = sig.bitOffset; b < sig.bitOffset + sig.bitLength && b < frameBits; b++) {
      bitMap[b]++;
    }
  }
  const hasOverlap = bitMap.some((v) => v > 1);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-1.5">
        {/* Byte boundary labels */}
        <div className="relative text-[10px] text-muted-foreground tabular-nums" style={{ height: 14 }}>
          {Array.from({ length: totalBytes + 1 }, (_, i) => (
            <span
              key={i}
              className="absolute"
              style={{ left: `${(i / totalBytes) * 100}%`, transform: "translateX(-50%)" }}
            >
              {i * 8}
            </span>
          ))}
        </div>

        {/* Frame bar */}
        <div className="relative h-7 rounded border bg-muted/30 overflow-hidden">
          {/* Byte boundary lines */}
          {Array.from({ length: totalBytes - 1 }, (_, i) => (
            <div
              key={`sep-${i}`}
              className="absolute top-0 bottom-0 w-px bg-border/60"
              style={{ left: `${((i + 1) / totalBytes) * 100}%` }}
            />
          ))}

          {/* Signal blocks */}
          {signals.map((sig, i) => {
            const left = (sig.bitOffset / frameBits) * 100;
            const width = (sig.bitLength / frameBits) * 100;
            // Check if this signal overlaps with another
            const overlaps = (() => {
              for (let b = sig.bitOffset; b < sig.bitOffset + sig.bitLength && b < frameBits; b++) {
                if (bitMap[b] > 1) return true;
              }
              return false;
            })();

            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <div
                    className={`absolute top-0.5 bottom-0.5 rounded-sm flex items-center justify-center text-[10px] font-medium text-white truncate px-0.5 cursor-default ${
                      overlaps ? "bg-red-500/80 ring-1 ring-red-400" : COLORS[i % COLORS.length]
                    }`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                  >
                    {width > 6 ? (sig.tagSuffix ?? `#${sig.bitOffset}`) : ""}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p className="font-medium">{sig.tagSuffix ?? "(unnamed)"}</p>
                  <p className="text-muted-foreground">
                    {formatIndex(sig.canopenIndex, sig.canopenSubIndex)} · {sig.bitLength} bit{sig.bitLength !== 1 ? "s" : ""} @ offset {sig.bitOffset}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Summary */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="tabular-nums">{totalBitsUsed}/{frameBits} bits</span>
          <span className="tabular-nums">({Math.round((totalBitsUsed / frameBits) * 100)}%)</span>
          {hasOverlap && (
            <span className="text-red-500 font-medium">Overlap detected</span>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
