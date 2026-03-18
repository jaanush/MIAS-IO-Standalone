import { PrismaClient } from "./generated/prisma/client/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const seedFile = path.join(process.cwd(), "prisma", "seed_data.sql");
  if (!fs.existsSync(seedFile)) {
    console.error("prisma/seed_data.sql not found");
    process.exit(1);
  }

  console.log("Running main data seed (seed_data.sql)...");
  const sql = fs.readFileSync(seedFile, "utf-8");

  // Wrap in a transaction that truncates all non-user tables first,
  // then inserts the seed data. TRUNCATE CASCADE handles FK deps.
  const wrappedSql = `
    BEGIN;
    TRUNCATE
      analog_alarm, discrete_alarm,
      analog_signal, discrete_signal, bus_signal, signal,
      pdo_config, instance_signal, component_instance,
      component_analog_alarm, component_discrete_alarm, component_signal, hardware_component,
      io_card, carrier_port, plc_port, plc_network, io_carrier, plc,
      global_variable_list, codesys_settings, codesys_task,
      project_approval, project,
      module_catalog_approval, module_catalog_protocol, module_catalog,
      device_catalog_approval, device_catalog_protocol, device_catalog,
      engineering_unit, input_type_catalog, plc_data_type_catalog, signal_system, approval
    CASCADE;
    ${sql}
    COMMIT;
  `;

  await prisma.$executeRawUnsafe(wrappedSql);
  console.log("Seed complete.");
}

main()
  .catch((e) => { console.error("Seed failed:", e.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
