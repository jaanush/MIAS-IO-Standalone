/**
 * IEC 61131-3 address computation for hardwired IO signals.
 * Offsets accumulate globally across all carriers within a PLC.
 */

type CardForAddress = {
  id: number;
  slotPosition: number;
  cardType: string;
  maxInputChannels: number | null;
  maxOutputChannels: number | null;
  hasDiagnostics: boolean;
  diagnosticType: string | null;
};

type SignalForAddress = {
  id: number;
  ioCardId: number | null;
  channelPosition: number | null;
  direction: string | null;
  origin: string;
  isDiagnostic: boolean;
};

export type AddressOffsets = { di: number; do: number; ai: number; ao: number };

/** Compute IEC addresses for all IEC signals within a carrier's cards.
 *  `initialOffsets` carries the cumulative byte/word counts from preceding carriers. */
export function computeCarrierAddresses(
  cards: CardForAddress[],
  signals: SignalForAddress[],
  initialOffsets: AddressOffsets = { di: 0, do: 0, ai: 0, ao: 0 },
): { addresses: Map<number, string | null>; nextOffsets: AddressOffsets } {
  const addresses = new Map<number, string | null>();

  // Sort cards by slot position
  const sorted = [...cards].sort((a, b) => a.slotPosition - b.slotPosition);

  // Running byte/word offsets per address space — start from previous carrier's end
  let diByteOffset = initialOffsets.di;
  let doByteOffset = initialOffsets.do;
  let aiWordOffset = initialOffsets.ai;
  let aoWordOffset = initialOffsets.ao;

  // Map card id → starting offsets
  const cardOffsets = new Map<number, { di: number; do: number; ai: number; ao: number }>();

  for (const card of sorted) {
    cardOffsets.set(card.id, { di: diByteOffset, do: doByteOffset, ai: aiWordOffset, ao: aoWordOffset });

    const inCh = card.maxInputChannels ?? 0;
    const outCh = card.maxOutputChannels ?? 0;

    switch (card.cardType) {
      case "DI":
        if (card.hasDiagnostics && card.diagnosticType === "DIGITAL_PAIRED") {
          // Data bits + diagnostic bits share the same byte(s)
          diByteOffset += Math.ceil(inCh * 2 / 8);
        } else {
          diByteOffset += Math.ceil(inCh / 8);
        }
        break;
      case "DO":
        doByteOffset += Math.ceil(outCh / 8);
        break;
      case "AI":
        if (card.hasDiagnostics && card.diagnosticType === "ANALOG_STATUS_BYTE") {
          // Status word + data word per channel
          aiWordOffset += inCh * 2;
        } else {
          aiWordOffset += inCh;
        }
        break;
      case "AO":
        aoWordOffset += outCh;
        break;
      case "COUNTER":
        // COUNTER uses DWord input space
        diByteOffset += inCh * 4; // 4 bytes per DWord
        break;
      case "MIXED":
        diByteOffset += Math.ceil(inCh / 8);
        doByteOffset += Math.ceil(outCh / 8);
        break;
      default:
        break;
    }
  }

  // Assign addresses to signals
  for (const sig of signals) {
    if (sig.origin !== "IEC" || sig.ioCardId == null || sig.channelPosition == null) {
      addresses.set(sig.id, null);
      continue;
    }

    const offsets = cardOffsets.get(sig.ioCardId);
    const card = sorted.find((c) => c.id === sig.ioCardId);
    if (!offsets || !card) {
      addresses.set(sig.id, null);
      continue;
    }

    const ch = sig.channelPosition;
    let addr: string | null = null;

    switch (card.cardType) {
      case "DI":
        addr = `%IX${offsets.di + Math.floor(ch / 8)}.${ch % 8}`;
        break;
      case "DO":
        addr = `%QX${offsets.do + Math.floor(ch / 8)}.${ch % 8}`;
        break;
      case "AI":
        if (card.hasDiagnostics && card.diagnosticType === "ANALOG_STATUS_BYTE") {
          // Interleaved: [status0, data0, status1, data1, ...]
          // Diagnostic signal → status word (ch * 2), data signal → data word (ch * 2 + 1)
          addr = sig.isDiagnostic
            ? `%IW${offsets.ai + ch * 2}`
            : `%IW${offsets.ai + ch * 2 + 1}`;
        } else {
          addr = `%IW${offsets.ai + ch}`;
        }
        break;
      case "AO":
        addr = `%QW${offsets.ao + ch}`;
        break;
      case "COUNTER":
        addr = `%ID${Math.floor((offsets.di + ch * 4) / 4)}`;
        break;
      case "MIXED":
        if (sig.direction === "INPUT") {
          addr = `%IX${offsets.di + Math.floor(ch / 8)}.${ch % 8}`;
        } else {
          addr = `%QX${offsets.do + Math.floor(ch / 8)}.${ch % 8}`;
        }
        break;
      default:
        addr = null;
    }

    addresses.set(sig.id, addr);
  }

  return {
    addresses,
    nextOffsets: { di: diByteOffset, do: doByteOffset, ai: aiWordOffset, ao: aoWordOffset },
  };
}

/** Sanitize a signal tag for use as an IEC 61131-3 variable name (max 64 chars). */
export function tagToVarName(tag: string | null | undefined): string {
  if (!tag) return "SIG_UNNAMED";
  const sanitized = tag.replace(/[^a-zA-Z0-9_]/g, "_");
  const prefixed = /^[0-9]/.test(sanitized) ? `SIG_${sanitized}` : sanitized;
  return prefixed.slice(0, 64);
}

/** Deduplicate variable names by appending _2, _3, ... on collision. */
export function deduplicateVarNames(names: string[]): string[] {
  const counts = new Map<string, number>();
  const result: string[] = [];
  for (const name of names) {
    const count = (counts.get(name) ?? 0) + 1;
    counts.set(name, count);
    if (count === 1) {
      result.push(name);
    } else {
      // Ensure suffix still fits within 64 chars
      const suffix = `_${count}`;
      result.push(name.slice(0, 64 - suffix.length) + suffix);
    }
  }
  return result;
}
