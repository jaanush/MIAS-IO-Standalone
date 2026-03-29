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
        } else if (p.sourceType === "INSTANCE_FB") {
          base.value = `${wr.targetGvl}.${instanceTag}`;
        }

        return base;
      });

      // Replace template variables in instance name pattern
      const instanceName = wr.instanceNamePattern
        .replace(/\{\{instance\.tag\}\}/g, instanceTag)
        .replace(/\{\{instance\.name\}\}/g, inst.name);

      return {
        fbName: wr.fbName,
        instanceName,
        targetGvl: wr.targetGvl,
        parameters,
      };
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
      pdoConfigs: resolvedPdos,
      wiring: resolvedWiring,
    };
  });

  return NextResponse.json({ instances: result });
}
