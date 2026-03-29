-- Editron Converter FW11 MC — PDO Configuration
-- Based on mCanOpenDataConfig_Editron_MC_Stack1_FW11.fn.st (METS-LIB, reference only)
-- Component ID 4 = 'Editron Converter FW11 MC'
--
-- NOTE: Signal-to-PDO assignments (UPDATE component_signal SET pdo_config_id = ...)
-- are done by matching canopenIndex on existing component_signal rows.
-- If signals don't exist yet, the UPDATE is a no-op — create them first.

-- ─── TPDOs (device → PLC) ──────────────────────────────────────────

-- TPDO 1: System status + fault words + DC link voltage
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (4, 'TPDO', 1, 384, 254, 100, 'System status, app config, fault word 1, active fault, DC link voltage')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x180 = 384 decimal

-- TPDO 2: DC link current + MC status/limit words
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (4, 'TPDO', 2, 640, 254, 100, 'DC link current, MC status word, MC limit word')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x280 = 640

-- TPDO 3: Motor speed, torque, current, power
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (4, 'TPDO', 3, 896, 254, 100, 'Motor speed RPM, torque Nm, phase RMS current, mechanical power')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x380 = 896

-- TPDO 4: Temperatures
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (4, 'TPDO', 4, 1152, 254, 1000, 'Max junction temp, PT100 CH1-CH3')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x480 = 1152

-- TPDO 5: Control switch, fault word 2, external temp, digital inputs, app config
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (4, 'TPDO', 5, 385, 254, 500, 'Control switch status, fault word 2, external temp, digital inputs, MC app config')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x181 = 385

-- TPDO 6: Motor voltage, frequency, MC fault/limit error words
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (4, 'TPDO', 6, 641, 254, 300, 'Motor voltage, frequency, MC fault word, MC limit error word')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x281 = 641

-- TPDO 7: Resolver status
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (4, 'TPDO', 7, 897, 254, 1000, 'Resolver speed, offset ID state, direction/pole/sync status, active control mode')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x381 = 897

-- TPDO 8: User I/O analog inputs
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (4, 'TPDO', 8, 1153, 254, 1000, 'User I/O 1-4 input voltage')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x481 = 1153

-- ─── RPDOs (PLC → device) ──────────────────────────────────────────

-- RPDO 1: System command + control mode + speed ref
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (4, 'RPDO', 1, 512, 254, 500, 'System cmd, app cmd, control switch cmd, control mode, MC cmd, app cmd, speed ref RPM')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x200 = 512

-- RPDO 2: DC link voltage ref + power ref/limits
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (4, 'RPDO', 2, 768, 254, 500, 'DC link voltage ref, power ref, power limit max/min')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x300 = 768

-- RPDO 3: Speed/torque limits
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (4, 'RPDO', 3, 1024, 254, 1000, 'Speed limit max/min, torque limit max/min')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x400 = 1024

-- RPDO 4: DC link voltage protection limits
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (4, 'RPDO', 4, 1280, 254, 500, 'OVC full/begin limit, UVC begin/full limit (VDC)')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x500 = 1280

-- RPDO 5: Speed controller params
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (4, 'RPDO', 5, 513, 254, 500, 'Speed controller KP, TI, ramp time; voltage controller ramp time')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x201 = 513

-- RPDO 6: Frequency/position references
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (4, 'RPDO', 6, 769, 254, 500, 'Frequency ref, position ref (full + fractional revolutions)')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x301 = 769

-- RPDO 7: Resolver identification
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (4, 'RPDO', 7, 1025, 254, 1000, 'Resolver ID request/method, enable feedback, offset, store params, enable objects')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x401 = 1025

-- RPDO 8: Digital outputs + torque ref + ICE curve
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (4, 'RPDO', 8, 1281, 254, 500, 'User I/O digital outputs, torque ref Nm, ICE curve scaling factor')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x501 = 1281
