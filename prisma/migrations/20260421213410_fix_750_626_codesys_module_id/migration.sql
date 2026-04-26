-- Correct 750-626 (5 VDC backplane extension supply) codesys_module_id.
-- CODESYS V3.5 SP21 Patch 5 has no specific device-repo entry for this module,
-- so Kbus enumeration at runtime reports it as "880E_075xDigital" (synthesized
-- from the 2DI+2DO+6-diag footprint). The former id "0750062600000000" caused
-- "KBUS configuration mismatch" errors on the physical PLC. See FR-005.
UPDATE "module_catalog"
SET "codesys_module_id" = '880E_075xDigital'
WHERE "article_number" = '750-626'
  AND "codesys_module_id" = '0750062600000000';
