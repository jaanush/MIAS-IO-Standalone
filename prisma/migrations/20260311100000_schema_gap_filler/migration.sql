-- CreateEnum
CREATE TYPE "component_status" AS ENUM ('DRAFT', 'ACTIVE', 'DEPRECATED');

-- DropForeignKey
ALTER TABLE "bus_signal" DROP CONSTRAINT "bus_signal_plc_network_id_fkey";

-- DropForeignKey
ALTER TABLE "component_analog_alarm" DROP CONSTRAINT "component_analog_alarm_component_signal_id_fkey";

-- DropForeignKey
ALTER TABLE "component_discrete_alarm" DROP CONSTRAINT "component_discrete_alarm_component_signal_id_fkey";

-- DropForeignKey
ALTER TABLE "component_instance" DROP CONSTRAINT "component_instance_component_id_fkey";

-- DropForeignKey
ALTER TABLE "component_instance" DROP CONSTRAINT "component_instance_plc_network_id_fkey";

-- DropForeignKey
ALTER TABLE "component_signal" DROP CONSTRAINT "component_signal_component_id_fkey";

-- DropForeignKey
ALTER TABLE "component_signal" DROP CONSTRAINT "template_signal_plc_data_type_id_fkey";

-- DropForeignKey
ALTER TABLE "discrete_signal" DROP CONSTRAINT "discrete_signal_plc_data_type_id_fkey";

-- DropForeignKey
ALTER TABLE "instance_signal" DROP CONSTRAINT "instance_signal_component_signal_id_fkey";

-- DropForeignKey
ALTER TABLE "module_catalog_protocol" DROP CONSTRAINT "module_catalog_protocol_module_catalog_id_fkey";

-- DropIndex
DROP INDEX "component_analog_alarm_component_signal_id_condition_key";

-- DropIndex
DROP INDEX "component_discrete_alarm_component_signal_id_condition_key";

-- DropIndex
DROP INDEX "component_signal_component_id_channel_offset_key";

-- DropIndex
DROP INDEX "instance_signal_instance_id_component_signal_id_key";

-- AlterTable
ALTER TABLE "analog_signal" DROP COLUMN "input_type",
ADD COLUMN     "input_type_id" INTEGER;

-- AlterTable
ALTER TABLE "bus_signal" ADD COLUMN     "is_mux_indicator" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mux_id" SMALLINT;

-- AlterTable
ALTER TABLE "component_analog_alarm" DROP COLUMN "template_signal_id",
ADD COLUMN     "component_signal_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "component_discrete_alarm" DROP COLUMN "template_signal_id",
ADD COLUMN     "component_signal_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "component_instance" DROP COLUMN "template_id",
ADD COLUMN     "can_id_offset" INTEGER,
ADD COLUMN     "component_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "component_signal" DROP COLUMN "default_input_type",
DROP COLUMN "template_id",
ADD COLUMN     "component_id" INTEGER NOT NULL,
ADD COLUMN     "is_mux_indicator" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mux_id" SMALLINT;

-- AlterTable
ALTER TABLE "hardware_component" DROP COLUMN "status",
ADD COLUMN     "status" "component_status" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "instance_signal" DROP COLUMN "override_input_type",
DROP COLUMN "template_signal_id",
ADD COLUMN     "component_signal_id" INTEGER NOT NULL,
ADD COLUMN     "override_input_type_id" INTEGER;

-- AlterTable
ALTER TABLE "io_card" DROP COLUMN "max_channels",
ADD COLUMN     "max_input_channels" SMALLINT,
ADD COLUMN     "max_output_channels" SMALLINT;

-- AlterTable
ALTER TABLE "module_catalog" DROP COLUMN "max_channels",
ADD COLUMN     "max_input_channels" SMALLINT,
ADD COLUMN     "max_output_channels" SMALLINT;

-- AlterTable
ALTER TABLE "signal" ADD COLUMN     "cabinet_location" VARCHAR(50),
ADD COLUMN     "component_tag" VARCHAR(100),
ADD COLUMN     "direction" "signal_direction",
ADD COLUMN     "drawing_ref" VARCHAR(100),
ADD COLUMN     "gvl_id" INTEGER,
ADD COLUMN     "system_id" INTEGER,
ALTER COLUMN "description" SET DATA TYPE TEXT;

-- DropEnum
DROP TYPE "analog_input_type";

-- DropEnum
DROP TYPE "template_status";

