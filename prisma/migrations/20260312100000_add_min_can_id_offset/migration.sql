-- AlterTable
ALTER TABLE "hardware_component" ADD COLUMN "min_can_id_offset" INTEGER;

-- Backfill from existing component signals
UPDATE hardware_component hc
SET min_can_id_offset = sub.span
FROM (
  SELECT component_id, MAX(can_id) - MIN(can_id) + 1 AS span
  FROM component_signal
  WHERE can_id IS NOT NULL AND active = true
  GROUP BY component_id
  HAVING COUNT(can_id) > 0
) sub
WHERE hc.id = sub.component_id;
