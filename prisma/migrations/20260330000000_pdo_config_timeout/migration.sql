-- Add PLC monitoring timeout to PDO config
ALTER TABLE "pdo_config" ADD COLUMN IF NOT EXISTS "timeout_ms" INTEGER;
