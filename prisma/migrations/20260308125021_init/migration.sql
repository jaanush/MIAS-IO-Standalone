-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'ENGINEER', 'VIEWER');

-- CreateEnum
CREATE TYPE "project_status" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "bus_protocol" AS ENUM ('MODBUS_RTU', 'MODBUS_TCP', 'PROFIBUS', 'PROFINET', 'CANOPEN', 'ETHERNETIP', 'DEVICENET', 'BACNET');

-- CreateEnum
CREATE TYPE "network_role" AS ENUM ('MASTER', 'SLAVE', 'ADAPTER', 'SCANNER');

-- CreateEnum
CREATE TYPE "io_card_type" AS ENUM ('DI', 'DO', 'AI', 'AO', 'MIXED', 'COUNTER', 'PWM', 'SERIAL', 'IO_LINK', 'SUPPLY', 'RELAY');

-- CreateEnum
CREATE TYPE "signal_type" AS ENUM ('DISCRETE', 'ANALOG');

-- CreateEnum
CREATE TYPE "trigger_type" AS ENUM ('NO', 'NC');

-- CreateEnum
CREATE TYPE "switching_type" AS ENUM ('HIGH_SIDE', 'LOW_SIDE', 'BOTH');

-- CreateEnum
CREATE TYPE "wire_config" AS ENUM ('TWO_WIRE', 'THREE_WIRE', 'FOUR_WIRE');

-- CreateEnum
CREATE TYPE "analog_input_type" AS ENUM ('MA_4_20', 'MA_0_20', 'MA_0_25', 'V_0_10', 'V_0_5', 'V_PLUS_MINUS_10', 'V_PLUS_MINUS_5', 'PT100', 'PT1000', 'NI100', 'NI1000', 'TC_K', 'TC_J', 'TC_T', 'TC_E', 'TC_N', 'TC_R', 'TC_S', 'TC_B', 'RESISTANCE_0_600', 'POTENTIOMETER');

-- CreateEnum
CREATE TYPE "alarm_severity" AS ENUM ('INFO', 'WARNING', 'ALARM', 'CRITICAL');

-- CreateEnum
CREATE TYPE "discrete_alarm_condition" AS ENUM ('ON_TRIGGER', 'OFF_TRIGGER');

-- CreateEnum
CREATE TYPE "analog_alarm_condition" AS ENUM ('HIGH', 'HIGH_HIGH', 'LOW', 'LOW_LOW');

