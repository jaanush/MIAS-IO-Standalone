-- =============================================================================
-- Component Signal Register/Index Fix
-- =============================================================================

BEGIN;

-- =============================================================================
-- COMPONENT 7: EST Battery String BMS (Modbus TCP)
-- =============================================================================

-- BusVoltage (channel_offset=0): reg=14, INT, INPUT_REGISTER
UPDATE component_signal SET
    modbus_register_type = 'INPUT_REGISTER',
    modbus_register_offset = 14,
    raw_data_type = 'INT',
    modbus_unit_id = NULL
WHERE component_id = 7 AND channel_offset = 0;

-- StringAverageCellTemperature (channel_offset=3): reg=9, BYTE
UPDATE component_signal SET
    modbus_register_type = 'INPUT_REGISTER',
    modbus_register_offset = 9,
    raw_data_type = 'BYTE',
    modbus_unit_id = NULL
WHERE component_id = 7 AND channel_offset = 3;

-- StringAverageCellVoltage (channel_offset=4): reg=6, WORD
UPDATE component_signal SET
    modbus_register_type = 'INPUT_REGISTER',
    modbus_register_offset = 6,
    raw_data_type = 'WORD',
    modbus_unit_id = NULL
WHERE component_id = 7 AND channel_offset = 4;

-- StringCurrent (channel_offset=5): reg=12, INT
UPDATE component_signal SET
    modbus_register_type = 'INPUT_REGISTER',
    modbus_register_offset = 12,
    raw_data_type = 'INT',
    modbus_unit_id = NULL
WHERE component_id = 7 AND channel_offset = 5;

-- StringMaxCellTemperature (channel_offset=6): reg=8, BYTE
UPDATE component_signal SET
    modbus_register_type = 'INPUT_REGISTER',
    modbus_register_offset = 8,
    raw_data_type = 'BYTE',
    modbus_unit_id = NULL
WHERE component_id = 7 AND channel_offset = 6;

-- StringMaxCellVoltage (channel_offset=7): reg=5, WORD
UPDATE component_signal SET
    modbus_register_type = 'INPUT_REGISTER',
    modbus_register_offset = 5,
    raw_data_type = 'WORD',
    modbus_unit_id = NULL
WHERE component_id = 7 AND channel_offset = 7;

-- StringMaxcharge (channel_offset=8): reg=3, INT
UPDATE component_signal SET
    modbus_register_type = 'INPUT_REGISTER',
    modbus_register_offset = 3,
    raw_data_type = 'INT',
    modbus_unit_id = NULL
WHERE component_id = 7 AND channel_offset = 8;

-- StringMaxdischarge (channel_offset=9): reg=2, INT
UPDATE component_signal SET
    modbus_register_type = 'INPUT_REGISTER',
    modbus_register_offset = 2,
    raw_data_type = 'INT',
    modbus_unit_id = NULL
WHERE component_id = 7 AND channel_offset = 9;

-- StringMinCellTemperature (channel_offset=10): reg=7, BYTE
UPDATE component_signal SET
    modbus_register_type = 'INPUT_REGISTER',
    modbus_register_offset = 7,
    raw_data_type = 'BYTE',
    modbus_unit_id = NULL
WHERE component_id = 7 AND channel_offset = 10;

-- StringMinCellVoltage (channel_offset=11): reg=4, WORD
UPDATE component_signal SET
    modbus_register_type = 'INPUT_REGISTER',
    modbus_register_offset = 4,
    raw_data_type = 'WORD',
    modbus_unit_id = NULL
WHERE component_id = 7 AND channel_offset = 11;

-- StringState (channel_offset=12): reg=0, BYTE
UPDATE component_signal SET
    modbus_register_type = 'INPUT_REGISTER',
    modbus_register_offset = 0,
    raw_data_type = 'BYTE',
    modbus_unit_id = NULL
WHERE component_id = 7 AND channel_offset = 12;

-- StringStateOfCharge (channel_offset=13): reg=10, WORD
UPDATE component_signal SET
    modbus_register_type = 'INPUT_REGISTER',
    modbus_register_offset = 10,
    raw_data_type = 'WORD',
    modbus_unit_id = NULL
WHERE component_id = 7 AND channel_offset = 13;

