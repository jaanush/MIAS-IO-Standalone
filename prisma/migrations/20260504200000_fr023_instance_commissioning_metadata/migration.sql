-- FR-023: per-instance commissioning metadata for CANopen device recipes.
--
-- Plugin's CommissioningRenderer walks ComponentInstance rows to emit
-- per-target sequence arrays from MIAS-ref's parts.json. The render needs:
--   - partId  → which hardware-DB record to consume the recipe from
--   - variant → which firmware variant's `minimum_sequence` to apply
-- Plus the existing nodeAddress (CANopen node id) + busId (CAN bus FK)
-- already on the row, surfaced via the API.

-- AlterTable
ALTER TABLE "component_instance"
    ADD COLUMN "commissioning_part_id" VARCHAR(100),
    ADD COLUMN "commissioning_variant" VARCHAR(40);

-- Backfill LasseMaja's 7 Editron converters by parsing the templated name.
-- All are EC-C1200-450 platform; variant inferred from componentName tail
-- ("uG AFE" → afe, "MC" → mc, "DCDC" → dcdc).
UPDATE "component_instance" ci
SET "commissioning_part_id" = 'danfoss-editron:ec-c1200-450',
    "commissioning_variant" = CASE
      WHEN hc.name ILIKE '%uG AFE%' OR hc.name ILIKE '%AFE%' THEN 'afe'
      WHEN hc.name ILIKE '%uG MC%'  OR hc.name ILIKE '%MC%'  THEN 'mc'
      WHEN hc.name ILIKE '%DCDC%'                            THEN 'dcdc'
      WHEN hc.name ILIKE '%uG%'                              THEN 'ug'
      WHEN hc.name ILIKE '%BC%'                              THEN 'bc'
      WHEN hc.name ILIKE '%switch%control%'                  THEN 'switch_control'
      ELSE NULL
    END
FROM "hardware_component" hc
WHERE ci.component_id = hc.id
  AND hc.name ILIKE '%Editron%'
  AND ci.commissioning_part_id IS NULL;
