-- Populate HVAC Modbus register metadata for existing 12 GVL_HVAC signals
-- Source: HVAC controller register maps (AS1 = unit 1, AS2 = unit 2)

-- AS1 signals
UPDATE bus_signal SET register_offset = 38, bit_offset = 6, unit_id = 1
WHERE signal_id = (SELECT id FROM signal WHERE tag = 'AS1_HMI_RSD_ALM'
  AND gvl_id = (SELECT id FROM global_variable_list WHERE name = 'GVL_HVAC'));

UPDATE bus_signal SET register_offset = 30, bit_offset = 1, unit_id = 1
WHERE signal_id = (SELECT id FROM signal WHERE tag = 'AS1_HMI_SYS_ALARM'
  AND gvl_id = (SELECT id FROM global_variable_list WHERE name = 'GVL_HVAC'));

UPDATE bus_signal SET register_offset = 1, bit_offset = 2, unit_id = 1
WHERE signal_id = (SELECT id FROM signal WHERE tag = 'AS1_HMI_FAU1_GT4_ALM'
  AND gvl_id = (SELECT id FROM global_variable_list WHERE name = 'GVL_HVAC'));

UPDATE bus_signal SET register_offset = 1, bit_offset = 3, unit_id = 1
WHERE signal_id = (SELECT id FROM signal WHERE tag = 'AS1_HMI_FAU2_GT4_ALM'
  AND gvl_id = (SELECT id FROM global_variable_list WHERE name = 'GVL_HVAC'));

UPDATE bus_signal SET register_offset = 40, bit_offset = 1, unit_id = 1
WHERE signal_id = (SELECT id FROM signal WHERE tag = 'AS1_HMI_FAU1_ALM'
  AND gvl_id = (SELECT id FROM global_variable_list WHERE name = 'GVL_HVAC'));

UPDATE bus_signal SET register_offset = 40, bit_offset = 4, unit_id = 1
WHERE signal_id = (SELECT id FROM signal WHERE tag = 'AS1_HMI_FAU2_ALM'
  AND gvl_id = (SELECT id FROM global_variable_list WHERE name = 'GVL_HVAC'));

-- VP alarm signals use HOLDING_REGISTER, not COIL
UPDATE bus_signal SET register_type = 'HOLDING_REGISTER', register_offset = 31, bit_offset = NULL, unit_id = 1
WHERE signal_id = (SELECT id FROM signal WHERE tag = 'AS1_HMI_VP1_ALARM_NUM'
  AND gvl_id = (SELECT id FROM global_variable_list WHERE name = 'GVL_HVAC'));

UPDATE bus_signal SET register_type = 'HOLDING_REGISTER', register_offset = 32, bit_offset = NULL, unit_id = 1
WHERE signal_id = (SELECT id FROM signal WHERE tag = 'AS1_HMI_VP2_ALARM_NUM'
  AND gvl_id = (SELECT id FROM global_variable_list WHERE name = 'GVL_HVAC'));

-- AS2 signals
UPDATE bus_signal SET register_offset = 1, bit_offset = 0, unit_id = 2
WHERE signal_id = (SELECT id FROM signal WHERE tag = 'AS2_HMI_SYS_ALARM'
  AND gvl_id = (SELECT id FROM global_variable_list WHERE name = 'GVL_HVAC'));

UPDATE bus_signal SET register_offset = 50, bit_offset = 1, unit_id = 2
WHERE signal_id = (SELECT id FROM signal WHERE tag = 'AS2_HMI_BVP_ALM'
  AND gvl_id = (SELECT id FROM global_variable_list WHERE name = 'GVL_HVAC'));

UPDATE bus_signal SET register_offset = 55, bit_offset = 1, unit_id = 2
WHERE signal_id = (SELECT id FROM signal WHERE tag = 'AS2_HMI_HYDB1_ALM'
  AND gvl_id = (SELECT id FROM global_variable_list WHERE name = 'GVL_HVAC'));

UPDATE bus_signal SET register_offset = 60, bit_offset = 1, unit_id = 2
WHERE signal_id = (SELECT id FROM signal WHERE tag = 'AS2_HMI_HYDB2_ALM'
  AND gvl_id = (SELECT id FROM global_variable_list WHERE name = 'GVL_HVAC'));
