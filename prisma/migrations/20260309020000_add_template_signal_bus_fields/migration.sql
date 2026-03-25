-- Create signal_direction type if it doesn't exist (was created outside Prisma on live DB)
DO $$ BEGIN
  CREATE TYPE signal_direction AS ENUM ('INPUT', 'OUTPUT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add bus signal fields to template_signal
ALTER TABLE template_signal
  ADD COLUMN IF NOT EXISTS direction            signal_direction NULL,
  ADD COLUMN IF NOT EXISTS plc_data_type_id     INT NULL REFERENCES plc_data_type_catalog(id),
  ADD COLUMN IF NOT EXISTS raw_data_type        bus_raw_data_type NULL,
  ADD COLUMN IF NOT EXISTS byte_order           byte_order NULL,
  ADD COLUMN IF NOT EXISTS can_node_id          SMALLINT NULL,
  ADD COLUMN IF NOT EXISTS can_id               INT NULL,
  ADD COLUMN IF NOT EXISTS bit_offset           INT NULL,
  ADD COLUMN IF NOT EXISTS bit_length           SMALLINT NULL,
  ADD COLUMN IF NOT EXISTS modbus_unit_id       SMALLINT NULL,
  ADD COLUMN IF NOT EXISTS modbus_register_type modbus_register_type NULL,
  ADD COLUMN IF NOT EXISTS modbus_register_offset INT NULL;
