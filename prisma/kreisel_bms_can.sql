-- ============================================================
-- Kreisel Electric BMS (component_id=10): populate CAN fields
-- ============================================================

-- 1. UPDATE can_id, bit_offset, bit_length, byte_order for 43 matched signals

-- SC01_State (0x01F = 31)
UPDATE component_signal SET can_id=31, bit_offset=27, bit_length=4, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=3;   -- alive_SC01
UPDATE component_signal SET can_id=31, bit_offset=39, bit_length=8, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=8;   -- CRC_SC01

-- PT_Request (0x11B = 283)
UPDATE component_signal SET can_id=283, bit_offset=7,  bit_length=4,  byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=0;  -- IsolationRequest_PT
UPDATE component_signal SET can_id=283, bit_offset=11, bit_length=4,  byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=1;  -- SleepRequest_PT
UPDATE component_signal SET can_id=283, bit_offset=15, bit_length=4,  byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=2;  -- RangeRequest_PT

-- BMS_State (0x11A = 282)
UPDATE component_signal SET can_id=282, bit_offset=5,  bit_length=2,  byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=5;  -- chargeState_BMS
UPDATE component_signal SET can_id=282, bit_offset=21, bit_length=2,  byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=18; -- hvilState_BMS
UPDATE component_signal SET can_id=282, bit_offset=23, bit_length=2,  byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=19; -- isolationError_BMS
UPDATE component_signal SET can_id=282, bit_offset=7,  bit_length=2,  byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=22; -- isolationState_BMS
UPDATE component_signal SET can_id=282, bit_offset=15, bit_length=8,  byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=43; -- numberOfConnectedStrings_BMS

-- BMS_Charge (0x333 = 819)
UPDATE component_signal SET can_id=819, bit_offset=7,  bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=4;  -- chargeCurrentSetpoint_BMS
UPDATE component_signal SET can_id=819, bit_offset=23, bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=6;  -- chargeVoltageLimit_BMS

-- BMS_CurrentVoltage (0x331 = 817)
UPDATE component_signal SET can_id=817, bit_offset=23, bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=9;  -- current_BMS
UPDATE component_signal SET can_id=817, bit_offset=39, bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=12; -- DischargeCurrentResidual_BMS
UPDATE component_signal SET can_id=817, bit_offset=7,  bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=23; -- linkVoltage_BMS
UPDATE component_signal SET can_id=817, bit_offset=55, bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=44; -- RegencurrenctResidual_BMS

-- BMS_DriveLimits (0x332 = 818)
UPDATE component_signal SET can_id=818, bit_offset=55, bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=10; -- dischargeCurrentLimit_BMS
UPDATE component_signal SET can_id=818, bit_offset=7,  bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=34; -- maxVoltageLimit_BMS
UPDATE component_signal SET can_id=818, bit_offset=23, bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=42; -- minVoltageLimit_BMS
UPDATE component_signal SET can_id=818, bit_offset=39, bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=45; -- regenCurrentLimit_BMS

-- BMS_PowerPrediction (0x33B = 827)
UPDATE component_signal SET can_id=827, bit_offset=23, bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=11; -- dischargeCurrentPred_BMS
UPDATE component_signal SET can_id=827, bit_offset=55, bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=13; -- dischargePowerPred_BMS
UPDATE component_signal SET can_id=827, bit_offset=7,  bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=46; -- regenCurrentPred_BMS
UPDATE component_signal SET can_id=827, bit_offset=39, bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=47; -- regenPowerPred_BMS

-- BMS_EnergySOH (0x334 = 820)
UPDATE component_signal SET can_id=820, bit_offset=7,  bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=14; -- energyAvailable_BMS
UPDATE component_signal SET can_id=820, bit_offset=31, bit_length=8,  byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=32; -- maxSOH_BMS
UPDATE component_signal SET can_id=820, bit_offset=23, bit_length=8,  byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=40; -- minSOH_BMS

