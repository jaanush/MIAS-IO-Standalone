-- LasseMaja: stamp two Tank Sensor instances (fuel + freshwater) using the
-- global Tank Sensor template (component_id resolved via name lookup).
-- Each instance gets a sensible default sTag; volume + curves are filled
-- via the parameter UI later.
--
-- Raw input signals already exist in LasseMaja:
--   - signal 2419 "Contr_Mon_System_Level_Fuel_Tank"       (D03:C19:1, 750-496)
--   - signal 2418 "Contr_Mon_System_Level_Freshwater_Tank" (D03:C19:2, 750-496)
-- The pDaoRawInput linkage is established later via wiring recipes or a
-- follow-up "raw input" parameter; for now the instances are configuration
-- containers.

DO $$
DECLARE
  v_template_id INTEGER;
  v_inst_fuel  INTEGER;
  v_inst_fw    INTEGER;
BEGIN
  SELECT id INTO v_template_id
  FROM hardware_component
  WHERE project_id IS NULL AND name = 'Tank Sensor';
  IF v_template_id IS NULL THEN
    RAISE EXCEPTION 'Tank Sensor template not found — run earlier seed first';
  END IF;

  -- Fuel tank instance
  SELECT id INTO v_inst_fuel
  FROM component_instance
  WHERE project_id = 1 AND component_id = v_template_id AND tag = 'T_FUEL';
  IF v_inst_fuel IS NULL THEN
    INSERT INTO component_instance (project_id, component_id, name, tag, updated_at)
    VALUES (1, v_template_id, 'Fuel Tank', 'T_FUEL', NOW())
    RETURNING id INTO v_inst_fuel;
  END IF;

  -- Freshwater tank instance
  SELECT id INTO v_inst_fw
  FROM component_instance
  WHERE project_id = 1 AND component_id = v_template_id AND tag = 'T_FW';
  IF v_inst_fw IS NULL THEN
    INSERT INTO component_instance (project_id, component_id, name, tag, updated_at)
    VALUES (1, v_template_id, 'Freshwater Tank', 'T_FW', NOW())
    RETURNING id INTO v_inst_fw;
  END IF;

  -- Seed the sTag parameter for both (idempotent)
  INSERT INTO component_instance_parameter (instance_id, param_name, string_value, updated_at)
  VALUES (v_inst_fuel, 'sTag', 'FuelOil', NOW())
  ON CONFLICT (instance_id, param_name) DO UPDATE
    SET string_value = EXCLUDED.string_value, updated_at = NOW();

  INSERT INTO component_instance_parameter (instance_id, param_name, string_value, updated_at)
  VALUES (v_inst_fw, 'sTag', 'FreshWater', NOW())
  ON CONFLICT (instance_id, param_name) DO UPDATE
    SET string_value = EXCLUDED.string_value, updated_at = NOW();
END $$;
