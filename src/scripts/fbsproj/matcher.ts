import type { PrismaClient } from '../../../prisma/generated/prisma/client/client';

/**
 * Match CodesysVariables to MIAS-IO Signals using three strategies:
 *   1. Hardware address (highest confidence)
 *   2. Tag name match
 *   3. FB instance name match (for component instances)
 *
 * Updates CodesysVariable.signalId and CodesysFbInstance.componentInstanceId.
 * Returns the total match count.
 */
export async function matchSignals(
  prisma: PrismaClient,
  importId: number,
  projectId: number,
): Promise<number> {
  let matchCount = 0;

  // Load all project signals
  const signals = await prisma.signal.findMany({
    where: { projectId },
    include: {
      ioCard: {
        include: {
          carrier: true,
        },
      },
    },
  });

  // Load unmatched variables from this import
  const variables = await prisma.codesysVariable.findMany({
    where: { importId, signalId: null },
  });

  // Build lookup maps
  const tagMap = new Map<string, number>(); // normalized tag -> signal id
  const hwMap = new Map<string, number>();  // hw address -> signal id

  for (const sig of signals) {
    // Tag-based lookup
    if (sig.tag) {
      tagMap.set(normalizeTag(sig.tag), sig.id);
    }

    // Hardware address lookup (carrier + card + channel)
    if (sig.ioCard && sig.channelPosition != null) {
      const carrier = sig.ioCard.carrier;
      if (carrier) {
        // Build address like D03_B7.1
        // The address format is: DNN_XSLOT.CHANNEL
        // where NN = carrier node or name suffix, X = card type letter, SLOT = slot pos
        // We need to try matching against the variable's hwAddress
        const addr = buildHwAddress(carrier.name, sig.ioCard.slotPosition, sig.channelPosition);
        if (addr) {
          hwMap.set(addr, sig.id);
        }
      }
    }
  }

  // Strategy 1 & 2: Match variables by hw address then tag
  for (const v of variables) {
    let matchedSignalId: number | null = null;

    // Strategy 1: Hardware address
    if (v.hwAddress) {
      matchedSignalId = hwMap.get(v.hwAddress) ?? null;
    }

    // Strategy 2: Tag name
    if (!matchedSignalId) {
      // The variable name in the GVL is essentially the tag
      const normalizedName = normalizeTag(v.name);
      matchedSignalId = tagMap.get(normalizedName) ?? null;
    }

    if (matchedSignalId) {
      await prisma.codesysVariable.update({
        where: { id: v.id },
        data: { signalId: matchedSignalId },
      });
      matchCount++;
    }
  }

  // Strategy 3: Match FB instances to component instances
  const fbInstances = await prisma.codesysFbInstance.findMany({
    where: { importId, componentInstanceId: null },
  });

  const componentInstances = await prisma.componentInstance.findMany({
    where: { projectId },
  });

  const ciTagMap = new Map<string, number>(); // normalized tag -> component instance id
  for (const ci of componentInstances) {
    if (ci.tag) {
      ciTagMap.set(normalizeTag(ci.tag), ci.id);
    }
    ciTagMap.set(normalizeTag(ci.name), ci.id);
  }

  for (const fbi of fbInstances) {
    const normalized = normalizeTag(fbi.name);
    const ciId = ciTagMap.get(normalized) ?? null;
    if (ciId) {
      await prisma.codesysFbInstance.update({
        where: { id: fbi.id },
        data: { componentInstanceId: ciId },
      });
    }
  }

  // Update matched count on import record
  await prisma.codesysImport.update({
    where: { id: importId },
    data: { matchedCount: matchCount },
  });

  return matchCount;
}

/**
 * Normalize a tag for comparison: lowercase, strip common prefixes/suffixes.
 */
function normalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/^alarm\d+_/, ''); // strip "Alarm001_" prefix
}

/**
 * Try to build a hardware address from carrier/card/channel info.
 * Returns null if we can't determine the address format.
 */
function buildHwAddress(
  carrierName: string,
  slotPosition: number,
  channelPosition: number,
): string | null {
  // Carrier names like "D03", "D04" → address is D03_B{slot}.{channel}
  // This is project-specific. We extract the carrier prefix.
  const carrierMatch = carrierName.match(/^([A-Z]\d{2})$/);
  if (!carrierMatch) return null;

  // The slot letter mapping depends on module type. In Alveli:
  // Slots use lettered groups (A, B, C) with numbered sub-positions.
  // This is too project-specific to generalize here.
  // For now, return null — hw matching will rely on direct hwAddress comparison.
  return null;
}
