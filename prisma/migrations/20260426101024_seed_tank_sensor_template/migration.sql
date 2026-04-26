-- FR-008 seed: a Tank Sensor template that exercises ComponentParameterDef +
-- the Curve plumbing. Idempotent — uses the unique index on
-- hardware_component(name) when project_id is NULL... actually there's no such
-- index, so we guard with NOT EXISTS instead.

DO $$
DECLARE
  v_component_id INTEGER;
BEGIN
  -- 1. Component (global template)
  SELECT id INTO v_component_id
  FROM hardware_component
  WHERE project_id IS NULL AND name = 'Tank Sensor';

  IF v_component_id IS NULL THEN
    INSERT INTO hardware_component (project_id, name, manufacturer, model, function_block, status, description, updated_at)
    VALUES (NULL, 'Tank Sensor', 'Generic', 'Tank Level FB', 'FB_TankSensor', 'ACTIVE',
            'Per-instance calibrated tank-level sensor (FR-008 demo). Two piecewise-linear curves convert raw sensor reading into volume %% and height cm.',
            NOW())
    RETURNING id INTO v_component_id;
  END IF;

  -- 2. Parameter declarations (idempotent on (component_id, param_name))
  INSERT INTO component_parameter_def (component_id, param_name, param_type, required, description, sort_order, updated_at)
  VALUES
    (v_component_id, 'maxVolume_m3', 'SCALAR_REAL', TRUE,  'Tank maximum volume in cubic metres', 1, NOW()),
    (v_component_id, 'sTag',         'STRING',      TRUE,  'Short tag used by FB_TankSensor (e.g. "FuelOil")', 2, NOW()),
    (v_component_id, 'volumeCurve',  'CURVE',       FALSE, 'Raw -> volume %% lookup (CHARCURVE, up to 11 points)', 3, NOW()),
    (v_component_id, 'heightCurve',  'CURVE',       FALSE, 'Raw -> height cm lookup (CHARCURVE, up to 11 points)', 4, NOW())
  ON CONFLICT (component_id, param_name) DO UPDATE
    SET param_type = EXCLUDED.param_type,
        required = EXCLUDED.required,
        description = EXCLUDED.description,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW();
END $$;
