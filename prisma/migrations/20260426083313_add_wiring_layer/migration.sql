-- FR-001 step 1: WiringRecipe gets a layer dimension so the plugin can route
-- each recipe to the right code generator (CONTROL = component FB itself,
-- HMI / PMS / HAL / ALARM = wrapper FBs that take a REFERENCE TO the control
-- instance). Default CONTROL keeps every existing recipe valid.

-- CreateEnum
CREATE TYPE "wiring_layer" AS ENUM ('CONTROL', 'HMI', 'PMS', 'HAL', 'ALARM');

-- AlterTable
ALTER TABLE "wiring_recipe" ADD COLUMN "layer" "wiring_layer" NOT NULL DEFAULT 'CONTROL';
