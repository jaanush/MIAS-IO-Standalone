-- DEIF MIC-2 MKII (HardwareComponent id=9): apply the active-signal subset
-- per FR-005-A reply from the CODESYS agent (2026-04-26).
--
-- Of the 53 strMKII fields, only 12 are consumed by FB_Sync / FB_ShoreAC /
-- FB_ShoreAC_Sync. The remaining 41 stay in the catalog as active=false so
-- they can be flipped on later without re-entering data. The Modbus block
-- read on the wire is unchanged (FC03 0x4000..+72 regs) — codegen / GVL
-- emission filters by active.

UPDATE "component_signal"
SET "active" = FALSE
WHERE "component_id" = 9
  AND "tag_suffix" NOT IN (
    'Frequency',
    'Average_voltage_Vavg',
    'Average_line_voltage_Vlavg',
    'Line_voltage_V12',
    'Line_voltage_V23',
    'Line_voltage_V31',
    'Phase_line_current_I1',
    'Phase_line_current_I2',
    'Phase_line_current_I3',
    'System_power_Psum',
    'System_apparent_power_Ssum',
    'System_power_factor_PFsum'
  );
