-- SFI Group System reference table.
--
-- Hierarchical 1→2→3→4-digit codes classifying ship subsystems. Seeds the
-- 13 codes currently used by signal_system plus their 1- and 2-digit
-- ancestors so rollups work. Descriptions for ancestors use the canonical
-- SFI Group System labels (Norwegian Skipsteknisk Forskningsinstitutt
-- standard); leaf codes copy the existing signal_system.name as a starting
-- point — refine when SFI specs are referenced.
--
-- The full SFI catalogue is licensed (SpecTec). Extend this table only with
-- codes you've verified — don't dump a third-party catalogue here.

-- ──────────────────────────────────────────────────────────────────────
-- 1) Schema
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE sfi_code (
  code         VARCHAR(10) PRIMARY KEY,
  description  VARCHAR(255),
  parent_code  VARCHAR(10),
  level        SMALLINT NOT NULL,
  CONSTRAINT sfi_code_parent_fk FOREIGN KEY (parent_code)
    REFERENCES sfi_code(code) ON UPDATE CASCADE ON DELETE SET NULL
);
CREATE INDEX sfi_code_parent_idx ON sfi_code(parent_code);

-- ──────────────────────────────────────────────────────────────────────
-- 2) Seed: 1-digit main groups
-- ──────────────────────────────────────────────────────────────────────
INSERT INTO sfi_code (code, description, parent_code, level) VALUES
  ('5', 'Equipment for crew & passengers',         NULL, 1),
  ('6', 'Machinery main components',               NULL, 1),
  ('7', 'Systems for machinery main components',   NULL, 1),
  ('8', 'Ship common systems',                     NULL, 1);

-- ──────────────────────────────────────────────────────────────────────
-- 3) Seed: 2-digit subgroups (best-guess SFI labels — verify and refine)
-- ──────────────────────────────────────────────────────────────────────
INSERT INTO sfi_code (code, description, parent_code, level) VALUES
  ('57', 'Air conditioning, heating & ventilation',     '5', 2),
  ('62', 'Diesel engines & propulsion machinery',       '6', 2),
  ('72', 'Cooling water systems',                       '7', 2),
  ('81', 'Common ship fluid systems (fire/bilge/ballast)', '8', 2),
  ('83', 'Hydraulic & pneumatic systems',               '8', 2),
  ('85', 'Common electric system',                      '8', 2),
  ('86', 'Common automation & instrumentation',         '8', 2),
  ('87', 'Cargo handling / common ship instrumentation','8', 2);

-- ──────────────────────────────────────────────────────────────────────
-- 4) Seed: 3-digit codes currently in use (descriptions copied from
--    existing signal_system.name as a starting point — refine when an
--    authoritative SFI label is on hand)
-- ──────────────────────────────────────────────────────────────────────
INSERT INTO sfi_code (code, description, parent_code, level) VALUES
  ('574', 'Ventilation system',          '57', 3),
  ('625', 'Propulsion (FWD)',            '62', 3),
  ('721', 'Cooling system',              '72', 3),
  ('811', 'Fire alarm',                  '81', 3),
  ('815', 'Ultra fog system',            '81', 3),
  ('831', 'Hydraulic system',            '83', 3),
  ('851', 'Common electric system',      '85', 3),
  ('861', 'Genset',                      '86', 3),
  ('868', 'DC shore connection (868)',   '86', 3),
  ('869', 'DC shore connection (869)',   '86', 3),
  ('871', 'DC distribution (871)',       '87', 3),
  ('874', '24 VDC distribution',         '87', 3),
  ('875', 'AC distribution',             '87', 3);

-- ──────────────────────────────────────────────────────────────────────
-- 5) Add FK from signal_system.code to sfi_code.code
--
-- All existing signal_system.code values that are non-NULL are numeric
-- (after the consolidation migration), and every numeric code seeded
-- above matches one of the 13 currently in use. So the FK can be added
-- without violation. Non-SFI systems (LasseMaja sub-scopes etc.) keep
-- code=NULL and are unaffected.
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE signal_system
  ADD CONSTRAINT signal_system_code_fkey
  FOREIGN KEY (code)
  REFERENCES sfi_code(code)
  ON UPDATE CASCADE
  ON DELETE SET NULL;
