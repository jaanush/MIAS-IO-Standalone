-- CreateEnum
CREATE TYPE "catalog_device_type" AS ENUM ('PLC', 'COUPLER');

-- CreateEnum
CREATE TYPE "signal_origin" AS ENUM ('IEC', 'MODBUS_RTU', 'MODBUS_TCP', 'CANBUS', 'CANOPEN', 'PROFIBUS', 'PROFINET', 'ETHERNETIP', 'DEVICENET', 'BACNET');

-- CreateEnum
CREATE TYPE "byte_order" AS ENUM ('BIG_ENDIAN', 'LITTLE_ENDIAN');

-- CreateEnum
CREATE TYPE "modbus_register_type" AS ENUM ('COIL', 'DISCRETE_INPUT', 'HOLDING_REGISTER', 'INPUT_REGISTER');

-- CreateEnum
CREATE TYPE "bus_raw_data_type" AS ENUM ('BOOL', 'BYTE', 'WORD', 'DWORD', 'LWORD', 'INT', 'DINT', 'LINT', 'UINT', 'UDINT', 'ULINT', 'REAL', 'LREAL');

-- CreateEnum
CREATE TYPE "plc_data_type" AS ENUM ('BOOL', 'BYTE', 'WORD', 'DWORD', 'LWORD', 'SINT', 'INT', 'DINT', 'LINT', 'USINT', 'UINT', 'UDINT', 'ULINT', 'REAL', 'LREAL', 'TIME', 'DATE', 'TOD', 'DT', 'STRING', 'WSTRING', 'SAFEBOOL', 'SAFEINT', 'SAFEDINT', 'SAFETIME', 'SAFEWORD');

-- AlterEnum
ALTER TYPE "bus_protocol" ADD VALUE 'ETHERCAT';

-- DropForeignKey
ALTER TABLE "instance_signal" DROP CONSTRAINT "instance_signal_signal_id_fkey";

-- DropForeignKey
ALTER TABLE "plc" DROP CONSTRAINT "plc_catalog_id_fkey";

-- DropForeignKey
ALTER TABLE "signal" DROP CONSTRAINT "signal_io_card_id_fkey";

-- AlterTable
ALTER TABLE "instance_signal" DROP COLUMN "signal_id";

-- AlterTable
ALTER TABLE "io_carrier" DROP COLUMN "ip_rating",
DROP COLUMN "max_modules",
ADD COLUMN     "catalog_id" INTEGER;

-- AlterTable
ALTER TABLE "module_catalog" DROP COLUMN "certifications";

-- AlterTable
ALTER TABLE "signal" ADD COLUMN     "instance_signal_id" INTEGER,
ADD COLUMN     "origin" "signal_origin" NOT NULL DEFAULT 'IEC',
ADD COLUMN     "project_id" INTEGER NOT NULL,
ALTER COLUMN "io_card_id" DROP NOT NULL,
ALTER COLUMN "channel_position" DROP NOT NULL;

-- AlterTable
ALTER TABLE "template_instance" ADD COLUMN     "byte_order" "byte_order";

-- DropTable
DROP TABLE "plc_catalog";

-- CreateTable
CREATE TABLE "certification" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_catalog_certification" (
    "device_catalog_id" INTEGER NOT NULL,
    "certification_id" INTEGER NOT NULL,

    CONSTRAINT "device_catalog_certification_pkey" PRIMARY KEY ("device_catalog_id","certification_id")
);

-- CreateTable
CREATE TABLE "module_catalog_certification" (
    "module_catalog_id" INTEGER NOT NULL,
    "certification_id" INTEGER NOT NULL,

    CONSTRAINT "module_catalog_certification_pkey" PRIMARY KEY ("module_catalog_id","certification_id")
);

-- CreateTable
CREATE TABLE "project_certification" (
    "project_id" INTEGER NOT NULL,
    "certification_id" INTEGER NOT NULL,

    CONSTRAINT "project_certification_pkey" PRIMARY KEY ("project_id","certification_id")
);

