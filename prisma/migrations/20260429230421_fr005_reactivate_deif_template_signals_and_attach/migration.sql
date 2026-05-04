-- FR-005 finalisation, take 2.
-- The previous migration's signal-attach loop matched zero rows because
-- 41 of the 53 DEIF MIC-2 MKII template signals had `active = false` —
-- a deliberate trim of the template to a 12-signal "essential" subset.
-- FR-005 explicitly requires all 53 signals attached because the plugin
-- struct-mode codegen consumes the whole strMKII struct, not just the
-- HMI-facing subset.
--
-- This migration:
--   1. Reactivates all 53 component_signal rows on the DEIF template (id=9).
--   2. Re-runs the signal-attach loop, now picking up the 41 newly-active
--      rows × 3 instances = 123 inserts.

-- ──────────────────────────────────────────────────────────────────────
-- 1) Reactivate the trimmed template signals
-- ──────────────────────────────────────────────────────────────────────
UPDATE component_signal
   SET active = TRUE
 WHERE component_id = 9
   AND active = FALSE;

-- ──────────────────────────────────────────────────────────────────────
-- 2) Attach missing template signals to each instance
-- ──────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  rec RECORD;
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
      (279, 275),
      (280, 276),
      (281, 277)
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
    INSERT INTO instance_signal (instance_id, component_signal_id, template_dirty)
    VALUES (rec.instance_id, rec.component_signal_id, FALSE)
    RETURNING id INTO new_instance_signal_id;

    INSERT INTO signal (
      project_id, instance_signal_id, origin, signal_type,
      tag, description, system_id, logging_enabled
    )
    VALUES (
      1, new_instance_signal_id, 'MODBUS_RTU'::signal_origin, 'ANALOG'::signal_type,
      rec.tag_suffix, rec.description, rec.system_id, COALESCE(rec.default_logging_enabled, FALSE)
    )
    RETURNING id INTO new_signal_id;

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
