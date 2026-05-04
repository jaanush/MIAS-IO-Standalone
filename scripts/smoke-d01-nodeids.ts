/**
 * Smoke test: pull 5 D01 signals, build nodeIds with new buildReadNodeId,
 * read them via OPC UA, print results.
 */
import { db } from "../src/lib/db";
import { halInstanceTag, buildReadNodeId } from "../src/server/lib/opcua/node-id";
import { OPCUAClient, AttributeIds, MessageSecurityMode, SecurityPolicy } from "node-opcua-client";

async function main() {
  const plc = await db.plc.findFirst({
    where: { codesysDeviceName: { not: null } },
    select: { id: true, name: true, ipAddress: true, codesysDeviceName: true },
  });
  if (!plc) { console.log("No PLC with codesysDeviceName"); return; }
  console.log("PLC:", plc);

  const sigs = await db.signal.findMany({
    where: {
      ioCard: { carrier: { plcId: plc.id } },
      componentTag: { not: null },
      tag: { not: null },
      gvl: { isNot: null },
    },
    select: {
      id: true, tag: true, signalType: true, componentTag: true,
      gvl: { select: { name: true } },
    },
    take: 8,
  });
  console.log(`Found ${sigs.length} candidate signals`);

  const items = sigs
    .filter((s): s is typeof s & { tag: string; gvl: { name: string } } => !!s.tag && !!s.gvl)
    .map((s) => ({
      sig: s,
      halTag: halInstanceTag(s.tag, s.componentTag),
      nodeId: buildReadNodeId(
        {
          deviceName: plc.codesysDeviceName!,
          gvlName: s.gvl.name,
          signalTag: s.tag,
          componentTag: s.componentTag,
        },
        s.signalType as "DISCRETE" | "ANALOG",
      ),
    }));
  for (const it of items) {
    console.log(`#${it.sig.id} ${it.sig.signalType} tag=${it.sig.tag} ct=${it.sig.componentTag}`);
    console.log(`  hal=${it.halTag}`);
    console.log(`  node=${it.nodeId}`);
  }

  const endpoint = `opc.tcp://${plc.ipAddress}:4840`;
  console.log(`\nConnecting to ${endpoint}...`);
  const c = OPCUAClient.create({
    applicationName: "smoke",
    securityMode: MessageSecurityMode.None,
    securityPolicy: SecurityPolicy.None,
    endpointMustExist: false,
    connectionStrategy: { initialDelay: 500, maxRetry: 1 },
  });
  await c.connect(endpoint);
  const sess = await c.createSession();
  for (const it of items) {
    try {
      const v = await sess.read({ nodeId: it.nodeId, attributeId: AttributeIds.Value });
      const valStr = JSON.stringify(v.value?.value)?.slice(0, 80);
      console.log(`#${it.sig.id} ${it.sig.signalType.padEnd(8)} value=${valStr}  status=${v.statusCode?.name}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`#${it.sig.id} READ_ERR ${msg}`);
    }
  }
  await sess.close();
  await c.disconnect();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
