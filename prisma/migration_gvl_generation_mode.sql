-- Add GVL generation mode (FLAT_VARS / FB_INSTANCES)
-- FLAT_VARS: one variable per signal (default, existing behavior)
-- FB_INSTANCES: one FB instance per component (for CAN/BATT GVLs)

CREATE TYPE "gvl_generation_mode" AS ENUM ('FLAT_VARS', 'FB_INSTANCES');

ALTER TABLE "global_variable_list"
  ADD COLUMN "generation_mode" "gvl_generation_mode" NOT NULL DEFAULT 'FLAT_VARS';
