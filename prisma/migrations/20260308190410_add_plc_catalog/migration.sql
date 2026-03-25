-- AlterTable
ALTER TABLE "plc" ADD COLUMN     "catalog_id" INTEGER;

-- CreateTable
CREATE TABLE "plc_catalog" (
    "id" SERIAL NOT NULL,
    "vendor_name" VARCHAR(100) NOT NULL,
    "article_number" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "protocol" VARCHAR(100),
    "generation" SMALLINT,
    "ethernet_ports" SMALLINT,
    "has_sd_card" BOOLEAN NOT NULL DEFAULT false,
    "has_media_redundancy" BOOLEAN NOT NULL DEFAULT false,
    "extended_temp" BOOLEAN NOT NULL DEFAULT false,
    "eco" BOOLEAN NOT NULL DEFAULT false,
    "program_memory_kb" INTEGER,
    "ram_memory_kb" INTEGER,
    "data_memory_kb" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plc_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plc_catalog_vendor_name_article_number_key" ON "plc_catalog"("vendor_name", "article_number");

-- AddForeignKey
ALTER TABLE "plc" ADD CONSTRAINT "plc_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "plc_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
