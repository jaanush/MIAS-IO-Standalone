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
  const raw = fs.readFileSync(seedFile, "utf-8");
  // Strip psql metacommands, pg_dump warnings, and setval calls (we reset sequences separately)
  const sql = raw.split("\n").filter((l) =>
    !l.startsWith("\\") && !l.startsWith("pg_dump:") && !l.includes("pg_catalog.setval")
  ).join("\n");

  // Step 1: Truncate + insert data. `users` is included so the seed-side
  // INSERTs (admin@mias.io + initial accounts) don't conflict with rows the
  // docker entrypoint's default-admin step may have already created.
  // session_replication_role=replica bypasses FK trigger checks during the
  // load; seed_data.sql is a pg_dump that doesn't insert in FK-safe order
  // (e.g. plc_network references io_card_id but plc_network rows come first).
  const dataSql = `
    SET session_replication_role = 'replica';

    TRUNCATE
      users,
      analog_alarm, discrete_alarm,
      analog_signal, discrete_signal, bus_signal, signal,
      pdo_config, instance_signal, component_instance,
      component_analog_alarm, component_discrete_alarm, component_signal, hardware_component,
      io_card, carrier_port, plc_port, network_node, ip_network, plc_network, io_carrier, plc,
      global_variable_list, codesys_settings, codesys_task, codesys_session,
      codesys_fb_connection, codesys_fb_instance, codesys_fb_parameter, codesys_fb_definition,
      codesys_variable, codesys_import,
      wiring_recipe_param, wiring_recipe,
      project_approval, project,
      module_catalog_approval, module_catalog_protocol, module_catalog,
      device_catalog_approval, device_catalog_protocol, device_catalog,
      engineering_unit, input_type_catalog, plc_data_type_catalog, signal_system, approval,
      module_type_code
    CASCADE;

    ${sql}

    SET session_replication_role = 'origin';
  `;

  await prisma.$executeRawUnsafe(dataSql);
  console.log("Data inserted.");

  // Step 2: Reset sequences (separate call, tolerant of missing sequences)
  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN
          SELECT c.relname AS seq
          FROM pg_class c
          WHERE c.relkind = 'S'
            AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        LOOP
          BEGIN
            EXECUTE format(
              'SELECT setval(''public.%I'', COALESCE((SELECT MAX(id) FROM %I), 0) + 1, false)',
              r.seq, replace(r.seq, '_id_seq', '')
            );
          EXCEPTION WHEN OTHERS THEN
            NULL;
          END;
        END LOOP;
      END $$;
    `);
    console.log("Sequences reset.");
  } catch (e) {
    console.warn("Sequence reset failed (non-fatal):", (e as Error).message);
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => { console.error("Seed failed:", e.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
