-- Editron Converter FW11 MC — PDO Signal Assignments
-- Maps component_signal rows to pdo_config rows by matching canopen_index.
-- Run AFTER seed_editron_mc_pdos.sql
-- Component ID 4 = 'Editron Converter FW11 MC'
--
-- Mapping derived from mCanOpenDataConfig_Editron_MC_Stack1_FW11.fn.st
-- MappedObjects DWORD encoding: 0xIIIISS0B = Index(16) : SubIndex(8) : BitLength(8)

-- Helper: assign a signal to a PDO by matching component_id + canopen_index + canopen_sub_index
-- and set the bit_offset within the PDO frame.

-- ─── TPDO 1 (id from DB): System status + fault words + DC link voltage ────
-- 0x2080:00:08 = Running/System status (8320:0, 8 bits)
-- 0x2087:00:08 = System app active cmd config (8327:0, 8 bits)
-- 0x20A0:00:16 = System fault word 1 (8352:0, 16 bits) — NOT in signals yet
-- 0x20C0:01:16 = Active fault ID (8384:1, 16 bits) — NOT in signals yet
-- 0x2392:00:16 = DC link voltage (9106:0, 16 bits) — NOT in signals yet

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'TPDO' AND pdo_number = 1), bit_offset = 0, bit_length = COALESCE(bit_length, 8)
WHERE component_id = 4 AND canopen_index = 8320 AND COALESCE(canopen_sub_index, 0) = 0;

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'TPDO' AND pdo_number = 1), bit_offset = 8, bit_length = COALESCE(bit_length, 8)
WHERE component_id = 4 AND canopen_index = 8327 AND COALESCE(canopen_sub_index, 0) = 0;

-- ─── TPDO 2: DC link current + MC status/limit words ───────────────────────
-- 0x2395:00:16 = DC link current (9109:0) — NOT in signals yet
-- 0x2381:00:32 = MC status word (9089:0, 32 bits)
-- 0x2382:00:16 = MC limit word (9090:0, 16 bits)

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'TPDO' AND pdo_number = 2), bit_offset = 16, bit_length = COALESCE(bit_length, 32)
WHERE component_id = 4 AND canopen_index = 9089 AND COALESCE(canopen_sub_index, 0) = 0 AND io_type = 'AI' AND tag_suffix = 'MCStatusWord';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'TPDO' AND pdo_number = 2), bit_offset = 48, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 9090 AND COALESCE(canopen_sub_index, 0) = 0 AND io_type = 'AI' AND tag_suffix = 'MCLimitWord';

-- ─── TPDO 3: Motor speed, torque, current, power ───────────────────────────
-- 0x2390:00:16 = Motor speed RPM (9104:0)
-- 0x2391:00:16 = Motor torque Nm (9105:0)
-- 0x2394:00:16 = Motor phase RMS current (9108:0)
-- 0x2393:00:16 = Motor mechanical power (9107:0)

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'TPDO' AND pdo_number = 3), bit_offset = 0, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 9104 AND COALESCE(canopen_sub_index, 0) = 0;

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'TPDO' AND pdo_number = 3), bit_offset = 16, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 9105 AND COALESCE(canopen_sub_index, 0) = 0;

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'TPDO' AND pdo_number = 3), bit_offset = 32, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 9108 AND COALESCE(canopen_sub_index, 0) = 0;

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'TPDO' AND pdo_number = 3), bit_offset = 48, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 9107 AND COALESCE(canopen_sub_index, 0) = 0;

-- ─── TPDO 5: Control switch, fault word 2, external temp, digital inputs ────
-- 0x2083:00:08 = Control switch status (8323:0)
-- (others not in signals yet)

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'TPDO' AND pdo_number = 5), bit_offset = 0, bit_length = COALESCE(bit_length, 8)
WHERE component_id = 4 AND canopen_index = 8323 AND COALESCE(canopen_sub_index, 0) = 0;

-- ─── TPDO 6: Motor voltage, frequency, MC fault/limit error words ──────────
-- 0x2396:00:16 = Motor voltage (9110:0)
-- 0x2397:00:16 = Motor frequency (9111:0)
-- 0x23A0:00:16 = MC fault word (9120:0)
-- 0x23A8:00:16 = MC limit error word (9128:0)

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'TPDO' AND pdo_number = 6), bit_offset = 0, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 9110 AND COALESCE(canopen_sub_index, 0) = 0;

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'TPDO' AND pdo_number = 6), bit_offset = 16, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 9111 AND COALESCE(canopen_sub_index, 0) = 0;

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'TPDO' AND pdo_number = 6), bit_offset = 32, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 9120 AND COALESCE(canopen_sub_index, 0) = 0 AND io_type = 'AI';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'TPDO' AND pdo_number = 6), bit_offset = 48, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 9128 AND COALESCE(canopen_sub_index, 0) = 0;

-- ─── TPDO 7: Resolver + active control mode ────────────────────────────────
-- 0x2384:00:08 = Active control mode (9092:0)

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'TPDO' AND pdo_number = 7), bit_offset = 56, bit_length = COALESCE(bit_length, 8)
WHERE component_id = 4 AND canopen_index = 9092 AND COALESCE(canopen_sub_index, 0) = 0;

