/**
 * IEC 61131-3 address computation for hardwired IO signals.
 * Offsets are carrier-scoped and accumulate by slot position order.
 */

type CardForAddress = {
  id: number;
  slotPosition: number;
  cardType: string;
  maxInputChannels: number | null;
  maxOutputChannels: number | null;
};

type SignalForAddress = {
  id: number;
  ioCardId: number | null;
  channelPosition: number | null;
  direction: string | null;
  origin: string;
};

/** Compute IEC addresses for all IEC signals within a carrier's cards. */
export function computeCarrierAddresses(
  cards: CardForAddress[],
  signals: SignalForAddress[]
): Map<number, string | null> {
  const result = new Map<number, string | null>();

  // Sort cards by slot position
  const sorted = [...cards].sort((a, b) => a.slotPosition - b.slotPosition);

  // Running byte/word offsets per address space
  let diByteOffset = 0;
  let doByteOffset = 0;
  let aiWordOffset = 0;
  let aoWordOffset = 0;

  // Map card id → starting offsets
  const cardOffsets = new Map<number, { di: number; do: number; ai: number; ao: number }>();

  for (const card of sorted) {
    cardOffsets.set(card.id, { di: diByteOffset, do: doByteOffset, ai: aiWordOffset, ao: aoWordOffset });

    const inCh = card.maxInputChannels ?? 0;
    const outCh = card.maxOutputChannels ?? 0;

    switch (card.cardType) {
      case "DI":
        diByteOffset += Math.ceil(inCh / 8);
        break;
      case "DO":
        doByteOffset += Math.ceil(outCh / 8);
        break;
      case "AI":
        aiWordOffset += inCh;
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
      result.set(sig.id, null);
      continue;
    }

    const offsets = cardOffsets.get(sig.ioCardId);
    const card = sorted.find((c) => c.id === sig.ioCardId);
    if (!offsets || !card) {
      result.set(sig.id, null);
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
        addr = `%IW${offsets.ai + ch}`;
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

    result.set(sig.id, addr);
  }

  return result;
}

/** Sanitize a signal tag for use as an IEC 61131-3 variable name. */
export function tagToVarName(tag: string | null | undefined): string {
  if (!tag) return "SIG_UNNAMED";
  const sanitized = tag.replace(/[^a-zA-Z0-9_]/g, "_");
  const prefixed = /^[0-9]/.test(sanitized) ? `SIG_${sanitized}` : sanitized;
  return prefixed.slice(0, 32);
}
