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
}

export interface UnsubscribeMessage {
  type: "unsubscribe";
  id: string;
  plcId: number;
  signalIds: number[];
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
