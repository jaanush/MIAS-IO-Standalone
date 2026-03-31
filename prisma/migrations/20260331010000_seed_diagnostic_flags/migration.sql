-- Seed diagnostic flags on module catalog entries.
-- Safe to re-run: UPDATE is idempotent, INSERT uses ON CONFLICT DO NOTHING.

-- DIGITAL_PAIRED: DI modules with paired diagnostic bits
UPDATE module_catalog
SET has_diagnostics = true,
    diagnostic_type = 'DIGITAL_PAIRED',
    diagnostic_bits_per_channel = 1
WHERE article_number IN ('750-418', '750-421', '750-422');

-- ANALOG_STATUS_BYTE: All AI modules have optional status byte
UPDATE module_catalog
SET has_diagnostics = true,
    diagnostic_type = 'ANALOG_STATUS_BYTE',
    diagnostic_bits_per_channel = 8
WHERE card_type = 'AI';

-- Add 750-458 (8AI Thermocouple / Diagnostics) — discontinued but used in legacy projects
INSERT INTO module_catalog (vendor_name, article_number, description, card_type, max_input_channels, max_output_channels, bit_resolution, has_diagnostics, diagnostic_type, diagnostic_bits_per_channel, created_at, updated_at)
VALUES ('WAGO', '750-458', '8AI Thermocouple / Diagnostics / adjustable', 'AI', 8, 0, 16, true, 'ANALOG_STATUS_BYTE', 8, NOW(), NOW())
ON CONFLICT (vendor_name, article_number) DO NOTHING;

-- Propagate diagnostic flags from catalog to existing io_card records
UPDATE io_card
SET has_diagnostics = mc.has_diagnostics,
    diagnostic_type = mc.diagnostic_type,
    diagnostic_bits_per_channel = mc.diagnostic_bits_per_channel
FROM module_catalog mc
WHERE io_card.catalog_id = mc.id
  AND mc.has_diagnostics = true
  AND io_card.has_diagnostics = false;