-- StringStateOfHealth (channel_offset=14): reg=11, WORD
UPDATE component_signal SET
    modbus_register_type = 'INPUT_REGISTER',
    modbus_register_offset = 11,
    raw_data_type = 'WORD',
    modbus_unit_id = NULL
WHERE component_id = 7 AND channel_offset = 14;

-- StringStatus (channel_offset=15): reg=1, WORD
UPDATE component_signal SET
    modbus_register_type = 'INPUT_REGISTER',
    modbus_register_offset = 1,
    raw_data_type = 'WORD',
    modbus_unit_id = NULL
WHERE component_id = 7 AND channel_offset = 15;

-- StringVoltage (channel_offset=16): reg=13, INT
UPDATE component_signal SET
    modbus_register_type = 'INPUT_REGISTER',
    modbus_register_offset = 13,
    raw_data_type = 'INT',
    modbus_unit_id = NULL
WHERE component_id = 7 AND channel_offset = 16;

-- StringCtrlEmergencyStop (channel_offset=17): reg=19, BOOL (bit from word)
UPDATE component_signal SET
    modbus_register_type = 'INPUT_REGISTER',
    modbus_register_offset = 19,
    raw_data_type = 'BOOL',
    modbus_unit_id = NULL
WHERE component_id = 7 AND channel_offset = 17;

-- StringCtrlHVILFeedback (channel_offset=18): reg=19, BOOL (bit from word)
UPDATE component_signal SET
    modbus_register_type = 'INPUT_REGISTER',
    modbus_register_offset = 19,
    raw_data_type = 'BOOL',
    modbus_unit_id = NULL
WHERE component_id = 7 AND channel_offset = 18;

-- StringCtrlAlarmFlags (channel_offset=19): reg=17, UDINT
UPDATE component_signal SET
    modbus_register_type = 'INPUT_REGISTER',
    modbus_register_offset = 17,
    raw_data_type = 'UDINT',
    modbus_unit_id = NULL
WHERE component_id = 7 AND channel_offset = 19;

-- StringCtrlErrorCode (channel_offset=20): reg=15, UDINT
UPDATE component_signal SET
    modbus_register_type = 'INPUT_REGISTER',
    modbus_register_offset = 15,
    raw_data_type = 'UDINT',
    modbus_unit_id = NULL
WHERE component_id = 7 AND channel_offset = 20;

-- StringCtrlState (channel_offset=21): reg=1000, BYTE
UPDATE component_signal SET
    modbus_register_type = 'INPUT_REGISTER',
    modbus_register_offset = 1000,
    raw_data_type = 'BYTE',
    modbus_unit_id = NULL
WHERE component_id = 7 AND channel_offset = 21;

-- Fault (channel_offset=2): reg=15, INPUT_REGISTER, raw_data_type=UDINT
-- (derived from error code word, keep origin=MODBUS_TCP)
UPDATE component_signal SET
    modbus_register_type = 'INPUT_REGISTER',
    modbus_register_offset = 15,
    raw_data_type = 'UDINT',
    modbus_unit_id = NULL
WHERE component_id = 7 AND channel_offset = 2;

-- Add missing BMS signals (active=false), starting at channel_offset=53
-- StringCtrlFPGAStatus: reg=1001, BYTE, INPUT_REGISTER
INSERT INTO component_signal (component_id, channel_offset, tag_suffix, description, origin, io_type, raw_data_type, modbus_register_type, modbus_register_offset, modbus_unit_id, active)
VALUES (7, 53, 'StringCtrlFPGAStatus', 'SC FPGA status (bitmapped)', 'MODBUS_TCP', 'AI', 'BYTE', 'INPUT_REGISTER', 1001, NULL, false);

-- StringCtrlSafetySignals: reg=19, BYTE, INPUT_REGISTER
INSERT INTO component_signal (component_id, channel_offset, tag_suffix, description, origin, io_type, raw_data_type, modbus_register_type, modbus_register_offset, modbus_unit_id, active)
VALUES (7, 54, 'StringCtrlSafetySignals', 'SC safety signals (bitmapped: HVIL, FailSafe, EMS)', 'MODBUS_TCP', 'AI', 'BYTE', 'INPUT_REGISTER', 19, NULL, false);

-- StringCtrlCMVoltage: reg=1006, DINT, INPUT_REGISTER
INSERT INTO component_signal (component_id, channel_offset, tag_suffix, description, origin, io_type, raw_data_type, modbus_register_type, modbus_register_offset, modbus_unit_id, active)
VALUES (7, 55, 'StringCtrlCMVoltage', 'SC common mode voltage (mV)', 'MODBUS_TCP', 'AI', 'DINT', 'INPUT_REGISTER', 1006, NULL, false);

