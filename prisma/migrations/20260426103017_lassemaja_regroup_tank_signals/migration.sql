-- LasseMaja: pull the two tank-level analog signals out of the
-- "Contr/Mon. System" catch-all and into a dedicated TANKS system,
-- with componentTag set to their corresponding Tank Sensor instance
-- so the signals UI groups them under the right tank.
--
-- Signal 2419 = LEVEL FUEL TANK       → instance tag T_FUEL
-- Signal 2418 = LEVEL FRESHWATER TANK → instance tag T_FW

DO $$
DECLARE
  v_tanks_system_id INTEGER;
BEGIN
  SELECT id INTO v_tanks_system_id FROM signal_system WHERE code = 'TANKS';
  IF v_tanks_system_id IS NULL THEN
    INSERT INTO signal_system (code, name, description)
    VALUES ('TANKS', 'TANKS', 'Tank-level monitoring (fuel, freshwater, etc.)')
    RETURNING id INTO v_tanks_system_id;
  END IF;

  UPDATE signal SET system_id = v_tanks_system_id, component_tag = 'T_FUEL'
  WHERE id = 2419 AND project_id = 1;

  UPDATE signal SET system_id = v_tanks_system_id, component_tag = 'T_FW'
  WHERE id = 2418 AND project_id = 1;
END $$;
