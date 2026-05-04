/**
 * WebSocket protocol types — shared between server and client.
 *
 * All messages are JSON with a `type` discriminator.
 * Client messages include an `id` field for request-response correlation.
 */

// --- Client → Server ---

export interface SubscribeMessage {
  type: "subscribe";
  id: string;
  plcId: number;
  signalIds: number[];
  /**
   * Which leaf to monitor:
   *   "scaled" (default) — AsReal/AsBool, the override-resolved engineering value
   *   "raw"              — analog only, AsDint, the unscaled DAO counts
   * Server silently drops non-analog ids when mode === "raw".
   */
  mode?: "scaled" | "raw";
}

export interface UnsubscribeMessage {
  type: "unsubscribe";
  id: string;
  plcId: number;
  signalIds: number[];
  mode?: "scaled" | "raw";
}

export interface ReadMessage {
  type: "read";
  id: string;
  plcId: number;
  signalIds: number[];
}

export interface WriteMessage {
  type: "write";
  id: string;
  plcId: number;
  signalId: number;
  value: unknown;
  dataType?: string;
  /**
   * Optional sub-field appended to the signal's base node ID with a dot.
   * Used for HAL-FB sideload writes — e.g. `_bSideloadActive` (BOOL) or
   * `_rSideloadValueREAL` (FR-016 typed pin). Omit to write to the base
   * node.
   */
  subField?: string;
}

export interface ConnectMessage {
  type: "connect";
  id: string;
  plcId: number;
}

export interface DisconnectMessage {
  type: "disconnect";
  id: string;
  plcId: number;
}

export interface BrowseMessage {
  type: "browse";
  id: string;
  plcId: number;
  nodeId: string;
}

export type ClientMessage =
  | SubscribeMessage
  | UnsubscribeMessage
  | ReadMessage
  | WriteMessage
  | ConnectMessage
  | DisconnectMessage
  | BrowseMessage;

// --- Server → Client ---

export interface ValuesMessage {
  type: "values";
  plcId: number;
  /** "scaled" if omitted (back-compat). "raw" updates carry analog DAO counts. */
  mode?: "scaled" | "raw";
  updates: {
    signalId: number;
    value: unknown;
    dataType: string;
    ts: string;
    status: string;
    statusCode: number;
  }[];
}

export interface ConnectionStatusMessage {
  type: "connection";
  plcId: number;
  connected: boolean;
  status: string;
  error?: string;
}

export interface WriteResultMessage {
  type: "write_ok";
  id: string;
  success: boolean;
  message?: string;
}

export interface ReadResultMessage {
  type: "read_result";
  id: string;
  values: {
    signalId: number;
    value: unknown;
    dataType: string;
    ts: string;
    status: string;
  }[];
}

export interface BrowseResultMessage {
  type: "browse_result";
  id: string;
  nodes: {
    nodeId: string;
    browseName: string;
    displayName: string;
    nodeClass: string;
    hasChildren: boolean;
  }[];
}

export interface ErrorMessage {
  type: "error";
  id?: string;
  message: string;
}

export type ServerMessage =
  | ValuesMessage
  | ConnectionStatusMessage
  | WriteResultMessage
  | ReadResultMessage
  | BrowseResultMessage
  | ErrorMessage;