-- StringCtrlOnOffTime: reg=1004, BYTE, INPUT_REGISTER
INSERT INTO component_signal (component_id, channel_offset, tag_suffix, description, origin, io_type, raw_data_type, modbus_register_type, modbus_register_offset, modbus_unit_id, active)
VALUES (7, 56, 'StringCtrlOnOffTime', 'Time since last on/off command (0.1s)', 'MODBUS_TCP', 'AI', 'BYTE', 'INPUT_REGISTER', 1004, NULL, false);


-- =============================================================================
-- COMPONENT 4: Editron FW11 MC (CANopen)
-- =============================================================================

-- ControlMode (channel_offset=0): 0x2300=8960
UPDATE component_signal SET canopen_index=8960, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=0;

-- CurrentARMS (channel_offset=1): 0x2394=9108
UPDATE component_signal SET canopen_index=9108, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=1;

-- DCCurrent (channel_offset=3): 0x2395=9109
UPDATE component_signal SET canopen_index=9109, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=3;

-- DCVoltage (channel_offset=4): 0x2392=9106
UPDATE component_signal SET canopen_index=9106, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=4;

-- FrequencyReferenceHz (channel_offset=6): 0x2314=8980
UPDATE component_signal SET canopen_index=8980, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=6;

-- MCLimitWord (channel_offset=7): 0x2382=9090
UPDATE component_signal SET canopen_index=9090, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=7;

-- MCStatusWord (channel_offset=8): 0x2381=9089
UPDATE component_signal SET canopen_index=9089, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=8;

-- MechanicalPower (channel_offset=9): 0x2393=9107
UPDATE component_signal SET canopen_index=9107, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=9;

-- PowerLimitMax (channel_offset=12): 0x2328=9000
UPDATE component_signal SET canopen_index=9000, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=12;

-- PowerLimitMin (channel_offset=13): 0x2329=9001
UPDATE component_signal SET canopen_index=9001, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=13;

-- PowerReferenceKW (channel_offset=14): 0x2313=8979
UPDATE component_signal SET canopen_index=8979, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=14;

-- ResetFaults (channel_offset=17): 0x2000=8192
UPDATE component_signal SET canopen_index=8192, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=17;

-- RunCommand (channel_offset=18): 0x2301=8961
UPDATE component_signal SET canopen_index=8961, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=18;

-- SpeedActualRPM (channel_offset=19): 0x2390=9104
UPDATE component_signal SET canopen_index=9104, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=19;

-- SpeedControllerKP (channel_offset=21): 0x2330=9008
UPDATE component_signal SET canopen_index=9008, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=21;

-- SpeedControllerRampTime (channel_offset=22): 0x2332=9010
UPDATE component_signal SET canopen_index=9010, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=22;

-- SpeedControllerTI (channel_offset=23): 0x2331=9009
UPDATE component_signal SET canopen_index=9009, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=23;

-- SpeedLimitMax (channel_offset=25): 0x2320=8992
UPDATE component_signal SET canopen_index=8992, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=25;

-- SpeedLimitMin (channel_offset=26): 0x2321=8993
UPDATE component_signal SET canopen_index=8993, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=26;

-- SpeedReferenceRPM (channel_offset=27): 0x2310=8976
UPDATE component_signal SET canopen_index=8976, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=27;

-- TorqueActualNM (channel_offset=28): 0x2391=9105
UPDATE component_signal SET canopen_index=9105, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=28;

-- TorqueLimitNMMax (channel_offset=30): 0x2322=8994
UPDATE component_signal SET canopen_index=8994, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=30;

-- TorqueLimitNMMin (channel_offset=31): 0x2323=8995
UPDATE component_signal SET canopen_index=8995, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=31;

-- TorqueReferenceNM (channel_offset=32): 0x2311=8977
UPDATE component_signal SET canopen_index=8977, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=32;

-- VoltageControllerRampTime (channel_offset=33): 0x2340=9024
UPDATE component_signal SET canopen_index=9024, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=33;

-- VoltageReferenceV (channel_offset=34): 0x2312=8978
UPDATE component_signal SET canopen_index=8978, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=34;

