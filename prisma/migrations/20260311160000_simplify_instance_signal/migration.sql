-- Simplify InstanceSignal: remove override columns, rename decoupled → template_dirty
-- Override columns were vestigial — Signal/DiscreteSignal/AnalogSignal are the source of truth.

-- Drop obsolete views and functions first (they depend on override columns)
DROP VIEW IF EXISTS v_instance_signal_resolved;
DROP FUNCTION IF EXISTS rollback_instance_signal(int);
DROP FUNCTION IF EXISTS rollback_template_instance(int);

-- Drop FK constraints
ALTER TABLE "instance_signal" DROP CONSTRAINT IF EXISTS "instance_signal_override_eu_id_fkey";
ALTER TABLE "instance_signal" DROP CONSTRAINT IF EXISTS "instance_signal_override_input_type_id_fkey";

-- Rename decoupled → template_dirty (preserves existing values)
ALTER TABLE "instance_signal" RENAME COLUMN "decoupled" TO "template_dirty";

-- Drop all override columns
ALTER TABLE "instance_signal"
  DROP COLUMN IF EXISTS "override_description",
  DROP COLUMN IF EXISTS "override_eu_id",
  DROP COLUMN IF EXISTS "override_filter_time_ms",
  DROP COLUMN IF EXISTS "override_input_type_id",
  DROP COLUMN IF EXISTS "override_scale_max",
  DROP COLUMN IF EXISTS "override_scale_min",
  DROP COLUMN IF EXISTS "override_switching_type",
  DROP COLUMN IF EXISTS "override_tag",
  DROP COLUMN IF EXISTS "override_trigger",
  DROP COLUMN IF EXISTS "override_wire_config";
