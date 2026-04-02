/**
 * OPC UA Subscription Fan-out Manager
 *
 * Maintains a single ClientSubscription per PLC and fans out value
 * changes to multiple WebSocket clients. Key behaviors:
 *
 * - Shared MonitoredItems: if two WS clients subscribe to the same
 *   signal, only one OPC UA MonitoredItem is created.
 * - Batching: value changes are buffered for 50ms and sent as a
 *   single message per WS client.
 * - Cleanup: when a WS client disconnects, its subscriptions are
 *   removed. Orphaned MonitoredItems are terminated.
 * - Session recovery: when OPC UA reconnects, subscriptions are
 *   re-created automatically.
 */

import {
  ClientSubscription,
  ClientMonitoredItem,
  AttributeIds,
  TimestampsToReturn,
  DataType,
  type DataValue,
} from "node-opcua-client";
import type { WebSocket } from "ws";
import { connectionManager } from "./connection-manager";

export interface ValueUpdate {
  signalId: number;
  nodeId: string;
  value: unknown;
  dataType: string;
  timestamp: string;
  statusCode: number;
  statusText: string;
}

interface PlcSubscription {
  subscription: ClientSubscription | null;
  /** nodeId → MonitoredItem */
  monitoredItems: Map<string, ClientMonitoredItem>;
  /** nodeId → set of WS clients watching this node */
  fanout: Map<string, Set<WebSocket>>;
  /** nodeId → signalId mapping (for messages to clients) */
  nodeToSignal: Map<string, number>;
  /** Pending batched updates per WS client */
  pendingUpdates: Map<WebSocket, ValueUpdate[]>;
  /** Batch flush timer */
  batchTimer: ReturnType<typeof setTimeout> | null;
}

const PUBLISH_INTERVAL_MS = 250;
const SAMPLING_INTERVAL_MS = 100;
const BATCH_WINDOW_MS = 50;

class SubscriptionManager {
  private plcSubs = new Map<number, PlcSubscription>();

  constructor() {
    // Re-subscribe after OPC UA session restore
    connectionManager.on("session_restored", (plcId: number) => {
      this.restoreSubscriptions(plcId);
    });
  }

  /**
   * Subscribe a WebSocket client to signals on a PLC.
   * signalMap: Map<signalId, nodeId>
   */
  async subscribe(
    ws: WebSocket,
    plcId: number,
    signalMap: Map<number, string>,
  ): Promise<void> {
    if (!connectionManager.hasSession(plcId)) {
      throw new Error(`PLC ${plcId} is not connected`);
    }

    let plcSub = this.plcSubs.get(plcId);
    if (!plcSub) {
      plcSub = {
        subscription: null,
        monitoredItems: new Map(),
        fanout: new Map(),
        nodeToSignal: new Map(),
        pendingUpdates: new Map(),
        batchTimer: null,
      };
      this.plcSubs.set(plcId, plcSub);
    }

    // Ensure ClientSubscription exists
    if (!plcSub.subscription) {
      const session = connectionManager.getSession(plcId);
      plcSub.subscription = ClientSubscription.create(session, {
        requestedPublishingInterval: PUBLISH_INTERVAL_MS,
        requestedMaxKeepAliveCount: 20,
        requestedLifetimeCount: 60,
        maxNotificationsPerPublish: 0, // unlimited
        publishingEnabled: true,
      });
    }

    for (const [signalId, nodeId] of signalMap) {
      plcSub.nodeToSignal.set(nodeId, signalId);

      // Add WS to fanout set
      let clients = plcSub.fanout.get(nodeId);
      if (!clients) {
        clients = new Set();
        plcSub.fanout.set(nodeId, clients);
      }
      clients.add(ws);

      // If node already monitored, skip creating a new MonitoredItem
      if (plcSub.monitoredItems.has(nodeId)) continue;

      // Create MonitoredItem
      try {
        const item = await ClientMonitoredItem.create(
          plcSub.subscription,
          {
            nodeId,
            attributeId: AttributeIds.Value,
          },
          {
            samplingInterval: SAMPLING_INTERVAL_MS,
            discardOldest: true,
            queueSize: 10,
          },
          TimestampsToReturn.Both,
        );

        plcSub.monitoredItems.set(nodeId, item);

        item.on("changed", (dataValue: DataValue) => {
          this.onValueChange(plcId, nodeId, dataValue);
        });
      } catch (err) {
        console.error(`[SubMgr] Failed to monitor ${nodeId} on PLC ${plcId}:`, err);
      }
    }

    connectionManager.touch(plcId);
  }

  /** Unsubscribe a WS client from specific signals */
  async unsubscribe(ws: WebSocket, plcId: number, nodeIds: string[]): Promise<void> {
    const plcSub = this.plcSubs.get(plcId);
    if (!plcSub) return;

    for (const nodeId of nodeIds) {
      const clients = plcSub.fanout.get(nodeId);
      if (!clients) continue;

      clients.delete(ws);

      // If no more clients watching this node, terminate MonitoredItem
      if (clients.size === 0) {
        plcSub.fanout.delete(nodeId);
        const item = plcSub.monitoredItems.get(nodeId);
        if (item) {
          try {
            await item.terminate();
          } catch {
            // Ignore termination errors
          }
          plcSub.monitoredItems.delete(nodeId);
        }
        plcSub.nodeToSignal.delete(nodeId);
      }
    }
  }