-- FaultWord1 (channel_offset=37): 0x20A0=8352
UPDATE component_signal SET canopen_index=8352, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=37;

-- FaultWord2 (channel_offset=38): 0x20A1=8353
UPDATE component_signal SET canopen_index=8353, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=38;

-- JunctionTempHighest (channel_offset=39): 0x2090=8336
UPDATE component_signal SET canopen_index=8336, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=39;

-- PT100CH1 (channel_offset=40): 0x2093=8339
UPDATE component_signal SET canopen_index=8339, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=40;

-- PT100CH2 (channel_offset=41): 0x2094=8340
UPDATE component_signal SET canopen_index=8340, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=41;

-- PT100CH3 (channel_offset=42): 0x2095=8341
UPDATE component_signal SET canopen_index=8341, canopen_sub_index=0 WHERE component_id=4 AND channel_offset=42;

-- Add missing MC signals (active=false), starting at channel_offset=50
INSERT INTO component_signal (component_id, channel_offset, tag_suffix, description, origin, io_type, raw_data_type, canopen_index, canopen_sub_index, active)
VALUES
    (4, 50, 'MotorVoltage',         'Motor voltage (0.1V)',                                                          'CANOPEN', 'AI', 'INT',  9110, 0, false),
    (4, 51, 'MotorFrequency',       'Motor frequency (0.1Hz)',                                                       'CANOPEN', 'AI', 'INT',  9111, 0, false),
    (4, 52, 'MCFaultWord',          'Motor control fault word',                                                      'CANOPEN', 'AI', 'WORD', 9120, 0, false),
    (4, 53, 'MCLimitErrorWord',     'Motor control limit error word',                                                'CANOPEN', 'AI', 'WORD', 9128, 0, false),
    (4, 54, 'ActiveControlMode',    'Active control mode (0=Speed,1=Torque,2=DCLinkVolt,4=Power,7=Freq,9=Position)', 'CANOPEN', 'AI', 'BYTE', 9092, 0, false),
    (4, 55, 'PT100CH4',             'PT100 temperature channel 4',                                                   'CANOPEN', 'AI', 'INT',  8342, 0, false),
    (4, 56, 'PT100CH5',             'PT100 temperature channel 5',                                                   'CANOPEN', 'AI', 'INT',  8343, 0, false),
    (4, 57, 'SystemStatusWord',     'System status word (Running/Fault/Warning)',                                    'CANOPEN', 'AI', 'BYTE', 8320, 0, false),
    (4, 58, 'SystemAppActiveCmd',   'System app active command config',                                              'CANOPEN', 'AI', 'BYTE', 8327, 0, false),
    (4, 59, 'ControlSwitchStatus',  'Control switch status (0-3=selected, 254=Error, 255=N/A)',                     'CANOPEN', 'AI', 'BYTE', 8323, 0, false),
    (4, 60, 'DCLinkVoltageRef',     'DC link voltage reference (0.1V)',                                              'CANOPEN', 'AO', 'WORD', 8978, 0, false),
    (4, 61, 'DCLinkOVFullLimit',    'DC link overvoltage protection, full limit (0.1V)',                             'CANOPEN', 'AO', 'WORD', 8996, 0, false),
    (4, 62, 'DCLinkOVBeginLimit',   'DC link overvoltage protection, begin limit (0.1V)',                           'CANOPEN', 'AO', 'WORD', 8997, 0, false),
    (4, 63, 'DCLinkUVBeginLimit',   'DC link undervoltage protection, begin limit (0.1V)',                          'CANOPEN', 'AO', 'WORD', 8998, 0, false),
    (4, 64, 'DCLinkUVFullLimit',    'DC link undervoltage protection, full limit (0.1V)',                           'CANOPEN', 'AO', 'WORD', 8999, 0, false);


-- =============================================================================
-- COMPONENT 3: Editron FW11 DCDC (CANopen)
-- =============================================================================

-- AvailableCurrentBoostA (channel_offset=0): 0x2492=9362 (HV current LV->HV)
UPDATE component_signal SET canopen_index=9362, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=0;

-- AvailableCurrentBuckA (channel_offset=1): 0x2493=9363 (LV current HV->LV)
UPDATE component_signal SET canopen_index=9363, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=1;

-- ControlMode (channel_offset=6): 0x2400=9216
UPDATE component_signal SET canopen_index=9216, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=6;

