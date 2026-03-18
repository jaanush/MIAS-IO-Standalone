-- Fix CAN/BATT signal origins: currently IEC, should match their bus protocol
-- Item #14 from pending-from-codesys.md

-- GVL_CAN signals → CANOPEN
UPDATE signal SET origin = 'CANOPEN'
WHERE gvl_id = (SELECT id FROM global_variable_list WHERE name = 'GVL_CAN')
  AND origin = 'IEC';

-- GVL_BATT signals → CANBUS
UPDATE signal SET origin = 'CANBUS'
WHERE gvl_id = (SELECT id FROM global_variable_list WHERE name = 'GVL_BATT')
  AND origin = 'IEC';

-- GVL_Modbus: fix the 15 IEC signals that should be MODBUS_RTU
UPDATE signal SET origin = 'MODBUS_RTU'
WHERE gvl_id = (SELECT id FROM global_variable_list WHERE name = 'GVL_Modbus')
  AND origin = 'IEC';