-- BMS_FluidMeasUserSOC (0x33A = 826)
UPDATE component_signal SET can_id=826, bit_offset=55, bit_length=8,  byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=15; -- fluidPressureInlet_BMS
UPDATE component_signal SET can_id=826, bit_offset=7,  bit_length=8,  byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=16; -- fluidTemperatureInlet_BMS
UPDATE component_signal SET can_id=826, bit_offset=23, bit_length=8,  byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=17; -- fluidTemperatureOutlet_BMS

-- BMS_IsolationSOC (0x336 = 822)
UPDATE component_signal SET can_id=822, bit_offset=7,  bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=20; -- isolationResistanceExtern_BMS
UPDATE component_signal SET can_id=822, bit_offset=23, bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=21; -- isolationResistanceIntern_BMS
UPDATE component_signal SET can_id=822, bit_offset=55, bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=31; -- maxSOC_BMS
UPDATE component_signal SET can_id=822, bit_offset=39, bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=39; -- minSOC_BMS

-- BMS_StringVoltages (0x339 = 825)
UPDATE component_signal SET can_id=825, bit_offset=39, bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=24; -- linkVoltageAuxiliary1_BMS
UPDATE component_signal SET can_id=825, bit_offset=55, bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=25; -- linkVoltageAuxiliary2_BMS
UPDATE component_signal SET can_id=825, bit_offset=23, bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=33; -- maxStringVoltage_BMS
UPDATE component_signal SET can_id=825, bit_offset=7,  bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=41; -- minStringVoltage_BMS

-- BMS_BrickVoltages (0x335 = 821)
UPDATE component_signal SET can_id=821, bit_offset=23, bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=26; -- maxBrickVoltage_BMS
UPDATE component_signal SET can_id=821, bit_offset=7,  bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=35; -- minBrickVoltage_BMS

-- BMS_ModuleTemperatures (0x337 = 823)
UPDATE component_signal SET can_id=823, bit_offset=55, bit_length=8,  byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=28; -- maxDewPointTemperature_BMS
UPDATE component_signal SET can_id=823, bit_offset=15, bit_length=8,  byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=29; -- maxModuleTemperature_BMS
UPDATE component_signal SET can_id=823, bit_offset=7,  bit_length=8,  byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=37; -- minModuleTemperature_BMS

-- ============================================================
-- 2. FIX tag_suffix names (case errors + typo + _0based)
-- ============================================================
UPDATE component_signal SET tag_suffix='isolationRequest_PT',              description='isolationRequest PT'              WHERE component_id=10 AND channel_offset=0;
UPDATE component_signal SET tag_suffix='sleepRequest_PT',                  description='sleepRequest PT'                  WHERE component_id=10 AND channel_offset=1;
UPDATE component_signal SET tag_suffix='rangeRequest_PT',                  description='rangeRequest PT'                  WHERE component_id=10 AND channel_offset=2;
UPDATE component_signal SET tag_suffix='dischargeCurrentResidual_BMS',     description='dischargeCurrentResidual BMS'     WHERE component_id=10 AND channel_offset=12;
UPDATE component_signal SET tag_suffix='regenCurrentResidual_BMS',         description='regenCurrentResidual BMS'         WHERE component_id=10 AND channel_offset=44;
UPDATE component_signal SET tag_suffix='maxBrickVoltageIndex_0based_BMS',  description='maxBrickVoltageIndex 0based BMS', can_id=821, bit_offset=55, bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=27;
UPDATE component_signal SET tag_suffix='minBrickVoltageIndex_0based_BMS',  description='minBrickVoltageIndex 0based BMS', can_id=821, bit_offset=39, bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=36;
UPDATE component_signal SET tag_suffix='maxModuleTempIndex_0based_BMS',    description='maxModuleTempIndex 0based BMS',   can_id=823, bit_offset=39, bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=30;
UPDATE component_signal SET tag_suffix='minModuleTempIndex_0based_BMS',    description='minModuleTempIndex 0based BMS',   can_id=823, bit_offset=23, bit_length=16, byte_order='BIG_ENDIAN' WHERE component_id=10 AND channel_offset=38;

-- ============================================================
-- 3. INSERT missing signals (offsets 48-65)
-- ============================================================

