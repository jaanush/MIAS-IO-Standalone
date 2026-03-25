-- Drop legacy Bus.plcId — PLC-bus relationships are now via BusNode
ALTER TABLE "plc_network" DROP CONSTRAINT IF EXISTS "plc_network_plc_id_fkey";
ALTER TABLE "plc_network" DROP COLUMN IF EXISTS "plc_id";
