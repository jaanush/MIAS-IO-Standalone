/**
 * Mock OPC UA Server — simulates a CODESYS runtime for DevTools development.
 *
 * Usage: npx tsx scripts/mock-opcua-server.ts [port]
 *
 * Creates a fake address space mimicking CODESYS GVL structure:
 *   ns=4;s=|var|Application.GVL_Cabinet1.Carrier1_DI_Signal1
 *
 * Variables simulate realistic behavior:
 *   - Booleans toggle periodically
 *   - Analog values follow sine/random patterns
 *   - Writable variables echo back what was written
 */

import {
  OPCUAServer,
  Variant,
  DataType,
  StatusCodes,
  UAObject,
  Namespace,
  AddressSpace,
} from "node-opcua";

const PORT = parseInt(process.argv[2] || "4840", 10);

// Simulated hardware structure
const CABINETS = [
  {
    name: "GVL_Cabinet1",
    carriers: [
      {
        name: "Carrier1",
        cards: [
          {
            article: "750-530",
            type: "DO",
            channels: [
              { tag: "DO_StartCmd", dataType: DataType.Boolean, writable: true },
              { tag: "DO_StopCmd", dataType: DataType.Boolean, writable: true },
              { tag: "DO_ResetCmd", dataType: DataType.Boolean, writable: true },
              { tag: "DO_ValveOpen", dataType: DataType.Boolean, writable: true },
            ],
          },
          {
            article: "750-421",
            type: "DI",
            channels: [
              { tag: "DI_RunFeedback", dataType: DataType.Boolean, writable: false },
              { tag: "DI_TripAlarm", dataType: DataType.Boolean, writable: false },
              { tag: "DI_DoorSwitch", dataType: DataType.Boolean, writable: false },
              { tag: "DI_EmergencyStop", dataType: DataType.Boolean, writable: false },
            ],
          },
        ],
      },
      {
        name: "Carrier2",
        cards: [
          {
            article: "750-469",
            type: "AI",
            channels: [
              { tag: "AI_Temperature", dataType: DataType.Float, writable: false },
              { tag: "AI_Pressure", dataType: DataType.Float, writable: false },
              { tag: "AI_FlowRate", dataType: DataType.Float, writable: false },
              { tag: "AI_Level", dataType: DataType.Float, writable: false },
            ],
          },
          {
            article: "750-559",
            type: "AO",
            channels: [
              { tag: "AO_SpeedRef", dataType: DataType.Float, writable: true },
              { tag: "AO_ValvePos", dataType: DataType.Float, writable: true },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "GVL_Cabinet2",
    carriers: [
      {
        name: "Carrier3",
        cards: [
          {
            article: "750-421",
            type: "DI",
            channels: [
              { tag: "DI_PumpRunning", dataType: DataType.Boolean, writable: false },
              { tag: "DI_PumpTrip", dataType: DataType.Boolean, writable: false },
              { tag: "DI_HighLevel", dataType: DataType.Boolean, writable: false },
              { tag: "DI_LowLevel", dataType: DataType.Boolean, writable: false },
            ],
          },
          {
            article: "750-469",
            type: "AI",
            channels: [
              { tag: "AI_BearingTemp", dataType: DataType.Float, writable: false },
              { tag: "AI_MotorCurrent", dataType: DataType.Float, writable: false },
              { tag: "AI_Vibration", dataType: DataType.Float, writable: false },
            ],
          },
        ],
      },
    ],
  },
];

// Runtime state for simulated values
const simulatedValues = new Map<string, { value: any; dataType: DataType }>();

async function main() {
  const server = new OPCUAServer({
    port: PORT,
    resourcePath: "/",
    buildInfo: {
      productName: "MIAS Mock CODESYS Runtime",
      buildNumber: "1.0.0",
      buildDate: new Date(),
    },
    // No security — matches real dev setup
    allowAnonymous: true,
  });

  await server.initialize();

  const addressSpace = server.engine.addressSpace!;
  const namespace = addressSpace.getOwnNamespace(); // ns=1

  // CODESYS uses ns=4, but node-opcua assigns sequential namespaces.
  // We'll register extra namespaces to get ns=4.
  addressSpace.registerNamespace("reserved2");
  addressSpace.registerNamespace("reserved3");
  const ns4 = addressSpace.registerNamespace("CodesysApplication"); // This should be ns=4

  // Create the Application root object
  const appFolder = ns4.addObject({
    organizedBy: addressSpace.rootFolder.objects,
    browseName: "|var|Application",
    nodeId: `s=|var|Application`,
  });

  // Build the GVL structure
  for (const cabinet of CABINETS) {
    const gvlFolder = ns4.addObject({
      componentOf: appFolder,
      browseName: cabinet.name,
      nodeId: `s=|var|Application.${cabinet.name}`,
    });

    for (const carrier of cabinet.carriers) {
      for (const card of carrier.cards) {
        for (const channel of card.channels) {
          const fullTag = `${carrier.name}_${channel.tag}`;
          const nodeId = `s=|var|Application.${cabinet.name}.${fullTag}`;

          // Initialize simulated value
          const initValue =
            channel.dataType === DataType.Boolean
              ? false
              : channel.dataType === DataType.Float
                ? 0.0
                : 0;
          simulatedValues.set(nodeId, { value: initValue, dataType: channel.dataType });

          ns4.addVariable({
            componentOf: gvlFolder,
            browseName: fullTag,
            nodeId,
            dataType: channel.dataType === DataType.Boolean ? "Boolean" : "Float",
            value: {
              get: () => {
                const sv = simulatedValues.get(nodeId);
                return new Variant({
                  dataType: sv?.dataType ?? DataType.Null,
                  value: sv?.value ?? null,
                });
              },
              set: (variant: Variant) => {
                if (channel.writable) {
                  simulatedValues.set(nodeId, {
                    value: variant.value,
                    dataType: channel.dataType,
                  });
                  return StatusCodes.Good;
                }
                return StatusCodes.BadNotWritable;
              },
            },
          });
        }
      }
    }
  }

  await server.start();

  const endpointUrl = server.getEndpointUrl();
  console.log(`\n  Mock OPC UA Server running at: ${endpointUrl}`);
  console.log(`  Namespace 4: CodesysApplication`);
  console.log(`  Variables: ${simulatedValues.size}`);
  console.log(`  Press Ctrl+C to stop\n`);

  // Log the full variable tree
  console.log("  Address space:");
  for (const cabinet of CABINETS) {
    console.log(`    ${cabinet.name}/`);
    for (const carrier of cabinet.carriers) {
      for (const card of carrier.cards) {
        for (const channel of card.channels) {
          const tag = `${carrier.name}_${channel.tag}`;
          const rw = channel.writable ? "RW" : "RO";
          const dt = channel.dataType === DataType.Boolean ? "BOOL" : "FLOAT";
          console.log(`      ${tag}  [${dt}, ${rw}]`);
        }
      }
    }
  }
  console.log("");

  // Simulation loop — update values every 500ms
  const startTime = Date.now();
  setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;

    for (const [nodeId, sv] of simulatedValues) {
      // Only update non-writable values (writable ones keep their set value)
      const isWritable = nodeId.includes("DO_") || nodeId.includes("AO_");
      if (isWritable) continue;

      if (sv.dataType === DataType.Boolean) {
        // Toggle at different rates per signal
        const hash = simpleHash(nodeId);
        const period = 2 + (hash % 5); // 2-6 second period
        sv.value = Math.sin((elapsed * Math.PI * 2) / period) > 0;
      } else if (sv.dataType === DataType.Float) {
        // Simulate realistic analog values
        if (nodeId.includes("Temperature")) {
          sv.value = 45 + 15 * Math.sin(elapsed / 10) + (Math.random() - 0.5) * 2;
        } else if (nodeId.includes("Pressure")) {
          sv.value = 3.0 + 1.0 * Math.sin(elapsed / 8) + (Math.random() - 0.5) * 0.3;
        } else if (nodeId.includes("FlowRate")) {
          sv.value = 120 + 30 * Math.sin(elapsed / 15) + (Math.random() - 0.5) * 5;
        } else if (nodeId.includes("Level")) {
          sv.value = 50 + 20 * Math.sin(elapsed / 20) + (Math.random() - 0.5) * 2;
        } else if (nodeId.includes("BearingTemp")) {
          sv.value = 55 + 8 * Math.sin(elapsed / 12) + (Math.random() - 0.5) * 1;
        } else if (nodeId.includes("MotorCurrent")) {
          sv.value = 85 + 10 * Math.sin(elapsed / 6) + (Math.random() - 0.5) * 3;
        } else if (nodeId.includes("Vibration")) {
          sv.value = 2.5 + 1.5 * Math.sin(elapsed / 4) + (Math.random() - 0.5) * 0.5;
        } else {
          sv.value = 50 + 25 * Math.sin(elapsed / 10);
        }
      }
    }
  }, 500);

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n  Shutting down mock OPC UA server...");
    await server.shutdown();
    process.exit(0);
  });
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

main().catch((err) => {
  console.error("Failed to start mock OPC UA server:", err);
  process.exit(1);
});