-- CurrentLimBoostA (channel_offset=7): 0x2425=9253
UPDATE component_signal SET canopen_index=9253, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=7;

-- CurrentLimBuckA (channel_offset=8): 0x2424=9252
UPDATE component_signal SET canopen_index=9252, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=8;

-- CurrentRefLVA (channel_offset=9): 0x2413=9235
UPDATE component_signal SET canopen_index=9235, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=9;

-- DCCurrent (channel_offset=10): 0x2492=9362
UPDATE component_signal SET canopen_index=9362, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=10;

-- DCVoltage (channel_offset=11): 0x2490=9360
UPDATE component_signal SET canopen_index=9360, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=11;

-- FaultWord1 (channel_offset=15): 0x20A0=8352
UPDATE component_signal SET canopen_index=8352, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=15;

-- FaultWord2 (channel_offset=16): 0x20A1=8353
UPDATE component_signal SET canopen_index=8353, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=16;

-- HVOVCBeginLimitationVDC (channel_offset=17): 0x2427=9255
UPDATE component_signal SET canopen_index=9255, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=17;

-- HVOVCFullLimitationVDC (channel_offset=18): 0x2426=9254
UPDATE component_signal SET canopen_index=9254, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=18;

-- HVUVCBeginLimitationVDC (channel_offset=21): 0x2428=9256
UPDATE component_signal SET canopen_index=9256, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=21;

-- HVUVCFullLimitationVDC (channel_offset=22): 0x2429=9257
UPDATE component_signal SET canopen_index=9257, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=22;

-- JunctionTempHighest (channel_offset=23): 0x2090=8336
UPDATE component_signal SET canopen_index=8336, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=23;

-- DCDCLimitWord (channel_offset=24): 0x2482=9346
UPDATE component_signal SET canopen_index=9346, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=24;

-- LVLinkCurrent (channel_offset=25): 0x2493=9363
UPDATE component_signal SET canopen_index=9363, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=25;

-- LVLinkVoltage (channel_offset=26): 0x2491=9361
UPDATE component_signal SET canopen_index=9361, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=26;

-- LVOVCBeginLimitationVDC (channel_offset=27): 0x242B=9259
UPDATE component_signal SET canopen_index=9259, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=27;

-- LVOVCFullLimitationVDC (channel_offset=28): 0x242A=9258
UPDATE component_signal SET canopen_index=9258, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=28;

-- LVUVCBeginLimitationVDC (channel_offset=31): 0x242C=9260
UPDATE component_signal SET canopen_index=9260, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=31;

-- LVUVCFullLimitationVDC (channel_offset=32): 0x242D=9261
UPDATE component_signal SET canopen_index=9261, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=32;

-- PowerDC (channel_offset=35): 0x2494=9364
UPDATE component_signal SET canopen_index=9364, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=35;

-- PowerLimBoostKW (channel_offset=36): 0x2421=9249
UPDATE component_signal SET canopen_index=9249, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=36;

-- PowerLimBuckKW (channel_offset=37): 0x2420=9248
UPDATE component_signal SET canopen_index=9248, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=37;

-- PowerRefKW (channel_offset=38): 0x2414=9236
UPDATE component_signal SET canopen_index=9236, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=38;

-- PT100CH1 (channel_offset=40): 0x2093=8339
UPDATE component_signal SET canopen_index=8339, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=40;

-- PT100CH2 (channel_offset=41): 0x2094=8340
UPDATE component_signal SET canopen_index=8340, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=41;

-- PT100CH3 (channel_offset=42): 0x2095=8341
UPDATE component_signal SET canopen_index=8341, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=42;

-- ResetFaults (channel_offset=43): 0x2000=8192
UPDATE component_signal SET canopen_index=8192, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=43;

-- RunCommand (channel_offset=44): 0x2401=9217
UPDATE component_signal SET canopen_index=9217, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=44;

-- DCDCStatusWord (channel_offset=46): 0x2480=9344
UPDATE component_signal SET canopen_index=9344, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=46;

-- VoltageRefHVVDC (channel_offset=48): 0x2410=9232
UPDATE component_signal SET canopen_index=9232, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=48;

-- VoltageRefLVVDC (channel_offset=49): 0x2411=9233
UPDATE component_signal SET canopen_index=9233, canopen_sub_index=0 WHERE component_id=3 AND channel_offset=49;

