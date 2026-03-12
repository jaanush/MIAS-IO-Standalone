-- =============================================================
-- migration_views.sql
-- Recreates PostgreSQL views and rollback functions to match
-- the current Prisma-managed schema.
--
-- Apply with:
--   docker exec -i mias-io-postgres-1 psql -U mias -d mias_io < prisma/migration_views.sql
--
-- Safe to re-run — uses CREATE OR REPLACE / DROP IF EXISTS.
-- =============================================================

BEGIN;

-- =============================================================
-- DROP old views that reference obsolete tables
-- =============================================================

DROP VIEW IF EXISTS v_project_signals;
DROP VIEW IF EXISTS v_instance_signal_resolved;

-- =============================================================
-- v_instance_signal_resolved
-- Effective values after applying per-signal overrides.
-- decoupled = FALSE → inherit from component_signal defaults
-- decoupled = TRUE  → override columns take precedence
-- =============================================================

CREATE VIEW v_instance_signal_resolved AS
SELECT
  ins.id                                                              AS instance_signal_id,
  ins.instance_id,
  ins.component_signal_id,
  ins.decoupled,
  ci.project_id,
  ci.name                                                             AS instance_name,
  cs.channel_offset,
  cs.io_type,
  cs.origin,
  COALESCE(ins.override_tag,            cs.tag_suffix)               AS effective_tag,
  COALESCE(ins.override_description,    cs.description)              AS effective_description,
  COALESCE(ins.override_trigger,        cs.default_trigger)          AS effective_trigger,
  COALESCE(ins.override_filter_time_ms, cs.default_filter_time_ms)   AS effective_filter_time_ms,
  COALESCE(ins.override_switching_type, cs.default_switching_type)   AS effective_switching_type,
  COALESCE(ins.override_input_type_id,  cs.default_input_type_id)    AS effective_input_type_id,
  COALESCE(ins.override_wire_config,    cs.default_wire_config)      AS effective_wire_config,
  COALESCE(ins.override_scale_min,      cs.default_scale_min)        AS effective_scale_min,
  COALESCE(ins.override_scale_max,      cs.default_scale_max)        AS effective_scale_max,
  COALESCE(ins.override_eu_id,          cs.default_eu_id)            AS effective_eu_id
FROM instance_signal ins
JOIN component_instance ci ON ci.id = ins.instance_id
JOIN component_signal   cs ON cs.id = ins.component_signal_id;

-- =============================================================
-- v_project_signals
-- Full signal view across all hardware assigned to IO cards.
-- Includes discrete and analog resolved fields.
-- Note: signals with io_card_id = NULL (bus-only / unassigned) are excluded.
-- =============================================================

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
  sig.origin,
  sig.direction,
  sig.tag,
  sig.description,
  -- Discrete fields
  ds.trigger,
  ds.filter_time_ms             AS discrete_filter_time_ms,
  ds.switching_type,
  ds.signal_voltage,
  -- Analog fields
  ait.code                      AS input_type_code,
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
JOIN plc           plc  ON plc.project_id  = p.id
JOIN io_carrier    ioc  ON ioc.plc_id      = plc.id
JOIN io_card       card ON card.carrier_id = ioc.id
JOIN signal        sig  ON sig.io_card_id  = card.id
LEFT JOIN discrete_signal   ds  ON ds.signal_id       = sig.id
LEFT JOIN analog_signal     ans ON ans.signal_id      = sig.id
LEFT JOIN input_type_catalog ait ON ait.id            = ans.input_type_id
LEFT JOIN engineering_unit  eu  ON eu.id              = ans.engineering_unit_id;

-- =============================================================
-- ROLLBACK FUNCTIONS
-- Reset a single instance_signal or all signals in an instance
-- back to component defaults (sets decoupled = FALSE, clears overrides).
-- =============================================================

CREATE OR REPLACE FUNCTION rollback_instance_signal(p_id INT)
RETURNS VOID AS $$
BEGIN
  UPDATE instance_signal SET
    decoupled                = FALSE,
    override_tag             = NULL,
    override_description     = NULL,
    override_trigger         = NULL,
    override_filter_time_ms  = NULL,
    override_switching_type  = NULL,
    override_input_type_id   = NULL,
    override_wire_config     = NULL,
    override_scale_min       = NULL,
    override_scale_max       = NULL,
    override_eu_id           = NULL
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION rollback_template_instance(p_id INT)
RETURNS VOID AS $$
BEGIN
  UPDATE instance_signal SET
    decoupled                = FALSE,
    override_tag             = NULL,
    override_description     = NULL,
    override_trigger         = NULL,
    override_filter_time_ms  = NULL,
    override_switching_type  = NULL,
    override_input_type_id   = NULL,
    override_wire_config     = NULL,
    override_scale_min       = NULL,
    override_scale_max       = NULL,
    override_eu_id           = NULL
  WHERE instance_id = p_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;
