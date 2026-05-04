/**
 * WebSocket message handlers.
 *
 * Each handler receives a parsed client message and the WebSocket,
 * performs the operation, and sends a response.
 */

import type { WebSocket } from "ws";
import type {
  ConnectMessage,
  DisconnectMessage,
  SubscribeMessage,
  UnsubscribeMessage,
  ReadMessage,
  WriteMessage,
  BrowseMessage,
} from "./protocol";
import { connectionManager } from "../opcua/connection-manager";
import { subscriptionManager } from "../opcua/subscription-manager";
import { readValues, writeValue, browseNode } from "../opcua/operations";
import { buildBaseNodeId, buildReadNodeId, buildRawReadNodeId } from "../opcua/node-id";
import { db } from "../../../lib/db";

function send(ws: WebSocket, data: unknown): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function sendError(ws: WebSocket, id: string | undefined, message: string): void {
  send(ws, { type: "error", id, message });
}

/** Resolve signal IDs to OPC UA node IDs via the database.
 *  Uses the new `buildReadNodeId` (device prefix + systemGroup-strip + AsReal/AsBool getter)
 *  for live reads. Skips any signal whose PLC has no codesysDeviceName set
 *  or whose gvl/tag is missing — those produce node IDs that can't possibly
 *  resolve. */
async function resolveSignalNodeIds(
  signalIds: number[],
  mode: "read" | "base" | "raw" = "read",
): Promise<Map<number, string>> {
  const signals = await db.signal.findMany({
    where: { id: { in: signalIds } },
    select: {
      id: true,
      tag: true,
      signalType: true,
      componentTag: true,
      gvl: { select: { name: true } },
      ioCard: {
        select: {
          carrier: {
            select: { plc: { select: { codesysDeviceName: true } } },
          },
        },
      },
    },
  });

  const result = new Map<number, string>();
  for (const sig of signals) {
    if (!sig.tag || !sig.gvl?.name) continue;
    const deviceName = sig.ioCard?.carrier?.plc?.codesysDeviceName;
    if (!deviceName) continue;     // PLC's CODESYS device-tree name not yet set
    const components = {
      deviceName,
      gvlName: sig.gvl.name,
      signalTag: sig.tag,
      componentTag: sig.componentTag,
    };
    let nodeId: string | null;
    if (mode === "read") {
      nodeId = buildReadNodeId(components, sig.signalType as "DISCRETE" | "ANALOG");
    } else if (mode === "raw") {
      // Analog only — raw counts have no meaning for DISCRETE.
      nodeId = buildRawReadNodeId(components, sig.signalType as "DISCRETE" | "ANALOG");
    } else {
      nodeId = buildBaseNodeId(components);
    }
    if (!nodeId) continue;
    result.set(sig.id, nodeId);
  }
  return result;
}

/** Look up PLC endpoint from database */
async function getPlcEndpoint(plcId: number): Promise<string | null> {
  const plc = await db.plc.findUnique({
    where: { id: plcId },
    select: { ipAddress: true },
  });
  if (!plc?.ipAddress) return null;
  return `opc.tcp://${plc.ipAddress}:4840`;
}

// --- Handler implementations ---

export async function handleConnect(ws: WebSocket, msg: ConnectMessage): Promise<void> {
  const endpoint = await getPlcEndpoint(msg.plcId);
  if (!endpoint) {
    sendError(ws, msg.id, `PLC ${msg.plcId} has no IP address configured`);
    return;
  }

  try {
    await connectionManager.connect(msg.plcId, endpoint);
    send(ws, {
      type: "connection",
      plcId: msg.plcId,
      connected: true,
      status: "connected",
    });
  } catch (err) {
    sendError(ws, msg.id, err instanceof Error ? err.message : String(err));
  }
}

export async function handleDisconnect(ws: WebSocket, msg: DisconnectMessage): Promise<void> {
  await connectionManager.disconnect(msg.plcId);
  send(ws, {
    type: "connection",
    plcId: msg.plcId,
    connected: false,
    status: "disconnected",
  });
}

