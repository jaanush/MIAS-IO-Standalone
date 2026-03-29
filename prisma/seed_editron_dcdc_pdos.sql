-- Editron Converter FW11 DCDC — PDO Configuration
-- Based on mCanOpenDataConfig_Editron_DCDC_Stack1_FW11.fn.st (METS-LIB, reference only)
-- Component ID 3 = 'Editron Converter FW11 DCDC'
--
-- NOTE: Signal-to-PDO assignments (UPDATE component_signal SET pdo_config_id = ...)
-- are done by matching canopenIndex on existing component_signal rows.
-- If signals don't exist yet, the UPDATE is a no-op — create them first.

-- ─── TPDOs (device → PLC) ──────────────────────────────────────────

-- TPDO 1: System status + fault words + active fault
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (3, 'TPDO', 1, 384, 254, 100, 'System status, app active cmd, fault word 1, active fault ID, fault word 2')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, transmission_type = EXCLUDED.transmission_type,
  event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x180 = 384

-- TPDO 2: HV/LV voltage + HV/LV current
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (3, 'TPDO', 2, 640, 254, 100, 'HV voltage, LV voltage, HV current, LV current')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, transmission_type = EXCLUDED.transmission_type,
  event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x280 = 640

-- TPDO 3: Power + available currents + control limit error
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (3, 'TPDO', 3, 896, 254, 100, 'Power, available LV current HV→LV, available HV current LV→HV, control limit error word')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, transmission_type = EXCLUDED.transmission_type,
  event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x380 = 896

-- TPDO 4: Temperatures
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (3, 'TPDO', 4, 1152, 254, 1000, 'Max junction temp, PT100 CH1-CH3')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, transmission_type = EXCLUDED.transmission_type,
  event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x480 = 1152

-- TPDO 5: External temp + digital inputs + app config + application status
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (3, 'TPDO', 5, 385, 254, 500, 'Max external temp, user I/O digital inputs, app active cmd config, application status word')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, transmission_type = EXCLUDED.transmission_type,
  event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x181 = 385

-- TPDO 6: Control/fault words + PT100 CH4-CH5
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (3, 'TPDO', 6, 641, 254, 1000, 'Control limit word, control fault word, PT100 CH4, PT100 CH5')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, transmission_type = EXCLUDED.transmission_type,
  event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x281 = 641

-- TPDO 7: User I/O analog inputs
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (3, 'TPDO', 7, 897, 254, 1000, 'User I/O 1-4 input voltage')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, transmission_type = EXCLUDED.transmission_type,
  event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x381 = 897

-- TPDO 8: DISABLED — skipped (no mapped objects)

-- ─── RPDOs (PLC → device) ──────────────────────────────────────────

-- RPDO 1: System command + control mode + DCDC/app cmd
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (3, 'RPDO', 1, 512, 254, 500, 'System cmd word, system app cmd word, control mode, DCDC cmd word, app cmd word')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, transmission_type = EXCLUDED.transmission_type,
  event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x200 = 512

-- RPDO 2: Voltage/current/power references
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (3, 'RPDO', 2, 768, 254, 500, 'HV voltage ref, LV voltage ref, LV current ref, power ref')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, transmission_type = EXCLUDED.transmission_type,
  event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x300 = 768

-- RPDO 3: Power/current limits
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (3, 'RPDO', 3, 1024, 254, 500, 'Power limit buck HV→LV, power limit boost LV→HV, LV current limit buck, LV current limit boost')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, transmission_type = EXCLUDED.transmission_type,
  event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x400 = 1024

-- RPDO 4: HV voltage protection limits
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (3, 'RPDO', 4, 1280, 254, 500, 'HV OV full/begin limit, HV UV begin/full limit')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, transmission_type = EXCLUDED.transmission_type,
  event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x500 = 1280

-- RPDO 5: LV voltage protection limits
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (3, 'RPDO', 5, 513, 254, 500, 'LV OV full/begin limit, LV UV begin/full limit')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, transmission_type = EXCLUDED.transmission_type,
  event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x201 = 513