  /** Remove a WS client from ALL subscriptions (called on disconnect) */
  async removeClient(ws: WebSocket): Promise<void> {
    for (const [plcId, plcSub] of this.plcSubs) {
      const nodeIdsToRemove: string[] = [];

      for (const [nodeId, clients] of plcSub.fanout) {
        clients.delete(ws);
        if (clients.size === 0) {
          nodeIdsToRemove.push(nodeId);
        }
      }

      // Clean up orphaned MonitoredItems
      for (const nodeId of nodeIdsToRemove) {
        plcSub.fanout.delete(nodeId);
        const item = plcSub.monitoredItems.get(nodeId);
        if (item) {
          try {
            await item.terminate();
          } catch {
            // Ignore
          }
          plcSub.monitoredItems.delete(nodeId);
        }
        plcSub.nodeToSignal.delete(nodeId);
      }

      // Clean up pending updates for this client
      plcSub.pendingUpdates.delete(ws);

      // If no more items, clean up the subscription
      if (plcSub.monitoredItems.size === 0 && plcSub.subscription) {
        try {
          await plcSub.subscription.terminate();
        } catch {
          // Ignore
        }
        plcSub.subscription = null;
      }

      // If completely empty, remove the PLC entry
      if (plcSub.fanout.size === 0) {
        this.plcSubs.delete(plcId);
      }
    }
  }

  /** Get count of active subscriptions for a PLC */
  getSubscriptionCount(plcId: number): number {
    return this.plcSubs.get(plcId)?.monitoredItems.size ?? 0;
  }

  /** Shut down all subscriptions */
  async shutdown(): Promise<void> {
    for (const [, plcSub] of this.plcSubs) {
      if (plcSub.batchTimer) clearTimeout(plcSub.batchTimer);
      if (plcSub.subscription) {
        try {
          await plcSub.subscription.terminate();
        } catch {
          // Ignore
        }
      }
    }
    this.plcSubs.clear();
  }

  /** Handle a value change from OPC UA — buffer for batching */
  private onValueChange(plcId: number, nodeId: string, dataValue: DataValue): void {
    const plcSub = this.plcSubs.get(plcId);
    if (!plcSub) return;

    const clients = plcSub.fanout.get(nodeId);
    if (!clients || clients.size === 0) return;

    const signalId = plcSub.nodeToSignal.get(nodeId) ?? 0;
    const update: ValueUpdate = {
      signalId,
      nodeId,
      value: dataValue.value?.value ?? null,
      dataType: DataType[dataValue.value?.dataType ?? DataType.Null],
      timestamp: (dataValue.sourceTimestamp ?? dataValue.serverTimestamp ?? new Date()).toISOString(),
      statusCode: dataValue.statusCode?.value ?? 0,
      statusText: dataValue.statusCode?.name ?? "Unknown",
    };

    // Add to pending updates for each watching client
    for (const ws of clients) {
      if (ws.readyState !== ws.OPEN) continue;
      let pending = plcSub.pendingUpdates.get(ws);
      if (!pending) {
        pending = [];
        plcSub.pendingUpdates.set(ws, pending);
      }
      pending.push(update);
    }

    // Schedule batch flush
    if (!plcSub.batchTimer) {
      plcSub.batchTimer = setTimeout(() => {
        this.flushBatch(plcId);
      }, BATCH_WINDOW_MS);
    }
  }

  /** Flush batched updates to all clients */
  private flushBatch(plcId: number): void {
    const plcSub = this.plcSubs.get(plcId);
    if (!plcSub) return;

    plcSub.batchTimer = null;

    for (const [ws, updates] of plcSub.pendingUpdates) {
      if (updates.length === 0) continue;
      if (ws.readyState !== ws.OPEN) continue;

      const message = JSON.stringify({
        type: "values",
        plcId,
        updates: updates.map(({ signalId, value, dataType, timestamp, statusCode, statusText }) => ({
          signalId,
          value,
          dataType,
          ts: timestamp,
          status: statusText,
          statusCode,
        })),
      });

      try {
        ws.send(message);
      } catch {
        // Client probably disconnected — will be cleaned up
      }
    }

    plcSub.pendingUpdates.clear();
  }

  /** Re-create subscriptions after OPC UA session restore */
  private async restoreSubscriptions(plcId: number): Promise<void> {
    const plcSub = this.plcSubs.get(plcId);
    if (!plcSub || plcSub.fanout.size === 0) return;

    console.log(`[SubMgr] Restoring ${plcSub.fanout.size} subscriptions for PLC ${plcId}`);

    // Clear old subscription and items (session is gone)
    plcSub.subscription = null;
    plcSub.monitoredItems.clear();

    // Create new subscription on the restored session
    const session = connectionManager.getSession(plcId);
    plcSub.subscription = ClientSubscription.create(session, {
      requestedPublishingInterval: PUBLISH_INTERVAL_MS,
      requestedMaxKeepAliveCount: 20,
      requestedLifetimeCount: 60,
      maxNotificationsPerPublish: 0,
      publishingEnabled: true,
    });

    // Re-create all MonitoredItems
    for (const [nodeId] of plcSub.fanout) {
      try {
        const item = await ClientMonitoredItem.create(
          plcSub.subscription,
          { nodeId, attributeId: AttributeIds.Value },
          { samplingInterval: SAMPLING_INTERVAL_MS, discardOldest: true, queueSize: 10 },
          TimestampsToReturn.Both,
        );
        plcSub.monitoredItems.set(nodeId, item);
        item.on("changed", (dataValue: DataValue) => {
          this.onValueChange(plcId, nodeId, dataValue);
        });
      } catch (err) {
        console.error(`[SubMgr] Failed to restore monitor for ${nodeId}:`, err);
      }
    }

    console.log(`[SubMgr] Restored ${plcSub.monitoredItems.size} items for PLC ${plcId}`);
  }
}

export const subscriptionManager = new SubscriptionManager();
