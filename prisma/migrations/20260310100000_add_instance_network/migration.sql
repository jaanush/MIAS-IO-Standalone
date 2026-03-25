-- AlterTable
ALTER TABLE "component_instance" ADD COLUMN "plc_network_id" INT REFERENCES "plc_network"(id);
