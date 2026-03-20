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

  // Concatenate: parent signals first (inherited), then own signals.
  // No override — children inherit ALL parent signals and add their own.
  // Process from root to leaf: root signals first, then intermediate, then own.
  const result: ResolvedSignal[] = [];

  for (let i = chain.length - 1; i >= 0; i--) {
    const comp = chain[i];
    const signals = allSignals.filter((s) => s.componentId === comp.id);

    for (const sig of signals) {
      result.push({
        ...sig,
        sourceComponentId: comp.id,
        sourceComponentName: nameMap.get(comp.id) ?? "",
        inherited: comp.id !== componentId,
      } as ResolvedSignal);
    }
  }

  return result;
}

/**
 * Get all component IDs that inherit from the given component
 * (the component itself + all descendants in the hierarchy).
 */
export async function getComponentAndDescendants(componentId: number): Promise<number[]> {
  const result: number[] = [componentId];
  let frontier = [componentId];

  while (frontier.length > 0) {
    const children = await db.hardwareComponent.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    if (children.length === 0) break;
    const childIds = children.map((c) => c.id);
    result.push(...childIds);
    frontier = childIds;
    if (result.length > 1000) break; // safety
  }

  return result;
}

/**
 * Sync a newly created (or re-activated) ComponentSignal to all existing
 * instances of the owning component and its descendants.
 *
 * Creates InstanceSignal + Signal + BusSignal + DiscreteSignal/AnalogSignal
 * for each instance that doesn't already have one for this ComponentSignal.
 */
export async function syncNewSignalToInstances(componentSignalId: number): Promise<number> {
  const cs = await db.componentSignal.findUniqueOrThrow({
    where: { id: componentSignalId },
    include: { plcDataTypeCatalog: { select: { code: true } } },
  });

  if (!cs.active) return 0;

  // Find all components that inherit this signal (self + descendants)
  const componentIds = await getComponentAndDescendants(cs.componentId);

  // Find all instances of those components that don't already have an InstanceSignal for this CS
  const instances = await db.componentInstance.findMany({
    where: { componentId: { in: componentIds } },
    select: {
      id: true,
      projectId: true,
      canIdOffset: true,
      plcNetworkId: true,
      network: { select: { protocol: true } },
      signals: { where: { componentSignalId: cs.id }, select: { id: true } },
    },
  });

  let created = 0;
  const isDiscrete = cs.ioType === "DI" || cs.ioType === "DO";

  for (const inst of instances) {
    // Skip if already has this component signal
    if (inst.signals.length > 0) continue;
    // Skip if no network (shouldn't happen, but safety)
    if (!inst.network) continue;

    const protocol = inst.network.protocol as string;
    const csOrigin = (cs.origin as string | null) ?? protocol;
    const canOffset = inst.canIdOffset ?? 0;

    const instanceSignal = await db.instanceSignal.create({
      data: {
        instanceId: inst.id,
        componentSignalId: cs.id,
        templateDirty: false,
      },
    });

    await db.signal.create({
      data: {
        projectId: inst.projectId,
        instanceSignalId: instanceSignal.id,
        origin: csOrigin as any,
        signalType: isDiscrete ? "DISCRETE" : "ANALOG",
        tag: cs.tagSuffix,
        description: cs.description,
        busSignal: {
          create: {
            plcNetworkId: inst.plcNetworkId!,
            rawDataType: cs.rawDataType ?? (isDiscrete ? "BOOL" : "WORD"),
            plcDataType: (cs.plcDataTypeCatalog?.code ?? (isDiscrete ? "BOOL" : "INT")) as any,
            byteOrder: cs.byteOrder ?? "BIG_ENDIAN",
            timeoutMs: cs.timeoutMs,
            nodeId: cs.canNodeId,
            canId: cs.canId != null ? cs.canId + canOffset : null,
            bitOffset: cs.bitOffset,
            bitLength: cs.bitLength,
            isMuxIndicator: cs.isMuxIndicator,
            muxId: cs.muxId,
            canopenIndex: cs.canopenIndex,
            canopenSubIndex: cs.canopenSubIndex,
            j1939Pgn: cs.j1939Pgn,
            j1939Spn: cs.j1939Spn,
            unitId: cs.modbusUnitId,
            registerType: cs.modbusRegisterType,
            registerOffset: cs.modbusRegisterOffset,
          },
        },
        ...(isDiscrete ? {
          discreteSignal: {
            create: {
              trigger: cs.defaultTrigger ?? "NO",
              filterTimeMs: cs.defaultFilterTimeMs ?? null,
              switchingType: cs.defaultSwitchingType ?? null,
            },
          },
        } : {
          analogSignal: {
            create: {
              inputTypeId: cs.defaultInputTypeId ?? null,
              wireConfig: cs.defaultWireConfig ?? null,
              scaleMin: cs.defaultScaleMin ?? null,
              scaleMax: cs.defaultScaleMax ?? null,
              engineeringUnitId: cs.defaultEuId ?? null,
            },
          },
        }),
      },
    });

    created++;
  }

  return created;
}

/**
 * Remove a ComponentSignal from all existing instances.
 * Deletes InstanceSignals (and their linked Signals cascade via schema).
 */
export async function removeSignalFromInstances(componentSignalId: number): Promise<number> {
  // Find all instance signals referencing this component signal
  const instanceSignals = await db.instanceSignal.findMany({
    where: { componentSignalId },
    select: { id: true, signals: { select: { id: true } } },
  });

  if (instanceSignals.length === 0) return 0;

  // Collect all Signal IDs to delete
  const signalIds = instanceSignals.flatMap((is) => is.signals.map((s) => s.id));

  // Delete project signals — DB ON DELETE CASCADE handles child tables
  // (discrete_signal, analog_signal, bus_signal, and their alarms)
  if (signalIds.length > 0) {
    await db.signal.deleteMany({ where: { id: { in: signalIds } } });
  }

  // Delete the instance signals
  await db.instanceSignal.deleteMany({ where: { componentSignalId } });

  return instanceSignals.length;
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
