-- =============================================================
-- plc_schema.sql
-- MIAS-IO: PLC Hardware Management System
-- Schema v1.0 — HISTORICAL BASELINE ONLY
-- Target: PostgreSQL 14+
--
-- ⚠️  DEPRECATED — DO NOT apply this file to any database.
--
-- The live schema is managed by Prisma migrations:
--   npm run db:migrate        (dev)
--   npx prisma migrate deploy (prod)
--
-- PostgreSQL-specific objects (views, triggers, rollback functions)
-- that Prisma cannot manage are maintained in:
--   prisma/migration_views.sql   ← apply this after initial migration
--
-- This file is kept for historical reference only.
-- Never rewrite it — add prisma/migration_NNN_*.sql files for changes.
-- =============================================================

BEGIN;

-- =============================================================
-- HELPER: auto-update updated_at on row changes
-- =============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- ENUMS
-- =============================================================

CREATE TYPE user_role AS ENUM (
  'ADMIN',      -- full access, user management
  'ENGINEER',   -- create/edit projects and hardware
  'VIEWER'      -- read-only
);

CREATE TYPE project_status AS ENUM (
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
  'ARCHIVED'
);

CREATE TYPE bus_protocol AS ENUM (
  'MODBUS_RTU',
  'MODBUS_TCP',
  'PROFIBUS',
  'PROFINET',
  'CANOPEN',
  'ETHERNETIP',
  'DEVICENET',
  'BACNET'
);

CREATE TYPE network_role AS ENUM (
  'MASTER',
  'SLAVE',
  'ADAPTER',
  'SCANNER'
);

CREATE TYPE io_card_type AS ENUM (
  'DI', 'DO', 'AI', 'AO', 'MIXED',
  'COUNTER', 'PWM', 'SERIAL', 'IO_LINK', 'SUPPLY', 'RELAY'
);

CREATE TYPE signal_type AS ENUM ('DISCRETE', 'ANALOG');

CREATE TYPE trigger_type AS ENUM ('NO', 'NC');

-- Replaces VARCHAR(10) CHECK constraint from previous design
CREATE TYPE switching_type AS ENUM ('HIGH_SIDE', 'LOW_SIDE', 'BOTH');

-- Replaces SMALLINT CHECK IN (2,3,4) from previous design
CREATE TYPE wire_config AS ENUM ('TWO_WIRE', 'THREE_WIRE', 'FOUR_WIRE');

CREATE TYPE analog_input_type AS ENUM (
  'MA_4_20', 'MA_0_20', 'MA_0_25',
  'V_0_10', 'V_0_5', 'V_PLUS_MINUS_10', 'V_PLUS_MINUS_5',
  'PT100', 'PT1000', 'NI100', 'NI1000',
  'TC_K', 'TC_J', 'TC_T', 'TC_E', 'TC_N', 'TC_R', 'TC_S', 'TC_B',
  'RESISTANCE_0_600',
  'POTENTIOMETER'
);

CREATE TYPE alarm_severity AS ENUM ('INFO', 'WARNING', 'ALARM', 'CRITICAL');

-- Split alarm conditions by signal type — enforced at table level
CREATE TYPE discrete_alarm_condition AS ENUM ('ON_TRIGGER', 'OFF_TRIGGER');
CREATE TYPE analog_alarm_condition   AS ENUM ('HIGH', 'HIGH_HIGH', 'LOW', 'LOW_LOW');

CREATE TYPE template_status AS ENUM ('DRAFT', 'ACTIVE', 'DEPRECATED');

-- =============================================================
-- USERS
-- =============================================================

