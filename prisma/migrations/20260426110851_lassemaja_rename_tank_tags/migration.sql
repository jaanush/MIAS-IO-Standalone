-- LasseMaja: rename Fuel/Freshwater tank instances from arbitrary T_FUEL/T_FW
-- to IEC-style LT-FUEL/LT-FW for consistency with the hydraulic tank
-- (831-LT001). Also updates the signals' componentTag to match so the
-- signal-to-instance grouping continues working.
--
-- Idempotent: only renames if the old tag still exists.

UPDATE component_instance
SET tag = 'LT-FUEL', updated_at = NOW()
WHERE project_id = 1 AND tag = 'T_FUEL';

UPDATE component_instance
SET tag = 'LT-FW', updated_at = NOW()
WHERE project_id = 1 AND tag = 'T_FW';

UPDATE signal
SET component_tag = 'LT-FUEL'
WHERE project_id = 1 AND id = 2419 AND component_tag = 'T_FUEL';

UPDATE signal
SET component_tag = 'LT-FW'
WHERE project_id = 1 AND id = 2418 AND component_tag = 'T_FW';