-- RPDO 6: DISABLED — skipped (no mapped objects)
-- RPDO 7: DISABLED — skipped (no mapped objects)

-- RPDO 8: User I/O digital outputs
INSERT INTO pdo_config (component_id, direction, pdo_number, cob_id, transmission_type, event_timer_ms, description)
VALUES (3, 'RPDO', 8, 1281, 254, 500, 'User I/O digital outputs')
ON CONFLICT (component_id, direction, pdo_number) DO UPDATE SET
  cob_id = EXCLUDED.cob_id, transmission_type = EXCLUDED.transmission_type,
  event_timer_ms = EXCLUDED.event_timer_ms, description = EXCLUDED.description;
-- 0x501 = 1281

-- ─── Delete disabled PDOs (TPDO 8, RPDO 6, RPDO 7) ────────────────
-- First unlink any signals that might reference them, then delete
UPDATE component_signal SET pdo_config_id = NULL
WHERE component_id = 3
  AND pdo_config_id IN (
    SELECT id FROM pdo_config
    WHERE component_id = 3
      AND ((direction = 'TPDO' AND pdo_number = 8)
        OR (direction = 'RPDO' AND pdo_number IN (6, 7)))
  );

DELETE FROM pdo_config
WHERE component_id = 3
  AND ((direction = 'TPDO' AND pdo_number = 8)
    OR (direction = 'RPDO' AND pdo_number IN (6, 7)));

-- ─── Signal-to-PDO Assignments ─────────────────────────────────────
-- Assign each component_signal to the correct pdo_config via subquery.
-- Uses UPDATE ... SET pdo_config_id = (SELECT id FROM pdo_config WHERE ...)

-- == TPDO 1 (0x180=384): System status(0x2080), app active cmd(0x2087),
--    fault word 1(0x20A0), active fault ID(0x20C0:01), fault word 2(0x20A1)
-- No matching signals in component 3 for these indices (0x2080=8320, 0x2087=8327,
-- 0x20A0=8352, 0x20C0=8384, 0x20A1=8353) — signals not yet created.

-- == TPDO 2 (0x280=640): HV voltage(0x2490=9360), LV voltage(0x2491=9361),
--    HV current(0x2492=9362), LV current(0x2493=9363)
UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'TPDO' AND pdo_number = 2
) WHERE component_id = 3 AND id = 177;  -- LVLinkVoltage (0x2491=9361)

UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'TPDO' AND pdo_number = 2
) WHERE component_id = 3 AND id = 151;  -- AvailableCurrentBoostA (0x2492=9362, also HV current)

UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'TPDO' AND pdo_number = 2
) WHERE component_id = 3 AND id = 176;  -- LVLinkCurrent (0x2493=9363)

UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'TPDO' AND pdo_number = 2
) WHERE component_id = 3 AND id = 152;  -- AvailableCurrentBuckA (0x2493=9363, also LV current)

-- == TPDO 3 (0x380=896): Power(0x2494=9364), Available LV current(0x2493=9363),
--    Available HV current(0x2492=9362), Control limit error word(0x24B8=9400)
UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'TPDO' AND pdo_number = 3
) WHERE component_id = 3 AND id = 186;  -- PowerDC (0x2494=9364)

UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'TPDO' AND pdo_number = 3
) WHERE component_id = 3 AND id = 1036;  -- DCDCControlLimitErrorWord (0x24B8=9400)

-- NOTE: AvailableCurrentBuckA(0x2493) and AvailableCurrentBoostA(0x2492) also appear
-- in TPDO 3, but a signal can only belong to one PDO. They are assigned to TPDO 2
-- where they first appear as primary measurements. TPDO 3 re-maps the same OD entries
-- as "available" values — the PLC code handles both PDOs.

-- == TPDO 4 (0x480=1152): Max junction temp(0x2090=8336), PT100 CH1-3(0x2093-0x2095)
-- No matching signals for 0x2090=8336, 0x2093=8339, 0x2094=8340, 0x2095=8341

