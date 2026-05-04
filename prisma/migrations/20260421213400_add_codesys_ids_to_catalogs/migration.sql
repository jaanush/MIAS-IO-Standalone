-- Backfill missing migration: codesys_module_id / codesys_device_id columns.
--
-- These were added in dev via `prisma db push` and never captured as a real
-- migration; subsequent migrations (notably 20260421213410_fix_750_626_*)
-- assume the columns exist, so a fresh build from migrations alone failed.
-- This migration creates the columns with the same shape currently in
-- prisma/schema.prisma (`String? @db.VarChar(50)`).

-- AlterTable
ALTER TABLE "module_catalog" ADD COLUMN IF NOT EXISTS "codesys_module_id" VARCHAR(50);

-- AlterTable
ALTER TABLE "device_catalog" ADD COLUMN IF NOT EXISTS "codesys_device_id" VARCHAR(50);
