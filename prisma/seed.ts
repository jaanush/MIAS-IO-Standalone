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

  const wrappedSql = `
    BEGIN;
    TRUNCATE
      analog_alarm, discrete_alarm,
      analog_signal, discrete_signal, bus_signal, signal,
      pdo_config, instance_signal, component_instance,
      component_analog_alarm, component_discrete_alarm, component_signal, hardware_component,
      io_card, carrier_port, plc_port, plc_network, io_carrier, plc,
      global_variable_list, codesys_settings, codesys_task, codesys_session,
      codesys_fb_connection, codesys_fb_instance, codesys_fb_parameter, codesys_fb_definition,
      codesys_variable, codesys_import,
      wiring_recipe_param, wiring_recipe,
      project_approval, project,
      module_catalog_approval, module_catalog_protocol, module_catalog,
      device_catalog_approval, device_catalog_protocol, device_catalog,
      engineering_unit, input_type_catalog, plc_data_type_catalog, signal_system, approval
    CASCADE;

    ${sql}

    -- Reset all sequences to max(id)+1 so new inserts get correct IDs
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN
        SELECT s.relname AS seq, t.relname AS tab, a.attname AS col
        FROM pg_class s
        JOIN pg_depend d ON d.objid = s.oid
        JOIN pg_class t ON t.oid = d.refobjid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
        WHERE s.relkind = 'S' AND t.relkind = 'r'
      LOOP
        EXECUTE format(
          'SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM %I), 0) + 1, false)',
          r.seq, r.col, r.tab
        );
      END LOOP;
    END $$;

    COMMIT;
  `;

  await prisma.$executeRawUnsafe(wrappedSql);
  console.log("Seed complete.");
}

main()
  .catch((e) => { console.error("Seed failed:", e.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