-- CreateTable
CREATE TABLE "signal_system" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(255),

    CONSTRAINT "signal_system_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_variable_list" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),

    CONSTRAINT "global_variable_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plc_port" (
    "id" SERIAL NOT NULL,
    "plc_id" INTEGER NOT NULL,
    "port_number" SMALLINT NOT NULL,
    "label" VARCHAR(20),
    "ip_address" VARCHAR(45),
    "plc_network_id" INTEGER,

    CONSTRAINT "plc_port_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carrier_port" (
    "id" SERIAL NOT NULL,
    "carrier_id" INTEGER NOT NULL,
    "port_number" SMALLINT NOT NULL,
    "label" VARCHAR(20),
    "ip_address" VARCHAR(45),
    "plc_network_id" INTEGER,

    CONSTRAINT "carrier_port_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "signal_system_code_key" ON "signal_system"("code");

-- CreateIndex
CREATE UNIQUE INDEX "global_variable_list_name_key" ON "global_variable_list"("name");

-- CreateIndex
CREATE UNIQUE INDEX "plc_port_plc_id_port_number_key" ON "plc_port"("plc_id", "port_number");

-- CreateIndex
CREATE UNIQUE INDEX "carrier_port_carrier_id_port_number_key" ON "carrier_port"("carrier_id", "port_number");

-- CreateIndex
CREATE UNIQUE INDEX "component_analog_alarm_component_signal_id_condition_key" ON "component_analog_alarm"("component_signal_id", "condition");

-- CreateIndex
CREATE UNIQUE INDEX "component_discrete_alarm_component_signal_id_condition_key" ON "component_discrete_alarm"("component_signal_id", "condition");

-- CreateIndex
CREATE UNIQUE INDEX "component_signal_component_id_channel_offset_key" ON "component_signal"("component_id", "channel_offset");

-- CreateIndex
CREATE UNIQUE INDEX "instance_signal_instance_id_component_signal_id_key" ON "instance_signal"("instance_id", "component_signal_id");

-- AddForeignKey
ALTER TABLE "module_catalog_protocol" ADD CONSTRAINT "module_catalog_protocol_module_catalog_id_fkey" FOREIGN KEY ("module_catalog_id") REFERENCES "module_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plc_port" ADD CONSTRAINT "plc_port_plc_id_fkey" FOREIGN KEY ("plc_id") REFERENCES "plc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plc_port" ADD CONSTRAINT "plc_port_plc_network_id_fkey" FOREIGN KEY ("plc_network_id") REFERENCES "plc_network"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_port" ADD CONSTRAINT "carrier_port_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "io_carrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrier_port" ADD CONSTRAINT "carrier_port_plc_network_id_fkey" FOREIGN KEY ("plc_network_id") REFERENCES "plc_network"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signal" ADD CONSTRAINT "signal_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "signal_system"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signal" ADD CONSTRAINT "signal_gvl_id_fkey" FOREIGN KEY ("gvl_id") REFERENCES "global_variable_list"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bus_signal" ADD CONSTRAINT "bus_signal_plc_network_id_fkey" FOREIGN KEY ("plc_network_id") REFERENCES "plc_network"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discrete_signal" ADD CONSTRAINT "discrete_signal_plc_data_type_id_fkey" FOREIGN KEY ("plc_data_type_id") REFERENCES "plc_data_type_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analog_signal" ADD CONSTRAINT "analog_signal_input_type_id_fkey" FOREIGN KEY ("input_type_id") REFERENCES "input_type_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_signal" ADD CONSTRAINT "component_signal_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "hardware_component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_signal" ADD CONSTRAINT "component_signal_plc_data_type_id_fkey" FOREIGN KEY ("plc_data_type_id") REFERENCES "plc_data_type_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_discrete_alarm" ADD CONSTRAINT "component_discrete_alarm_component_signal_id_fkey" FOREIGN KEY ("component_signal_id") REFERENCES "component_signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_analog_alarm" ADD CONSTRAINT "component_analog_alarm_component_signal_id_fkey" FOREIGN KEY ("component_signal_id") REFERENCES "component_signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_instance" ADD CONSTRAINT "component_instance_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "hardware_component"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_instance" ADD CONSTRAINT "component_instance_plc_network_id_fkey" FOREIGN KEY ("plc_network_id") REFERENCES "plc_network"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instance_signal" ADD CONSTRAINT "instance_signal_override_input_type_id_fkey" FOREIGN KEY ("override_input_type_id") REFERENCES "input_type_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instance_signal" ADD CONSTRAINT "instance_signal_component_signal_id_fkey" FOREIGN KEY ("component_signal_id") REFERENCES "component_signal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

