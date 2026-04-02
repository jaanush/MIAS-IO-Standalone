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
import { buildNodeId } from "../opcua/node-id";
import { db } from "../../../lib/db";

function send(ws: WebSocket, data: unknown): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function sendError(ws: WebSocket, id: string | undefined, message: string): void {
  send(ws, { type: "error", id, message });
}

/** Resolve signal IDs to OPC UA node IDs via the database */
async function resolveSignalNodeIds(signalIds: number[]): Promise<Map<number, string>> {
  const signals = await db.signal.findMany({
    where: { id: { in: signalIds } },
    select: {
      id: true,
      tag: true,
      gvl: { select: { name: true } },
    },
  });

  const result = new Map<number, string>();
  for (const sig of signals) {
    if (sig.tag && sig.gvl?.name) {
      result.set(sig.id, buildNodeId(sig.gvl.name, sig.tag));
    }
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

  const signalMap = await resolveSignalNodeIds(msg.signalIds);
  if (signalMap.size === 0) {
    sendError(ws, msg.id, "No valid signals found for the given IDs");
    return;
  }

  try {
    await subscriptionManager.subscribe(ws, msg.plcId, signalMap);
  } catch (err) {
    sendError(ws, msg.id, err instanceof Error ? err.message : String(err));
  }
}

export async function handleUnsubscribe(ws: WebSocket, msg: UnsubscribeMessage): Promise<void> {
  const signalMap = await resolveSignalNodeIds(msg.signalIds);
  const nodeIds = Array.from(signalMap.values());
  await subscriptionManager.unsubscribe(ws, msg.plcId, nodeIds);
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

  const signalMap = await resolveSignalNodeIds([msg.signalId]);
  const nodeId = signalMap.get(msg.signalId);
  if (!nodeId) {
    sendError(ws, msg.id, `Signal ${msg.signalId} not found or has no OPC UA mapping`);
    return;
  }

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
