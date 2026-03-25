-- Add project_id to plc_network, make plc_id optional
ALTER TABLE "plc_network" ADD COLUMN "project_id" INT;

-- Backfill project_id from existing plc_id → plc.project_id
UPDATE "plc_network" SET "project_id" = (
  SELECT p.project_id FROM plc p WHERE p.id = plc_network.plc_id
);

-- Now make project_id NOT NULL
ALTER TABLE "plc_network" ALTER COLUMN "project_id" SET NOT NULL;

-- Make plc_id nullable
ALTER TABLE "plc_network" ALTER COLUMN "plc_id" DROP NOT NULL;

-- Change plc FK from CASCADE to SET NULL (deleting a PLC no longer deletes its networks)
ALTER TABLE "plc_network" DROP CONSTRAINT IF EXISTS "plc_network_plc_id_fkey";
ALTER TABLE "plc_network" ADD CONSTRAINT "plc_network_plc_id_fkey"
    FOREIGN KEY ("plc_id") REFERENCES "plc"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Add project FK with CASCADE
ALTER TABLE "plc_network" ADD CONSTRAINT "plc_network_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "project"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
