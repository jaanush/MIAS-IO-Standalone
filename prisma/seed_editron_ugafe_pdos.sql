-- Editron Converter FW11 uG AFE — PDO Configuration + Signal Assignments
-- Based on mCanOpenDataConfig_Editron_uGAFE_Stack1_FW11.fn.st (METS-LIB, reference only)
-- Component ID 5 = 'Editron Converter FW11 uG AFE'
--
-- NOTE: Signal-to-PDO assignments (UPDATE component_signal SET pdo_config_id = ...)
-- are done by matching canopen_index on existing component_signal rows.
-- If signals don't exist yet, the UPDATE is a no-op — create them first.
--
-- Hex-to-decimal reference:
-- 0x2080=8320, 0x2083=8323, 0x2087=8327, 0x2090=8336, 0x2091=8337,
-- 0x2093=8339, 0x2094=8340, 0x2095=8341, 0x20A0=8352, 0x20A1=8353,
-- 0x20C0=8384 (sub1), 0x20D0=8400,
-- 0x2382=9090, 0x2600=9728, 0x2601=9729, 0x2610=9744, 0x2611=9745,
-- 0x2612=9746, 0x2620=9760, 0x2621=9761, 0x2622=9762, 0x2623=9763,
-- 0x2681=9857, 0x2687=9863, 0x2690=9872, 0x2691=9873, 0x2692=9874,
-- 0x2693=9875, 0x2694=9876, 0x2695=9877,
-- 0x2700=9984, 0x2710=10000, 0x2711=10001, 0x2712=10002,
-- 0x2780=10112, 0x2782=10114, 0x2787=10119, 0x2790=10128,
-- 0x2792=10130, 0x2793=10131, 0x2794=10132, 0x2795=10133,
-- 0x27A0=10144, 0x27A1=10145, 0x27A2=10146, 0x27A3=10147

-- ═══════════════════════════════════════════════════════════════════════
-- PART 1: PDO CONFIG INSERTS
-- ═══════════════════════════════════════════════════════════════════════

-- ─── TPDOs (device → PLC) ──────────────────────────────────────────

-- TPDO 1: System status, app active cmd, fault word 1, active fault, control switch
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (5, 'TPDO', 1, 384, 254, 100, 'System status, app active cmd, fault word 1, active fault ID, control switch status')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x180 = 384

-- TPDO 2: AFE DC link voltage/current, AFE status/limit words
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (5, 'TPDO', 2, 640, 254, 100, 'AFE DC link voltage, AFE DC link current, AFE status word, AFE limit word')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x280 = 640

-- TPDO 3: AFE grid measurements
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (5, 'TPDO', 3, 896, 254, 100, 'AFE grid frequency, grid RMS AC voltage, grid power, grid reactive power')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x380 = 896

-- TPDO 4: Temperatures
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (5, 'TPDO', 4, 1152, 254, 1000, 'Max junction temp, PT100 CH1-CH3')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x480 = 1152

-- TPDO 5: Fault word 2, external temp, digital inputs, AFE/uGrid app active cmds
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (5, 'TPDO', 5, 385, 254, 500, 'Fault word 2, external temp, digital inputs, AFE app active cmd, uGrid app active cmd')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x181 = 385

-- TPDO 6: uGrid DC link voltage/current, uGrid status/limit words
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (5, 'TPDO', 6, 641, 254, 100, 'uGrid DC link voltage, uGrid DC link current, uGrid status word, uGrid limit word')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x281 = 641

-- TPDO 7: uGrid output measurements
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (5, 'TPDO', 7, 897, 254, 100, 'uGrid output frequency, uGrid converter RMS AC voltage, uGrid RMS current, uGrid grid power')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x381 = 897

-- TPDO 8: uGrid power measurements
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (5, 'TPDO', 8, 1153, 254, 100, 'uGrid reactive power, uGrid apparent power, uGrid power factor')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x481 = 1153

-- ─── RPDOs (PLC → device) ──────────────────────────────────────────

-- RPDO 1: AFE control mode + run command + (reserved)
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (5, 'RPDO', 1, 512, 254, 500, 'AFE control mode, AFE run command')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x200 = 512

-- RPDO 2: uGrid control mode + (reserved) + (reserved)
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (5, 'RPDO', 2, 768, 254, 500, 'uGrid control mode')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x300 = 768

