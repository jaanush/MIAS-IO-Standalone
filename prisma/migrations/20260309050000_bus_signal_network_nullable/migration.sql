-- Make bus_signal.plc_network_id nullable with ON DELETE SET NULL
-- so deleting a PlcNetwork nulls the reference rather than blocking the delete

-- Drop existing FK constraint (Prisma-generated name)
ALTER TABLE bus_signal DROP CONSTRAINT IF EXISTS "bus_signal_plc_network_id_fkey";

-- Allow NULL
ALTER TABLE bus_signal ALTER COLUMN plc_network_id DROP NOT NULL;

-- Re-add FK with SET NULL cascade
ALTER TABLE bus_signal
  ADD CONSTRAINT "bus_signal_plc_network_id_fkey"
  FOREIGN KEY (plc_network_id) REFERENCES plc_network(id) ON DELETE SET NULL;
