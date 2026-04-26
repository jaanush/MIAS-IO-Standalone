-- AlterTable
ALTER TABLE "module_catalog" ADD COLUMN     "kbus_image_size" SMALLINT;

-- Seed default variants for the two WAGO Kbus modules that ship with multiple
-- process-image configurations. 24 bytes per direction covers typical CANopen
-- and Modbus RTU traffic; other articles leave the column NULL (fixed image).
UPDATE "module_catalog" SET "kbus_image_size" = 24 WHERE "article_number" IN ('750-658', '750-652');
