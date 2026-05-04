-- Hardware commissioning layer.
--
-- Adds catalog-level commissioning data (defaults from MIAS-ref docs JSON)
-- and project-level override tables for per-PLC and per-IoCard setting
-- writes.
--
-- See prisma/schema.prisma DeviceCatalog/ModuleCatalog `commissioningData`
-- field comments for the JSON shape — mirrors a single part_id entry in
-- MIAS-ref/docs/databases/wago/module_commissioning.json.
--
-- Effective value resolution (read order):
--   1. Project override (PlcCommissioning / IoCardCommissioning row by name)
--   2. Catalog `mias_convention_value`
--   3. Catalog `default_value`
--   4. null

-- AlterTable
ALTER TABLE "device_catalog" ADD COLUMN "commissioning_data" JSONB;

-- AlterTable
ALTER TABLE "module_catalog" ADD COLUMN "commissioning_data" JSONB;

-- CreateTable
CREATE TABLE "plc_commissioning" (
    "id" SERIAL NOT NULL,
    "plc_id" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "value" VARCHAR(500) NOT NULL,
    "notes" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plc_commissioning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "io_card_commissioning" (
    "id" SERIAL NOT NULL,
    "io_card_id" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "value" VARCHAR(500) NOT NULL,
    "notes" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "io_card_commissioning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plc_commissioning_plc_id_idx" ON "plc_commissioning"("plc_id");

-- CreateIndex
CREATE UNIQUE INDEX "plc_commissioning_plc_id_name_key" ON "plc_commissioning"("plc_id", "name");

-- CreateIndex
CREATE INDEX "io_card_commissioning_io_card_id_idx" ON "io_card_commissioning"("io_card_id");

-- CreateIndex
CREATE UNIQUE INDEX "io_card_commissioning_io_card_id_name_key" ON "io_card_commissioning"("io_card_id", "name");

-- AddForeignKey
ALTER TABLE "plc_commissioning" ADD CONSTRAINT "plc_commissioning_plc_id_fkey" FOREIGN KEY ("plc_id") REFERENCES "plc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "io_card_commissioning" ADD CONSTRAINT "io_card_commissioning_io_card_id_fkey" FOREIGN KEY ("io_card_id") REFERENCES "io_card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
