-- Consolidation pass on signal_system + engineering_unit.
--
-- Decision: signal_system.code is SFI numeric when one applies (e.g. '574',
-- '625', '871'), NULL otherwise. The `name` column is the always-descriptive
-- label and carries identity when no SFI applies. This stops the
-- code-vs-name confusion where some rows had SFI numbers, others held a
-- truncated copy of the name, and others still held a project-specific
-- snake_case label.
--
-- Engineering units: drop the unused 'C' and 'Deg' rows that shadow the
-- canonical '°C' (id=9). Both have zero references.

-- ──────────────────────────────────────────────────────────────────────
-- 1) Re-point signals from name-duplicates onto the SFI-coded keeper
-- ──────────────────────────────────────────────────────────────────────
UPDATE signal SET system_id = 3  WHERE system_id = 30;  -- Genset → 861 (1 row)
UPDATE signal SET system_id = 12 WHERE system_id = 38;  -- Ventilation system → 574 (2 rows)

-- ──────────────────────────────────────────────────────────────────────
-- 2) Delete confirmed name-duplicates of an SFI-coded system
-- ──────────────────────────────────────────────────────────────────────
DELETE FROM signal_system WHERE id IN (
  15,  -- "AC Distribution"        dupes id=4  (875)
  24,  -- "DC Shore connection"    dupes id=6  (868) / id=8 (869)
  25,  -- "DC shore connection"    dupes id=6  (868) / id=8 (869)
  30,  -- "Genset"                 dupes id=3  (861)
  37,  -- "Propulsion FWD"         dupes id=1  (625)
  38   -- "Ventilation system"     dupes id=12 (574)
);

-- ──────────────────────────────────────────────────────────────────────
-- 3) Delete zero-usage placeholder rows from the early seed
-- ──────────────────────────────────────────────────────────────────────
DELETE FROM signal_system WHERE id IN (
  17,  -- AQM1
  18,  -- AQM2
  19,  -- AS1
  20,  -- AS2
  21,  -- Consumers
  23,  -- "DC Distribution"            (SFI 871 already exists as id=5)
  26,  -- "DG1 start battery"
  28,  -- "Firefighting system"
  29,  -- "Fresh water cooling system"
  31,  -- "HPU aft"
  32,  -- "HPU fwd"
  34,  -- MIAS
  35,  -- Microgrid
  36   -- "Propulsion AFT"
);
-- Kept (used, no SFI yet — re-code later): id=22 'Contr/Mon. System' (14
-- sigs), id=27 'Energy storage system' (46 sigs), and the LasseMaja
-- sub-scopes id=275–278.

-- ──────────────────────────────────────────────────────────────────────
-- 4) Make `code` nullable, then null every non-numeric value
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE signal_system ALTER COLUMN code DROP NOT NULL;
UPDATE signal_system SET code = NULL WHERE code !~ '^[0-9]+$';

-- ──────────────────────────────────────────────────────────────────────
-- 5) Lock in case-insensitive name uniqueness so name-duplicates
--    can't reappear via the upsert path or manual inserts
-- ──────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX signal_system_name_lower_key ON signal_system (lower(name));

-- ──────────────────────────────────────────────────────────────────────
-- 6) engineering_unit cleanup — drop redundant 'degrees' placeholders
-- ──────────────────────────────────────────────────────────────────────
-- 'C' (id=1) and 'Deg' (id=12) are both unused (0 signals, 0 components)
-- and shadow the canonical '°C' (id=9, 85 sigs / 19 comps). 'C' carries a
-- misleading description ("Degrees") that reads angular but symbol-C in
-- PLC catalogues is normally Celsius. Removing both leaves a single
-- canonical Celsius unit.
DELETE FROM engineering_unit WHERE id IN (1, 12);