-- RPDO 3: AFE DC link voltage ref + power ref + reactive power ref
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (5, 'RPDO', 3, 1024, 254, 500, 'AFE DC link voltage ref, AFE power ref, AFE reactive power ref')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x400 = 1024

-- RPDO 4: uGrid voltage ref + power ref + frequency ref
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (5, 'RPDO', 4, 1280, 254, 500, 'uGrid voltage ref, uGrid power ref, uGrid frequency ref')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x500 = 1280

-- RPDO 5: AFE power limits + DC link current limits
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (5, 'RPDO', 5, 513, 254, 500, 'AFE power limit min/max, AFE DC link current limit min/max')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x201 = 513

-- RPDO 6: DISABLED (skipped)
-- RPDO 7: DISABLED (skipped)

-- RPDO 8: (placeholder for future use — no signals mapped)
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (5, 'RPDO', 8, 1281, 254, 500, 'Reserved')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x501 = 1281

-- ═══════════════════════════════════════════════════════════════════════
-- PART 2: SIGNAL-TO-PDO ASSIGNMENTS
-- ═══════════════════════════════════════════════════════════════════════

-- ─── TPDO 1: System status, app active cmd, fault word 1, active fault, control switch ─
-- 0x2080:00:08 = System status (8320:0, 8 bits) — NO SIGNAL at 8320
-- 0x2087:00:08 = System app active cmd (8327:0, 8 bits)
-- 0x20A0:00:16 = Fault word 1 (8352:0, 16 bits) — NO SIGNAL at 8352
-- 0x20C0:01:16 = Active fault ID (8384:1, 16 bits) — NO SIGNAL at 8384
-- 0x2083:00:08 = Control switch status (8323:0, 8 bits)

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'TPDO' AND pdo_number = 1), bit_offset = 0, bit_length = COALESCE(bit_length, 8)
WHERE component_id = 5 AND canopen_index = 8327 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'SystemAppActiveCmd';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'TPDO' AND pdo_number = 1), bit_offset = 32, bit_length = COALESCE(bit_length, 8)
WHERE component_id = 5 AND canopen_index = 8323 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'ControlSwitchStatus';

-- ─── TPDO 2: AFE DC link voltage/current, AFE status word, AFE limit word ──
-- 0x2694:00:16 = AFE DC link voltage (9876:0, 16 bits) — NO SIGNAL at 9876
-- 0x2695:00:16 = AFE DC link current (9877:0, 16 bits)
-- 0x2681:00:16 = AFE control status word (9857:0, 16 bits) — disambiguate: AFEStatusWord
-- 0x2382:00:16 = AFE control limit word (9090:0, 16 bits) — disambiguate: AFELimitWord

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'TPDO' AND pdo_number = 2), bit_offset = 32, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 9877 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'AFEDCLinkCurrent';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'TPDO' AND pdo_number = 2), bit_offset = 32, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 9857 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'AFEStatusWord';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'TPDO' AND pdo_number = 2), bit_offset = 48, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 9090 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'AFELimitWord';

-- ─── TPDO 3: AFE grid frequency, grid voltage, grid power, grid reactive power ─
-- 0x2690:00:16 = AFE grid frequency (9872:0, 16 bits)
-- 0x2691:00:16 = Grid RMS AC voltage (9873:0, 16 bits)
-- 0x2692:00:16 = Grid power (9874:0, 16 bits)
-- 0x2693:00:16 = Grid reactive power (9875:0, 16 bits)

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'TPDO' AND pdo_number = 3), bit_offset = 0, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 9872 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'AFEGridFrequency';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'TPDO' AND pdo_number = 3), bit_offset = 16, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 9873 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'AFEGridVoltageRMS';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'TPDO' AND pdo_number = 3), bit_offset = 32, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 9874 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'AFEGridPower';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'TPDO' AND pdo_number = 3), bit_offset = 48, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 9875 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'AFEGridReactivePower';

-- ─── TPDO 4: Temperatures ──────────────────────────────────────────────────
-- 0x2090:00:16 = Max junction temp (8336:0, 16 bits) — NO SIGNAL at 8336
-- 0x2093:00:16 = PT100 CH1 (8339:0, 16 bits) — NO SIGNAL at 8339
-- 0x2094:00:16 = PT100 CH2 (8340:0, 16 bits) — NO SIGNAL at 8340
-- 0x2095:00:16 = PT100 CH3 (8341:0, 16 bits) — NO SIGNAL at 8341
-- (No matching signals in component 5 — all skipped)

