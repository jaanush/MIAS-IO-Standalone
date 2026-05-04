/**
 * One-off OPC UA discovery — connect to the given endpoint, dump the
 * Objects-folder tree (depth-limited), then read every leaf variable.
 *
 * Usage:
 *   npx tsx scripts/opcua-probe.ts opc.tcp://192.168.107.11:4840
 *   npx tsx scripts/opcua-probe.ts opc.tcp://192.168.107.11:4840 --depth 4
 */
import {
  OPCUAClient,
  AttributeIds,
  BrowseDirection,
  NodeClassMask,
  MessageSecurityMode,
  SecurityPolicy,
  TimestampsToReturn,
  type ClientSession,
} from "node-opcua-client";

const args = process.argv.slice(2);
const endpoint = args.find((a) => a.startsWith("opc.tcp://")) ?? "opc.tcp://192.168.107.11:4840";
const depthIdx = args.indexOf("--depth");
const maxDepth = depthIdx !== -1 ? parseInt(args[depthIdx + 1], 10) : 5;
const maxLeafReads = 500;

const NODE_CLASS = {
  1: "Object",
  2: "Variable",
  4: "Method",
  8: "ObjectType",
  16: "VariableType",
  32: "ReferenceType",
  64: "DataType",
  128: "View",
} as const;

interface LeafVar {
  nodeId: string;
  path: string;
}

async function browseTree(
  session: ClientSession,
  rootNodeId: string,
  rootPath: string,
  depth: number,
  out: { tree: string[]; leaves: LeafVar[] },
): Promise<void> {
  if (depth < 0) return;
  const browseResult = await session.browse({
    nodeId: rootNodeId,
    browseDirection: BrowseDirection.Forward,
    nodeClassMask: NodeClassMask.Object | NodeClassMask.Variable,
    resultMask: 0x3f,
  });
  const refs = browseResult.references ?? [];
  for (const ref of refs) {
    const name = ref.browseName?.name ?? ref.displayName?.text ?? "?";
    const cls = NODE_CLASS[ref.nodeClass as keyof typeof NODE_CLASS] ?? "Other";
    const childPath = `${rootPath}/${name}`;
    out.tree.push(`${"  ".repeat(maxDepth - depth + 1)}[${cls}] ${name}  ←  ${ref.nodeId.toString()}`);
    if (ref.nodeClass === 2) {
      out.leaves.push({ nodeId: ref.nodeId.toString(), path: childPath });
    }
    if (ref.nodeClass === 1 && depth > 0) {
      await browseTree(session, ref.nodeId.toString(), childPath, depth - 1, out);
    }
  }
}

async function main() {
  console.log(`Connecting to ${endpoint} (max depth ${maxDepth})…`);

  const client = OPCUAClient.create({
    applicationName: "MIAS-IO probe",
    keepSessionAlive: true,
    requestedSessionTimeout: 30_000,
    securityMode: MessageSecurityMode.None,
    securityPolicy: SecurityPolicy.None,
    endpointMustExist: false,
    connectionStrategy: { initialDelay: 500, maxRetry: 1 },
  });

  client.on("backoff", (n, d) => console.error(`  backoff ${n} delay=${d}ms`));

  try {
    await client.connect(endpoint);
  } catch (e) {
    console.error(`✗ Connect failed:`, e instanceof Error ? e.message : e);
    process.exit(1);
  }
  console.log(`✓ Connected.`);

  const session = await client.createSession();
  console.log(`✓ Session created (id=${session.sessionId.toString()})`);

  const out = { tree: [] as string[], leaves: [] as LeafVar[] };

  // 1) Server info
  try {
    const serverArrayRead = await session.read({
      nodeId: "ns=0;i=2254", // Server_NamespaceArray
      attributeId: AttributeIds.Value,
    });
    const ns = serverArrayRead.value.value as string[];
    console.log(`\nNamespaces (${ns.length}):`);
    ns.forEach((u, i) => console.log(`  [${i}] ${u}`));
  } catch (e) {
    console.log(`(could not read namespace array)`);
  }

  // 2) Walk Objects folder
  console.log(`\nObjects folder tree:`);
  out.tree.push(`Objects (i=85)`);
  await browseTree(session, "i=85", "Objects", maxDepth, out);
  console.log(out.tree.join("\n"));

  // 3) Read every variable leaf
  console.log(`\n${out.leaves.length} variable leaves found.`);
  if (out.leaves.length > maxLeafReads) {
    console.log(`  (capping reads at ${maxLeafReads})`);
  }
  const slice = out.leaves.slice(0, maxLeafReads);

  if (slice.length === 0) {
    console.log("  (none)");
  } else {
    const reads = await session.read(
      slice.map((v) => ({ nodeId: v.nodeId, attributeId: AttributeIds.Value })),
      0,
    );
    console.log(`\nValue dump:`);
    for (let i = 0; i < slice.length; i++) {
      const dv = reads[i];
      const val = dv.value?.value;
      const dt = dv.value?.dataType ?? "?";
      const status = dv.statusCode?.name ?? "?";
      const valStr = val === undefined ? "—"
        : typeof val === "object" ? JSON.stringify(val).slice(0, 120)
        : String(val).slice(0, 120);
      console.log(`  ${slice[i].path}  =  ${valStr}  (dt=${dt}, ${status})`);
    }
  }

  await session.close();
  await client.disconnect();
  console.log("\n✓ Disconnected.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
