/**
 * Browse a single OPC UA node and read each child's value + datatype.
 * Usage: npx tsx scripts/opcua-browse-one.ts opc.tcp://… "ns=4;s=|var|…"
 */
import {
  OPCUAClient,
  AttributeIds,
  BrowseDirection,
  MessageSecurityMode,
  SecurityPolicy,
} from "node-opcua-client";

const endpoint = process.argv[2];
const target = process.argv[3];
if (!endpoint || !target) {
  console.error("Usage: npx tsx scripts/opcua-browse-one.ts <endpoint> <nodeId>");
  process.exit(1);
}

const client = OPCUAClient.create({
  applicationName: "MIAS-IO probe",
  securityMode: MessageSecurityMode.None,
  securityPolicy: SecurityPolicy.None,
  endpointMustExist: false,
  connectionStrategy: { initialDelay: 500, maxRetry: 1 },
});

(async () => {
  await client.connect(endpoint);
  const session = await client.createSession();
  const browse = await session.browse({
    nodeId: target,
    browseDirection: BrowseDirection.Forward,
    nodeClassMask: 0x3,
    resultMask: 0x3f,
  });
  const refs = browse.references ?? [];
  console.log(`Children of ${target}: ${refs.length}`);
  for (const r of refs) {
    const childId = r.nodeId.toString();
    const cls = r.nodeClass === 1 ? "Object" : r.nodeClass === 2 ? "Variable" : `cls=${r.nodeClass}`;
    const val = await session.read({ nodeId: childId, attributeId: AttributeIds.Value });
    const dtRead = await session.read({ nodeId: childId, attributeId: AttributeIds.DataType });
    const v = val.value?.value;
    const vstr = v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v).slice(0, 80) : String(v).slice(0, 80);
    console.log(`  [${cls}] ${r.browseName?.name}  =  ${vstr}  (dataType nodeId=${dtRead.value?.value})  ${val.statusCode?.name}`);
  }
  await session.close();
  await client.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
