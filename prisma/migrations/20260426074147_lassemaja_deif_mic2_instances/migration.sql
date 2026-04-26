-- LasseMaja DEIF MIC-2 MKII instances (FR-005)
--
-- Creates 3 power-meter instances on Modbus RTU net 24 (hosted by 750-652 S10):
--   - 868-P01 (slave 1) — AC shore intake (64A 3-phase)
--   - 875-P01 (slave 2) — AC distribution grid 1
--   - 875-P02 (slave 3) — AC distribution grid 2
--
-- Each instance gets all 53 strMKII signals (eager — only 12 are active=true on
-- the template; inactive ones can be flipped later without re-entering data).
-- Signals are tagged `{instance.tag}_{tag_suffix}` (e.g. "868-P01_Frequency").
--
-- Touches: signal_system (+3), global_variable_list (+1), component_instance (+3),
-- instance_signal (+159), signal (+159), bus_signal (+159) — 484 rows total.

BEGIN;

-- 1. signal_system rows
INSERT INTO "signal_system" ("code", "name", "description") VALUES
  ('AC_Shore_Connection_868', 'AC Shore Connection (868)',     'LasseMaja shore intake metering — 64A 3-phase'),
  ('AC_Distribution_Grid_1',  'AC Distribution Grid 1 (875)',  'LasseMaja AC distribution grid 1'),
  ('AC_Distribution_Grid_2',  'AC Distribution Grid 2 (875)',  'LasseMaja AC distribution grid 2');

-- 2. GVL_MIAS_COM (global, project-shared by name)
INSERT INTO "global_variable_list" ("name", "description") VALUES
  ('GVL_MIAS_COM', 'Modbus RTU communication structures (DEIF MIC-2 MKII strMKII per meter)');

-- 3. Component instances — DEIF MIC-2 MKII (component_id=9) on RTU net 24
INSERT INTO "component_instance" ("project_id", "component_id", "name", "tag", "plc_network_id", "byte_order", "node_role", "node_address", "created_at", "updated_at") VALUES
  (1, 9, '868-P01', '868-P01', 24, 'BIG_ENDIAN', 'SERVER', 1, NOW(), NOW()),
  (1, 9, '875-P01', '875-P01', 24, 'BIG_ENDIAN', 'SERVER', 2, NOW(), NOW()),
  (1, 9, '875-P02', '875-P02', 24, 'BIG_ENDIAN', 'SERVER', 3, NOW(), NOW());

-- 4. instance_signal — 3 instances × 53 template signals = 159
INSERT INTO "instance_signal" ("instance_id", "component_signal_id", "updated_at")
SELECT ci.id, cs.id, NOW()
FROM "component_instance" ci
CROSS JOIN "component_signal" cs
WHERE ci.component_id = 9
  AND ci.project_id   = 1
  AND ci.tag IN ('868-P01', '875-P01', '875-P02')
  AND cs.component_id = 9;

-- 5. signal — 1 per instance_signal (eager: all 53 per instance)
--    tag = `{instance.tag}_{tag_suffix}`
--    system_id picked per-instance via lookup on signal_system.code
INSERT INTO "signal" ("project_id", "tag", "description", "signal_type", "origin", "system_id", "gvl_id", "instance_signal_id", "updated_at")
SELECT
  1,
  ci.tag || '_' || cs.tag_suffix,
  cs.description,
  'ANALOG',
  'MODBUS_RTU',
  ss.id,
  (SELECT id FROM "global_variable_list" WHERE name = 'GVL_MIAS_COM'),
  ist.id,
  NOW()
FROM "instance_signal" ist
JOIN "component_instance" ci ON ci.id = ist.instance_id
JOIN "component_signal"   cs ON cs.id = ist.component_signal_id
JOIN "signal_system" ss ON ss.code = CASE ci.tag
    WHEN '868-P01' THEN 'AC_Shore_Connection_868'
    WHEN '875-P01' THEN 'AC_Distribution_Grid_1'
    WHEN '875-P02' THEN 'AC_Distribution_Grid_2'
  END
WHERE ci.component_id = 9
  AND ci.project_id   = 1
  AND ci.tag IN ('868-P01', '875-P01', '875-P02');

-- 6. bus_signal — Modbus addressing copied from template; unit_id = instance.node_address
INSERT INTO "bus_signal" ("signal_id", "plc_network_id", "unit_id", "register_type", "register_offset", "byte_order", "raw_data_type", "plc_data_type")
SELECT
  s.id,
  24,
  ci.node_address::smallint,
  cs.modbus_register_type,
  cs.modbus_register_offset,
  cs.byte_order,
  cs.raw_data_type,
  (cs.raw_data_type::text)::"plc_data_type"
FROM "signal" s
JOIN "instance_signal"    ist ON ist.id = s.instance_signal_id
JOIN "component_instance" ci  ON ci.id  = ist.instance_id
JOIN "component_signal"   cs  ON cs.id  = ist.component_signal_id
WHERE ci.component_id = 9
  AND ci.project_id   = 1
  AND ci.tag IN ('868-P01', '875-P01', '875-P02');

COMMIT;
