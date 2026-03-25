-- AlterTable
ALTER TABLE "analog_alarm" ADD COLUMN     "alarm_group" CHAR(1);

-- AlterTable
ALTER TABLE "analog_signal" ADD COLUMN     "deadband_raw_max" DECIMAL(12,4),
ADD COLUMN     "deadband_raw_min" DECIMAL(12,4),
ADD COLUMN     "deadband_raw_zero" DECIMAL(12,4),
ADD COLUMN     "raw_zero" DECIMAL(12,4),
ADD COLUMN     "scaling_fb_override" VARCHAR(100),
ADD COLUMN     "sensor_fail_behavior" VARCHAR(50),
ADD COLUMN     "sensor_fail_delay_ms" INTEGER,
ADD COLUMN     "sensor_fail_margin" DECIMAL(12,4),
ADD COLUMN     "sensor_fail_raw" DECIMAL(12,4),
ADD COLUMN     "use_tank_level" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "discrete_alarm" ADD COLUMN     "alarm_group" CHAR(1);

-- AlterTable
ALTER TABLE "io_carrier" ADD COLUMN     "modbus_input_base" INTEGER,
ADD COLUMN     "modbus_output_base" INTEGER;

-- AlterTable
ALTER TABLE "signal" ADD COLUMN     "alarm_block_mask" VARCHAR(5),
ADD COLUMN     "alarm_group" CHAR(1),
ADD COLUMN     "ana_to_dig_alarm" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "comm_block_mask" VARCHAR(5),
ADD COLUMN     "fat_block" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fb_name_override" VARCHAR(255),
ADD COLUMN     "is_persistent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_retain" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "logging_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "special_alarm_fb" VARCHAR(100),
ADD COLUMN     "special_alarm_input" VARCHAR(255),
ADD COLUMN     "suppression_st" TEXT,
ADD COLUMN     "use_short_name" BOOLEAN NOT NULL DEFAULT false;
