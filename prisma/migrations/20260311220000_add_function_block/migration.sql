-- Add function_block to hardware_component (CODESYS FB name for this component type)
ALTER TABLE "hardware_component" ADD COLUMN "function_block" VARCHAR(100);

-- Add function_block_override to component_instance (per-project override)
ALTER TABLE "component_instance" ADD COLUMN "function_block_override" VARCHAR(100);
