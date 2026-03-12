-- ============================================================
-- Kreisel BMS (id=10) + SC String Controller (id=26)
-- Populate: raw_data_type, default_eu_id, default_scale_min/max
-- ============================================================

-- Add missing engineering unit
INSERT INTO engineering_unit (symbol, description) VALUES ('kOhm', 'Kilohm') ON CONFLICT (symbol) DO NOTHING;

-- ============================================================
-- BMS component (id=10) — voltage signals → V DC (id=20)
-- ============================================================
-- linkVoltage_BMS: 0..1200 V DC, UINT
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=20, default_scale_min=0, default_scale_max=1200 WHERE component_id=10 AND channel_offset=23;
-- maxVoltageLimit_BMS / minVoltageLimit_BMS: 0..1200 V DC
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=20, default_scale_min=0, default_scale_max=1200 WHERE component_id=10 AND channel_offset=34;
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=20, default_scale_min=0, default_scale_max=1200 WHERE component_id=10 AND channel_offset=42;
-- chargeVoltageLimit_BMS: 0..1200 V DC
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=20, default_scale_min=0, default_scale_max=1200 WHERE component_id=10 AND channel_offset=6;
-- minStringVoltage_BMS / maxStringVoltage_BMS: 0..1200 V DC
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=20, default_scale_min=0, default_scale_max=1200 WHERE component_id=10 AND channel_offset=41;
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=20, default_scale_min=0, default_scale_max=1200 WHERE component_id=10 AND channel_offset=33;
-- linkVoltageAuxiliary1/2_BMS: 0..1200 V DC
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=20, default_scale_min=0, default_scale_max=1200 WHERE component_id=10 AND channel_offset=24;
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=20, default_scale_min=0, default_scale_max=1200 WHERE component_id=10 AND channel_offset=25;
-- minBrickVoltage_BMS / maxBrickVoltage_BMS: 0..6.5 V DC
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=20, default_scale_min=0, default_scale_max=6.5 WHERE component_id=10 AND channel_offset=35;
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=20, default_scale_min=0, default_scale_max=6.5 WHERE component_id=10 AND channel_offset=26;

-- ============================================================
-- Current signals → A DC (id=11)
-- ============================================================
-- current_BMS: -3200..3200 A DC (signed offset in raw)
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=11, default_scale_min=-3200, default_scale_max=3200 WHERE component_id=10 AND channel_offset=9;
-- dischargeCurrentResidual_BMS: -3200..3200 A DC
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=11, default_scale_min=-3200, default_scale_max=3200 WHERE component_id=10 AND channel_offset=12;
-- regenCurrentResidual_BMS: -3200..3200 A DC
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=11, default_scale_min=-3200, default_scale_max=3200 WHERE component_id=10 AND channel_offset=44;
-- regenCurrentLimit_BMS / dischargeCurrentLimit_BMS: 0..3200 A DC
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=11, default_scale_min=0, default_scale_max=3200 WHERE component_id=10 AND channel_offset=45;
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=11, default_scale_min=0, default_scale_max=3200 WHERE component_id=10 AND channel_offset=10;
-- chargeCurrentSetpoint_BMS: 0..3200 A DC
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=11, default_scale_min=0, default_scale_max=3200 WHERE component_id=10 AND channel_offset=4;
-- regenCurrentPred_BMS / dischargeCurrentPred_BMS: 0..3200 A DC
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=11, default_scale_min=0, default_scale_max=3200 WHERE component_id=10 AND channel_offset=46;
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=11, default_scale_min=0, default_scale_max=3200 WHERE component_id=10 AND channel_offset=11;

-- ============================================================
-- Power signals → kW (id=4)
-- ============================================================
-- regenPowerPred_BMS / dischargePowerPred_BMS: 0..650 kW
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=4, default_scale_min=0, default_scale_max=650 WHERE component_id=10 AND channel_offset=47;
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=4, default_scale_min=0, default_scale_max=650 WHERE component_id=10 AND channel_offset=13;
-- chargePowerAvailable_PT: 0..650 kW
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=4, default_scale_min=0, default_scale_max=650 WHERE component_id=10 AND channel_offset=56;