-- BMS_State (0x11A = 282) missing signals
INSERT INTO component_signal (component_id, channel_offset, tag_suffix, description, io_type, origin, can_id, bit_offset, bit_length, byte_order, active)
VALUES
  (10, 48, 'state_BMS',         'state BMS',         'AI', 'CANBUS', 282, 3,  4, 'BIG_ENDIAN', true),
  (10, 49, 'stateTR_BMS',       'stateTR BMS',       'AI', 'CANBUS', 282, 19, 4, 'BIG_ENDIAN', true),
  (10, 50, 'stateTRIndex_BMS',  'stateTRIndex BMS',  'AI', 'CANBUS', 282, 39, 6, 'BIG_ENDIAN', true),
  (10, 51, 'cntrStateAux1_BMS', 'cntrStateAux1 BMS', 'AI', 'CANBUS', 282, 25, 2, 'BIG_ENDIAN', true),
  (10, 52, 'cntrStateAux2_BMS', 'cntrStateAux2 BMS', 'AI', 'CANBUS', 282, 27, 2, 'BIG_ENDIAN', true),
  (10, 53, 'cntrStateAux3_BMS', 'cntrStateAux3 BMS', 'AI', 'CANBUS', 282, 29, 2, 'BIG_ENDIAN', true),
  (10, 54, 'cntrStateAux4_BMS', 'cntrStateAux4 BMS', 'AI', 'CANBUS', 282, 31, 2, 'BIG_ENDIAN', true);

-- PT_Request (0x11B = 283) missing signals
INSERT INTO component_signal (component_id, channel_offset, tag_suffix, description, io_type, origin, can_id, bit_offset, bit_length, byte_order, active)
VALUES
  (10, 55, 'stateRequest_PT',         'stateRequest PT',         'AO', 'CANBUS', 283, 3,  4,  'BIG_ENDIAN', true),
  (10, 56, 'chargePowerAvailable_PT', 'chargePowerAvailable PT', 'AO', 'CANBUS', 283, 23, 16, 'BIG_ENDIAN', true),
  (10, 57, 'cntrRequestAux1_PT',      'cntrRequestAux1 PT',      'AO', 'CANBUS', 283, 40, 1,  'BIG_ENDIAN', true),
  (10, 58, 'cntrRequestAux2_PT',      'cntrRequestAux2 PT',      'AO', 'CANBUS', 283, 41, 1,  'BIG_ENDIAN', true),
  (10, 59, 'cntrRequestAux3_PT',      'cntrRequestAux3 PT',      'AO', 'CANBUS', 283, 42, 1,  'BIG_ENDIAN', true),
  (10, 60, 'cntrRequestAux4_PT',      'cntrRequestAux4 PT',      'AO', 'CANBUS', 283, 43, 1,  'BIG_ENDIAN', true),
  (10, 61, 'alive_PT',                'alive PT',                'AO', 'CANBUS', 283, 47, 4,  'BIG_ENDIAN', true),
  (10, 62, 'CRC_PT',                  'CRC PT',                  'AO', 'CANBUS', 283, 55, 8,  'BIG_ENDIAN', true);

-- BMS_FluidMeasUserSOC (0x33A = 826) missing signal
INSERT INTO component_signal (component_id, channel_offset, tag_suffix, description, io_type, origin, can_id, bit_offset, bit_length, byte_order, active)
VALUES (10, 63, 'userSOC_BMS', 'userSOC BMS', 'AI', 'CANBUS', 826, 39, 16, 'BIG_ENDIAN', true);

-- SC01_State (0x01F = 31) missing signals
INSERT INTO component_signal (component_id, channel_offset, tag_suffix, description, io_type, origin, can_id, bit_offset, bit_length, byte_order, active)
VALUES
  (10, 64, 'linkVoltage_SC01',      'linkVoltage SC01',      'AI', 'CANBUS', 31, 7,  16, 'BIG_ENDIAN', true),
  (10, 65, 'emergencyRequest_SC01', 'emergencyRequest SC01', 'AI', 'CANBUS', 31, 19, 4,  'BIG_ENDIAN', true);

-- Verify
SELECT COUNT(*) as total, COUNT(can_id) as with_can_id FROM component_signal WHERE component_id=10;
