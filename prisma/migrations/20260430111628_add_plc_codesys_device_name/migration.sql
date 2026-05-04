-- The CODESYS OPC UA path prefixes the application namespace with the
-- device-tree name set by the integrator (e.g. "WAGO 750-8210 PFC200
-- G2 4ETH"). MIAS-IO needs this string to construct correct node IDs
-- when subscribing to live values via the WS bridge. Add it as an
-- explicit nullable column on Plc; back-fill the LasseMaja D01 row from
-- the OPC UA probe today, leave NULL for the others until they're known.

ALTER TABLE plc ADD COLUMN codesys_device_name VARCHAR(100);

UPDATE plc
   SET codesys_device_name = 'WAGO 750-8210 PFC200 G2 4ETH'
 WHERE id = 7;       -- LasseMaja D01 (PFC200 G2 at 192.168.107.11)