-- ============================================================
-- Energy → kWh (id=5)
-- ============================================================
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=5, default_scale_min=0, default_scale_max=650 WHERE component_id=10 AND channel_offset=14;

-- ============================================================
-- Percentage → % (id=10)
-- ============================================================
-- minSOC / maxSOC: 0..100 %
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=10, default_scale_min=0, default_scale_max=100 WHERE component_id=10 AND channel_offset=39;
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=10, default_scale_min=0, default_scale_max=100 WHERE component_id=10 AND channel_offset=31;
-- userSOC_BMS: 0..100 %
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=10, default_scale_min=0, default_scale_max=100 WHERE component_id=10 AND channel_offset=63;
-- minSOH / maxSOH: 0..120 % (can exceed 100 in calibrated systems)
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=10, default_scale_min=0, default_scale_max=120 WHERE component_id=10 AND channel_offset=40;
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=10, default_scale_min=0, default_scale_max=120 WHERE component_id=10 AND channel_offset=32;

-- ============================================================
-- Temperature → °C (id=9)
-- ============================================================
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=9, default_scale_min=-40, default_scale_max=85 WHERE component_id=10 AND channel_offset=37;
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=9, default_scale_min=-40, default_scale_max=85 WHERE component_id=10 AND channel_offset=29;
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=9, default_scale_min=-40, default_scale_max=85 WHERE component_id=10 AND channel_offset=28;
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=9, default_scale_min=-40, default_scale_max=85 WHERE component_id=10 AND channel_offset=16;
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=9, default_scale_min=-40, default_scale_max=85 WHERE component_id=10 AND channel_offset=17;

-- ============================================================
-- Isolation resistance → kOhm
-- ============================================================
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=(SELECT id FROM engineering_unit WHERE symbol='kOhm'), default_scale_min=0, default_scale_max=130000 WHERE component_id=10 AND channel_offset=20;
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=(SELECT id FROM engineering_unit WHERE symbol='kOhm'), default_scale_min=0, default_scale_max=130000 WHERE component_id=10 AND channel_offset=21;

-- ============================================================
-- Pressure → mBar (id=24)
-- ============================================================
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=24, default_scale_min=0, default_scale_max=2540 WHERE component_id=10 AND channel_offset=15;

-- ============================================================
-- Enum / discrete signals — set raw_data_type only (no EU, no range)
-- ============================================================
-- 2-bit enums
UPDATE component_signal SET raw_data_type='UINT' WHERE component_id=10 AND channel_offset IN (5,18,19,22,51,52,53,54);
-- 4-bit enums
UPDATE component_signal SET raw_data_type='UINT' WHERE component_id=10 AND channel_offset IN (0,1,2,48,49,55);
-- 6-bit index
UPDATE component_signal SET raw_data_type='UINT' WHERE component_id=10 AND channel_offset=50;
-- 16-bit indexes (no EU, no range)
UPDATE component_signal SET raw_data_type='UINT' WHERE component_id=10 AND channel_offset IN (27,30,36,38);
-- 8-bit count (numberOfConnectedStrings, alive, CRC)
UPDATE component_signal SET raw_data_type='BYTE' WHERE component_id=10 AND channel_offset IN (43,61,62);
-- 1-bit contactor requests
UPDATE component_signal SET raw_data_type='BOOL' WHERE component_id=10 AND channel_offset IN (57,58,59,60);

-- ============================================================
-- SC String Controller (id=26)
-- ============================================================
-- linkVoltage: -1250..1250 V DC, UINT (raw unsigned, offset applied by scale)
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=20, default_scale_min=-1250, default_scale_max=1250 WHERE component_id=26 AND channel_offset=0;
-- emergencyRequest: 4-bit enum
UPDATE component_signal SET raw_data_type='UINT' WHERE component_id=26 AND channel_offset=1;
-- alive: 4-bit counter
UPDATE component_signal SET raw_data_type='UINT' WHERE component_id=26 AND channel_offset=2;
-- CRC: 8-bit
UPDATE component_signal SET raw_data_type='BYTE' WHERE component_id=26 AND channel_offset=3;

-- Verify
SELECT channel_offset, tag_suffix, raw_data_type, default_eu_id, default_scale_min, default_scale_max
FROM component_signal WHERE component_id=10 ORDER BY channel_offset;
