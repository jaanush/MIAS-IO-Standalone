-- PlcPort: change FK from plc_network (Bus) to ip_network (IpNetwork)
-- Null out existing values since they point to bus IDs, not network IDs
UPDATE plc_port SET plc_network_id = NULL;
ALTER TABLE plc_port DROP CONSTRAINT IF EXISTS "plc_port_plc_network_id_fkey";
ALTER TABLE plc_port ADD CONSTRAINT "plc_port_plc_network_id_fkey"
    FOREIGN KEY ("plc_network_id") REFERENCES "ip_network"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- CarrierPort: same change
UPDATE carrier_port SET plc_network_id = NULL;
ALTER TABLE carrier_port DROP CONSTRAINT IF EXISTS "carrier_port_plc_network_id_fkey";
ALTER TABLE carrier_port ADD CONSTRAINT "carrier_port_plc_network_id_fkey"
    FOREIGN KEY ("plc_network_id") REFERENCES "ip_network"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Remove plcPorts and carrierPorts relations from Bus (plc_network table)
-- No schema change needed — just the FK change above disconnects them
