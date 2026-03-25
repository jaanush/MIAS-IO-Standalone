-- Create enum type
CREATE TYPE "io_type" AS ENUM ('DI', 'DO', 'AI', 'AO');

-- Add column as nullable first
ALTER TABLE "component_signal" ADD COLUMN "io_type" "io_type";

-- Populate from existing columns
UPDATE "component_signal"
SET "io_type" = CASE
  WHEN "signal_type" = 'DISCRETE' AND "direction" = 'OUTPUT' THEN 'DO'::"io_type"
  WHEN "signal_type" = 'DISCRETE'                            THEN 'DI'::"io_type"
  WHEN "signal_type" = 'ANALOG'   AND "direction" = 'OUTPUT' THEN 'AO'::"io_type"
  WHEN "signal_type" = 'ANALOG'                             THEN 'AI'::"io_type"
END;

-- Make NOT NULL
ALTER TABLE "component_signal" ALTER COLUMN "io_type" SET NOT NULL;

-- Drop old columns
ALTER TABLE "component_signal" DROP COLUMN IF EXISTS "signal_type";
ALTER TABLE "component_signal" DROP COLUMN IF EXISTS "direction";