export async function handleSubscribe(ws: WebSocket, msg: SubscribeMessage): Promise<void> {
  if (!connectionManager.hasSession(msg.plcId)) {
    sendError(ws, msg.id, `PLC ${msg.plcId} is not connected`);
    return;
  }

  const mode = msg.mode ?? "scaled";
  const resolveMode = mode === "raw" ? "raw" : "read";
  const signalMap = await resolveSignalNodeIds(msg.signalIds, resolveMode);
  if (signalMap.size === 0) {
    sendError(ws, msg.id, "No valid signals found for the given IDs");
    return;
  }

  try {
    await subscriptionManager.subscribe(ws, msg.plcId, signalMap, mode);
  } catch (err) {
    sendError(ws, msg.id, err instanceof Error ? err.message : String(err));
  }
}

export async function handleUnsubscribe(ws: WebSocket, msg: UnsubscribeMessage): Promise<void> {
  const mode = msg.mode ?? "scaled";
  const resolveMode = mode === "raw" ? "raw" : "read";
  const signalMap = await resolveSignalNodeIds(msg.signalIds, resolveMode);
  const nodeIds = Array.from(signalMap.values());
  await subscriptionManager.unsubscribe(ws, msg.plcId, nodeIds, mode);
}

export async function handleRead(ws: WebSocket, msg: ReadMessage): Promise<void> {
  if (!connectionManager.hasSession(msg.plcId)) {
    sendError(ws, msg.id, `PLC ${msg.plcId} is not connected`);
    return;
  }

  const signalMap = await resolveSignalNodeIds(msg.signalIds);
  if (signalMap.size === 0) {
    sendError(ws, msg.id, "No valid signals found");
    return;
  }

  try {
    const nodeIds = Array.from(signalMap.values());
    const values = await readValues(msg.plcId, nodeIds);

    // Map nodeId back to signalId
    const nodeToSignal = new Map<string, number>();
    for (const [sigId, nodeId] of signalMap) {
      nodeToSignal.set(nodeId, sigId);
    }

    send(ws, {
      type: "read_result",
      id: msg.id,
      values: values.map((v) => ({
        signalId: nodeToSignal.get(v.nodeId) ?? 0,
        value: v.value,
        dataType: v.dataType,
        ts: v.timestamp,
        status: v.statusText,
      })),
    });
  } catch (err) {
    sendError(ws, msg.id, err instanceof Error ? err.message : String(err));
  }
}

export async function handleWrite(ws: WebSocket, msg: WriteMessage): Promise<void> {
  if (!connectionManager.hasSession(msg.plcId)) {
    sendError(ws, msg.id, `PLC ${msg.plcId} is not connected`);
    return;
  }

  // For writes, use the BASE node (FB Object root). The optional subField
  // appended below reaches the FB's typed sideload pin (e.g. _rHmiValue,
  // _xHmiBool, _bHmiOverrideActive). Writing to the bare base node would
  // fail — base is an Object, not a Variable.
  const signalMap = await resolveSignalNodeIds([msg.signalId], "base");
  const baseNodeId = signalMap.get(msg.signalId);
  if (!baseNodeId) {
    sendError(ws, msg.id, `Signal ${msg.signalId} not found or has no OPC UA mapping`);
    return;
  }

  const nodeId = msg.subField ? `${baseNodeId}.${msg.subField}` : baseNodeId;

  try {
    const result = await writeValue(msg.plcId, nodeId, msg.value, msg.dataType ?? "Boolean");
    send(ws, { type: "write_ok", id: msg.id, ...result });
  } catch (err) {
    sendError(ws, msg.id, err instanceof Error ? err.message : String(err));
  }
}

export async function handleBrowse(ws: WebSocket, msg: BrowseMessage): Promise<void> {
  if (!connectionManager.hasSession(msg.plcId)) {
    sendError(ws, msg.id, `PLC ${msg.plcId} is not connected`);
    return;
  }

  try {
    const nodes = await browseNode(msg.plcId, msg.nodeId);
    send(ws, { type: "browse_result", id: msg.id, nodes });
  } catch (err) {
    sendError(ws, msg.id, err instanceof Error ? err.message : String(err));
  }
}
