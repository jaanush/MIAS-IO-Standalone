-- FR-005 finalisation: DEIF MIC-2 MKII full signal coverage on LasseMaja.
--
-- The HardwareComponent template (id=9), three instances (279, 280, 281),
-- and the Modbus RTU bus (id=24) all already exist; only 12 of 53 template
-- signals were bound per instance. This migration:
--
--   1. Configures bus 24 with the DEIF factory defaults: 19200 baud, 8N1,
--      no parity, RS-485. Per FR-005 — confirmed against Älvelie firmware.
--   2. Attaches the 41 missing template signals to each of the 3
--      instances, creating the full instance_signal + signal + bus_signal
--      + analog_signal chain so all 53 signals are reachable per device.
--
-- After this, FR-005 acceptance criteria 1 (DEIF type selectable), 2 (3
-- instances with all 53 signals + correct systemGroup), and the data
-- requirement of 4 (bus reachable / configured) are met. Acceptance 3
-- (struct-mode plugin codegen) is plugin-side.

-- ──────────────────────────────────────────────────────────────────────
-- 1) Bus 24 — DEIF factory transport defaults
-- ──────────────────────────────────────────────────────────────────────
UPDATE plc_network
   SET baud_rate_kbit   = 19,                  -- 19200 baud
       baud_rate_bps    = 19200,
       serial_parity    = 'NONE',
       serial_stop_bits = 1,
       description      = 'Modbus RTU net 24 (750-652 S10) — DEIF MIC-2 MKII meters'
 WHERE id = 24;

-- ──────────────────────────────────────────────────────────────────────
-- 2) Auto-attach the 41 missing template signals to each of the 3
--    DEIF instances. Done with three CTEs per instance, parameterised
--    by (instance_id, system_id) tuple.
-- ──────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  rec RECORD;          -- one row per missing (instance, component_signal)
  new_instance_signal_id INT;
  new_signal_id INT;
BEGIN
  FOR rec IN
    SELECT
      inst.instance_id,
      inst.system_id,
      cs.id              AS component_signal_id,
      cs.tag_suffix,
      cs.description,
      cs.raw_data_type,
      cs.byte_order,
      cs.modbus_register_type,
      cs.modbus_register_offset,
      cs.modbus_unit_id,
      cs.timeout_ms,
      cs.default_scale_min,
      cs.default_scale_max,
      cs.default_raw_min,
      cs.default_raw_max,
      cs.default_eu_id,
      cs.default_logging_enabled
    FROM (VALUES
      (279, 275),       -- 868-P01  → AC Shore Connection (868)
      (280, 276),       -- 875-P01  → AC Distribution Grid 1 (875)
      (281, 277)        -- 875-P02  → AC Distribution Grid 2 (875)
    ) AS inst(instance_id, system_id)
    CROSS JOIN component_signal cs
    WHERE cs.component_id = 9
      AND cs.active = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM instance_signal ins
         WHERE ins.instance_id = inst.instance_id
           AND ins.component_signal_id = cs.id
      )
    ORDER BY inst.instance_id, cs.channel_offset
  LOOP
    -- 1. instance_signal
    INSERT INTO instance_signal (instance_id, component_signal_id, template_dirty)
    VALUES (rec.instance_id, rec.component_signal_id, FALSE)
    RETURNING id INTO new_instance_signal_id;

    -- 2. signal (project-scoped, ANALOG, MODBUS_RTU origin)
    INSERT INTO signal (
      project_id, instance_signal_id, origin, signal_type,
      tag, description, system_id, logging_enabled
    )
    VALUES (
      1, new_instance_signal_id, 'MODBUS_RTU'::signal_origin, 'ANALOG'::signal_type,
      rec.tag_suffix, rec.description, rec.system_id, COALESCE(rec.default_logging_enabled, FALSE)
    )
    RETURNING id INTO new_signal_id;

    -- 3. bus_signal — Modbus RTU addressing
    INSERT INTO bus_signal (
      signal_id, plc_network_id,
      raw_data_type, plc_data_type, byte_order, timeout_ms,
      register_type, register_offset, unit_id,
      is_mux_indicator
    )
    VALUES (
      new_signal_id, 24,
      COALESCE(rec.raw_data_type, 'WORD'::bus_raw_data_type),
      'REAL'::plc_data_type,
      COALESCE(rec.byte_order, 'BIG_ENDIAN'::byte_order),
      rec.timeout_ms,
      rec.modbus_register_type,
      rec.modbus_register_offset,
      rec.modbus_unit_id,
      FALSE
    );

    -- 4. analog_signal child (template default scaling)
    INSERT INTO analog_signal (
      signal_id, engineering_unit_id,
      scale_min, scale_max, raw_min, raw_max
    )
    VALUES (
      new_signal_id, rec.default_eu_id,
      rec.default_scale_min, rec.default_scale_max,
      rec.default_raw_min, rec.default_raw_max
    );
  END LOOP;
END $$;
