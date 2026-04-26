import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "../../../_auth";

/**
 * GET /api/codesys/project/{id}/components
 *
 * Returns all component instances in a project with their PDO configurations,
 * mapped objects (CANopen PDO signal mappings), and wiring recipes.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  const { id } = await params;
  const projectId = Number(id);
  if (isNaN(projectId)) return NextResponse.json({ error: "Invalid project id" }, { status: 400 });

  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Fetch all component instances in the project with full relations
  const instances = await db.componentInstance.findMany({
    where: { projectId },
    orderBy: { name: "asc" },
    include: {
      component: {
        select: {
          id: true,
          name: true,
          functionBlock: true,
          busProtocol: true,
          minCanIdOffset: true,
          parameterDefs: {
            select: {
              paramName: true,
              paramType: true,
              required: true,
              defaultScalarValue: true,
              defaultIntValue: true,
              defaultStringValue: true,
              defaultBoolValue: true,
            },
          },
        },
      },
      bus: {
        select: { id: true, protocol: true },
      },
      signals: {
        include: {
          componentSignal: {
            select: {
              id: true,
              channelOffset: true,
              tagSuffix: true,
              description: true,
              ioType: true,
              rawDataType: true,
              bitOffset: true,
              bitLength: true,
              canopenIndex: true,
              canopenSubIndex: true,
              pdoConfigId: true,
              pdoConfig: {
                select: {
                  id: true,
                  direction: true,
                  pdoNumber: true,
                },
              },
            },
          },
          signals: {
            select: {
              id: true,
              tag: true,
              gvl: { select: { id: true, name: true } },
            },
          },
        },
      },
      parameters: {
        include: {
          curve: {
            include: { points: { orderBy: { ordinal: "asc" } } },
          },
        },
        orderBy: { paramName: "asc" },
      },
      // FR-009: composite children for CHILD_SIGNAL resolution and codegen.
      children: {
        select: {
          id: true,
          name: true,
          tag: true,
          compositionRole: true,
          componentId: true,
          signals: {
            select: {
              componentSignal: { select: { tagSuffix: true } },
              signals: { select: { id: true, tag: true, gvl: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });

  // Fetch PDO configs for all components referenced by instances
  const componentIds = [...new Set(instances.map((i) => i.componentId))];
  const pdoConfigs = await db.pdoConfig.findMany({
    where: { componentId: { in: componentIds } },
    orderBy: [{ direction: "asc" }, { pdoNumber: "asc" }],
    include: {
      signals: {
        select: {
          id: true,
          channelOffset: true,
          tagSuffix: true,
          description: true,
          ioType: true,
          rawDataType: true,
          bitOffset: true,
          bitLength: true,
          canopenIndex: true,
          canopenSubIndex: true,
        },
        orderBy: { bitOffset: "asc" },
      },
    },
  });

  // Fetch wiring recipes for these components
  const wiringRecipes = await db.wiringRecipe.findMany({
    where: {
      OR: [
        { componentId: { in: componentIds } },
        { projectId },
      ],
    },
    include: {
      params: { orderBy: { sortOrder: "asc" } },
    },
  });

  // Build signal tag lookup: instanceSignal.id → resolved project signal tag
  const signalTagMap = new Map<number, { tag: string | null; gvlName: string | null; signalId: number }>();
  for (const inst of instances) {
    for (const is of inst.signals) {
      if (is.signals.length > 0) {
        const sig = is.signals[0]; // primary signal
        signalTagMap.set(is.componentSignalId, {
          tag: sig.tag,
          gvlName: sig.gvl?.name ?? null,
          signalId: sig.id,
        });
      }
    }
  }

  // Build PDO config map by componentId
  const pdoByComponent = new Map<number, typeof pdoConfigs>();
  for (const pdo of pdoConfigs) {
    const existing = pdoByComponent.get(pdo.componentId) ?? [];
    existing.push(pdo);
    pdoByComponent.set(pdo.componentId, existing);
  }

  // Build wiring recipe map by componentId
  const wiringByComponent = new Map<number, typeof wiringRecipes>();
  for (const wr of wiringRecipes) {
    if (!wr.componentId) continue;
    const existing = wiringByComponent.get(wr.componentId) ?? [];
    existing.push(wr);
    wiringByComponent.set(wr.componentId, existing);
  }

  // Per-component CONTROL recipe lookup — wrapper-layer recipes (HMI/PMS/HAL/ALARM)
  // resolve their INSTANCE_FB params through the same component's CONTROL recipe.
  const controlRecipeByComponent = new Map<number, (typeof wiringRecipes)[number]>();
  for (const wr of wiringRecipes) {
    if (!wr.componentId) continue;
    if (wr.layer === "CONTROL" && !controlRecipeByComponent.has(wr.componentId)) {
      controlRecipeByComponent.set(wr.componentId, wr);
    }
  }

  // Assemble response
  const result = instances.map((inst) => {
    const nodeAddress = inst.nodeAddress ?? 0;
    const componentPdos = pdoByComponent.get(inst.componentId) ?? [];

    // Resolve PDO configs with mapped objects
    const resolvedPdos = componentPdos.map((pdo) => {
      const cobIdBase = pdo.cobId ?? 0;
      const cobIdResolved = cobIdBase + nodeAddress;

      const mappedObjects = pdo.signals.map((sig, position) => {
        const index = sig.canopenIndex ?? 0;
        const subIndex = sig.canopenSubIndex ?? 0;
        const bits = sig.bitLength ?? 0;
        const mappingDword = (index << 16) | (subIndex << 8) | bits;

        // Look up the resolved project signal tag
        const resolved = signalTagMap.get(sig.id);

        return {
          position,
          bitOffset: sig.bitOffset ?? 0,
          bitLength: bits,
          canopenIndex: index,
          canopenIndexHex: `0x${index.toString(16).toUpperCase().padStart(4, "0")}`,
          canopenSubIndex: subIndex,
          mappingDword: `0x${mappingDword.toString(16).toUpperCase().padStart(8, "0")}`,
          signalId: resolved?.signalId ?? null,
          signalTag: resolved?.tag ?? sig.tagSuffix,
          rawDataType: sig.rawDataType,
          description: sig.description,
        };
      });

      return {
        id: pdo.id,
        direction: pdo.direction,
        pdoNumber: pdo.pdoNumber,
        cobIdBase,
        cobIdResolved,
        transmissionType: pdo.transmissionType,
        eventTimerMs: pdo.eventTimerMs,
        inhibitTimeUs: pdo.inhibitTimeUs,
        syncWindowUs: pdo.syncWindowUs,
        timeoutMs: pdo.timeoutMs,
        description: pdo.description,
        mappedObjects,
      };
    });

    // Resolve wiring recipes
    const componentRecipes = wiringByComponent.get(inst.componentId) ?? [];
    const resolvedWiring = componentRecipes.map((wr) => {
      const instanceTag = inst.tag ?? inst.name.replace(/[^A-Za-z0-9_]/g, "_");

      const parameters = wr.params.map((p) => {
        const base: Record<string, unknown> = {
          name: p.parameterName,
          direction: p.direction,
          sourceType: p.sourceType,
        };

        if (p.sourceType === "LITERAL") {
          base.value = p.literalValue;
        } else if (p.sourceType === "EXPRESSION") {
          // Replace template variables
          let expr = p.expression ?? "";
          expr = expr.replace(/\{\{instance\.tag\}\}/g, instanceTag);
          expr = expr.replace(/\{\{instance\.name\}\}/g, inst.name);
          base.value = expr;
        } else if (p.sourceType === "SIGNAL" || p.sourceType === "SIGNAL_RAW" || p.sourceType === "SIGNAL_SENSOR_FAULT") {
          // Resolve signal tag
          let tag: string | null = null;
          let gvlName: string | null = null;

          if (p.channelOffset != null) {
            // Find by channel offset in this instance
            const resolved = signalTagMap.get(p.channelOffset);
            if (resolved) {
              tag = resolved.tag;
              gvlName = resolved.gvlName;
            }
          } else if (p.signalTag) {
            // Template pattern
            tag = p.signalTag
              .replace(/\{\{instance\.tag\}\}/g, instanceTag)
              .replace(/\{\{instance\.name\}\}/g, inst.name);
          }

          if (p.sourceType === "SIGNAL_RAW" && tag) tag += "_RAW";
          if (p.sourceType === "SIGNAL_SENSOR_FAULT" && tag) tag += "_SensorFaultAlarm";

          base.signalTag = tag;
          base.gvlName = gvlName;
        } else if (p.sourceType === "CHILD_SIGNAL") {
          // FR-009: resolve to a signal on a composite child instance.
          // childRole identifies which child; signalTag is matched against
          // the child's componentSignal.tagSuffix.
          let tag: string | null = null;
          let gvlName: string | null = null;
          if (p.childRole && p.signalTag) {
            const child = inst.children.find((c) => c.compositionRole === p.childRole);
            if (child) {
              const match = child.signals.find(
                (is) => is.componentSignal?.tagSuffix === p.signalTag,
              );
              const sig = match?.signals[0];
              if (sig) {
                tag = sig.tag;
                gvlName = sig.gvl?.name ?? null;
              }
            }
          }
          base.signalTag = tag;
          base.gvlName = gvlName;
          base.childRole = p.childRole;
        } else if (p.sourceType === "INSTANCE_FB") {
          // Wrapper layers (HMI / PMS / HAL / ALARM) reference the CONTROL-layer
          // instance of the same ComponentInstance. Resolve through the CONTROL
          // recipe's targetGvl + instanceNamePattern.
          if (wr.layer !== "CONTROL") {
            const ctrl = controlRecipeByComponent.get(inst.componentId);
            if (ctrl) {
              const ctrlInstanceName = ctrl.instanceNamePattern
                .replace(/\{\{instance\.tag\}\}/g, instanceTag)
                .replace(/\{\{instance\.name\}\}/g, inst.name);
              base.value = `${ctrl.targetGvl}.${ctrlInstanceName}`;
            } else {
              // Fallback: no CONTROL recipe exists. Use the component's FB +
              // instance tag (matches the convention for hand-coded controls).
              const fb = inst.functionBlockOverride ?? inst.component.functionBlock;
              base.value = fb ? `${fb}.${instanceTag}` : instanceTag;
            }
          } else {
            // CONTROL self-reference — keep historical behaviour (own targetGvl).
            base.value = `${wr.targetGvl}.${instanceTag}`;
          }
        }

        return base;
      });

      // Replace template variables in instance name pattern
      const instanceName = wr.instanceNamePattern
        .replace(/\{\{instance\.tag\}\}/g, instanceTag)
        .replace(/\{\{instance\.name\}\}/g, inst.name);

      return {
        layer: wr.layer,
        fbName: wr.fbName,
        instanceName,
        targetGvl: wr.targetGvl,
        parameters,
      };
    });

    // FR-008: per-instance parameters merged with template defaults.
    // Each entry carries paramType from the template def + the instance value
    // (or the template default when the instance hasn't been customized).
    const defByName = new Map(inst.component.parameterDefs.map((d) => [d.paramName, d]));
    const valueByName = new Map(inst.parameters.map((p) => [p.paramName, p]));
    const paramNames = new Set<string>([...defByName.keys(), ...valueByName.keys()]);
    const parameters = [...paramNames].sort().map((name) => {
      const def = defByName.get(name);
      const val = valueByName.get(name);
      const paramType = def?.paramType ?? null;
      const base: Record<string, unknown> = {
        name,
        type: paramType,
        required: def?.required ?? false,
      };
      if (paramType === "CURVE") {
        const c = val?.curve;
        base.curve = c
          ? { type: c.type, points: c.points.map((p) => ({ x: p.x, y: p.y })) }
          : null;
      } else if (paramType === "SCALAR_REAL") {
        base.value = val?.scalarValue ?? def?.defaultScalarValue ?? null;
      } else if (paramType === "INT") {
        base.value = val?.intValue ?? def?.defaultIntValue ?? null;
      } else if (paramType === "STRING") {
        base.value = val?.stringValue ?? def?.defaultStringValue ?? null;
      } else if (paramType === "BOOL") {
        base.value = val?.boolValue ?? def?.defaultBoolValue ?? null;
      }
      return base;
    });

    return {
      id: inst.id,
      name: inst.name,
      tag: inst.tag,
      componentId: inst.componentId,
      componentName: inst.component.name,
      functionBlock: inst.functionBlockOverride ?? inst.component.functionBlock,
      functionBlockOverride: inst.functionBlockOverride,
      busId: inst.busId,
      busProtocol: inst.bus?.protocol ?? inst.component.busProtocol,
      nodeAddress: inst.nodeAddress,
      canIdOffset: inst.canIdOffset,
      byteOrder: inst.byteOrder,
      parameters,
      pdoConfigs: resolvedPdos,
      wiring: resolvedWiring,
    };
  });

  return NextResponse.json({ instances: result });
}