-- ─── TPDO 5: Fault word 2, external temp, digital inputs, AFE/uGrid app active cmds ─
-- 0x20A1:00:16 = Fault word 2 (8353:0, 16 bits) — NO SIGNAL at 8353
-- 0x2091:00:16 = External temp (8337:0, 16 bits) — NO SIGNAL at 8337
-- 0x20D0:00:08 = Digital inputs (8400:0, 8 bits) — NO SIGNAL at 8400
-- 0x2687:00:08 = AFE app active cmd (9863:0, 8 bits)
-- 0x2787:00:08 = uGrid app active cmd (10119:0, 8 bits)

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'TPDO' AND pdo_number = 5), bit_offset = 40, bit_length = COALESCE(bit_length, 8)
WHERE component_id = 5 AND canopen_index = 9863 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'AFEAppActiveCmd';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'TPDO' AND pdo_number = 5), bit_offset = 48, bit_length = COALESCE(bit_length, 8)
WHERE component_id = 5 AND canopen_index = 10119 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'MicrogridAppActiveCmd';

-- ─── TPDO 6: uGrid DC link voltage/current, uGrid status word, uGrid limit word ─
-- 0x2794:00:16 = uGrid DC link voltage (10132:0, 16 bits)
-- 0x2795:00:16 = uGrid DC link current (10133:0, 16 bits)
-- 0x2780:00:16 = uGrid control status word (10112:0, 16 bits)
-- 0x2782:00:16 = uGrid control limit word (10114:0, 16 bits)

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'TPDO' AND pdo_number = 6), bit_offset = 0, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 10132 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'MicrogridVoltageRMS';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'TPDO' AND pdo_number = 6), bit_offset = 16, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 10133 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'MicrogridApparentPower';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'TPDO' AND pdo_number = 6), bit_offset = 32, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 10112 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'MicrogridStatusWord';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'TPDO' AND pdo_number = 6), bit_offset = 48, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 10114 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'MicrogridLimitWord';

-- ─── TPDO 7: uGrid output frequency, converter voltage, RMS current, grid power ─
-- 0x2790:00:16 = uGrid output frequency (10128:0, 16 bits) — NO SIGNAL at 10128
-- 0x2792:00:16 = uGrid converter RMS AC voltage (10130:0, 16 bits) — signal MicrogridPower at 10130
-- 0x2793:00:16 = uGrid RMS current (10131:0, 16 bits) — signal MicrogridReactivePower at 10131
-- 0x27A0:00:16 = uGrid grid power (10144:0, 16 bits) — signal MicrogridOutputFrequency at 10144

-- NOTE: ST code index 0x2790 (10128) has no matching signal. Indices 10130/10131/10144
-- map to signals with different names than what the ST code describes. Mapping by index.

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'TPDO' AND pdo_number = 7), bit_offset = 16, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 10130 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'MicrogridPower';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'TPDO' AND pdo_number = 7), bit_offset = 32, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 10131 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'MicrogridReactivePower';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'TPDO' AND pdo_number = 7), bit_offset = 48, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 10144 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'MicrogridOutputFrequency';

-- ─── TPDO 8: uGrid reactive power, apparent power, power factor ───────────
-- 0x27A1:00:16 = uGrid reactive power (10145:0, 16 bits) — signal MicrogridSoftstartActive at 10145
-- 0x27A2:00:16 = uGrid apparent power (10146:0, 16 bits) — signal MicrogridRunning at 10146
-- 0x27A3:00:16 = uGrid power factor (10147:0, 16 bits) — signals MicrogridPowerFactor AND MicrogridSoftStart at 10147

-- NOTE: Same index-vs-name mismatch as TPDO 7. Mapping by index.
-- For 10147, MicrogridPowerFactor is the primary (full word), MicrogridSoftStart is a bit.

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'TPDO' AND pdo_number = 8), bit_offset = 0, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 10145 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'MicrogridSoftstartActive';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'TPDO' AND pdo_number = 8), bit_offset = 16, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 10146 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'MicrogridRunning';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'TPDO' AND pdo_number = 8), bit_offset = 32, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 10147 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'MicrogridPowerFactor';

