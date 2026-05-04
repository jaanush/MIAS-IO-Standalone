-- WAGO front-panel renderings + LED layouts.
--
-- Adds a JSONB column on both catalogs holding the parsed `.wdd` metadata
-- + image URL + LED layout for each WAGO module. Imported from a local
-- WAGO-IO-CHECK 3 install via scripts/import_wago_modules.py and seeded
-- via prisma/seed_wago_front_panels.ts. PNG renderings live under
-- public/wago-modules/<articleNumber>.png.

-- AlterTable
ALTER TABLE "device_catalog" ADD COLUMN "front_panel" JSONB;

-- AlterTable
ALTER TABLE "module_catalog" ADD COLUMN "front_panel" JSONB;
