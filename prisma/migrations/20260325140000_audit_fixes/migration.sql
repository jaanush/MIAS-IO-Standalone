-- Drop deletedAt columns (hard delete is the pattern per CLAUDE.md rule #10)
ALTER TABLE "plc" DROP COLUMN IF EXISTS "deleted_at";
ALTER TABLE "io_carrier" DROP COLUMN IF EXISTS "deleted_at";
ALTER TABLE "io_card" DROP COLUMN IF EXISTS "deleted_at";

-- Fix FK cascades: add onDelete behaviors where missing

-- Plc.catalog → SetNull
ALTER TABLE "plc" DROP CONSTRAINT IF EXISTS "plc_catalog_id_fkey";
ALTER TABLE "plc" ADD CONSTRAINT "plc_catalog_id_fkey"
    FOREIGN KEY ("catalog_id") REFERENCES "device_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- IoCarrier.catalog → SetNull
ALTER TABLE "io_carrier" DROP CONSTRAINT IF EXISTS "io_carrier_catalog_id_fkey";
ALTER TABLE "io_carrier" ADD CONSTRAINT "io_carrier_catalog_id_fkey"
    FOREIGN KEY ("catalog_id") REFERENCES "device_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- IoCarrier.bus → SetNull
ALTER TABLE "io_carrier" DROP CONSTRAINT IF EXISTS "io_carrier_plc_network_id_fkey";
ALTER TABLE "io_carrier" ADD CONSTRAINT "io_carrier_plc_network_id_fkey"
    FOREIGN KEY ("plc_network_id") REFERENCES "plc_network"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- IoCard.catalog → SetNull
ALTER TABLE "io_card" DROP CONSTRAINT IF EXISTS "io_card_catalog_id_fkey";
ALTER TABLE "io_card" ADD CONSTRAINT "io_card_catalog_id_fkey"
    FOREIGN KEY ("catalog_id") REFERENCES "module_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Signal.instanceSignal → SetNull
ALTER TABLE "signal" DROP CONSTRAINT IF EXISTS "signal_instance_signal_id_fkey";
ALTER TABLE "signal" ADD CONSTRAINT "signal_instance_signal_id_fkey"
    FOREIGN KEY ("instance_signal_id") REFERENCES "instance_signal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Signal.system → SetNull
ALTER TABLE "signal" DROP CONSTRAINT IF EXISTS "signal_system_id_fkey";
ALTER TABLE "signal" ADD CONSTRAINT "signal_system_id_fkey"
    FOREIGN KEY ("system_id") REFERENCES "signal_system"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Signal.gvl → SetNull
ALTER TABLE "signal" DROP CONSTRAINT IF EXISTS "signal_gvl_id_fkey";
ALTER TABLE "signal" ADD CONSTRAINT "signal_gvl_id_fkey"
    FOREIGN KEY ("gvl_id") REFERENCES "global_variable_list"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ComponentInstance.component → Cascade
ALTER TABLE "component_instance" DROP CONSTRAINT IF EXISTS "component_instance_component_id_fkey";
ALTER TABLE "component_instance" ADD CONSTRAINT "component_instance_component_id_fkey"
    FOREIGN KEY ("component_id") REFERENCES "hardware_component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ComponentInstance.bus → SetNull
ALTER TABLE "component_instance" DROP CONSTRAINT IF EXISTS "component_instance_plc_network_id_fkey";
ALTER TABLE "component_instance" ADD CONSTRAINT "component_instance_plc_network_id_fkey"
    FOREIGN KEY ("plc_network_id") REFERENCES "plc_network"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- InstanceSignal.componentSignal → Cascade
ALTER TABLE "instance_signal" DROP CONSTRAINT IF EXISTS "instance_signal_component_signal_id_fkey";
ALTER TABLE "instance_signal" ADD CONSTRAINT "instance_signal_component_signal_id_fkey"
    FOREIGN KEY ("component_signal_id") REFERENCES "component_signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CodesysSession.project → SetNull
ALTER TABLE "codesys_session" DROP CONSTRAINT IF EXISTS "codesys_session_mias_project_id_fkey";
ALTER TABLE "codesys_session" ADD CONSTRAINT "codesys_session_mias_project_id_fkey"
    FOREIGN KEY ("mias_project_id") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for common FK columns
CREATE INDEX IF NOT EXISTS "signal_project_id_idx" ON "signal"("project_id");
CREATE INDEX IF NOT EXISTS "signal_io_card_id_idx" ON "signal"("io_card_id");
CREATE INDEX IF NOT EXISTS "signal_instance_signal_id_idx" ON "signal"("instance_signal_id");
CREATE INDEX IF NOT EXISTS "io_card_carrier_id_idx" ON "io_card"("carrier_id");
CREATE INDEX IF NOT EXISTS "io_carrier_plc_id_idx" ON "io_carrier"("plc_id");
CREATE INDEX IF NOT EXISTS "component_signal_component_id_idx" ON "component_signal"("component_id");
CREATE INDEX IF NOT EXISTS "instance_signal_instance_id_idx" ON "instance_signal"("instance_id");
CREATE INDEX IF NOT EXISTS "instance_signal_component_signal_id_idx" ON "instance_signal"("component_signal_id");
CREATE INDEX IF NOT EXISTS "component_instance_project_id_idx" ON "component_instance"("project_id");
CREATE INDEX IF NOT EXISTS "component_instance_component_id_idx" ON "component_instance"("component_id");
CREATE INDEX IF NOT EXISTS "component_instance_bus_id_idx" ON "component_instance"("plc_network_id");
CREATE INDEX IF NOT EXISTS "bus_signal_bus_id_idx" ON "bus_signal"("plc_network_id");
CREATE INDEX IF NOT EXISTS "network_node_bus_id_idx" ON "network_node"("network_id");
