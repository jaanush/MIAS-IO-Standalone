-- FR-005 finalisation, take 3.
-- Previous attempt's DO block failed because Prisma's @updatedAt fields
-- have no DB default — INSERT must set updated_at = NOW() explicitly when
-- bypassing the Prisma client. This take re-runs with the timestamps and
-- completes the signal-attach.

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
    INSERT INTO instance_signal (instance_id, component_signal_id, template_dirty, updated_at)
    VALUES (rec.instance_id, rec.component_signal_id, FALSE, NOW())
    RETURNING id INTO new_instance_signal_id;

    INSERT INTO signal (
      project_id, instance_signal_id, origin, signal_type,
      tag, description, system_id, logging_enabled, updated_at
    )
    VALUES (
      1, new_instance_signal_id, 'MODBUS_RTU'::signal_origin, 'ANALOG'::signal_type,
      rec.tag_suffix, rec.description, rec.system_id, COALESCE(rec.default_logging_enabled, FALSE), NOW()
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
