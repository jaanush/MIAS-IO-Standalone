-- AlterTable
ALTER TABLE "hardware_component" ADD COLUMN "bus_protocol" "bus_protocol";

-- Backfill: set busProtocol from the most common non-IEC/INTERNAL origin across active signals
UPDATE hardware_component hc SET bus_protocol = sub.origin::text::bus_protocol
FROM (
  SELECT DISTINCT ON (component_id) component_id, origin
  FROM component_signal
  WHERE origin IS NOT NULL AND origin NOT IN ('IEC','INTERNAL') AND active = true
  GROUP BY component_id, origin
  ORDER BY component_id, COUNT(*) DESC
) sub
WHERE hc.id = sub.component_id AND hc.bus_protocol IS NULL;
