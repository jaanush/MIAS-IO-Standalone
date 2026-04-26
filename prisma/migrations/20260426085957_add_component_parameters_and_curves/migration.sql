-- FR-008: Generic component-instance configuration framework.
--
-- Adds the parameter declaration / value layer plus a Curve table for
-- piecewise-linear data (calibration curves, response curves, etc.).
-- Replaces what would otherwise be a Tank-specific calibration schema.

-- CreateEnum
CREATE TYPE "param_type" AS ENUM ('SCALAR_REAL', 'INT', 'STRING', 'BOOL', 'CURVE');

-- CreateEnum
CREATE TYPE "curve_type" AS ENUM ('VOLUME_PERCENT', 'HEIGHT_CM', 'GENERIC');

-- CreateTable
CREATE TABLE "component_parameter_def" (
    "id" SERIAL NOT NULL,
    "component_id" INTEGER NOT NULL,
    "param_name" VARCHAR(100) NOT NULL,
    "param_type" "param_type" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "default_scalar_value" DOUBLE PRECISION,
    "default_int_value" INTEGER,
    "default_string_value" VARCHAR(255),
    "default_bool_value" BOOLEAN,
    "description" VARCHAR(255),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "component_parameter_def_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_instance_parameter" (
    "id" SERIAL NOT NULL,
    "instance_id" INTEGER NOT NULL,
    "param_name" VARCHAR(100) NOT NULL,
    "scalar_value" DOUBLE PRECISION,
    "int_value" INTEGER,
    "string_value" VARCHAR(255),
    "bool_value" BOOLEAN,
    "curve_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "component_instance_parameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curve" (
    "id" SERIAL NOT NULL,
    "type" "curve_type" NOT NULL DEFAULT 'GENERIC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "curve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curve_point" (
    "id" SERIAL NOT NULL,
    "curve_id" INTEGER NOT NULL,
    "ordinal" SMALLINT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "curve_point_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "component_parameter_def_component_id_param_name_key" ON "component_parameter_def"("component_id", "param_name");

-- CreateIndex
CREATE UNIQUE INDEX "component_instance_parameter_instance_id_param_name_key" ON "component_instance_parameter"("instance_id", "param_name");

-- CreateIndex
CREATE UNIQUE INDEX "curve_point_curve_id_ordinal_key" ON "curve_point"("curve_id", "ordinal");

-- AddForeignKey
ALTER TABLE "component_parameter_def" ADD CONSTRAINT "component_parameter_def_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "hardware_component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_instance_parameter" ADD CONSTRAINT "component_instance_parameter_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "component_instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_instance_parameter" ADD CONSTRAINT "component_instance_parameter_curve_id_fkey" FOREIGN KEY ("curve_id") REFERENCES "curve"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curve_point" ADD CONSTRAINT "curve_point_curve_id_fkey" FOREIGN KEY ("curve_id") REFERENCES "curve"("id") ON DELETE CASCADE ON UPDATE CASCADE;
