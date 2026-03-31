-- backfill_iocard_diagnostics.sql
-- Backfill diagnostic fields on existing io_card rows from their module_catalog source.
-- Run AFTER seed_diagnostic_flags.sql has been applied to module_catalog.

UPDATE io_card c
SET has_diagnostics = mc.has_diagnostics,
    diagnostic_type = mc.diagnostic_type,
    diagnostic_bits_per_channel = mc.diagnostic_bits_per_channel
FROM module_catalog mc
WHERE c.catalog_id = mc.id
  AND mc.has_diagnostics = true;
