/**
 * OPC UA read, write, and browse operations.
 */

import {
  AttributeIds,
  BrowseDirection,
  NodeClassMask,
  type ReadValueIdOptions,
  type WriteValueOptions,
  StatusCodes,
  DataType,
  type Variant,
  type ClientSession,
} from "node-opcua-client";
import { connectionManager } from "./connection-manager";

export interface OpcUaValue {
  nodeId: string;
  value: unknown;
  dataType: string;
  timestamp: string;
  statusCode: number;
  statusText: string;
}

export interface OpcUaNode {
  nodeId: string;
  browseName: string;
  displayName: string;
  nodeClass: string;
  hasChildren: boolean;
}

/** Read values from one or more node IDs */
export async function readValues(plcId: number, nodeIds: string[]): Promise<OpcUaValue[]> {
  const session = connectionManager.getSession(plcId);

  const nodesToRead: ReadValueIdOptions[] = nodeIds.map((nodeId) => ({
    nodeId,
    attributeId: AttributeIds.Value,
  }));

  const results = await session.read(nodesToRead);

  return results.map((result, i) => ({
    nodeId: nodeIds[i],
    value: result.value?.value ?? null,
    dataType: DataType[result.value?.dataType ?? DataType.Null],
    timestamp: (result.sourceTimestamp ?? result.serverTimestamp ?? new Date()).toISOString(),
    statusCode: result.statusCode?.value ?? 0,
    statusText: result.statusCode?.name ?? "Unknown",
  }));
}

/** Write a value to a node */
export async function writeValue(
  plcId: number,
  nodeId: string,
  value: unknown,
  dataType: string,
): Promise<{ success: boolean; message?: string }> {
  const session = connectionManager.getSession(plcId);

  const opcDataType = DataType[dataType as keyof typeof DataType];
  if (opcDataType === undefined) {
    return { success: false, message: `Unknown data type: ${dataType}` };
  }

  const writeValue: WriteValueOptions = {
    nodeId,
    attributeId: AttributeIds.Value,
    value: {
      value: {
        dataType: opcDataType,
        value,
      } as Variant,
    },
  };

  const statusCode = await session.write(writeValue);

  if (statusCode.value === StatusCodes.Good.value) {
    return { success: true };
  }
  return { success: false, message: statusCode.name ?? `Status: ${statusCode.value}` };
}

/** Browse children of a node */
export async function browseNode(plcId: number, nodeId: string): Promise<OpcUaNode[]> {
  const session = connectionManager.getSession(plcId);

  const browseResult = await session.browse({
    nodeId,
    browseDirection: BrowseDirection.Forward,
    nodeClassMask: NodeClassMask.Object | NodeClassMask.Variable,
    resultMask: 0x3f, // All fields
  });

  if (!browseResult.references) return [];

  // Check which nodes have children (for folder icons in UI)
  const nodes: OpcUaNode[] = [];
  for (const ref of browseResult.references) {
    const nodeClass = ref.nodeClass?.toString() ?? "Unknown";
    // Objects typically have children, variables don't
    const hasChildren = nodeClass === "Object" || nodeClass === "1";

    nodes.push({
      nodeId: ref.nodeId.toString(),
      browseName: ref.browseName.name ?? "",
      displayName: ref.displayName.text ?? ref.browseName.name ?? "",
      nodeClass: hasChildren ? "Object" : "Variable",
      hasChildren,
    });
  }

  return nodes;
}