-- Add missing DCDC signals (active=false), starting at channel_offset=55
INSERT INTO component_signal (component_id, channel_offset, tag_suffix, description, origin, io_type, raw_data_type, canopen_index, canopen_sub_index, active)
VALUES
    (3, 55, 'DCDCAppActiveCmd',          'App active command config',           'CANOPEN', 'AI', 'BYTE', 9351, 0, false),
    (3, 56, 'SystemStatusWord',          'System status word',                  'CANOPEN', 'AI', 'BYTE', 8320, 0, false),
    (3, 57, 'PT100CH4',                  'PT100 temperature channel 4',         'CANOPEN', 'AI', 'INT',  8342, 0, false),
    (3, 58, 'PT100CH5',                  'PT100 temperature channel 5',         'CANOPEN', 'AI', 'INT',  8343, 0, false),
    (3, 59, 'DCDCControlFaultWord',      'Control fault word',                  'CANOPEN', 'AI', 'WORD', 9392, 0, false),
    (3, 60, 'DCDCControlLimitErrorWord', 'Control limit error word',            'CANOPEN', 'AI', 'WORD', 9400, 0, false),
    (3, 61, 'SystemAppCmd',              'System application command word',     'CANOPEN', 'AO', 'BYTE', 8200, 0, false),
    (3, 62, 'AppCommandWord',            'Application command word',            'CANOPEN', 'AO', 'BYTE', 9218, 0, false);


-- =============================================================================
-- COMPONENT 5: Editron FW11 uG AFE (CANopen)
-- =============================================================================
-- Current signals (from query): channel_offsets 0-49
-- AFE-specific indices:
--   0x2600=9728  AFE ControlMode
--   0x2601=9729  AFE RunCommand / Control command word
--   0x2602=9730  AFE AppCommandWord
--   0x2610=9744  AFE DCLinkVoltageReference
--   0x2611=9745  AFE PowerReference
--   0x2612=9746  AFE ReactivePowerReference
--   0x2620=9760  AFE PowerLimitMin
--   0x2621=9761  AFE PowerLimitMax
--   0x2622=9762  AFE DCLinkCurrentLimitMin
--   0x2623=9763  AFE DCLinkCurrentLimitMax (not currently in table)
--   0x2681=9857  AFE StatusWord (AFEStatusWord)
--   0x2687=9863  AFE AppActiveCmd config
--   0x2690=9872  AFE GridFrequency
--   0x2691=9873  AFE GridVoltageRMS
--   0x2692=9874  AFE GridPower
--   0x2693=9875  AFE GridReactivePower
--   0x2694=9876  AFE DCLinkVoltage
--   0x2695=9877  AFE DCLinkCurrent (not currently in table)
-- uGrid (microgrid):
--   0x2700=9984  uGrid ControlMode
--   0x2701=9985  uGrid RunCommand
--   0x2702=9986  uGrid AppCommandWord (not currently in table)
--   0x2710=10000 uGrid VoltageReference
--   0x2711=10001 uGrid PowerReference
--   0x2712=10002 uGrid ReactivePowerReference (not currently in table)
--   0x2780=10112 uGrid StatusWord
--   0x2782=10114 uGrid LimitWord
--   0x2787=10119 uGrid AppActiveCmd config (not currently in table)
--   0x2790=10128 uGrid GridFrequency
--   0x2791=10129 uGrid GridCurrentRMS (not currently in table)
--   0x2792=10130 uGrid GridPower
--   0x2793=10131 uGrid GridReactivePower
--   0x2794=10132 uGrid GridVoltageRMS
--   0x2795=10133 uGrid ApparentPower
--   0x27A0=10144 uGrid OutputFrequency
--   0x27A1=10145 uGrid SoftstartActive
--   0x27A2=10146 uGrid Running (MicrogridRunning)
--   0x27A3=10147 uGrid SoftStart command
-- Common:
--   0x2090=8336  JunctionTempHighest
--   0x2093=8339  PT100CH1
--   0x2094=8340  PT100CH2
--   0x2095=8341  PT100CH3
--   0x20A0=8352  FaultWord1
--   0x20A1=8353  FaultWord2
--   0x2000=8192  ResetFaults
--   0x2080=8320  SystemStatusWord
--   0x2087=8327  SystemAppActiveCmd
--   0x2083=8323  ControlSwitchStatus

