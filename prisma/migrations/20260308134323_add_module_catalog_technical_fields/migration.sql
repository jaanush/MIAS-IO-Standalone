-- AlterTable
ALTER TABLE "module_catalog" ADD COLUMN     "bus_current_consumption_ma" SMALLINT,
ADD COLUMN     "certifications" VARCHAR(100),
ADD COLUMN     "conversion_time_ms" DECIMAL(8,2),
ADD COLUMN     "field_current_consumption_ma" SMALLINT,
ADD COLUMN     "module_width_mm" SMALLINT,
ADD COLUMN     "signal_range" VARCHAR(50);
