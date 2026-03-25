-- Replace component-scoped FbWiringTemplate with standalone WiringRecipe

DROP TABLE IF EXISTS "fb_wiring_param" CASCADE;
DROP TABLE IF EXISTS "fb_wiring_template" CASCADE;

CREATE TABLE "wiring_recipe" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER,
    "component_id" INTEGER,
    "fb_name" VARCHAR(255) NOT NULL,
    "target_gvl" VARCHAR(100) NOT NULL,
    "instance_name_pattern" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wiring_recipe_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wiring_recipe_param" (
    "id" SERIAL NOT NULL,
    "recipe_id" INTEGER NOT NULL,
    "parameter_name" VARCHAR(255) NOT NULL,
    "direction" VARCHAR(10) NOT NULL,
    "source_type" "wiring_source_type" NOT NULL,
    "channel_offset" SMALLINT,
    "signal_tag" VARCHAR(255),
    "literal_value" VARCHAR(500),
    "expression" VARCHAR(500),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "wiring_recipe_param_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wiring_recipe_param_recipe_id_parameter_name_key" ON "wiring_recipe_param"("recipe_id", "parameter_name");

ALTER TABLE "wiring_recipe" ADD CONSTRAINT "wiring_recipe_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wiring_recipe" ADD CONSTRAINT "wiring_recipe_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "hardware_component"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "wiring_recipe_param" ADD CONSTRAINT "wiring_recipe_param_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "wiring_recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
