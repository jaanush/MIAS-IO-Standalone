-- AlterTable
ALTER TABLE "device_catalog" ADD COLUMN "series" VARCHAR(50);

-- Backfill existing PLCs as '750 Series'
UPDATE "device_catalog" SET "series" = '750 Series' WHERE "type" = 'PLC';
