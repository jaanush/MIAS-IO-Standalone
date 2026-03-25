ALTER TABLE "discrete_signal" ADD COLUMN IF NOT EXISTS "plc_data_type_id" INTEGER REFERENCES "plc_data_type_catalog"("id");
UPDATE "discrete_signal" SET "plc_data_type_id" = 1 WHERE "plc_data_type_id" IS NULL;