-- ─── RPDO 1: System command + control mode + speed ref ─────────────────────
-- 0x2300:00:08 = Control mode (8960:0)
-- 0x2310:00:16 = Speed ref RPM (8976:0)

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'RPDO' AND pdo_number = 1), bit_offset = 24, bit_length = COALESCE(bit_length, 8)
WHERE component_id = 4 AND canopen_index = 8960 AND COALESCE(canopen_sub_index, 0) = 0;

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'RPDO' AND pdo_number = 1), bit_offset = 48, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 8976 AND COALESCE(canopen_sub_index, 0) = 0;

-- ─── RPDO 2: DC link voltage ref + power ref/limits ────────────────────────
-- 0x2312:00:16 = DC link voltage ref (8978:0) — ambiguous: VoltageReferenceV and DCLinkVoltageRef both 8978
-- 0x2313:00:16 = Power reference kW (8979:0) — ambiguous: PowerDC and PowerReferenceKW both 8979
-- 0x2328:00:16 = Power limit max (9000:0)
-- 0x2329:00:16 = Power limit min (9001:0)

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'RPDO' AND pdo_number = 2), bit_offset = 0, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 8978 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'DCLinkVoltageRef';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'RPDO' AND pdo_number = 2), bit_offset = 16, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 8979 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'PowerReferenceKW';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'RPDO' AND pdo_number = 2), bit_offset = 32, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 9000 AND COALESCE(canopen_sub_index, 0) = 0;

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'RPDO' AND pdo_number = 2), bit_offset = 48, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 9001 AND COALESCE(canopen_sub_index, 0) = 0;

-- ─── RPDO 3: Speed/torque limits ───────────────────────────────────────────
-- 0x2320:00:16 = Speed limit max (8992:0)
-- 0x2321:00:16 = Speed limit min (8993:0)
-- 0x2322:00:16 = Torque limit max (8994:0)
-- 0x2323:00:16 = Torque limit min (8995:0)

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'RPDO' AND pdo_number = 3), bit_offset = 0, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 8992 AND COALESCE(canopen_sub_index, 0) = 0;

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'RPDO' AND pdo_number = 3), bit_offset = 16, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 8993 AND COALESCE(canopen_sub_index, 0) = 0;

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'RPDO' AND pdo_number = 3), bit_offset = 32, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 8994 AND COALESCE(canopen_sub_index, 0) = 0;

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'RPDO' AND pdo_number = 3), bit_offset = 48, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 8995 AND COALESCE(canopen_sub_index, 0) = 0;

-- ─── RPDO 4: DC link voltage protection limits ─────────────────────────────
-- 0x2324:00:16 = OVC full limit (8996:0)
-- 0x2325:00:16 = OVC begin limit (8997:0)
-- 0x2326:00:16 = UVC begin limit (8998:0)
-- 0x2327:00:16 = UVC full limit (8999:0)

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'RPDO' AND pdo_number = 4), bit_offset = 0, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 8996 AND COALESCE(canopen_sub_index, 0) = 0;

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'RPDO' AND pdo_number = 4), bit_offset = 16, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 8997 AND COALESCE(canopen_sub_index, 0) = 0;

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'RPDO' AND pdo_number = 4), bit_offset = 32, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 8998 AND COALESCE(canopen_sub_index, 0) = 0;

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'RPDO' AND pdo_number = 4), bit_offset = 48, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 8999 AND COALESCE(canopen_sub_index, 0) = 0;

-- ─── RPDO 5: Speed controller params ───────────────────────────────────────
-- 0x2330:00:16 = Speed controller KP (9008:0)
-- 0x2331:00:16 = Speed controller TI (9009:0)
-- 0x2332:00:16 = Speed controller ramp time (9010:0)
-- 0x2340:00:16 = Voltage controller ramp time (9024:0)

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'RPDO' AND pdo_number = 5), bit_offset = 0, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 9008 AND COALESCE(canopen_sub_index, 0) = 0;

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'RPDO' AND pdo_number = 5), bit_offset = 16, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 9009 AND COALESCE(canopen_sub_index, 0) = 0;

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'RPDO' AND pdo_number = 5), bit_offset = 32, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 9010 AND COALESCE(canopen_sub_index, 0) = 0;

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'RPDO' AND pdo_number = 5), bit_offset = 48, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 9024 AND COALESCE(canopen_sub_index, 0) = 0;

-- ─── RPDO 6: Frequency/position references ─────────────────────────────────
-- 0x2314:00:16 = Frequency reference Hz (8980:0)

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'RPDO' AND pdo_number = 6), bit_offset = 0, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 8980 AND COALESCE(canopen_sub_index, 0) = 0;

-- ─── RPDO 8: Torque ref + ICE curve ────────────────────────────────────────
-- 0x2311:00:16 = Torque reference Nm (8977:0)

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 4 AND direction = 'RPDO' AND pdo_number = 8), bit_offset = 16, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 4 AND canopen_index = 8977 AND COALESCE(canopen_sub_index, 0) = 0;