-- == TPDO 5 (0x181=385): Max external temp(0x2091=8337), User I/O DI(0x20D0=8400),
--    App active cmd config(0x2487=9351), Application status word(0x2480=9344)
UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'TPDO' AND pdo_number = 5
) WHERE component_id = 3 AND id = 1031;  -- DCDCAppActiveCmd (0x2487=9351)

UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'TPDO' AND pdo_number = 5
) WHERE component_id = 3 AND id = 197;  -- DCDCStatusWord (0x2480=9344)

-- Running (id=196) is a bit-extracted DI from DCDCStatusWord(0x2480=9344), same PDO
UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'TPDO' AND pdo_number = 5
) WHERE component_id = 3 AND id = 196;  -- Running (bit from 0x2480=9344)

-- == TPDO 6 (0x281=641): Control limit word(0x2482=9346), Control fault word(0x24B0=9392),
--    PT100 CH4(0x2096=8342), PT100 CH5(0x2097=8343)
UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'TPDO' AND pdo_number = 6
) WHERE component_id = 3 AND id = 175;  -- DCDCLimitWord (0x2482=9346)

UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'TPDO' AND pdo_number = 6
) WHERE component_id = 3 AND id = 1035;  -- DCDCControlFaultWord (0x24B0=9392)

-- All bit-extracted DIs from DCDCLimitWord (0x2482=9346) → TPDO 6
UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'TPDO' AND pdo_number = 6
) WHERE component_id = 3 AND canopen_index = 9346 AND io_type = 'DI';
-- Covers: BoostCurrentLimit(153), BoostPowerLimit(154), BuckCurrentLimit(155),
--         BuckPowerLimit(156), HVSideOvervoltageLimit(170), HVSideUndervoltageLimit(171),
--         LVSideOvervoltageLimit(180), LVSideUndervoltageLimit(181),
--         MaximumDutyCycleLimit(184), MinimumDutyCycleLimit(185),
--         PowerSwitchCurrentLimit(190), ThermalCurrentLimit(198)

-- == TPDO 7 (0x381=897): User I/O 1-4 input voltage(0x20D1:01-04 = 8401:01-04)
-- No matching signals for 0x20D1=8401

-- == RPDO 1 (0x200=512): System cmd word(0x2000=8192), system app cmd(0x2008=8200),
--    control mode(0x2400=9216), DCDC cmd word(0x2401=9217), app cmd word(0x2402=9218)
UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'RPDO' AND pdo_number = 1
) WHERE component_id = 3 AND id = 1037;  -- SystemAppCmd (0x2008=8200)

UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'RPDO' AND pdo_number = 1
) WHERE component_id = 3 AND id = 157;  -- ControlMode (0x2400=9216)

UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'RPDO' AND pdo_number = 1
) WHERE component_id = 3 AND id = 1038;  -- AppCommandWord (0x2402=9218)
-- 0x2000=8192 (System cmd word) and 0x2401=9217 (DCDC cmd word) — not in signals

-- == RPDO 2 (0x300=768): HV voltage ref(0x2410=9232), LV voltage ref(0x2411=9233),
--    LV current ref(0x2413=9235), Power ref(0x2414=9236)
UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'RPDO' AND pdo_number = 2
) WHERE component_id = 3 AND id = 199;  -- VoltageRefHVVDC (0x2410=9232)

UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'RPDO' AND pdo_number = 2
) WHERE component_id = 3 AND id = 200;  -- VoltageRefLVVDC (0x2411=9233)

UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'RPDO' AND pdo_number = 2
) WHERE component_id = 3 AND id = 160;  -- CurrentRefLVA (0x2413=9235)

UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'RPDO' AND pdo_number = 2
) WHERE component_id = 3 AND id = 189;  -- PowerRefKW (0x2414=9236)

-- == RPDO 3 (0x400=1024): Power limit buck(0x2420=9248), power limit boost(0x2421=9249),
--    LV current limit buck(0x2424=9252), LV current limit boost(0x2425=9253)
UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'RPDO' AND pdo_number = 3
) WHERE component_id = 3 AND id = 188;  -- PowerLimBuckKW (0x2420=9248)

UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'RPDO' AND pdo_number = 3
) WHERE component_id = 3 AND id = 187;  -- PowerLimBoostKW (0x2421=9249)

UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'RPDO' AND pdo_number = 3
) WHERE component_id = 3 AND id = 159;  -- CurrentLimBuckA (0x2424=9252)

UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'RPDO' AND pdo_number = 3
) WHERE component_id = 3 AND id = 158;  -- CurrentLimBoostA (0x2425=9253)

-- == RPDO 4 (0x500=1280): HV OV full(0x2426=9254), HV OV begin(0x2427=9255),
--    HV UV begin(0x2428=9256), HV UV full(0x2429=9257)
UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'RPDO' AND pdo_number = 4
) WHERE component_id = 3 AND id = 169;  -- HVOVCFullLimitationVDC (0x2426=9254)

UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'RPDO' AND pdo_number = 4
) WHERE component_id = 3 AND id = 168;  -- HVOVCBeginLimitationVDC (0x2427=9255)

UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'RPDO' AND pdo_number = 4
) WHERE component_id = 3 AND id = 172;  -- HVUVCBeginLimitationVDC (0x2428=9256)

UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'RPDO' AND pdo_number = 4
) WHERE component_id = 3 AND id = 173;  -- HVUVCFullLimitationVDC (0x2429=9257)

-- == RPDO 5 (0x201=513): LV OV full(0x242A=9258), LV OV begin(0x242B=9259),
--    LV UV begin(0x242C=9260), LV UV full(0x242D=9261)
UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'RPDO' AND pdo_number = 5
) WHERE component_id = 3 AND id = 179;  -- LVOVCFullLimitationVDC (0x242A=9258)

UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'RPDO' AND pdo_number = 5
) WHERE component_id = 3 AND id = 178;  -- LVOVCBeginLimitationVDC (0x242B=9259)

UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'RPDO' AND pdo_number = 5
) WHERE component_id = 3 AND id = 182;  -- LVUVCBeginLimitationVDC (0x242C=9260)

UPDATE component_signal SET pdo_config_id = (
  SELECT id FROM pdo_config WHERE component_id = 3 AND direction = 'RPDO' AND pdo_number = 5
) WHERE component_id = 3 AND id = 183;  -- LVUVCFullLimitationVDC (0x242D=9261)

-- == RPDO 8 (0x501=1281): User I/O digital outputs(0x2020=8224)
-- No matching signal for 0x2020=8224

-- ─── Summary of unmapped OD entries (signals not yet in component 3) ─
-- 0x2080=8320  System status              (TPDO 1)
-- 0x2087=8327  App active cmd             (TPDO 1) — note: 0x2087 != 0x2487
-- 0x20A0=8352  Fault word 1               (TPDO 1)
-- 0x20C0=8384  Active fault ID            (TPDO 1)
-- 0x20A1=8353  Fault word 2               (TPDO 1)
-- 0x2490=9360  HV voltage                 (TPDO 2)
-- 0x2090=8336  Max junction temp          (TPDO 4)
-- 0x2093=8339  PT100 CH1                  (TPDO 4)
-- 0x2094=8340  PT100 CH2                  (TPDO 4)
-- 0x2095=8341  PT100 CH3                  (TPDO 4)
-- 0x2091=8337  Max external temp          (TPDO 5)
-- 0x20D0=8400  User I/O digital inputs    (TPDO 5)
-- 0x2096=8342  PT100 CH4                  (TPDO 6)
-- 0x2097=8343  PT100 CH5                  (TPDO 6)
-- 0x20D1=8401  User I/O 1-4 input voltage (TPDO 7)
-- 0x2000=8192  System cmd word            (RPDO 1)
-- 0x2401=9217  DCDC cmd word              (RPDO 1)
-- 0x2020=8224  User I/O digital outputs   (RPDO 8)
