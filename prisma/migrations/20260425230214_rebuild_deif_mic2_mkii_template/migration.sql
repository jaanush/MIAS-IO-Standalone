-- Rebuild HardwareComponent id=9 as the full DEIF MIC-2 MKII template per FR-005.
-- Wipes the 34 incomplete signals (zero FK references at time of writing) and
-- inserts all 53 fields from the strMKII register map with proper Modbus addressing.
--
-- All signals start as active=true; the CODESYS agent will reply with the actual
-- consumed subset and a follow-up migration will toggle the rest to active=false.
--
-- Fresh-install guard: hardware_component is populated by seed_data.sql which runs
-- AFTER `prisma migrate deploy`. On a from-scratch deploy, id=9 doesn't exist yet
-- and this migration is a no-op — the seed itself installs the correct template
-- shape. On an upgrade-deploy where id=9 already exists, this migration rebuilds
-- the signals to match FR-005.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "hardware_component" WHERE id = 9) THEN
    RAISE NOTICE 'hardware_component id=9 not yet seeded; rebuild_deif_mic2_mkii_template skipped (fresh install).';
    RETURN;
  END IF;

  -- 1. Rename the component to match FR-005 wording
  UPDATE "hardware_component"
  SET "name" = 'DEIF MIC-2 MKII',
      "description" = 'DEIF MIC-2 MKII power meter — Modbus RTU, 19200 8N1, 53-signal strMKII register map (0x4000–0x4061)',
      "function_block" = 'FB_Sync',
      updated_at = NOW()
  WHERE id = 9;

  -- 2. Wipe existing signals (verified 0 FK references in instance_signal,
  --    component_analog_alarm, component_discrete_alarm)
  DELETE FROM "component_signal" WHERE "component_id" = 9;

  -- 3. Insert 53 fresh signals — snake_case tag_suffix matches strMKII fields verbatim,
  --    register addresses populated, all read-only (HOLDING_REGISTER / FC03), big-endian.
  --    channel_offset is the unique-per-component sequence number (1..53).

  -- Block 1 — 36× REAL (32-bit float, 2 regs each), 0x4000–0x4047
  INSERT INTO "component_signal"
    (component_id, channel_offset, tag_suffix, description, io_type, origin,
     raw_data_type, byte_order, modbus_register_type, modbus_register_offset, active)
  VALUES
  (9,  1, 'Frequency',                       'Frequency',                        'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16384, TRUE),
  (9,  2, 'Phase_voltage_V1',                'Phase voltage V1',                 'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16386, TRUE),
  (9,  3, 'Phase_voltage_V2',                'Phase voltage V2',                 'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16388, TRUE),
  (9,  4, 'Phase_voltage_V3',                'Phase voltage V3',                 'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16390, TRUE),
  (9,  5, 'Average_voltage_Vavg',            'Average voltage Vavg',             'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16392, TRUE),
  (9,  6, 'Line_voltage_V12',                'Line voltage V12',                 'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16394, TRUE),
  (9,  7, 'Line_voltage_V23',                'Line voltage V23',                 'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16396, TRUE),
  (9,  8, 'Line_voltage_V31',                'Line voltage V31',                 'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16398, TRUE),
  (9,  9, 'Average_line_voltage_Vlavg',      'Average line voltage Vlavg',       'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16400, TRUE),
  (9, 10, 'Phase_line_current_I1',           'Phase line current I1',            'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16402, TRUE),
  (9, 11, 'Phase_line_current_I2',           'Phase line current I2',            'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16404, TRUE),
  (9, 12, 'Phase_line_current_I3',           'Phase line current I3',            'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16406, TRUE),
  (9, 13, 'Average_current_Iavg',            'Average current Iavg',             'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16408, TRUE),
  (9, 14, 'Neutral_current_In',              'Neutral current In',               'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16410, TRUE),
  (9, 15, 'Phase_L1_power_P',                'Phase L1 power P',                 'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16412, TRUE),
  (9, 16, 'Phase_L2_power_P',                'Phase L2 power P',                 'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16414, TRUE),
  (9, 17, 'Phase_L3_power_P',                'Phase L3 power P',                 'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16416, TRUE),
  (9, 18, 'System_power_Psum',               'System power Psum',                'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16418, TRUE),
  (9, 19, 'Phase_L1_reactive_power_Q',       'Phase L1 reactive power Q',        'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16420, TRUE),
  (9, 20, 'Phase_L2_reactive_power_Q',       'Phase L2 reactive power Q',        'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16422, TRUE),
  (9, 21, 'Phase_L3_reactive_power_Q',       'Phase L3 reactive power Q',        'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16424, TRUE),
  (9, 22, 'System_reactive_power_Qsum',      'System reactive power Qsum',       'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16426, TRUE),
  (9, 23, 'Phase_L1_apparent_power_S',       'Phase L1 apparent power S',        'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16428, TRUE),
  (9, 24, 'Phase_L2_apparent_power_S',       'Phase L2 apparent power S',        'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16430, TRUE),
  (9, 25, 'Phase_L3_apparent_power_S',       'Phase L3 apparent power S',        'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16432, TRUE),
  (9, 26, 'System_apparent_power_Ssum',      'System apparent power Ssum',       'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16434, TRUE),
  (9, 27, 'Phase_L1_power_factor_PF',        'Phase L1 power factor PF',         'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16436, TRUE),
  (9, 28, 'Phase_L2_power_factor_PF',        'Phase L2 power factor PF',         'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16438, TRUE),
  (9, 29, 'Phase_L3_power_factor_PF',        'Phase L3 power factor PF',         'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16440, TRUE),
  (9, 30, 'System_power_factor_PFsum',       'System power factor PFsum',        'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16442, TRUE),
  (9, 31, 'Voltage_unbalance_factor_U_unbl', 'Voltage unbalance factor U_unbl',  'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16444, TRUE),
  (9, 32, 'Current_unbalance_factor_I_unbl', 'Current unbalance factor I_unbl',  'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16446, TRUE),
  (9, 33, 'Load_characteristic_L_C_R',       'Load characteristic L/C/R',        'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16448, TRUE),
  (9, 34, 'Power_demand',                    'Power demand',                     'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16450, TRUE),
  (9, 35, 'Reactive_power_demand',           'Reactive power demand',            'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16452, TRUE),
  (9, 36, 'Apparent_power_demand',           'Apparent power demand',            'AI', 'MODBUS_RTU', 'REAL',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16454, TRUE),

-- Block 2 — 9× DWORD (32-bit unsigned, 2 regs each), 0x4048–0x4059
  (9, 37, 'Energy_IMP',                      'Energy IMP',                       'AI', 'MODBUS_RTU', 'DWORD', 'BIG_ENDIAN', 'HOLDING_REGISTER', 16456, TRUE),
  (9, 38, 'Energy_EXP',                      'Energy EXP',                       'AI', 'MODBUS_RTU', 'DWORD', 'BIG_ENDIAN', 'HOLDING_REGISTER', 16458, TRUE),
  (9, 39, 'Reactive_energy_IMP',             'Reactive energy IMP',              'AI', 'MODBUS_RTU', 'DWORD', 'BIG_ENDIAN', 'HOLDING_REGISTER', 16460, TRUE),
  (9, 40, 'Reactive_energy_EXP',             'Reactive energy EXP',              'AI', 'MODBUS_RTU', 'DWORD', 'BIG_ENDIAN', 'HOLDING_REGISTER', 16462, TRUE),
  (9, 41, 'Energy_TOTAL',                    'Energy TOTAL',                     'AI', 'MODBUS_RTU', 'DWORD', 'BIG_ENDIAN', 'HOLDING_REGISTER', 16464, TRUE),
  (9, 42, 'Energy_NET',                      'Energy NET',                       'AI', 'MODBUS_RTU', 'DWORD', 'BIG_ENDIAN', 'HOLDING_REGISTER', 16466, TRUE),
  (9, 43, 'Reactive_energy_TOTAL',           'Reactive energy TOTAL',            'AI', 'MODBUS_RTU', 'DWORD', 'BIG_ENDIAN', 'HOLDING_REGISTER', 16468, TRUE),
  (9, 44, 'Reactive_energy_NET',             'Reactive energy NET',              'AI', 'MODBUS_RTU', 'DWORD', 'BIG_ENDIAN', 'HOLDING_REGISTER', 16470, TRUE),
  (9, 45, 'Apparent_energy',                 'Apparent energy',                  'AI', 'MODBUS_RTU', 'DWORD', 'BIG_ENDIAN', 'HOLDING_REGISTER', 16472, TRUE),

-- Block 3 — 8× WORD (16-bit, 1 reg each), 0x405A–0x4061
  (9, 46, 'THD_V1_of_V1_V12',                'THD V1 of V1 (V12)',               'AI', 'MODBUS_RTU', 'WORD',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16474, TRUE),
  (9, 47, 'THD_V1_of_V2_V31',                'THD V1 of V2 (V31)',               'AI', 'MODBUS_RTU', 'WORD',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16475, TRUE),
  (9, 48, 'THD_V1_of_V3_V23',                'THD V1 of V3 (V23)',               'AI', 'MODBUS_RTU', 'WORD',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16476, TRUE),
  (9, 49, 'Average_THD_V',                   'Average THD V',                    'AI', 'MODBUS_RTU', 'WORD',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16477, TRUE),
  (9, 50, 'THD_I1',                          'THD I1',                           'AI', 'MODBUS_RTU', 'WORD',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16478, TRUE),
  (9, 51, 'THD_I2',                          'THD I2',                           'AI', 'MODBUS_RTU', 'WORD',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16479, TRUE),
  (9, 52, 'THD_I3',                          'THD I3',                           'AI', 'MODBUS_RTU', 'WORD',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16480, TRUE),
  (9, 53, 'Average_THD_I',                   'Average THD I',                    'AI', 'MODBUS_RTU', 'WORD',  'BIG_ENDIAN', 'HOLDING_REGISTER', 16481, TRUE);
END$$;
