/**
 * WebSocket server setup.
 *
 * Attaches to an existing HTTP server and handles upgrade requests
 * on the /ws path. Routes incoming messages to handlers.
 */

import { WebSocketServer, type WebSocket } from "ws";
import type { Server as HttpServer } from "http";
import type { ClientMessage } from "./protocol";
import {
  handleConnect,
  handleDisconnect,
  handleSubscribe,
  handleUnsubscribe,
  handleRead,
  handleWrite,
  handleBrowse,
} from "./handlers";
import { subscriptionManager } from "../opcua/subscription-manager";
import { connectionManager } from "../opcua/connection-manager";

const WS_PATH = "/ws";

/** Set of all connected WebSocket clients */
const clients = new Set<WebSocket>();

export function setupWebSocketServer(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  // Handle HTTP upgrade on /ws path
  httpServer.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
    if (url.pathname !== WS_PATH) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws: WebSocket) => {
    clients.add(ws);
    console.log(`[WS] Client connected (${clients.size} total)`);

    // Send current connection statuses
    const statuses = connectionManager.getAllStatuses();
    for (const [plcId, { status, endpoint }] of statuses) {
      ws.send(JSON.stringify({
        type: "connection",
        plcId,
        connected: status === "connected",
        status,
      }));
    }

    ws.on("message", async (raw: Buffer | string) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf-8"));
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
        return;
      }

      if (!msg.type || !msg.id) {
        ws.send(JSON.stringify({ type: "error", message: "Missing type or id field" }));
        return;
      }

      try {
        switch (msg.type) {
          case "connect":
            await handleConnect(ws, msg);
            break;
          case "disconnect":
            await handleDisconnect(ws, msg);
            break;
          case "subscribe":
            await handleSubscribe(ws, msg);
            break;
          case "unsubscribe":
            await handleUnsubscribe(ws, msg);
            break;
          case "read":
            await handleRead(ws, msg);
            break;
          case "write":
            await handleWrite(ws, msg);
            break;
          case "browse":
            await handleBrowse(ws, msg);
            break;
          default:
            ws.send(JSON.stringify({ type: "error", id: (msg as any).id, message: `Unknown message type: ${(msg as any).type}` }));
        }
      } catch (err) {
        console.error(`[WS] Error handling ${msg.type}:`, err);
        ws.send(JSON.stringify({
          type: "error",
          id: msg.id,
          message: err instanceof Error ? err.message : "Internal error",
        }));
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected (${clients.size} remaining)`);
      subscriptionManager.removeClient(ws);
    });

    ws.on("error", (err) => {
      console.error("[WS] Client error:", err);
      clients.delete(ws);
      subscriptionManager.removeClient(ws);
    });
  });

  // Broadcast connection status changes to all WS clients
  connectionManager.on("status", (plcId: number, status: string, error?: string) => {
    const message = JSON.stringify({
      type: "connection",
      plcId,
      connected: status === "connected",
      status,
      error,
    });
    for (const ws of clients) {
      if (ws.readyState === ws.OPEN) {
        ws.send(message);
      }
    }
  });

  console.log(`[WS] WebSocket server ready on ${WS_PATH}`);
  return wss;
}