-- ─── RPDO 1: AFE control mode, AFE run command ────────────────────────────
-- 0x2600:00:08 = AFE control mode (9728:0, 8 bits) — disambiguate: AFEControlMode (not MicrogridAFESelection)
-- 0x2601:00:08 = AFE run command (9729:0, 8 bits)
-- 0x2602:00:08 = (reserved, 9730) — NO SIGNAL at 9730

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'RPDO' AND pdo_number = 1), bit_offset = 0, bit_length = COALESCE(bit_length, 8)
WHERE component_id = 5 AND canopen_index = 9728 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'AFEControlMode';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'RPDO' AND pdo_number = 1), bit_offset = 8, bit_length = COALESCE(bit_length, 8)
WHERE component_id = 5 AND canopen_index = 9729 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'AFERunCommand';

-- ─── RPDO 2: uGrid control mode ───────────────────────────────────────────
-- 0x2700:00:08 = uGrid control mode (9984:0, 8 bits)
-- 0x2701:00:08 = (reserved, 9985) — NO SIGNAL at 9985
-- 0x2702:00:08 = (reserved, 9986) — NO SIGNAL at 9986

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'RPDO' AND pdo_number = 2), bit_offset = 0, bit_length = COALESCE(bit_length, 8)
WHERE component_id = 5 AND canopen_index = 9984 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'MicrogridControlMode';

-- ─── RPDO 3: AFE DC link voltage ref, power ref, reactive power ref ───────
-- 0x2610:00:16 = AFE DC link voltage ref (9744:0, 16 bits)
-- 0x2611:00:16 = AFE power reference (9745:0, 16 bits)
-- 0x2612:00:16 = AFE reactive power reference (9746:0, 16 bits)

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'RPDO' AND pdo_number = 3), bit_offset = 0, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 9744 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'AFEDCLinkVoltageReference';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'RPDO' AND pdo_number = 3), bit_offset = 16, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 9745 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'AFEPowerReference';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'RPDO' AND pdo_number = 3), bit_offset = 32, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 9746 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'AFEReactivePowerReference';

-- ─── RPDO 4: uGrid voltage ref, power ref, frequency ref ──────────────────
-- 0x2710:00:16 = uGrid voltage reference V (10000:0, 16 bits)
-- 0x2711:00:16 = uGrid power reference (10001:0, 16 bits)
-- 0x2712:00:16 = uGrid frequency reference Hz (10002:0, 16 bits)

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'RPDO' AND pdo_number = 4), bit_offset = 0, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 10000 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'MicrogridVoltageReferenceV';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'RPDO' AND pdo_number = 4), bit_offset = 16, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 10001 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'MicrogridPowerReference';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'RPDO' AND pdo_number = 4), bit_offset = 32, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 10002 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'MicrogridFrequencyReferenceHz';

-- ─── RPDO 5: AFE power limits + DC link current limits ─────────────────────
-- 0x2620:00:16 = AFE power limit min (9760:0, 16 bits)
-- 0x2621:00:16 = AFE power limit max (9761:0, 16 bits)
-- 0x2622:00:16 = AFE DC link current limit min (9762:0, 16 bits)
-- 0x2623:00:16 = AFE DC link current limit max (9763:0, 16 bits)

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'RPDO' AND pdo_number = 5), bit_offset = 0, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 9760 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'AFEPowerLimitMin';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'RPDO' AND pdo_number = 5), bit_offset = 16, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 9761 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'AFEPowerLimitMax';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'RPDO' AND pdo_number = 5), bit_offset = 32, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 9762 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'AFEDCLinkCurrentLimitMin';

UPDATE component_signal SET pdo_config_id = (SELECT id FROM pdo_config WHERE component_id = 5 AND direction = 'RPDO' AND pdo_number = 5), bit_offset = 48, bit_length = COALESCE(bit_length, 16)
WHERE component_id = 5 AND canopen_index = 9763 AND COALESCE(canopen_sub_index, 0) = 0 AND tag_suffix = 'AFEDCLinkCurrentLimitMax';

-- RPDO 6: DISABLED (skipped)
-- RPDO 7: DISABLED (skipped)
-- RPDO 8: No signals mapped (reserved)
