-- CreateEnum
CREATE TYPE "wiring_source_type" AS ENUM ('SIGNAL', 'SIGNAL_RAW', 'SIGNAL_SENSOR_FAULT', 'INSTANCE_FB', 'LITERAL', 'EXPRESSION');

-- CreateTable
CREATE TABLE "fb_wiring_template" (
    "id" SERIAL NOT NULL,
    "component_id" INTEGER NOT NULL,
    "fb_name" VARCHAR(255) NOT NULL,
    "target_gvl" VARCHAR(100) NOT NULL,
    "instance_name_pattern" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "fb_wiring_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fb_wiring_param" (
    "id" SERIAL NOT NULL,
    "template_id" INTEGER NOT NULL,
    "parameter_name" VARCHAR(255) NOT NULL,
    "direction" VARCHAR(10) NOT NULL,
    "source_type" "wiring_source_type" NOT NULL,
    "channel_offset" SMALLINT,
    "literal_value" VARCHAR(500),
    "expression" VARCHAR(500),
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "fb_wiring_param_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fb_wiring_template_component_id_fb_name_key" ON "fb_wiring_template"("component_id", "fb_name");

-- CreateIndex
CREATE UNIQUE INDEX "fb_wiring_param_template_id_parameter_name_key" ON "fb_wiring_param"("template_id", "parameter_name");

-- AddForeignKey
ALTER TABLE "fb_wiring_template" ADD CONSTRAINT "fb_wiring_template_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "hardware_component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fb_wiring_param" ADD CONSTRAINT "fb_wiring_param_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "fb_wiring_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
