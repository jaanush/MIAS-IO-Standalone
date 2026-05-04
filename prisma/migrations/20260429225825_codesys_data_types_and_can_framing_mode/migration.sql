-- Two coordinated additions in one migration:
--
-- 1. FR-016 (plugin): autobaud / framing-mode field on Bus + a timestamp
--    for when the plugin last pushed back a discovered framing combo.
--
-- 2. FR-014 (plugin): tables for CODESYS user-defined enums and structs
--    so the bridge can resolve `codesys_fb_parameter` rows whose dataType
--    is a custom type (E_*, ST_*, …) instead of skipping them.

-- ──────────────────────────────────────────────────────────────────────
-- 1) FR-016 — CAN framing mode
-- ──────────────────────────────────────────────────────────────────────
CREATE TYPE can_framing_mode AS ENUM ('FIXED', 'AUTO');

ALTER TABLE plc_network
  ADD COLUMN can_framing_mode can_framing_mode DEFAULT 'FIXED',
  ADD COLUMN can_framing_discovered_at TIMESTAMP(3);

-- Existing CAN buses default to FIXED (we set the values manually yesterday).
UPDATE plc_network SET can_framing_mode = 'FIXED'
 WHERE protocol IN ('CANBUS', 'CANOPEN', 'J1939', 'DEVICENET')
   AND can_framing_mode IS NULL;

-- ──────────────────────────────────────────────────────────────────────
-- 2) FR-014 — CODESYS user-defined data-type tables
-- ──────────────────────────────────────────────────────────────────────
CREATE TYPE codesys_data_type_kind AS ENUM ('ENUM', 'STRUCT');

CREATE TABLE codesys_data_type (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  kind         codesys_data_type_kind NOT NULL,
  base_type    VARCHAR(50),
  default_name VARCHAR(100),
  source_file  VARCHAR(255) NOT NULL,
  created_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP(3) NOT NULL,
  CONSTRAINT codesys_data_type_name_source_unique UNIQUE (name, source_file)
);
CREATE INDEX codesys_data_type_name_idx ON codesys_data_type(name);

CREATE TABLE codesys_data_type_value (
  id           SERIAL PRIMARY KEY,
  data_type_id INT NOT NULL,
  name         VARCHAR(100) NOT NULL,
  value        INT NOT NULL,
  sort_order   INT NOT NULL DEFAULT 0,
  CONSTRAINT codesys_data_type_value_dt_name_unique UNIQUE (data_type_id, name),
  CONSTRAINT codesys_data_type_value_dt_fk FOREIGN KEY (data_type_id)
    REFERENCES codesys_data_type(id) ON DELETE CASCADE
);
CREATE INDEX codesys_data_type_value_dt_idx ON codesys_data_type_value(data_type_id);

CREATE TABLE codesys_data_type_member (
  id           SERIAL PRIMARY KEY,
  data_type_id INT NOT NULL,
  name         VARCHAR(255) NOT NULL,
  member_type  VARCHAR(255) NOT NULL,
  sort_order   INT NOT NULL DEFAULT 0,
  CONSTRAINT codesys_data_type_member_dt_name_unique UNIQUE (data_type_id, name),
  CONSTRAINT codesys_data_type_member_dt_fk FOREIGN KEY (data_type_id)
    REFERENCES codesys_data_type(id) ON DELETE CASCADE
);
CREATE INDEX codesys_data_type_member_dt_idx ON codesys_data_type_member(data_type_id);
