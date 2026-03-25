-- AlterTable
ALTER TABLE "analog_signal" DROP COLUMN IF EXISTS "plc_data_type",
ADD COLUMN IF NOT EXISTS "plc_data_type_id" INTEGER;

-- AlterTable
ALTER TABLE "engineering_unit" DROP COLUMN IF EXISTS "plc_data_type",
ADD COLUMN IF NOT EXISTS "plc_data_type_id" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "plc_data_type_catalog" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "plc_data_type_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "plc_data_type_catalog_code_key" ON "plc_data_type_catalog"("code");

-- AddForeignKey
ALTER TABLE "engineering_unit" DROP CONSTRAINT IF EXISTS "engineering_unit_plc_data_type_id_fkey";
ALTER TABLE "engineering_unit" ADD CONSTRAINT "engineering_unit_plc_data_type_id_fkey" FOREIGN KEY ("plc_data_type_id") REFERENCES "plc_data_type_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analog_signal" DROP CONSTRAINT IF EXISTS "analog_signal_plc_data_type_id_fkey";
ALTER TABLE "analog_signal" ADD CONSTRAINT "analog_signal_plc_data_type_id_fkey" FOREIGN KEY ("plc_data_type_id") REFERENCES "plc_data_type_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