-- Map existing AFE signals:
-- channel_offset=0: Warning → INTERNAL/derived → leave NULL
-- channel_offset=1: RunCommand → 0x2701=9985 (uGrid run command)
UPDATE component_signal SET canopen_index=9985, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=1;

-- channel_offset=2: ResetFaults → 0x2000=8192
UPDATE component_signal SET canopen_index=8192, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=2;

-- channel_offset=3: PT100CH3 → 0x2095=8341
UPDATE component_signal SET canopen_index=8341, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=3;

-- channel_offset=4: PT100CH2 → 0x2094=8340
UPDATE component_signal SET canopen_index=8340, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=4;

-- channel_offset=5: PT100CH1 → 0x2093=8339
UPDATE component_signal SET canopen_index=8339, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=5;

-- channel_offset=6: MicrogridVoltageRMS → 0x2794=10132
UPDATE component_signal SET canopen_index=10132, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=6;

-- channel_offset=7: MicrogridVoltageReferenceV → 0x2710=10000
UPDATE component_signal SET canopen_index=10000, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=7;

-- channel_offset=8: MicrogridStatusWord → 0x2780=10112
UPDATE component_signal SET canopen_index=10112, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=8;

-- channel_offset=9: MicrogridSoftstartActive → 0x27A1=10145
UPDATE component_signal SET canopen_index=10145, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=9;

-- channel_offset=10: MicrogridSoftStart → 0x27A3=10147
UPDATE component_signal SET canopen_index=10147, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=10;

-- channel_offset=11: MicrogridRunning → 0x27A2=10146
UPDATE component_signal SET canopen_index=10146, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=11;

-- channel_offset=12: MicrogridReactivePower → 0x2793=10131
UPDATE component_signal SET canopen_index=10131, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=12;

-- channel_offset=13: MicrogridPowerReference → 0x2711=10001
UPDATE component_signal SET canopen_index=10001, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=13;

-- channel_offset=14: MicrogridPowerFactor → no direct index in AFE/uGrid spec; leave NULL
-- channel_offset=15: MicrogridPower → 0x2792=10130
UPDATE component_signal SET canopen_index=10130, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=15;

-- channel_offset=16: MicrogridOutputFrequency → 0x27A0=10144
UPDATE component_signal SET canopen_index=10144, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=16;

-- channel_offset=17: MicrogridLimitWord → 0x2782=10114
UPDATE component_signal SET canopen_index=10114, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=17;

-- channel_offset=18: MicrogridFrequencyReferenceHz → 0x2712=10002
UPDATE component_signal SET canopen_index=10002, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=18;

-- channel_offset=19: MicrogridCurrentRMS → 0x2791=10129
UPDATE component_signal SET canopen_index=10129, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=19;

-- channel_offset=20: MicrogridControlMode → 0x2700=9984
UPDATE component_signal SET canopen_index=9984, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=20;

-- channel_offset=21: MicrogridApparentPower → 0x2795=10133
UPDATE component_signal SET canopen_index=10133, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=21;

-- channel_offset=22: MicrogridAFESelection → no direct uGrid spec index; leave NULL

-- channel_offset=23: JunctionTempHighest → 0x2090=8336
UPDATE component_signal SET canopen_index=8336, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=23;

-- channel_offset=24: FaultWord2 → 0x20A1=8353
UPDATE component_signal SET canopen_index=8353, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=24;

-- channel_offset=25: FaultWord1 → 0x20A0=8352
UPDATE component_signal SET canopen_index=8352, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=25;

-- channel_offset=26: Fault → INTERNAL/derived → leave NULL
-- channel_offset=27: Enable → command, leave NULL (no specific CANopen obj in AFE enable)
-- channel_offset=28: EmStop → INTERNAL/derived → leave NULL

-- channel_offset=29: DCVoltage → 0x2694=9876 (AFE DC link voltage)
UPDATE component_signal SET canopen_index=9876, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=29;

-- channel_offset=30: DCCurrent → 0x2695=9877 (AFE DC link current)
UPDATE component_signal SET canopen_index=9877, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=30;

-- channel_offset=31: CurrentLimit → INTERNAL/derived → leave NULL

-- channel_offset=32: AFEStatusWord → 0x2681=9857
UPDATE component_signal SET canopen_index=9857, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=32;

-- channel_offset=33: AFERunning → INTERNAL/derived → leave NULL

