-- Set GVL_CAN and GVL_BATT to FB_INSTANCES generation mode
-- These GVLs emit one FB instance declaration per component instance,
-- not one variable per signal.

UPDATE global_variable_list SET generation_mode = 'FB_INSTANCES'
WHERE name IN ('GVL_CAN', 'GVL_BATT');
