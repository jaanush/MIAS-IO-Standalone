-- Rename certification tables and columns to "approval"

-- 1. Rename the main lookup table
ALTER TABLE "certification" RENAME TO "approval";

-- 2. Rename the join tables
ALTER TABLE "device_catalog_certification" RENAME TO "device_catalog_approval";
ALTER TABLE "module_catalog_certification" RENAME TO "module_catalog_approval";
ALTER TABLE "project_certification" RENAME TO "project_approval";

-- 3. Rename FK columns in join tables
ALTER TABLE "device_catalog_approval" RENAME COLUMN "certification_id" TO "approval_id";
ALTER TABLE "module_catalog_approval" RENAME COLUMN "certification_id" TO "approval_id";
ALTER TABLE "project_approval" RENAME COLUMN "certification_id" TO "approval_id";

-- 4. Rename constraints (PK and FK)
-- device_catalog_approval
ALTER TABLE "device_catalog_approval" RENAME CONSTRAINT "device_catalog_certification_pkey" TO "device_catalog_approval_pkey";
ALTER TABLE "device_catalog_approval" RENAME CONSTRAINT "device_catalog_certification_certification_id_fkey" TO "device_catalog_approval_approval_id_fkey";
ALTER TABLE "device_catalog_approval" RENAME CONSTRAINT "device_catalog_certification_device_catalog_id_fkey" TO "device_catalog_approval_device_catalog_id_fkey";

-- module_catalog_approval
ALTER TABLE "module_catalog_approval" RENAME CONSTRAINT "module_catalog_certification_pkey" TO "module_catalog_approval_pkey";
ALTER TABLE "module_catalog_approval" RENAME CONSTRAINT "module_catalog_certification_certification_id_fkey" TO "module_catalog_approval_approval_id_fkey";
ALTER TABLE "module_catalog_approval" RENAME CONSTRAINT "module_catalog_certification_module_catalog_id_fkey" TO "module_catalog_approval_module_catalog_id_fkey";

-- project_approval
ALTER TABLE "project_approval" RENAME CONSTRAINT "project_certification_pkey" TO "project_approval_pkey";
ALTER TABLE "project_approval" RENAME CONSTRAINT "project_certification_certification_id_fkey" TO "project_approval_approval_id_fkey";
ALTER TABLE "project_approval" RENAME CONSTRAINT "project_certification_project_id_fkey" TO "project_approval_project_id_fkey";

-- 5. Add 5 missing approvals from WAGO official documentation
INSERT INTO "approval" (code, name) VALUES
  ('ABS',   'ABS (American Bureau of Shipping)'),
  ('KR',    'KR (Korean Register of Shipping)'),
  ('NKK',   'NKK (Nippon Kaiji Kyokai)'),
  ('BSH',   'BSH (Federal Maritime Authority)'),
  ('BR_EX', 'BR-Ex (Brazilian Explosive Atmospheres)')
ON CONFLICT (code) DO NOTHING;