-- CreateEnum
CREATE TYPE "template_status" AS ENUM ('DRAFT', 'ACTIVE', 'DEPRECATED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "role" "user_role" NOT NULL DEFAULT 'ENGINEER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engineering_unit" (
    "id" SERIAL NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "description" VARCHAR(100),

    CONSTRAINT "engineering_unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_catalog" (
    "id" SERIAL NOT NULL,
    "vendor_name" VARCHAR(100) NOT NULL,
    "article_number" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "card_type" "io_card_type" NOT NULL,
    "max_channels" SMALLINT,
    "bit_resolution" SMALLINT,
    "supply_voltage_field" VARCHAR(20),
    "filter_time_ms" DECIMAL(8,3),
    "galvanic_isolation" BOOLEAN DEFAULT true,
    "isolation_voltage_v" SMALLINT,
    "temp_min_c" SMALLINT,
    "temp_max_c" SMALLINT,
    "max_channel_current_ma" SMALLINT,
    "short_circuit_protected" BOOLEAN NOT NULL DEFAULT false,
    "provides_network" BOOLEAN NOT NULL DEFAULT false,
    "ip_rating" VARCHAR(10) NOT NULL DEFAULT 'IP20',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "client" VARCHAR(255),
    "location" VARCHAR(255),
    "status" "project_status" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plc" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "model" VARCHAR(100),
    "ip_address" VARCHAR(45),
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plc_network" (
    "id" SERIAL NOT NULL,
    "plc_id" INTEGER NOT NULL,
    "io_card_id" INTEGER,
    "protocol" "bus_protocol" NOT NULL,
    "role" "network_role" NOT NULL,
    "network_id" SMALLINT,
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plc_network_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "io_carrier" (
    "id" SERIAL NOT NULL,
    "plc_id" INTEGER NOT NULL,
    "plc_network_id" INTEGER,
    "name" VARCHAR(255) NOT NULL,
    "model" VARCHAR(100),
    "ip_address" VARCHAR(45),
    "node_address" SMALLINT,
    "max_modules" SMALLINT,
    "ip_rating" VARCHAR(10) NOT NULL DEFAULT 'IP20',
    "firmware_version" VARCHAR(20),
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "io_carrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "io_card" (
    "id" SERIAL NOT NULL,
    "carrier_id" INTEGER NOT NULL,
    "catalog_id" INTEGER,
    "slot_position" SMALLINT NOT NULL,
    "card_type" "io_card_type" NOT NULL,
    "name" VARCHAR(255),
    "vendor_article_number" VARCHAR(50),
    "max_channels" SMALLINT,
    "bit_resolution" SMALLINT,
    "provides_network" BOOLEAN NOT NULL DEFAULT false,
    "supply_voltage_field" VARCHAR(20),
    "filter_time_ms" DECIMAL(8,3),
    "galvanic_isolation" BOOLEAN DEFAULT true,
    "isolation_voltage_v" SMALLINT,
    "temp_min_c" SMALLINT,
    "temp_max_c" SMALLINT,
    "max_channel_current_ma" SMALLINT,
    "short_circuit_protected" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "io_card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signal" (
    "id" SERIAL NOT NULL,
    "io_card_id" INTEGER NOT NULL,
    "channel_position" SMALLINT NOT NULL,
    "signal_type" "signal_type" NOT NULL,
    "tag" VARCHAR(50),
    "description" VARCHAR(255),
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discrete_signal" (
    "signal_id" INTEGER NOT NULL,
    "trigger" "trigger_type" NOT NULL DEFAULT 'NO',
    "filter_time_ms" DECIMAL(8,3),
    "switching_type" "switching_type",
    "signal_voltage" VARCHAR(20),

    CONSTRAINT "discrete_signal_pkey" PRIMARY KEY ("signal_id")
);

-- CreateTable
CREATE TABLE "analog_signal" (
    "signal_id" INTEGER NOT NULL,
    "input_type" "analog_input_type" NOT NULL,
    "wire_config" "wire_config",
    "raw_min" DECIMAL(12,4),
    "raw_max" DECIMAL(12,4),
    "scale_min" DECIMAL(12,4),
    "scale_max" DECIMAL(12,4),
    "clamp_low" DECIMAL(12,4),
    "clamp_high" DECIMAL(12,4),
    "deadband" DECIMAL(12,4),
    "engineering_unit_id" INTEGER,
    "detect_wire_break" BOOLEAN NOT NULL DEFAULT false,
    "detect_short_circuit" BOOLEAN NOT NULL DEFAULT false,
    "detect_out_of_range" BOOLEAN NOT NULL DEFAULT false,
    "namur_ne43" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "analog_signal_pkey" PRIMARY KEY ("signal_id")
);

-- CreateTable
CREATE TABLE "discrete_alarm" (
    "id" SERIAL NOT NULL,
    "signal_id" INTEGER NOT NULL,
    "condition" "discrete_alarm_condition" NOT NULL,
    "severity" "alarm_severity" NOT NULL DEFAULT 'ALARM',
    "delay_seconds" SMALLINT NOT NULL DEFAULT 0,
    "message" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discrete_alarm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analog_alarm" (
    "id" SERIAL NOT NULL,
    "signal_id" INTEGER NOT NULL,
    "condition" "analog_alarm_condition" NOT NULL,
    "setpoint" DECIMAL(12,4) NOT NULL,
    "hysteresis" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "severity" "alarm_severity" NOT NULL DEFAULT 'ALARM',
    "delay_seconds" SMALLINT NOT NULL DEFAULT 0,
    "message" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analog_alarm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hardware_template" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER,
    "name" VARCHAR(255) NOT NULL,
    "manufacturer" VARCHAR(100),
    "model" VARCHAR(100),
    "version" VARCHAR(50),
    "status" "template_status" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hardware_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_signal" (
    "id" SERIAL NOT NULL,
    "template_id" INTEGER NOT NULL,
    "channel_offset" SMALLINT NOT NULL,
    "signal_type" "signal_type" NOT NULL,
    "tag_suffix" VARCHAR(50),
    "description" VARCHAR(255),
    "default_trigger" "trigger_type",
    "default_filter_time_ms" DECIMAL(8,3),
    "default_switching_type" "switching_type",
    "default_input_type" "analog_input_type",
    "default_wire_config" "wire_config",
    "default_scale_min" DECIMAL(12,4),
    "default_scale_max" DECIMAL(12,4),
    "default_eu_id" INTEGER,

    CONSTRAINT "template_signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_discrete_alarm" (
    "id" SERIAL NOT NULL,
    "template_signal_id" INTEGER NOT NULL,
    "condition" "discrete_alarm_condition" NOT NULL,
    "severity" "alarm_severity" NOT NULL DEFAULT 'ALARM',
    "delay_seconds" SMALLINT NOT NULL DEFAULT 0,
    "message" VARCHAR(255),

    CONSTRAINT "template_discrete_alarm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_analog_alarm" (
    "id" SERIAL NOT NULL,
    "template_signal_id" INTEGER NOT NULL,
    "condition" "analog_alarm_condition" NOT NULL,
    "setpoint" DECIMAL(12,4) NOT NULL,
    "hysteresis" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "severity" "alarm_severity" NOT NULL DEFAULT 'ALARM',
    "delay_seconds" SMALLINT NOT NULL DEFAULT 0,
    "message" VARCHAR(255),

    CONSTRAINT "template_analog_alarm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_instance" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "template_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "tag" VARCHAR(50),
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instance_signal" (
    "id" SERIAL NOT NULL,
    "instance_id" INTEGER NOT NULL,
    "template_signal_id" INTEGER NOT NULL,
    "signal_id" INTEGER,
    "decoupled" BOOLEAN NOT NULL DEFAULT false,
    "override_tag" VARCHAR(50),
    "override_description" VARCHAR(255),
    "override_trigger" "trigger_type",
    "override_filter_time_ms" DECIMAL(8,3),
    "override_switching_type" "switching_type",
    "override_input_type" "analog_input_type",
    "override_wire_config" "wire_config",
    "override_scale_min" DECIMAL(12,4),
    "override_scale_max" DECIMAL(12,4),
    "override_eu_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instance_signal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "engineering_unit_symbol_key" ON "engineering_unit"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "module_catalog_vendor_name_article_number_key" ON "module_catalog"("vendor_name", "article_number");

-- CreateIndex
CREATE UNIQUE INDEX "io_card_carrier_id_slot_position_key" ON "io_card"("carrier_id", "slot_position");

-- CreateIndex
CREATE UNIQUE INDEX "signal_io_card_id_channel_position_key" ON "signal"("io_card_id", "channel_position");

-- CreateIndex
CREATE UNIQUE INDEX "discrete_alarm_signal_id_condition_key" ON "discrete_alarm"("signal_id", "condition");

-- CreateIndex
CREATE UNIQUE INDEX "analog_alarm_signal_id_condition_key" ON "analog_alarm"("signal_id", "condition");

-- CreateIndex
CREATE UNIQUE INDEX "template_signal_template_id_channel_offset_key" ON "template_signal"("template_id", "channel_offset");

-- CreateIndex
CREATE UNIQUE INDEX "template_discrete_alarm_template_signal_id_condition_key" ON "template_discrete_alarm"("template_signal_id", "condition");

-- CreateIndex
CREATE UNIQUE INDEX "template_analog_alarm_template_signal_id_condition_key" ON "template_analog_alarm"("template_signal_id", "condition");

-- CreateIndex
CREATE UNIQUE INDEX "instance_signal_instance_id_template_signal_id_key" ON "instance_signal"("instance_id", "template_signal_id");

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plc" ADD CONSTRAINT "plc_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plc" ADD CONSTRAINT "plc_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plc_network" ADD CONSTRAINT "plc_network_plc_id_fkey" FOREIGN KEY ("plc_id") REFERENCES "plc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plc_network" ADD CONSTRAINT "plc_network_io_card_id_fkey" FOREIGN KEY ("io_card_id") REFERENCES "io_card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "io_carrier" ADD CONSTRAINT "io_carrier_plc_id_fkey" FOREIGN KEY ("plc_id") REFERENCES "plc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "io_carrier" ADD CONSTRAINT "io_carrier_plc_network_id_fkey" FOREIGN KEY ("plc_network_id") REFERENCES "plc_network"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "io_carrier" ADD CONSTRAINT "io_carrier_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "io_card" ADD CONSTRAINT "io_card_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "io_carrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "io_card" ADD CONSTRAINT "io_card_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "module_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "io_card" ADD CONSTRAINT "io_card_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signal" ADD CONSTRAINT "signal_io_card_id_fkey" FOREIGN KEY ("io_card_id") REFERENCES "io_card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signal" ADD CONSTRAINT "signal_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discrete_signal" ADD CONSTRAINT "discrete_signal_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analog_signal" ADD CONSTRAINT "analog_signal_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analog_signal" ADD CONSTRAINT "analog_signal_engineering_unit_id_fkey" FOREIGN KEY ("engineering_unit_id") REFERENCES "engineering_unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discrete_alarm" ADD CONSTRAINT "discrete_alarm_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "discrete_signal"("signal_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analog_alarm" ADD CONSTRAINT "analog_alarm_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "analog_signal"("signal_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware_template" ADD CONSTRAINT "hardware_template_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware_template" ADD CONSTRAINT "hardware_template_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_signal" ADD CONSTRAINT "template_signal_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "hardware_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_signal" ADD CONSTRAINT "template_signal_default_eu_id_fkey" FOREIGN KEY ("default_eu_id") REFERENCES "engineering_unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_discrete_alarm" ADD CONSTRAINT "template_discrete_alarm_template_signal_id_fkey" FOREIGN KEY ("template_signal_id") REFERENCES "template_signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_analog_alarm" ADD CONSTRAINT "template_analog_alarm_template_signal_id_fkey" FOREIGN KEY ("template_signal_id") REFERENCES "template_signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_instance" ADD CONSTRAINT "template_instance_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_instance" ADD CONSTRAINT "template_instance_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "hardware_template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_instance" ADD CONSTRAINT "template_instance_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instance_signal" ADD CONSTRAINT "instance_signal_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "template_instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instance_signal" ADD CONSTRAINT "instance_signal_template_signal_id_fkey" FOREIGN KEY ("template_signal_id") REFERENCES "template_signal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instance_signal" ADD CONSTRAINT "instance_signal_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "signal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instance_signal" ADD CONSTRAINT "instance_signal_override_eu_id_fkey" FOREIGN KEY ("override_eu_id") REFERENCES "engineering_unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
