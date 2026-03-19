/**
 * Recursive component signal resolution.
 *
 * Walk up the parent chain and merge signals: child signals at the same
 * channelOffset override parent signals. The result is the effective
 * signal set for a component, including all inherited signals.
 */
import { db } from "@/lib/db";

type ComponentSignalRow = {
  id: number;
  componentId: number;
  channelOffset: number;
  ioType: string;
  origin: string | null;
  tagSuffix: string | null;
  description: string | null;
  active: boolean;
  [key: string]: unknown;
};

export type ResolvedSignal = ComponentSignalRow & {
  /** The component that defines this signal (may differ from the queried component if inherited) */
  sourceComponentId: number;
  sourceComponentName: string;
  inherited: boolean;
};

/**
 * Get the effective signals for a component, including inherited signals
 * from the parent chain. Child signals override parent signals at the same
 * channelOffset.
 */
export async function getEffectiveSignals(componentId: number): Promise<ResolvedSignal[]> {
  // Build the ancestor chain (child → parent → grandparent → ...)
  const chain: { id: number; name: string }[] = [];
  let currentId: number | null = componentId;

  while (currentId != null) {
    const comp: { id: number; name: string; parentId: number | null } | null =
      await db.hardwareComponent.findUnique({
        where: { id: currentId },
        select: { id: true, name: true, parentId: true },
      });
    if (!comp) break;
    chain.push({ id: comp.id, name: comp.name });
    currentId = comp.parentId;
    // Safety: prevent infinite loops (max 10 levels)
    if (chain.length > 10) break;
  }

  // Fetch signals for all components in the chain
  const allIds = chain.map((c) => c.id);
  const allSignals = await db.componentSignal.findMany({
    where: { componentId: { in: allIds }, active: true },
    orderBy: { channelOffset: "asc" },
  });

  // Build name lookup
  const nameMap = new Map(chain.map((c) => [c.id, c.name]));

  // Merge: start from root (last in chain), child overrides parent
  // chain[0] = the queried component (most specific)
  // chain[last] = the root ancestor (most general)
  const merged = new Map<number, ResolvedSignal>();

  // Process from root to leaf so children override parents
  for (let i = chain.length - 1; i >= 0; i--) {
    const comp = chain[i];
    const signals = allSignals.filter((s) => s.componentId === comp.id);

    for (const sig of signals) {
      merged.set(sig.channelOffset, {
        ...sig,
        sourceComponentId: comp.id,
        sourceComponentName: nameMap.get(comp.id) ?? "",
        inherited: comp.id !== componentId,
      } as ResolvedSignal);
    }
  }

  return Array.from(merged.values()).sort((a, b) => a.channelOffset - b.channelOffset);
}

/**
 * Get the ancestor chain for a component (self → parent → grandparent → ...).
 */
export async function getAncestorChain(componentId: number): Promise<{ id: number; name: string }[]> {
  const chain: { id: number; name: string }[] = [];
  let currentId: number | null = componentId;

  while (currentId != null) {
    const comp: { id: number; name: string; parentId: number | null } | null =
      await db.hardwareComponent.findUnique({
        where: { id: currentId },
        select: { id: true, name: true, parentId: true },
      });
    if (!comp) break;
    chain.push({ id: comp.id, name: comp.name });
    currentId = comp.parentId;
    if (chain.length > 10) break;
  }

  return chain;
}
