/**
 * OPC UA Connection Manager
 *
 * Manages one OPC UA client session per PLC. Supports:
 * - Lazy connection (on first request)
 * - Auto-reconnect with exponential backoff
 * - Idle timeout disconnect
 * - Status events
 */

import {
  OPCUAClient,
  MessageSecurityMode,
  SecurityPolicy,
  ClientSession,
  type OPCUAClientOptions,
} from "node-opcua-client";
import { EventEmitter } from "events";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";

export interface PlcConnection {
  client: OPCUAClient;
  session: ClientSession | null;
  status: ConnectionStatus;
  endpoint: string;
  error: string | null;
  lastActivity: number;
}

interface ConnectionEvents {
  status: (plcId: number, status: ConnectionStatus, error?: string) => void;
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const CLIENT_OPTIONS: OPCUAClientOptions = {
  applicationName: "MIAS-DevTools",
  connectionStrategy: {
    initialDelay: RECONNECT_BASE_MS,
    maxDelay: RECONNECT_MAX_MS,
    maxRetry: -1, // Infinite retries
  },
  securityMode: MessageSecurityMode.None,
  securityPolicy: SecurityPolicy.None,
  endpointMustExist: false,
  keepSessionAlive: true,
};

class ConnectionManager extends EventEmitter {
  private connections = new Map<number, PlcConnection>();
  private reconnectTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private idleTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super();
    // Check for idle connections every 60s
    this.idleTimer = setInterval(() => this.checkIdleConnections(), 60_000);
  }

  /** Get connection status for a PLC */
  getStatus(plcId: number): { status: ConnectionStatus; endpoint: string; error: string | null } {
    const conn = this.connections.get(plcId);
    if (!conn) return { status: "disconnected", endpoint: "", error: null };
    return { status: conn.status, endpoint: conn.endpoint, error: conn.error };
  }

  /** Get all active connection statuses */
  getAllStatuses(): Map<number, { status: ConnectionStatus; endpoint: string }> {
    const result = new Map<number, { status: ConnectionStatus; endpoint: string }>();
    for (const [plcId, conn] of this.connections) {
      result.set(plcId, { status: conn.status, endpoint: conn.endpoint });
    }
    return result;
  }

  /** Connect to a PLC's OPC UA server */
  async connect(plcId: number, endpoint: string): Promise<void> {
    // If already connected or connecting, skip
    const existing = this.connections.get(plcId);
    if (existing && (existing.status === "connected" || existing.status === "connecting")) {
      return;
    }

    // Clean up previous connection if any
    if (existing) {
      await this.cleanupConnection(plcId);
    }

    const client = OPCUAClient.create(CLIENT_OPTIONS);
    const conn: PlcConnection = {
      client,
      session: null,
      status: "connecting",
      endpoint,
      error: null,
      lastActivity: Date.now(),
    };
    this.connections.set(plcId, conn);
    this.emitStatus(plcId, "connecting");

    try {
      await client.connect(endpoint);

      const session = await client.createSession();
      conn.session = session;
      conn.status = "connected";
      conn.error = null;
      conn.lastActivity = Date.now();
      this.emitStatus(plcId, "connected");

      // Handle connection loss
      client.on("connection_lost", () => {
        console.log(`[OPC UA] Connection lost to PLC ${plcId}`);
        conn.status = "reconnecting";
        conn.session = null;
        this.emitStatus(plcId, "reconnecting");
      });

      client.on("after_reconnection", async () => {
        console.log(`[OPC UA] Reconnected to PLC ${plcId}`);
        try {
          const newSession = await client.createSession();
          conn.session = newSession;
          conn.status = "connected";
          conn.error = null;
          conn.lastActivity = Date.now();
          this.emitStatus(plcId, "connected");
          this.emit("session_restored", plcId, newSession);
        } catch (err) {
          console.error(`[OPC UA] Failed to create session after reconnect for PLC ${plcId}:`, err);
          conn.status = "error";
          conn.error = err instanceof Error ? err.message : String(err);
          this.emitStatus(plcId, "error", conn.error);
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[OPC UA] Failed to connect to PLC ${plcId} at ${endpoint}:`, message);
      conn.status = "error";
      conn.error = message;
      this.emitStatus(plcId, "error", message);

      // Schedule reconnect
      this.scheduleReconnect(plcId, endpoint);
    }
  }

  /** Disconnect from a PLC */
  async disconnect(plcId: number): Promise<void> {
    this.clearReconnectTimer(plcId);
    await this.cleanupConnection(plcId);
    this.connections.delete(plcId);
    this.emitStatus(plcId, "disconnected");
  }

  /** Get active session for a PLC (throws if not connected) */
  getSession(plcId: number): ClientSession {
    const conn = this.connections.get(plcId);
    if (!conn || !conn.session) {
      throw new Error(`PLC ${plcId} is not connected`);
    }
    conn.lastActivity = Date.now();
    return conn.session;
  }

  /** Check if a PLC has an active session */
  hasSession(plcId: number): boolean {
    const conn = this.connections.get(plcId);
    return conn?.session != null && conn.status === "connected";
  }

  /** Mark activity on a connection (resets idle timer) */
  touch(plcId: number): void {
    const conn = this.connections.get(plcId);
    if (conn) conn.lastActivity = Date.now();
  }

  /** Shut down all connections */
  async shutdown(): Promise<void> {
    if (this.idleTimer) clearInterval(this.idleTimer);
    for (const plcId of this.connections.keys()) {
      await this.disconnect(plcId);
    }
  }

  private emitStatus(plcId: number, status: ConnectionStatus, error?: string): void {
    (this as EventEmitter).emit("status", plcId, status, error);
  }

  private async cleanupConnection(plcId: number): Promise<void> {
    const conn = this.connections.get(plcId);
    if (!conn) return;

    try {
      if (conn.session) {
        await conn.session.close().catch(() => {});
        conn.session = null;
      }
      await conn.client.disconnect().catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
  }

  private scheduleReconnect(plcId: number, endpoint: string): void {
    this.clearReconnectTimer(plcId);
    const timer = setTimeout(async () => {
      console.log(`[OPC UA] Attempting reconnect to PLC ${plcId}...`);
      await this.connect(plcId, endpoint);
    }, RECONNECT_BASE_MS);
    this.reconnectTimers.set(plcId, timer);
  }

  private clearReconnectTimer(plcId: number): void {
    const timer = this.reconnectTimers.get(plcId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(plcId);
    }
  }

  private checkIdleConnections(): void {
    const now = Date.now();
    for (const [plcId, conn] of this.connections) {
      if (conn.status === "connected" && now - conn.lastActivity > IDLE_TIMEOUT_MS) {
        console.log(`[OPC UA] Idle timeout — disconnecting PLC ${plcId}`);
        this.disconnect(plcId);
      }
    }
  }
}

// Singleton — shared across the application
export const connectionManager = new ConnectionManager();
