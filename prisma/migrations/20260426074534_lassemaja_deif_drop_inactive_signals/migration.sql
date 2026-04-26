-- LasseMaja DEIF MIC-2 MKII: switch from eager to lazy signal materialization.
--
-- The previous migration (20260426074147) created all 53 strMKII signals per
-- instance. The convention on this project is to only create signal rows for
-- the active subset (Diesel Genset on net 25 has 23 materialised of 55 template
-- signals). Drop the inactive 41 per instance to match.
--
-- Touches: signal (-123 → cascades bus_signal -123), instance_signal (-123).
-- Result: 12 active signals per instance × 3 instances = 36 of each row type.
-- Inactive component_signal templates remain in catalog (id=9) and can be
-- materialised later without re-entering data.

BEGIN;

-- 1. Delete signal rows for inactive templates on these 3 instances
--    (bus_signal rows cascade automatically via FK ON DELETE CASCADE)
DELETE FROM "signal"
WHERE id IN (
  SELECT s.id
  FROM "signal" s
  JOIN "instance_signal"    ist ON ist.id = s.instance_signal_id
  JOIN "component_instance" ci  ON ci.id  = ist.instance_id
  JOIN "component_signal"   cs  ON cs.id  = ist.component_signal_id
  WHERE ci.component_id = 9
    AND ci.project_id   = 1
    AND ci.tag IN ('868-P01', '875-P01', '875-P02')
    AND cs.active = FALSE
);

-- 2. Delete instance_signal rows for inactive templates (the join table now
--    only carries materialised pairings, matching Diesel Genset convention)
DELETE FROM "instance_signal"
WHERE id IN (
  SELECT ist.id
  FROM "instance_signal"    ist
  JOIN "component_instance" ci ON ci.id = ist.instance_id
  JOIN "component_signal"   cs ON cs.id = ist.component_signal_id
  WHERE ci.component_id = 9
    AND ci.project_id   = 1
    AND ci.tag IN ('868-P01', '875-P01', '875-P02')
    AND cs.active = FALSE
);

COMMIT;
