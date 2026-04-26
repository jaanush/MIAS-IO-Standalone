-- LasseMaja: hydraulic-oil tank — wraps signal 2408
-- (Hydraulic_System_831_LT001_Level_Sensor) with the Tank Sensor template
-- so the operator can attach calibration curves and a maxVolume per the
-- FR-008 parameter framework.
--
-- Tag/component_tag follow the IEC convention already on the signal:
-- "831-LT001". sTag default "HydraulicOil".
--
-- Signal 2408 stays in system_id = 11 (HYDRAULIC SYSTEM) — its proper
-- domain. Only the tank-config layer is added here.

DO $$
DECLARE
  v_template_id INTEGER;
  v_inst_hyd    INTEGER;
BEGIN
  SELECT id INTO v_template_id
  FROM hardware_component
  WHERE project_id IS NULL AND name = 'Tank Sensor';
  IF v_template_id IS NULL THEN
    RAISE EXCEPTION 'Tank Sensor template not found — run earlier seed first';
  END IF;

  SELECT id INTO v_inst_hyd
  FROM component_instance
  WHERE project_id = 1 AND component_id = v_template_id AND tag = '831-LT001';
  IF v_inst_hyd IS NULL THEN
    INSERT INTO component_instance (project_id, component_id, name, tag, updated_at)
    VALUES (1, v_template_id, 'Hydraulic Oil Tank', '831-LT001', NOW())
    RETURNING id INTO v_inst_hyd;
  END IF;

  INSERT INTO component_instance_parameter (instance_id, param_name, string_value, updated_at)
  VALUES (v_inst_hyd, 'sTag', 'HydraulicOil', NOW())
  ON CONFLICT (instance_id, param_name) DO UPDATE
    SET string_value = EXCLUDED.string_value, updated_at = NOW();
END $$;