-- CreateTable
CREATE TABLE "device_catalog" (
    "id" SERIAL NOT NULL,
    "vendor_name" VARCHAR(100) NOT NULL,
    "article_number" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "type" "catalog_device_type" NOT NULL,
    "generation" SMALLINT,
    "program_memory_kb" INTEGER,
    "ram_memory_kb" INTEGER,
    "data_memory_kb" INTEGER,
    "eco" BOOLEAN NOT NULL DEFAULT false,
    "max_modules" SMALLINT,
    "bus_power_budget_ma" INTEGER,
    "supply_voltage_min_v" SMALLINT,
    "supply_voltage_max_v" SMALLINT,
    "internal_current_ma" INTEGER,
    "ip_rating" VARCHAR(10) NOT NULL DEFAULT 'IP20',
    "temp_min_c" SMALLINT,
    "temp_max_c" SMALLINT,
    "extended_temp" BOOLEAN NOT NULL DEFAULT false,
    "ethernet_ports" SMALLINT,
    "data_rate_mbit" SMALLINT,
    "has_sd_card" BOOLEAN NOT NULL DEFAULT false,
    "has_media_redundancy" BOOLEAN NOT NULL DEFAULT false,
    "width_mm" SMALLINT,
    "height_mm" SMALLINT,
    "depth_mm" SMALLINT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_catalog_protocol" (
    "id" SERIAL NOT NULL,
    "device_catalog_id" INTEGER NOT NULL,
    "protocol" "bus_protocol" NOT NULL,
    "baud_rate_max_kbit" INTEGER,
    "node_address_min" SMALLINT,
    "node_address_max" SMALLINT,

    CONSTRAINT "device_catalog_protocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bus_signal" (
    "signal_id" INTEGER NOT NULL,
    "plc_network_id" INTEGER NOT NULL,
    "unit_id" SMALLINT,
    "register_type" "modbus_register_type",
    "register_offset" INTEGER,
    "node_id" SMALLINT,
    "can_id" INTEGER,
    "bit_offset" INTEGER,
    "bit_length" SMALLINT,
    "raw_data_type" "bus_raw_data_type" NOT NULL,
    "plc_data_type" "plc_data_type" NOT NULL,
    "byte_order" "byte_order" NOT NULL,

    CONSTRAINT "bus_signal_pkey" PRIMARY KEY ("signal_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "certification_code_key" ON "certification"("code");

-- CreateIndex
CREATE UNIQUE INDEX "device_catalog_vendor_name_article_number_key" ON "device_catalog"("vendor_name", "article_number");

-- CreateIndex
CREATE UNIQUE INDEX "device_catalog_protocol_device_catalog_id_protocol_key" ON "device_catalog_protocol"("device_catalog_id", "protocol");

-- AddForeignKey
ALTER TABLE "device_catalog_certification" ADD CONSTRAINT "device_catalog_certification_device_catalog_id_fkey" FOREIGN KEY ("device_catalog_id") REFERENCES "device_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_catalog_certification" ADD CONSTRAINT "device_catalog_certification_certification_id_fkey" FOREIGN KEY ("certification_id") REFERENCES "certification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_catalog_certification" ADD CONSTRAINT "module_catalog_certification_module_catalog_id_fkey" FOREIGN KEY ("module_catalog_id") REFERENCES "module_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_catalog_certification" ADD CONSTRAINT "module_catalog_certification_certification_id_fkey" FOREIGN KEY ("certification_id") REFERENCES "certification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_certification" ADD CONSTRAINT "project_certification_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_certification" ADD CONSTRAINT "project_certification_certification_id_fkey" FOREIGN KEY ("certification_id") REFERENCES "certification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_catalog_protocol" ADD CONSTRAINT "device_catalog_protocol_device_catalog_id_fkey" FOREIGN KEY ("device_catalog_id") REFERENCES "device_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plc" ADD CONSTRAINT "plc_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "device_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "io_carrier" ADD CONSTRAINT "io_carrier_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "device_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signal" ADD CONSTRAINT "signal_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signal" ADD CONSTRAINT "signal_instance_signal_id_fkey" FOREIGN KEY ("instance_signal_id") REFERENCES "instance_signal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signal" ADD CONSTRAINT "signal_io_card_id_fkey" FOREIGN KEY ("io_card_id") REFERENCES "io_card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bus_signal" ADD CONSTRAINT "bus_signal_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bus_signal" ADD CONSTRAINT "bus_signal_plc_network_id_fkey" FOREIGN KEY ("plc_network_id") REFERENCES "plc_network"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