CREATE TABLE users (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email      VARCHAR(255) NOT NULL UNIQUE,
  name       VARCHAR(255),
  role       user_role    NOT NULL DEFAULT 'ENGINEER',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- ENGINEERING UNITS (global — not project-scoped)
-- =============================================================

CREATE TABLE engineering_unit (
  id          SERIAL      PRIMARY KEY,
  symbol      VARCHAR(20) NOT NULL UNIQUE,
  description VARCHAR(100)
);

-- =============================================================
-- MODULE CATALOG
-- Vendor/reference hardware specs. Separate from project data.
-- io_card rows may optionally reference a catalog entry to
-- pre-fill specs, but can override any field independently.
-- Replaces the __WAGO_REFERENCE_LIBRARY__ ARCHIVED project hack.
-- =============================================================

CREATE TABLE module_catalog (
  id                      SERIAL       PRIMARY KEY,
  vendor_name             VARCHAR(100) NOT NULL,
  article_number          VARCHAR(50)  NOT NULL,
  description             TEXT,
  card_type               io_card_type NOT NULL,
  max_channels            SMALLINT,
  bit_resolution          SMALLINT     CHECK (bit_resolution IN (8, 10, 12, 14, 16, 18, 20)),
  supply_voltage_field    VARCHAR(20),
  filter_time_ms          NUMERIC(8,3),
  galvanic_isolation      BOOLEAN      DEFAULT TRUE,
  isolation_voltage_v     SMALLINT,
  temp_min_c              SMALLINT,
  temp_max_c              SMALLINT,
  max_channel_current_ma  SMALLINT,
  short_circuit_protected BOOLEAN      DEFAULT FALSE,
  provides_network        BOOLEAN      DEFAULT FALSE,
  ip_rating               VARCHAR(10)  DEFAULT 'IP20',
  notes                   TEXT,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (vendor_name, article_number)
);

CREATE TRIGGER trg_module_catalog_updated_at
  BEFORE UPDATE ON module_catalog
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- PROJECT
-- =============================================================

CREATE TABLE project (
  id         SERIAL         PRIMARY KEY,
  name       VARCHAR(255)   NOT NULL,
  client     VARCHAR(255),
  location   VARCHAR(255),
  status     project_status NOT NULL DEFAULT 'ACTIVE',
  created_by UUID           REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_project_updated_at
  BEFORE UPDATE ON project
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- PLC
-- Soft delete via deleted_at — do not hard-delete PLCs.
-- =============================================================

CREATE TABLE plc (
  id         SERIAL       PRIMARY KEY,
  project_id INT          NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  model      VARCHAR(100),
  ip_address VARCHAR(45),
  notes      TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_plc_updated_at
  BEFORE UPDATE ON plc
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_plc_project_id ON plc(project_id);

-- =============================================================
-- PLC NETWORK
-- io_card_id = NULL  → network is hosted by the PLC CPU itself
-- io_card_id IS SET  → network is hosted by that IO card
--                      (io_card.provides_network must be TRUE)
--
-- FK to io_card is added after io_card is created below
-- to break the carrier → card → network → card circular reference.
-- =============================================================

CREATE TABLE plc_network (
  id          SERIAL       PRIMARY KEY,
  plc_id      INT          NOT NULL REFERENCES plc(id) ON DELETE CASCADE,
  io_card_id  INT,                 -- FK added via ALTER TABLE below
  protocol    bus_protocol NOT NULL,
  role        network_role NOT NULL,
  network_id  SMALLINT,            -- bus address / network number
  description VARCHAR(255),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_plc_network_updated_at
  BEFORE UPDATE ON plc_network
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- IO CARRIER (remote IO rack / unit)
-- Soft delete via deleted_at.
-- plc_network_id = NULL → carrier is local to PLC backplane.
-- =============================================================

CREATE TABLE io_carrier (
  id               SERIAL       PRIMARY KEY,
  plc_id           INT          NOT NULL REFERENCES plc(id) ON DELETE CASCADE,
  plc_network_id   INT          REFERENCES plc_network(id) ON DELETE SET NULL,
  name             VARCHAR(255) NOT NULL,
  model            VARCHAR(100),
  ip_address       VARCHAR(45),
  node_address     SMALLINT,
  max_modules      SMALLINT,
  ip_rating        VARCHAR(10)  DEFAULT 'IP20',
  firmware_version VARCHAR(20),
  notes            TEXT,
  deleted_at       TIMESTAMPTZ,
  created_by       UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_io_carrier_updated_at
  BEFORE UPDATE ON io_carrier
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_io_carrier_plc_id ON io_carrier(plc_id);

-- =============================================================
-- IO CARD
-- Soft delete via deleted_at.
-- catalog_id (optional): links to a module_catalog entry that
-- was used to pre-fill this card's specs. All spec fields are
-- independent copies and can be changed without affecting the catalog.
-- =============================================================

CREATE TABLE io_card (
  id                      SERIAL       PRIMARY KEY,
  carrier_id              INT          NOT NULL REFERENCES io_carrier(id) ON DELETE CASCADE,
  catalog_id              INT          REFERENCES module_catalog(id) ON DELETE SET NULL,
  slot_position           SMALLINT     NOT NULL,
  card_type               io_card_type NOT NULL,
  name                    VARCHAR(255),
  vendor_article_number   VARCHAR(50),
  max_channels            SMALLINT,
  bit_resolution          SMALLINT     CHECK (bit_resolution IN (8, 10, 12, 14, 16, 18, 20)),
  provides_network        BOOLEAN      NOT NULL DEFAULT FALSE,
  supply_voltage_field    VARCHAR(20),
  filter_time_ms          NUMERIC(8,3),
  galvanic_isolation      BOOLEAN      DEFAULT TRUE,
  isolation_voltage_v     SMALLINT,
  temp_min_c              SMALLINT,
  temp_max_c              SMALLINT,
  max_channel_current_ma  SMALLINT,
  short_circuit_protected BOOLEAN      DEFAULT FALSE,
  notes                   TEXT,
  deleted_at              TIMESTAMPTZ,
  created_by              UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (carrier_id, slot_position)
);

CREATE TRIGGER trg_io_card_updated_at
  BEFORE UPDATE ON io_card
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_io_card_carrier_id ON io_card(carrier_id);

-- Resolve the circular FK: plc_network.io_card_id → io_card
ALTER TABLE plc_network
  ADD CONSTRAINT fk_plc_network_io_card
  FOREIGN KEY (io_card_id) REFERENCES io_card(id) ON DELETE SET NULL;

-- =============================================================
-- SIGNAL (base table — vertical inheritance)
-- Child tables discrete_signal and analog_signal hold type-specific
-- fields via 1:1 FK. Never merge these into signal.
-- =============================================================

CREATE TABLE signal (
  id               SERIAL      PRIMARY KEY,
  io_card_id       INT         NOT NULL REFERENCES io_card(id) ON DELETE CASCADE,
  channel_position SMALLINT    NOT NULL,
  signal_type      signal_type NOT NULL,
  tag              VARCHAR(50),          -- ISA instrument tag, e.g. FT-101
  description      VARCHAR(255),
  notes            TEXT,
  created_by       UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (io_card_id, channel_position)
);

CREATE TRIGGER trg_signal_updated_at
  BEFORE UPDATE ON signal
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_signal_io_card_id ON signal(io_card_id);

-- =============================================================
-- DISCRETE SIGNAL (child of signal)
-- signal_type = 'DISCRETE' enforced by trigger below.
-- =============================================================

CREATE TABLE discrete_signal (
  signal_id      INT            PRIMARY KEY REFERENCES signal(id) ON DELETE CASCADE,
  trigger        trigger_type   NOT NULL DEFAULT 'NO',
  filter_time_ms NUMERIC(8,3),           -- per-channel override; card-level default in io_card
  switching_type switching_type,
  signal_voltage VARCHAR(20)
);

CREATE OR REPLACE FUNCTION enforce_signal_type_discrete()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT signal_type FROM signal WHERE id = NEW.signal_id) <> 'DISCRETE' THEN
    RAISE EXCEPTION 'discrete_signal.signal_id must reference a DISCRETE signal (id=%).',
      NEW.signal_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chk_discrete_signal_type
  BEFORE INSERT OR UPDATE ON discrete_signal
  FOR EACH ROW EXECUTE FUNCTION enforce_signal_type_discrete();

-- =============================================================
-- ANALOG SIGNAL (child of signal)
-- signal_type = 'ANALOG' enforced by trigger below.
-- =============================================================

CREATE TABLE analog_signal (
  signal_id            INT               PRIMARY KEY REFERENCES signal(id) ON DELETE CASCADE,
  input_type           analog_input_type NOT NULL,
  wire_config          wire_config,
  raw_min              NUMERIC(12,4),
  raw_max              NUMERIC(12,4),
  scale_min            NUMERIC(12,4),
  scale_max            NUMERIC(12,4),
  clamp_low            NUMERIC(12,4),
  clamp_high           NUMERIC(12,4),
  deadband             NUMERIC(12,4),
  engineering_unit_id  INT               REFERENCES engineering_unit(id) ON DELETE SET NULL,
  detect_wire_break    BOOLEAN           DEFAULT FALSE,
  detect_short_circuit BOOLEAN           DEFAULT FALSE,
  detect_out_of_range  BOOLEAN           DEFAULT FALSE,
  namur_ne43           BOOLEAN           DEFAULT FALSE
);

CREATE OR REPLACE FUNCTION enforce_signal_type_analog()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT signal_type FROM signal WHERE id = NEW.signal_id) <> 'ANALOG' THEN
    RAISE EXCEPTION 'analog_signal.signal_id must reference an ANALOG signal (id=%).',
      NEW.signal_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chk_analog_signal_type
  BEFORE INSERT OR UPDATE ON analog_signal
  FOR EACH ROW EXECUTE FUNCTION enforce_signal_type_analog();

-- =============================================================
-- ALARMS — split by signal type
-- Separating alarm tables ensures alarm condition enums are DB-enforced
-- by FK rather than a cross-table trigger.
-- discrete_alarm → discrete_signal (conditions: ON_TRIGGER / OFF_TRIGGER)
-- analog_alarm   → analog_signal   (conditions: HIGH / HIGH_HIGH / LOW / LOW_LOW)
-- UNIQUE on (signal_id, condition): one row per condition per signal.
-- =============================================================

CREATE TABLE discrete_alarm (
  id            SERIAL                   PRIMARY KEY,
  signal_id     INT                      NOT NULL REFERENCES discrete_signal(signal_id) ON DELETE CASCADE,
  condition     discrete_alarm_condition NOT NULL,
  severity      alarm_severity           NOT NULL DEFAULT 'ALARM',
  delay_seconds SMALLINT                 NOT NULL DEFAULT 0,
  message       VARCHAR(255),
  created_at    TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
  UNIQUE (signal_id, condition)
);

CREATE TRIGGER trg_discrete_alarm_updated_at
  BEFORE UPDATE ON discrete_alarm
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE analog_alarm (
  id            SERIAL                 PRIMARY KEY,
  signal_id     INT                    NOT NULL REFERENCES analog_signal(signal_id) ON DELETE CASCADE,
  condition     analog_alarm_condition NOT NULL,
  setpoint      NUMERIC(12,4)          NOT NULL,
  hysteresis    NUMERIC(12,4)          NOT NULL DEFAULT 0,
  severity      alarm_severity         NOT NULL DEFAULT 'ALARM',
  delay_seconds SMALLINT               NOT NULL DEFAULT 0,
  message       VARCHAR(255),
  created_at    TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  UNIQUE (signal_id, condition)
);

CREATE TRIGGER trg_analog_alarm_updated_at
  BEFORE UPDATE ON analog_alarm
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- HARDWARE TEMPLATES
-- project_id = NULL  → global / shared template (all projects can use)
-- project_id IS SET  → project-private template
-- =============================================================

CREATE TABLE hardware_template (
  id           SERIAL          PRIMARY KEY,
  project_id   INT             REFERENCES project(id) ON DELETE CASCADE,
  name         VARCHAR(255)    NOT NULL,
  manufacturer VARCHAR(100),
  model        VARCHAR(100),
  version      VARCHAR(50),
  status       template_status NOT NULL DEFAULT 'DRAFT',
  description  TEXT,
  created_by   UUID            REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_hardware_template_updated_at
  BEFORE UPDATE ON hardware_template
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Template signals hold per-channel defaults.
-- Both discrete and analog defaults live in this table (nullable per type).
-- signal_type determines which set of default columns is active.

CREATE TABLE template_signal (
  id                      SERIAL            PRIMARY KEY,
  template_id             INT               NOT NULL REFERENCES hardware_template(id) ON DELETE CASCADE,
  channel_offset          SMALLINT          NOT NULL,
  signal_type             signal_type       NOT NULL,
  tag_suffix              VARCHAR(50),
  description             VARCHAR(255),
  -- Discrete defaults (relevant when signal_type = 'DISCRETE')
  default_trigger         trigger_type,
  default_filter_time_ms  NUMERIC(8,3),
  default_switching_type  switching_type,
  -- Analog defaults (relevant when signal_type = 'ANALOG')
  default_input_type      analog_input_type,
  default_wire_config     wire_config,
  default_scale_min       NUMERIC(12,4),
  default_scale_max       NUMERIC(12,4),
  default_eu_id           INT               REFERENCES engineering_unit(id) ON DELETE SET NULL,
  UNIQUE (template_id, channel_offset)
);

-- Template alarms — split by type, same rationale as discrete_alarm / analog_alarm.

CREATE TABLE template_discrete_alarm (
  id                 SERIAL                   PRIMARY KEY,
  template_signal_id INT                      NOT NULL REFERENCES template_signal(id) ON DELETE CASCADE,
  condition          discrete_alarm_condition NOT NULL,
  severity           alarm_severity           NOT NULL DEFAULT 'ALARM',
  delay_seconds      SMALLINT                 NOT NULL DEFAULT 0,
  message            VARCHAR(255),
  UNIQUE (template_signal_id, condition)
);

CREATE OR REPLACE FUNCTION enforce_template_signal_discrete()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT signal_type FROM template_signal WHERE id = NEW.template_signal_id) <> 'DISCRETE' THEN
    RAISE EXCEPTION 'template_discrete_alarm requires a DISCRETE template_signal (id=%).',
      NEW.template_signal_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chk_template_discrete_alarm
  BEFORE INSERT OR UPDATE ON template_discrete_alarm
  FOR EACH ROW EXECUTE FUNCTION enforce_template_signal_discrete();

CREATE TABLE template_analog_alarm (
  id                 SERIAL                 PRIMARY KEY,
  template_signal_id INT                    NOT NULL REFERENCES template_signal(id) ON DELETE CASCADE,
  condition          analog_alarm_condition NOT NULL,
  setpoint           NUMERIC(12,4)          NOT NULL,
  hysteresis         NUMERIC(12,4)          NOT NULL DEFAULT 0,
  severity           alarm_severity         NOT NULL DEFAULT 'ALARM',
  delay_seconds      SMALLINT               NOT NULL DEFAULT 0,
  message            VARCHAR(255),
  UNIQUE (template_signal_id, condition)
);

CREATE OR REPLACE FUNCTION enforce_template_signal_analog()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT signal_type FROM template_signal WHERE id = NEW.template_signal_id) <> 'ANALOG' THEN
    RAISE EXCEPTION 'template_analog_alarm requires an ANALOG template_signal (id=%).',
      NEW.template_signal_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chk_template_analog_alarm
  BEFORE INSERT OR UPDATE ON template_analog_alarm
  FOR EACH ROW EXECUTE FUNCTION enforce_template_signal_analog();

-- =============================================================
-- TEMPLATE INSTANCES
-- Links a hardware_template to a project with per-signal
-- override/decoupling support.
-- =============================================================

CREATE TABLE template_instance (
  id          SERIAL       PRIMARY KEY,
  project_id  INT          NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  template_id INT          NOT NULL REFERENCES hardware_template(id),
  name        VARCHAR(255) NOT NULL,
  tag         VARCHAR(50),
  notes       TEXT,
  created_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_template_instance_updated_at
  BEFORE UPDATE ON template_instance
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Per-signal override within a template instance.
-- decoupled = FALSE → inherit all defaults from template_signal (overrides are NULL)
-- decoupled = TRUE  → override columns take precedence over template defaults
-- signal_id links to the actual mapped IO card channel (may be NULL if unmapped)

CREATE TABLE instance_signal (
  id                      SERIAL            PRIMARY KEY,
  instance_id             INT               NOT NULL REFERENCES template_instance(id) ON DELETE CASCADE,
  template_signal_id      INT               NOT NULL REFERENCES template_signal(id),
  signal_id               INT               REFERENCES signal(id) ON DELETE SET NULL,
  decoupled               BOOLEAN           NOT NULL DEFAULT FALSE,
  -- Override columns (NULL when decoupled = FALSE)
  override_tag            VARCHAR(50),
  override_description    VARCHAR(255),
  override_trigger        trigger_type,
  override_filter_time_ms NUMERIC(8,3),
  override_switching_type switching_type,
  override_input_type     analog_input_type,
  override_wire_config    wire_config,
  override_scale_min      NUMERIC(12,4),
  override_scale_max      NUMERIC(12,4),
  override_eu_id          INT               REFERENCES engineering_unit(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  UNIQUE (instance_id, template_signal_id)
);

CREATE TRIGGER trg_instance_signal_updated_at
  BEFORE UPDATE ON instance_signal
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- ROLLBACK FUNCTIONS
-- Reset a single instance_signal or all signals in an instance
-- back to template defaults (sets decoupled = FALSE, clears overrides).
-- =============================================================

CREATE OR REPLACE FUNCTION rollback_instance_signal(p_id INT)
RETURNS VOID AS $$
BEGIN
  UPDATE instance_signal SET
    decoupled               = FALSE,
    override_tag            = NULL,
    override_description    = NULL,
    override_trigger        = NULL,
    override_filter_time_ms = NULL,
    override_switching_type = NULL,
    override_input_type     = NULL,
    override_wire_config    = NULL,
    override_scale_min      = NULL,
    override_scale_max      = NULL,
    override_eu_id          = NULL
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION rollback_template_instance(p_id INT)
RETURNS VOID AS $$
BEGIN
  UPDATE instance_signal SET
    decoupled               = FALSE,
    override_tag            = NULL,
    override_description    = NULL,
    override_trigger        = NULL,
    override_filter_time_ms = NULL,
    override_switching_type = NULL,
    override_input_type     = NULL,
    override_wire_config    = NULL,
    override_scale_min      = NULL,
    override_scale_max      = NULL,
    override_eu_id          = NULL
  WHERE instance_id = p_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- VIEWS
-- =============================================================

-- Resolved instance signal: returns effective values after applying
-- overrides (decoupled = TRUE) or falling back to template defaults.
CREATE VIEW v_instance_signal_resolved AS
SELECT
  ins.id                                                              AS instance_signal_id,
  ins.instance_id,
  ins.template_signal_id,
  ins.signal_id,
  ins.decoupled,
  ti.project_id,
  ti.name                                                             AS instance_name,
  ts.channel_offset,
  ts.signal_type,
  COALESCE(ins.override_tag,            ts.tag_suffix)               AS effective_tag,
  COALESCE(ins.override_description,    ts.description)              AS effective_description,
  COALESCE(ins.override_trigger,        ts.default_trigger)          AS effective_trigger,
  COALESCE(ins.override_filter_time_ms, ts.default_filter_time_ms)   AS effective_filter_time_ms,
  COALESCE(ins.override_switching_type, ts.default_switching_type)   AS effective_switching_type,
  COALESCE(ins.override_input_type,     ts.default_input_type)       AS effective_input_type,
  COALESCE(ins.override_wire_config,    ts.default_wire_config)      AS effective_wire_config,
  COALESCE(ins.override_scale_min,      ts.default_scale_min)        AS effective_scale_min,
  COALESCE(ins.override_scale_max,      ts.default_scale_max)        AS effective_scale_max,
  COALESCE(ins.override_eu_id,          ts.default_eu_id)            AS effective_eu_id
FROM instance_signal ins
JOIN template_instance ti ON ti.id = ins.instance_id
JOIN template_signal   ts ON ts.id = ins.template_signal_id;

-- Full signal view across all active hardware.
-- Excludes soft-deleted PLCs, carriers, and cards.
-- Includes migration_002 fields (switching_type, wire_config, etc.)
CREATE VIEW v_project_signals AS
SELECT
  p.id                          AS project_id,
  p.name                        AS project_name,
  plc.id                        AS plc_id,
  plc.name                      AS plc_name,
  ioc.id                        AS carrier_id,
  ioc.name                      AS carrier_name,
  card.id                       AS card_id,
  card.slot_position,
  card.card_type,
  sig.id                        AS signal_id,
  sig.channel_position,
  sig.signal_type,
  sig.tag,
  sig.description,
  -- Discrete fields
  ds.trigger,
  ds.filter_time_ms             AS discrete_filter_time_ms,
  ds.switching_type,
  ds.signal_voltage,
  -- Analog fields
  ans.input_type,
  ans.wire_config,
  ans.raw_min,
  ans.raw_max,
  ans.scale_min,
  ans.scale_max,
  ans.clamp_low,
  ans.clamp_high,
  ans.deadband,
  eu.symbol                     AS engineering_unit,
  ans.detect_wire_break,
  ans.detect_short_circuit,
  ans.detect_out_of_range,
  ans.namur_ne43
FROM project p
JOIN plc           plc  ON plc.project_id  = p.id    AND plc.deleted_at  IS NULL
JOIN io_carrier    ioc  ON ioc.plc_id      = plc.id  AND ioc.deleted_at  IS NULL
JOIN io_card       card ON card.carrier_id = ioc.id  AND card.deleted_at IS NULL
JOIN signal        sig  ON sig.io_card_id  = card.id
LEFT JOIN discrete_signal  ds  ON ds.signal_id  = sig.id
LEFT JOIN analog_signal    ans ON ans.signal_id = sig.id
LEFT JOIN engineering_unit eu  ON eu.id = ans.engineering_unit_id;

-- =============================================================
-- SEED: Engineering Units
-- =============================================================

INSERT INTO engineering_unit (symbol, description) VALUES
  ('%',     'Percent'),
  ('°C',    'Degrees Celsius'),
  ('°F',    'Degrees Fahrenheit'),
  ('K',     'Kelvin'),
  ('bar',   'Bar'),
  ('mbar',  'Millibar'),
  ('Pa',    'Pascal'),
  ('kPa',   'Kilopascal'),
  ('MPa',   'Megapascal'),
  ('psi',   'Pounds per square inch'),
  ('V',     'Volt'),
  ('mV',    'Millivolt'),
  ('A',     'Ampere'),
  ('mA',    'Milliampere'),
  ('W',     'Watt'),
  ('kW',    'Kilowatt'),
  ('MW',    'Megawatt'),
  ('kWh',   'Kilowatt-hour'),
  ('Hz',    'Hertz'),
  ('rpm',   'Revolutions per minute'),
  ('m',     'Metre'),
  ('mm',    'Millimetre'),
  ('m/s',   'Metres per second'),
  ('L',     'Litre'),
  ('m³',    'Cubic metre'),
  ('L/min', 'Litres per minute'),
  ('m³/h',  'Cubic metres per hour'),
  ('kg',    'Kilogram'),
  ('kg/h',  'Kilograms per hour'),
  ('t/h',   'Tonnes per hour'),
  ('Ω',     'Ohm'),
  ('kΩ',    'Kilohm'),
  ('pH',    'pH'),
  ('NTU',   'Nephelometric Turbidity Unit'),
  ('dB',    'Decibel'),
  ('lux',   'Lux'),
  ('N',     'Newton'),
  ('Nm',    'Newton-metre'),
  ('mm²',   'Square millimetre');

COMMIT;
