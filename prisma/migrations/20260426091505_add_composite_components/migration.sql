-- FR-009 — Composite HardwareComponents.
--
--  - component_composition: template-level structure (parent + child + role)
--  - component_instance: parent_instance_id + composition_role at runtime
--  - wiring_recipe_param: child_role for CHILD_SIGNAL source type
--  - wiring_source_type: new CHILD_SIGNAL value
--
-- Note: ALTER TYPE ADD VALUE cannot run inside the same transaction that uses
-- the new value. We add the enum value here; usage happens in subsequent
-- inserts/queries from application code.

-- AlterEnum
ALTER TYPE "wiring_source_type" ADD VALUE 'CHILD_SIGNAL';

-- AlterTable: component_instance
ALTER TABLE "component_instance"
  ADD COLUMN "parent_instance_id" INTEGER,
  ADD COLUMN "composition_role"   VARCHAR(100);

-- AlterTable: wiring_recipe_param
ALTER TABLE "wiring_recipe_param" ADD COLUMN "child_role" VARCHAR(100);

-- CreateTable: component_composition
CREATE TABLE "component_composition" (
    "id" SERIAL NOT NULL,
    "parent_component_id" INTEGER NOT NULL,
    "child_component_id" INTEGER NOT NULL,
    "role" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "component_composition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "component_composition_child_component_id_idx" ON "component_composition"("child_component_id");
CREATE UNIQUE INDEX "component_composition_parent_component_id_role_key" ON "component_composition"("parent_component_id", "role");
CREATE INDEX "component_instance_parent_instance_id_idx" ON "component_instance"("parent_instance_id");
CREATE UNIQUE INDEX "component_instance_parent_instance_id_composition_role_key" ON "component_instance"("parent_instance_id", "composition_role");

-- AddForeignKey
ALTER TABLE "component_instance"  ADD CONSTRAINT "component_instance_parent_instance_id_fkey" FOREIGN KEY ("parent_instance_id") REFERENCES "component_instance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "component_composition" ADD CONSTRAINT "component_composition_parent_component_id_fkey" FOREIGN KEY ("parent_component_id") REFERENCES "hardware_component"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "component_composition" ADD CONSTRAINT "component_composition_child_component_id_fkey" FOREIGN KEY ("child_component_id") REFERENCES "hardware_component"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
