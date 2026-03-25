-- Recursive component hierarchy: parent_id enables signal inheritance
ALTER TABLE "hardware_component" ADD COLUMN "parent_id" INTEGER;
ALTER TABLE "hardware_component" ADD CONSTRAINT "hardware_component_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "hardware_component"("id") ON DELETE SET NULL ON UPDATE CASCADE;
