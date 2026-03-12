-- ============================================================
-- Debug PCAN components (id=29, id=30) -- scaling, EU, raw types
-- ============================================================

-- New engineering units
INSERT INTO engineering_unit (symbol, description) VALUES ('mOhm', 'Milliohm') ON CONFLICT (symbol) DO NOTHING;
INSERT INTO engineering_unit (symbol, description) VALUES ('km', 'Kilometer') ON CONFLICT (symbol) DO NOTHING;
INSERT INTO engineering_unit (symbol, description) VALUES ('As', 'Ampere-second') ON CONFLICT (symbol) DO NOTHING;
INSERT INTO engineering_unit (symbol, description) VALUES ('MWh', 'Megawatt-hour') ON CONFLICT (symbol) DO NOTHING;

-- Component 29: Kreisel BMS String (Debug PCAN)
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=29 AND channel_offset=1; -- isolationRequest_BMS01_BMS
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=29 AND channel_offset=0; -- stringStateReq_BMS01_BMS
UPDATE component_signal SET raw_data_type='BOOL', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=29 AND channel_offset=3; -- stringOpenDEMReq_BMS01_BMS
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=29 AND channel_offset=2; -- sleepRequest_BMS01_BMS
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=3, default_scale_min=-3200, default_scale_max=3353.5 WHERE component_id=29 AND channel_offset=4; -- current
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=2, default_scale_min=0, default_scale_max=1200 WHERE component_id=29 AND channel_offset=5; -- linkVoltage
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=15 WHERE component_id=29 AND channel_offset=7; -- chargeState
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=29 AND channel_offset=6; -- stringState
UPDATE component_signal SET raw_data_type='BOOL', default_eu_id=NULL, default_scale_min=0, default_scale_max=1 WHERE component_id=29 AND channel_offset=11; -- thermalEventTypeS
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=2550 WHERE component_id=29 AND channel_offset=10; -- thermalEventStatus
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=7 WHERE component_id=29 AND channel_offset=9; -- thermalFaultIndex
UPDATE component_signal SET raw_data_type='BOOL', default_eu_id=NULL, default_scale_min=0, default_scale_max=1 WHERE component_id=29 AND channel_offset=8; -- faultBitHVIL
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=3 WHERE component_id=29 AND channel_offset=12; -- stringInitStatus
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=2, default_scale_min=0, default_scale_max=1200 WHERE component_id=29 AND channel_offset=13; -- stringVoltage
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=3, default_scale_min=0, default_scale_max=3200 WHERE component_id=29 AND channel_offset=14; -- chargerCurrentLimit
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=10, default_scale_min=0, default_scale_max=100 WHERE component_id=29 AND channel_offset=15; -- meanSOC
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=2, default_scale_min=0, default_scale_max=6.5 WHERE component_id=29 AND channel_offset=16; -- brickOpenCircuitV
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=26, default_scale_min=0, default_scale_max=130000 WHERE component_id=29 AND channel_offset=17; -- isolationResExternal
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=26, default_scale_min=0, default_scale_max=130000 WHERE component_id=29 AND channel_offset=18; -- isolationResInternal
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=10, default_scale_min=0, default_scale_max=100 WHERE component_id=29 AND channel_offset=19; -- minSOC
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=10, default_scale_min=0, default_scale_max=100 WHERE component_id=29 AND channel_offset=20; -- maxSOC
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=(SELECT id FROM engineering_unit WHERE symbol='mOhm'), default_scale_min=0, default_scale_max=3276.75 WHERE component_id=29 AND channel_offset=21; -- dchgIntResistance
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=(SELECT id FROM engineering_unit WHERE symbol='mOhm'), default_scale_min=0, default_scale_max=3276.75 WHERE component_id=29 AND channel_offset=22; -- regenIntResistance
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=5, default_scale_min=0, default_scale_max=650 WHERE component_id=29 AND channel_offset=23; -- energyAvailable
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=10, default_scale_min=0, default_scale_max=120 WHERE component_id=29 AND channel_offset=24; -- minSOH
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=10, default_scale_min=0, default_scale_max=120 WHERE component_id=29 AND channel_offset=25; -- maxSOH
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=2, default_scale_min=0, default_scale_max=6.5 WHERE component_id=29 AND channel_offset=26; -- minBrickVoltage
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=2, default_scale_min=0, default_scale_max=6.5 WHERE component_id=29 AND channel_offset=27; -- maxBrickVoltage
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=NULL, default_scale_min=0, default_scale_max=65535 WHERE component_id=29 AND channel_offset=28; -- minBrickVoltageIndex
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=NULL, default_scale_min=0, default_scale_max=65535 WHERE component_id=29 AND channel_offset=29; -- maxBrickVoltageIndex
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=9, default_scale_min=-40, default_scale_max=87.5 WHERE component_id=29 AND channel_offset=30; -- minModuleTempString
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=9, default_scale_min=-40, default_scale_max=87.5 WHERE component_id=29 AND channel_offset=31; -- maxModuleTempString
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=255 WHERE component_id=29 AND channel_offset=32; -- minModuleTempIndex
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=255 WHERE component_id=29 AND channel_offset=33; -- maxModuleTempIndex
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=9, default_scale_min=-40, default_scale_max=87.5 WHERE component_id=29 AND channel_offset=34; -- maxDewPointTemperature
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=9, default_scale_min=-40, default_scale_max=87.5 WHERE component_id=29 AND channel_offset=35; -- meanModuleTemperature
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=(SELECT id FROM engineering_unit WHERE symbol='As'), default_scale_min=0, default_scale_max=1310700 WHERE component_id=29 AND channel_offset=36; -- minBrickCapacity
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=2, default_scale_min=0, default_scale_max=1200 WHERE component_id=29 AND channel_offset=37; -- maxStringVLimit
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=2, default_scale_min=0, default_scale_max=1200 WHERE component_id=29 AND channel_offset=38; -- minStringVLimit
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=3, default_scale_min=0, default_scale_max=3200 WHERE component_id=29 AND channel_offset=39; -- regenCurrentLimit
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=3, default_scale_min=0, default_scale_max=3200 WHERE component_id=29 AND channel_offset=40; -- dchgCurrentLimit
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=3, default_scale_min=0, default_scale_max=3200 WHERE component_id=29 AND channel_offset=41; -- dchgCurrentPredShrt
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=3, default_scale_min=0, default_scale_max=3200 WHERE component_id=29 AND channel_offset=42; -- dchgCurrentPredLong
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=3, default_scale_min=0, default_scale_max=3200 WHERE component_id=29 AND channel_offset=43; -- regenCurrentPredShrt
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=3, default_scale_min=0, default_scale_max=3200 WHERE component_id=29 AND channel_offset=44; -- regenCurrentPredLong
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=2, default_scale_min=0, default_scale_max=1200 WHERE component_id=29 AND channel_offset=45; -- dchgVoltagePredShrt
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=2, default_scale_min=0, default_scale_max=1200 WHERE component_id=29 AND channel_offset=46; -- dchgVoltagePredLong
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=2, default_scale_min=0, default_scale_max=1200 WHERE component_id=29 AND channel_offset=47; -- regenVoltagePredShrt
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=2, default_scale_min=0, default_scale_max=1200 WHERE component_id=29 AND channel_offset=48; -- regenVoltagePredLong
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=4, default_scale_min=0, default_scale_max=650 WHERE component_id=29 AND channel_offset=49; -- dchgPowerPredShrt
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=4, default_scale_min=0, default_scale_max=650 WHERE component_id=29 AND channel_offset=50; -- dchgPowerPredLong
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=4, default_scale_min=0, default_scale_max=650 WHERE component_id=29 AND channel_offset=51; -- regenPowerPredShrt
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=4, default_scale_min=0, default_scale_max=650 WHERE component_id=29 AND channel_offset=52; -- regenPowerPredLong
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=2, default_scale_min=0, default_scale_max=6.5 WHERE component_id=29 AND channel_offset=53; -- cusMinCellVLimit
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=2, default_scale_min=0, default_scale_max=6.5 WHERE component_id=29 AND channel_offset=54; -- cusMaxCellVLimit
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=29 AND channel_offset=56; -- cntrState
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=29 AND channel_offset=55; -- cntrWeldState
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=29 AND channel_offset=60; -- cntrStatePos1
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=29 AND channel_offset=59; -- cntrStateNeg1
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=29 AND channel_offset=58; -- cntrStatePrechg1
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=29 AND channel_offset=57; -- cntrStatePos2
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=29 AND channel_offset=64; -- cntrStateNeg2
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=29 AND channel_offset=63; -- cntrStatePrechg2
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=29 AND channel_offset=62; -- cntrStatePos3
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=29 AND channel_offset=61; -- cntrStateNeg3
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=29 AND channel_offset=65; -- stringShutdownTimer
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=29 AND channel_offset=66; -- stringShutdownTarget
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=5, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=29 AND channel_offset=67; -- chargeEnergyAvailable
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=(SELECT id FROM engineering_unit WHERE symbol='MWh'), default_scale_min=0, default_scale_max=1310.7 WHERE component_id=29 AND channel_offset=68; -- cusChrgEnrgyLifeTime
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=(SELECT id FROM engineering_unit WHERE symbol='MWh'), default_scale_min=0, default_scale_max=1310.7 WHERE component_id=29 AND channel_offset=69; -- cusDschrgEnrgyLifeTime
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=NULL, default_scale_min=0, default_scale_max=65535 WHERE component_id=29 AND channel_offset=70; -- minSOCIndex
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=NULL, default_scale_min=0, default_scale_max=65535 WHERE component_id=29 AND channel_offset=71; -- maxSOCIndex
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=1 WHERE component_id=29 AND channel_offset=72; -- obdClearFaultMemory
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=255 WHERE component_id=29 AND channel_offset=73; -- obdDTCId
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=(SELECT id FROM engineering_unit WHERE symbol='km'), default_scale_min=0, default_scale_max=65535 WHERE component_id=29 AND channel_offset=74; -- obdDTCOdometer
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=126 WHERE component_id=29 AND channel_offset=76; -- obdOccurrence
UPDATE component_signal SET raw_data_type='BOOL', default_eu_id=NULL, default_scale_min=0, default_scale_max=1 WHERE component_id=29 AND channel_offset=75; -- obdTestFailed
UPDATE component_signal SET raw_data_type='DWORD', default_eu_id=5, default_scale_min=0, default_scale_max=42949672.95 WHERE component_id=29 AND channel_offset=77; -- energyThroughput_KWh
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=24, default_scale_min=0, default_scale_max=2550 WHERE component_id=29 AND channel_offset=78; -- maxFluidPressureInlet
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=255 WHERE component_id=29 AND channel_offset=79; -- SlowDataMpx
UPDATE component_signal SET raw_data_type='DWORD', default_eu_id=NULL, default_scale_min=0, default_scale_max=NULL WHERE component_id=29 AND channel_offset=80; -- SW_VersionBL
UPDATE component_signal SET raw_data_type='DWORD', default_eu_id=NULL, default_scale_min=0, default_scale_max=NULL WHERE component_id=29 AND channel_offset=81; -- SW_Version
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=255 WHERE component_id=29 AND channel_offset=82; -- PackSerialNumber_char15
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=255 WHERE component_id=29 AND channel_offset=83; -- PackSerialNumber_char08
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=255 WHERE component_id=29 AND channel_offset=84; -- PackSerialNumber_char01
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=255 WHERE component_id=29 AND channel_offset=85; -- PackSerialNumber_char16
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=255 WHERE component_id=29 AND channel_offset=86; -- PackSerialNumber_char09
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=255 WHERE component_id=29 AND channel_offset=87; -- PackSerialNumber_char02
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=255 WHERE component_id=29 AND channel_offset=88; -- PackSerialNumber_char17
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=255 WHERE component_id=29 AND channel_offset=89; -- PackSerialNumber_char10
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=255 WHERE component_id=29 AND channel_offset=90; -- PackSerialNumber_char03
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=255 WHERE component_id=29 AND channel_offset=91; -- PackSerialNumber_char18
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=255 WHERE component_id=29 AND channel_offset=92; -- PackSerialNumber_char11
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=255 WHERE component_id=29 AND channel_offset=93; -- PackSerialNumber_char04
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=255 WHERE component_id=29 AND channel_offset=94; -- PackSerialNumber_char19
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=255 WHERE component_id=29 AND channel_offset=95; -- PackSerialNumber_char12
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=255 WHERE component_id=29 AND channel_offset=96; -- PackSerialNumber_char05
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=255 WHERE component_id=29 AND channel_offset=97; -- PackSerialNumber_char20
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=255 WHERE component_id=29 AND channel_offset=98; -- PackSerialNumber_char13
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=255 WHERE component_id=29 AND channel_offset=99; -- PackSerialNumber_char06
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=255 WHERE component_id=29 AND channel_offset=100; -- PackSerialNumber_char14
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=255 WHERE component_id=29 AND channel_offset=101; -- PackSerialNumber_char07
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=9, default_scale_min=-40, default_scale_max=200 WHERE component_id=29 AND channel_offset=102; -- cmbCoolantTemp01
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=9, default_scale_min=-40, default_scale_max=200 WHERE component_id=29 AND channel_offset=103; -- cmbCoolantTemp02
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=9, default_scale_min=-40, default_scale_max=200 WHERE component_id=29 AND channel_offset=104; -- cmbCoolantTemp03
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=9, default_scale_min=-40, default_scale_max=200 WHERE component_id=29 AND channel_offset=105; -- cmbCoolantTemp04
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=9, default_scale_min=-40, default_scale_max=200 WHERE component_id=29 AND channel_offset=106; -- cmbCoolantTemp05
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=9, default_scale_min=-40, default_scale_max=200 WHERE component_id=29 AND channel_offset=107; -- cmbCoolantTemp06
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=9, default_scale_min=-40, default_scale_max=200 WHERE component_id=29 AND channel_offset=108; -- cmbCoolantTemp07
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=9, default_scale_min=-40, default_scale_max=200 WHERE component_id=29 AND channel_offset=109; -- cmbCoolantTemp08
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=9, default_scale_min=-40, default_scale_max=215 WHERE component_id=29 AND channel_offset=110; -- coolantInletTemperature
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=9, default_scale_min=-40, default_scale_max=215 WHERE component_id=29 AND channel_offset=111; -- coolantOutletTemperature

