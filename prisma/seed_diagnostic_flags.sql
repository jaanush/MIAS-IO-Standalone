-- seed_diagnostic_flags.sql
-- Flag module_catalog entries that have built-in diagnostics.
-- Run AFTER seed_data.sql / seed.ts has populated the catalog.
--
-- DIGITAL_PAIRED: DI modules with paired diagnostic bits (1 diag bit per data channel)
-- ANALOG_STATUS_BYTE: AI modules with status byte (8 diagnostic bits per channel)

-- ── DIGITAL_PAIRED ─────────────────────────────────────────────────────────────
-- These DI modules have paired diagnostic bits in the process image.
-- Each data bit has a companion diagnostic bit in the same byte.
-- diagnosticBitsPerChannel = 1 (one diagnostic bit per data channel).

UPDATE module_catalog
SET has_diagnostics = true,
    diagnostic_type = 'DIGITAL_PAIRED',
    diagnostic_bits_per_channel = 1
WHERE article_number IN (
  '750-418',       -- 2DI 24VDC 3ms Acknowledgment + Diagnostics
  '750-421',       -- 2DI 24VDC 3ms Diagnostics
  '750-422'        -- 4DI 24VDC Pulse Extension + Diagnostics
);

-- ── ANALOG_STATUS_BYTE ─────────────────────────────────────────────────────────
-- All WAGO analog input modules support an optional status byte per channel.
-- The status byte is 8 bits: underrange, overrange, user limits, under/overflow,
-- general error, RegCom.
-- diagnosticBitsPerChannel = 8.
-- Flag every AI-type module in the catalog.

UPDATE module_catalog
SET has_diagnostics = true,
    diagnostic_type = 'ANALOG_STATUS_BYTE',
    diagnostic_bits_per_channel = 8
WHERE card_type = 'AI';
