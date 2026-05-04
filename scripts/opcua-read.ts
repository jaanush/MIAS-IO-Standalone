import { OPCUAClient, AttributeIds, MessageSecurityMode, SecurityPolicy } from "node-opcua-client";

const endpoint = process.argv[2];
const targets = process.argv.slice(3);

(async () => {
  const c = OPCUAClient.create({
    applicationName: "probe",
    securityMode: MessageSecurityMode.None,
    securityPolicy: SecurityPolicy.None,
    endpointMustExist: false,
    connectionStrategy: { initialDelay: 500, maxRetry: 1 },
  });
  await c.connect(endpoint);
  const s = await c.createSession();
  for (const t of targets) {
    const v = await s.read({ nodeId: t, attributeId: AttributeIds.Value });
    const dt = await s.read({ nodeId: t, attributeId: AttributeIds.DataType });
    const cls = await s.read({ nodeId: t, attributeId: AttributeIds.NodeClass });
    console.log(`${t}\n  value=${JSON.stringify(v.value?.value)?.slice(0,120)}  dt=${dt.value?.value}  nodeClass=${cls.value?.value}  ${v.statusCode?.name}`);
  }
  await s.close();
  await c.disconnect();
})().catch((e) => { console.error(e.message ?? e); process.exit(1); });
