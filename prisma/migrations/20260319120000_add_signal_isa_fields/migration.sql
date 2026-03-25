-- Add ISA instrument identification and supplier fields to signal table

ALTER TABLE "signal" ADD COLUMN "instrument_tag" VARCHAR(50);
ALTER TABLE "signal" ADD COLUMN "signal_classification" VARCHAR(10);
ALTER TABLE "signal" ADD COLUMN "subsystem" VARCHAR(255);
ALTER TABLE "signal" ADD COLUMN "element" VARCHAR(255);
ALTER TABLE "signal" ADD COLUMN "signal_function" VARCHAR(100);
ALTER TABLE "signal" ADD COLUMN "supplier_name" VARCHAR(255);
ALTER TABLE "signal" ADD COLUMN "supplier_sensor_type" VARCHAR(255);
ALTER TABLE "signal" ADD COLUMN "normal_value" VARCHAR(100);