-- channel_offset=34: AFEReactivePowerReference → 0x2612=9746
UPDATE component_signal SET canopen_index=9746, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=34;

-- channel_offset=35: AFEPowerReference → 0x2611=9745
UPDATE component_signal SET canopen_index=9745, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=35;

-- channel_offset=36: AFEPowerLimitMin → 0x2620=9760
UPDATE component_signal SET canopen_index=9760, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=36;

-- channel_offset=37: AFEPowerLimitMax → 0x2621=9761
UPDATE component_signal SET canopen_index=9761, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=37;

-- channel_offset=38: AFEPowerLimit → INTERNAL/derived → leave NULL

-- channel_offset=39: AFELimitWord → 0x2682=9858 (AFE limit word, not in original list but standard)
-- Actually use 0x2682 if it exists; per spec use NULL if not confirmed
-- Leave NULL for now — not in provided reference list

-- channel_offset=40: AFEGridVoltageRMS → 0x2691=9873
UPDATE component_signal SET canopen_index=9873, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=40;

-- channel_offset=41: AFEGridReactivePower → 0x2693=9875
UPDATE component_signal SET canopen_index=9875, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=41;

-- channel_offset=42: AFEGridPower → 0x2692=9874
UPDATE component_signal SET canopen_index=9874, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=42;

-- channel_offset=43: AFEGridFrequency → 0x2690=9872
UPDATE component_signal SET canopen_index=9872, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=43;

-- channel_offset=44: AFEDCLinkVoltageReference → 0x2610=9744
UPDATE component_signal SET canopen_index=9744, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=44;

-- channel_offset=45: AFEDCLinkCurrentLimitMin → 0x2622=9762
UPDATE component_signal SET canopen_index=9762, canopen_sub_index=0 WHERE component_id=5 AND channel_offset=45;

-- INTERNAL signals (46-49): StartStopMode, RunningHours, Interlock, CommunicationFault → leave NULL

-- Add missing AFE signals (active=false), starting at channel_offset=50
INSERT INTO component_signal (component_id, channel_offset, tag_suffix, description, origin, io_type, raw_data_type, canopen_index, canopen_sub_index, active)
VALUES
    (5, 50, 'AFEControlMode',           'AFE control mode',                              'CANOPEN', 'AO', 'WORD', 9728,  0, false),
    (5, 51, 'AFERunCommand',            'AFE control command word',                      'CANOPEN', 'DO', 'BOOL', 9729,  0, false),
    (5, 52, 'AFEDCLinkCurrentLimitMax', 'AFE DC link current limit max (1A)',            'CANOPEN', 'AO', 'INT',  9763,  0, false),
    (5, 53, 'AFEDCLinkCurrent',         'AFE DC link current (1A)',                      'CANOPEN', 'AI', 'INT',  9877,  0, false),
    (5, 54, 'AFEAppActiveCmd',          'AFE app active command config',                 'CANOPEN', 'AI', 'BYTE', 9863,  0, false),
    (5, 55, 'SystemStatusWord',         'System status word (Running/Fault/Warning)',    'CANOPEN', 'AI', 'BYTE', 8320,  0, false),
    (5, 56, 'SystemAppActiveCmd',       'System app active command config',              'CANOPEN', 'AI', 'BYTE', 8327,  0, false),
    (5, 57, 'ControlSwitchStatus',      'Control switch status (0-3=selected, 254=Error, 255=N/A)', 'CANOPEN', 'AI', 'BYTE', 8323, 0, false),
    (5, 58, 'MicrogridAppActiveCmd',    'Microgrid app active command config',           'CANOPEN', 'AI', 'BYTE', 10119, 0, false),
    (5, 59, 'PT100CH4',                 'PT100 temperature channel 4',                   'CANOPEN', 'AI', 'INT',  8342,  0, false),
    (5, 60, 'PT100CH5',                 'PT100 temperature channel 5',                   'CANOPEN', 'AI', 'INT',  8343,  0, false);

COMMIT;

-- =============================================================================
-- VERIFICATION
-- =============================================================================
SELECT component_id, COUNT(*) as total_signals,
       COUNT(CASE WHEN active THEN 1 END) as active_signals,
       COUNT(CASE WHEN NOT active THEN 1 END) as inactive_signals
FROM component_signal
WHERE component_id IN (3,4,5,7)
GROUP BY component_id ORDER BY component_id;
