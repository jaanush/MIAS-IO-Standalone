-- FR-017 (plugin): backfill CANopen baud + enforce baud-required for CAN-family.
--
-- The FR-015/FR-016 retry showed CANopen buses 16/17/18/19 (LasseMaja's
-- four Editron CANopen buses) still NULL. Operator confirmed 500 kbit
-- for these. Backfill them, then add a CHECK constraint so CANBUS /
-- CANOPEN / DEVICENET buses always carry a baud (J1939 retains a defacto
-- 250 kbit fallback so NULL is allowed there).

UPDATE plc_network
   SET baud_rate_kbit = 500
 WHERE project_id = 1
   AND id IN (16, 17, 18, 19)
   AND baud_rate_kbit IS NULL;

ALTER TABLE plc_network
  ADD CONSTRAINT plc_network_baud_required_for_can
  CHECK (
    protocol NOT IN ('CANBUS', 'CANOPEN', 'DEVICENET')
    OR baud_rate_kbit IS NOT NULL
  );