-- Component 30: Kreisel BMS ESS Master (Debug PCAN)
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=30 AND tag_suffix='fktCommand';
UPDATE component_signal SET raw_data_type='DWORD', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=30 AND tag_suffix='fktKey';
UPDATE component_signal SET raw_data_type='DWORD', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=30 AND tag_suffix='fktSeed';
UPDATE component_signal SET raw_data_type='BOOL', default_eu_id=NULL, default_scale_min=0, default_scale_max=1 WHERE component_id=30 AND tag_suffix='essMstrStr15ShouldBeOn_BMS';
UPDATE component_signal SET raw_data_type='BOOL', default_eu_id=NULL, default_scale_min=0, default_scale_max=1 WHERE component_id=30 AND tag_suffix='essMstrStr14ShouldBeOn_BMS';
UPDATE component_signal SET raw_data_type='BOOL', default_eu_id=NULL, default_scale_min=0, default_scale_max=1 WHERE component_id=30 AND tag_suffix='essMstrStr13ShouldBeOn_BMS';
UPDATE component_signal SET raw_data_type='BOOL', default_eu_id=NULL, default_scale_min=0, default_scale_max=1 WHERE component_id=30 AND tag_suffix='essMstrStr12ShouldBeOn_BMS';
UPDATE component_signal SET raw_data_type='BOOL', default_eu_id=NULL, default_scale_min=0, default_scale_max=1 WHERE component_id=30 AND tag_suffix='essMstrStr11ShouldBeOn_BMS';
UPDATE component_signal SET raw_data_type='BOOL', default_eu_id=NULL, default_scale_min=0, default_scale_max=1 WHERE component_id=30 AND tag_suffix='essMstrStr10ShouldBeOn_BMS';
UPDATE component_signal SET raw_data_type='BOOL', default_eu_id=NULL, default_scale_min=0, default_scale_max=1 WHERE component_id=30 AND tag_suffix='essMstrStr09ShouldBeOn_BMS';
UPDATE component_signal SET raw_data_type='BOOL', default_eu_id=NULL, default_scale_min=0, default_scale_max=1 WHERE component_id=30 AND tag_suffix='essMstrStr08ShouldBeOn_BMS';
UPDATE component_signal SET raw_data_type='BOOL', default_eu_id=NULL, default_scale_min=0, default_scale_max=1 WHERE component_id=30 AND tag_suffix='essMstrStr07ShouldBeOn_BMS';
UPDATE component_signal SET raw_data_type='BOOL', default_eu_id=NULL, default_scale_min=0, default_scale_max=1 WHERE component_id=30 AND tag_suffix='essMstrStr06ShouldBeOn_BMS';
UPDATE component_signal SET raw_data_type='BOOL', default_eu_id=NULL, default_scale_min=0, default_scale_max=1 WHERE component_id=30 AND tag_suffix='essMstrStr05ShouldBeOn_BMS';
UPDATE component_signal SET raw_data_type='BOOL', default_eu_id=NULL, default_scale_min=0, default_scale_max=1 WHERE component_id=30 AND tag_suffix='essMstrStr04ShouldBeOn_BMS';
UPDATE component_signal SET raw_data_type='BOOL', default_eu_id=NULL, default_scale_min=0, default_scale_max=1 WHERE component_id=30 AND tag_suffix='essMstrStr03ShouldBeOn_BMS';
UPDATE component_signal SET raw_data_type='BOOL', default_eu_id=NULL, default_scale_min=0, default_scale_max=1 WHERE component_id=30 AND tag_suffix='essMstrStr02ShouldBeOn_BMS';
UPDATE component_signal SET raw_data_type='BOOL', default_eu_id=NULL, default_scale_min=0, default_scale_max=1 WHERE component_id=30 AND tag_suffix='essMstrStr01ShouldBeOn_BMS';
UPDATE component_signal SET raw_data_type='BOOL', default_eu_id=NULL, default_scale_min=0, default_scale_max=1 WHERE component_id=30 AND tag_suffix='essMstrStr00ShouldBeOn_BMS';
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=30 AND tag_suffix='essShutdownTimer_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=30 AND tag_suffix='essShutdownTarget_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=30 AND tag_suffix='essMstrNrOfStringsInPrchg_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=30 AND tag_suffix='essMstrStateRequest_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=30 AND tag_suffix='essMstrState_BMS01';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=30 AND tag_suffix='essMstrOverallChargeState_BMS';
UPDATE component_signal SET raw_data_type='BOOL', default_eu_id=NULL, default_scale_min=0, default_scale_max=1 WHERE component_id=30 AND tag_suffix='essMstrChargeDerateFlag_BMS';
UPDATE component_signal SET raw_data_type='BOOL', default_eu_id=NULL, default_scale_min=0, default_scale_max=1 WHERE component_id=30 AND tag_suffix='essMstrAccInhibit_BMS';
UPDATE component_signal SET raw_data_type='BOOL', default_eu_id=NULL, default_scale_min=0, default_scale_max=1 WHERE component_id=30 AND tag_suffix='essMstrChargeInhibit_BMS';
UPDATE component_signal SET raw_data_type='BOOL', default_eu_id=NULL, default_scale_min=0, default_scale_max=1 WHERE component_id=30 AND tag_suffix='essMstrDriveInhibit_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=15 WHERE component_id=30 AND tag_suffix='essMstrPrechargeState15_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=15 WHERE component_id=30 AND tag_suffix='essMstrPrechargeState14_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=15 WHERE component_id=30 AND tag_suffix='essMstrPrechargeState13_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=15 WHERE component_id=30 AND tag_suffix='essMstrPrechargeState12_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=15 WHERE component_id=30 AND tag_suffix='essMstrPrechargeState11_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=15 WHERE component_id=30 AND tag_suffix='essMstrPrechargeState10_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=15 WHERE component_id=30 AND tag_suffix='essMstrPrechargeState09_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=15 WHERE component_id=30 AND tag_suffix='essMstrPrechargeState08_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=15 WHERE component_id=30 AND tag_suffix='essMstrPrechargeState07_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=15 WHERE component_id=30 AND tag_suffix='essMstrPrechargeState06_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=15 WHERE component_id=30 AND tag_suffix='essMstrPrechargeState05_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=15 WHERE component_id=30 AND tag_suffix='essMstrPrechargeState04_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=15 WHERE component_id=30 AND tag_suffix='essMstrPrechargeState03_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=15 WHERE component_id=30 AND tag_suffix='essMstrPrechargeState02_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=15 WHERE component_id=30 AND tag_suffix='essMstrPrechargeState01_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=15 WHERE component_id=30 AND tag_suffix='essMstrPrechargeState00_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=30 AND tag_suffix='numberOfStrings_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=30 AND tag_suffix='numberOfPacksPerString_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=30 AND tag_suffix='numberOfModulesPerPack_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=30 AND tag_suffix='numberOfCellsPerModule_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=NULL, default_scale_max=NULL WHERE component_id=30 AND tag_suffix='debugChargePIDMpex_BMS01';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=3, default_scale_min=-12.5, default_scale_max=12.5 WHERE component_id=30 AND tag_suffix='PID_loadCurrrentPID_error_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=3, default_scale_min=-12.5, default_scale_max=12.5 WHERE component_id=30 AND tag_suffix='PID_StringCurrrentPID_error_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=2, default_scale_min=-0.5, default_scale_max=0.5 WHERE component_id=30 AND tag_suffix='PID_BrickVPID_error_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=125 WHERE component_id=30 AND tag_suffix='PID_loadCurrrentPID_int_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=125 WHERE component_id=30 AND tag_suffix='PID_StringCurrrentPID_int_BMS';
UPDATE component_signal SET raw_data_type='BYTE', default_eu_id=NULL, default_scale_min=0, default_scale_max=125 WHERE component_id=30 AND tag_suffix='PID_BrickVPID_int_BMS';
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=NULL, default_scale_min=-325, default_scale_max=325 WHERE component_id=30 AND tag_suffix='PID_loadCurrrentPID_out_BMS';
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=NULL, default_scale_min=-325, default_scale_max=325 WHERE component_id=30 AND tag_suffix='PID_StringCurrrentPID_out_BMS';
UPDATE component_signal SET raw_data_type='UINT', default_eu_id=NULL, default_scale_min=-325, default_scale_max=325 WHERE component_id=30 AND tag_suffix='PID_BrickVPID_out_BMS';
