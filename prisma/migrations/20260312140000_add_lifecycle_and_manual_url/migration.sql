-- CreateEnum
CREATE TYPE "catalog_lifecycle" AS ENUM ('ACTIVE', 'NRND', 'LAST_BUY', 'DISCONTINUED', 'OBSOLETE', 'UNKNOWN');

-- AlterTable
ALTER TABLE "device_catalog" ADD COLUMN "lifecycle_checked_at" TIMESTAMP(3),
ADD COLUMN "lifecycle_status" "catalog_lifecycle" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "manual_url" TEXT,
ADD COLUMN "successor_article" VARCHAR(50);

-- AlterTable
ALTER TABLE "module_catalog" ADD COLUMN "lifecycle_checked_at" TIMESTAMP(3),
ADD COLUMN "lifecycle_status" "catalog_lifecycle" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "manual_url" TEXT,
ADD COLUMN "successor_article" VARCHAR(50);

-- Fix leftover constraint names from certification→approval rename
ALTER TABLE "approval" RENAME CONSTRAINT "certification_pkey" TO "approval_pkey";
ALTER INDEX "certification_code_key" RENAME TO "approval_code_key";
