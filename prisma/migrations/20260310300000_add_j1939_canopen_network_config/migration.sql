-- Add J1939 to BusProtocol enum
ALTER TYPE "bus_protocol" ADD VALUE IF NOT EXISTS 'J1939';

-- Add J1939 to SignalOrigin enum
ALTER TYPE "signal_origin" ADD VALUE IF NOT EXISTS 'J1939';

-- Create SerialParity enum
DO $$ BEGIN
  CREATE TYPE "serial_parity" AS ENUM ('NONE', 'EVEN', 'ODD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create CanMode enum
DO $$ BEGIN
  CREATE TYPE "can_mode" AS ENUM ('TRANSPARENT', 'MAPPED', 'SNIFFER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- PlcNetwork: rename networkId → nodeAddress, add protocol-specific config fields
ALTER TABLE "plc_network"
  RENAME COLUMN "network_id" TO "node_address";

ALTER TABLE "plc_network"
  ADD COLUMN IF NOT EXISTS "baud_rate_kbit"    INTEGER,
  ADD COLUMN IF NOT EXISTS "baud_rate_bps"     INTEGER,
  ADD COLUMN IF NOT EXISTS "serial_parity"     "serial_parity",
  ADD COLUMN IF NOT EXISTS "serial_stop_bits"  SMALLINT,
  ADD COLUMN IF NOT EXISTS "ip_address"        VARCHAR(45),
  ADD COLUMN IF NOT EXISTS "ip_port"           SMALLINT,
  ADD COLUMN IF NOT EXISTS "can_mode"          "can_mode",
  ADD COLUMN IF NOT EXISTS "can_heartbeat_ms"  INTEGER,
  ADD COLUMN IF NOT EXISTS "can_sync_period_ms" INTEGER,
  ADD COLUMN IF NOT EXISTS "cycle_period_ms"   INTEGER;

-- ComponentSignal: add CANopen and J1939 addressing fields
ALTER TABLE "component_signal"
  ADD COLUMN IF NOT EXISTS "canopen_index"     INTEGER,
  ADD COLUMN IF NOT EXISTS "canopen_sub_index" SMALLINT,
  ADD COLUMN IF NOT EXISTS "j1939_pgn"         INTEGER,
  ADD COLUMN IF NOT EXISTS "j1939_spn"         INTEGER;

-- BusSignal: add CANopen and J1939 addressing fields
ALTER TABLE "bus_signal"
  ADD COLUMN IF NOT EXISTS "canopen_index"     INTEGER,
  ADD COLUMN IF NOT EXISTS "canopen_sub_index" SMALLINT,
  ADD COLUMN IF NOT EXISTS "j1939_pgn"         INTEGER,
  ADD COLUMN IF NOT EXISTS "j1939_spn"         INTEGER;
