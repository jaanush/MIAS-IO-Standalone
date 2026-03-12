import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import cantools

db = cantools.database.load_file("C:/onedrive/OneDrive - IT Borgen/Dokument/GitHub/MIAS-IO/docs/debug_PCAN_234601.dbc")

EU = {
    'V': 2, 'A': 3, 'kW': 4, 'kWh': 5, '%': 10, 'A DC': 11,
    'Hz': 14, 'V AC': 19, 'V DC': 20, 'mA': 23, 'mBar': 24, 'mV': 25,
    'kOhm': 26, 'PCT': 10, 'C': 9, 'KWh': 5, 'mbar': 24,
}
NEW_EU = {'mOhm': 'Milliohm', 'km': 'Kilometer', 'As': 'Ampere-second', 'MWh': 'Megawatt-hour'}

comp29_tag_to_offset = {
    'stringStateReq_BMS01_BMS': 0, 'isolationRequest_BMS01_BMS': 1, 'sleepRequest_BMS01_BMS': 2,
    'stringOpenDEMReq_BMS01_BMS': 3, 'current': 4, 'linkVoltage': 5, 'stringState': 6,
    'chargeState': 7, 'faultBitHVIL': 8, 'thermalFaultIndex': 9, 'thermalEventStatus': 10,
    'thermalEventTypeS': 11, 'stringInitStatus': 12, 'stringVoltage': 13, 'chargerCurrentLimit': 14,
    'meanSOC': 15, 'brickOpenCircuitV': 16, 'isolationResExternal': 17, 'isolationResInternal': 18,
    'minSOC': 19, 'maxSOC': 20, 'dchgIntResistance': 21, 'regenIntResistance': 22,
    'energyAvailable': 23, 'minSOH': 24, 'maxSOH': 25, 'minBrickVoltage': 26, 'maxBrickVoltage': 27,
    'minBrickVoltageIndex': 28, 'maxBrickVoltageIndex': 29, 'minModuleTempString': 30,
    'maxModuleTempString': 31, 'minModuleTempIndex': 32, 'maxModuleTempIndex': 33,
    'maxDewPointTemperature': 34, 'meanModuleTemperature': 35, 'minBrickCapacity': 36,
    'maxStringVLimit': 37, 'minStringVLimit': 38, 'regenCurrentLimit': 39, 'dchgCurrentLimit': 40,
    'dchgCurrentPredShrt': 41, 'dchgCurrentPredLong': 42, 'regenCurrentPredShrt': 43,
    'regenCurrentPredLong': 44, 'dchgVoltagePredShrt': 45, 'dchgVoltagePredLong': 46,
    'regenVoltagePredShrt': 47, 'regenVoltagePredLong': 48, 'dchgPowerPredShrt': 49,
    'dchgPowerPredLong': 50, 'regenPowerPredShrt': 51, 'regenPowerPredLong': 52,
    'cusMinCellVLimit': 53, 'cusMaxCellVLimit': 54, 'cntrWeldState': 55, 'cntrState': 56,
    'cntrStatePos2': 57, 'cntrStatePrechg1': 58, 'cntrStateNeg1': 59, 'cntrStatePos1': 60,
    'cntrStateNeg3': 61, 'cntrStatePos3': 62, 'cntrStatePrechg2': 63, 'cntrStateNeg2': 64,
    'stringShutdownTimer': 65, 'stringShutdownTarget': 66, 'chargeEnergyAvailable': 67,
    'cusChrgEnrgyLifeTime': 68, 'cusDschrgEnrgyLifeTime': 69, 'minSOCIndex': 70, 'maxSOCIndex': 71,
    'obdClearFaultMemory': 72, 'obdDTCId': 73, 'obdDTCOdometer': 74, 'obdTestFailed': 75,
    'obdOccurrence': 76, 'energyThroughput_KWh': 77, 'maxFluidPressureInlet': 78,
    'SlowDataMpx': 79, 'SW_VersionBL': 80, 'SW_Version': 81,
    'PackSerialNumber_char15': 82, 'PackSerialNumber_char08': 83, 'PackSerialNumber_char01': 84,
    'PackSerialNumber_char16': 85, 'PackSerialNumber_char09': 86, 'PackSerialNumber_char02': 87,
    'PackSerialNumber_char17': 88, 'PackSerialNumber_char10': 89, 'PackSerialNumber_char03': 90,
    'PackSerialNumber_char18': 91, 'PackSerialNumber_char11': 92, 'PackSerialNumber_char04': 93,
    'PackSerialNumber_char19': 94, 'PackSerialNumber_char12': 95, 'PackSerialNumber_char05': 96,
    'PackSerialNumber_char20': 97, 'PackSerialNumber_char13': 98, 'PackSerialNumber_char06': 99,
    'PackSerialNumber_char14': 100, 'PackSerialNumber_char07': 101,
    'cmbCoolantTemp01': 102, 'cmbCoolantTemp02': 103, 'cmbCoolantTemp03': 104, 'cmbCoolantTemp04': 105,
    'cmbCoolantTemp05': 106, 'cmbCoolantTemp06': 107, 'cmbCoolantTemp07': 108, 'cmbCoolantTemp08': 109,
    'coolantInletTemperature': 110, 'coolantOutletTemperature': 111,
}

def dbc_to_db_tag(name):
    if name.endswith('_BMS01'):
        return name[:-6]
    return name

def infer_raw_type(sig):
    bl = sig.length
    signed = sig.is_signed
    if bl == 1: return 'BOOL'
    if not signed:
        if bl <= 8: return 'BYTE'
        if bl <= 16: return 'UINT'
        if bl <= 32: return 'DWORD'
        return 'LWORD'
    else:
        if bl <= 8: return 'BYTE'
        if bl <= 16: return 'INT'
        if bl <= 32: return 'DINT'
        return 'LINT'

def eu_expr(unit):
    if not unit: return 'NULL'
    eid = EU.get(unit)
    if eid: return str(eid)
    if unit in NEW_EU: return "(SELECT id FROM engineering_unit WHERE symbol='" + unit + "')"
    return 'NULL'

comp29_can_ids = {0, 16, 32, 48, 64, 80, 96, 112, 128, 144, 160, 176, 192, 208, 320, 336, 352, 384, 400, 512, 528}
comp30_can_ids = {368, 369, 768, 769, 771, 772}

lines = [
    "-- ============================================================",
    "-- Debug PCAN components (id=29, id=30) -- scaling, EU, raw types",
    "-- ============================================================",
    "",
    "-- New engineering units",
]
for sym, desc in NEW_EU.items():
    lines.append("INSERT INTO engineering_unit (symbol, description) VALUES ('" + sym + "', '" + desc + "') ON CONFLICT (symbol) DO NOTHING;")
lines.append("")
lines.append("-- Component 29: Kreisel BMS String (Debug PCAN)")

handled29 = set()
for msg in sorted(db.messages, key=lambda m: m.frame_id):
    if msg.frame_id not in comp29_can_ids: continue
    for sig in msg.signals:
        db_tag = dbc_to_db_tag(sig.name)
        offset = comp29_tag_to_offset.get(db_tag) if comp29_tag_to_offset.get(db_tag) is not None else comp29_tag_to_offset.get(sig.name)
        if offset is None:
            print("WARNING: no offset for " + sig.name, file=sys.stderr)
            continue
        if offset in handled29: continue
        handled29.add(offset)
        raw_type = infer_raw_type(sig)
        unit = sig.unit or ''
        mn = sig.minimum
        mx = sig.maximum
        eu = eu_expr(unit)
        MAX_DB = 99999999
        mn_s = str(mn) if mn is not None and abs(mn) <= MAX_DB else 'NULL'
        mx_s = str(mx) if mx is not None and abs(mx) <= MAX_DB else 'NULL'
        lines.append("UPDATE component_signal SET raw_data_type='" + raw_type + "', default_eu_id=" + eu + ", default_scale_min=" + mn_s + ", default_scale_max=" + mx_s + " WHERE component_id=29 AND channel_offset=" + str(offset) + "; -- " + db_tag)

lines.append("")
lines.append("-- Component 30: Kreisel BMS ESS Master (Debug PCAN)")
for msg in sorted(db.messages, key=lambda m: m.frame_id):
    if msg.frame_id not in comp30_can_ids: continue
    for sig in msg.signals:
        raw_type = infer_raw_type(sig)
        unit = sig.unit or ''
        mn = sig.minimum
        mx = sig.maximum
        eu = eu_expr(unit)
        MAX_DB = 99999999
        mn_s = str(mn) if mn is not None and abs(mn) <= MAX_DB else 'NULL'
        mx_s = str(mx) if mx is not None and abs(mx) <= MAX_DB else 'NULL'
        lines.append("UPDATE component_signal SET raw_data_type='" + raw_type + "', default_eu_id=" + eu + ", default_scale_min=" + mn_s + ", default_scale_max=" + mx_s + " WHERE component_id=30 AND tag_suffix='" + sig.name + "';")

sql = '\n'.join(lines) + '\n'
with open("C:/onedrive/OneDrive - IT Borgen/Dokument/GitHub/MIAS-IO/prisma/kreisel_debug_pcan_scaling.sql", "w", encoding="utf-8") as f:
    f.write(sql)
print("Written " + str(len(lines)) + " lines, comp29 handled: " + str(len(handled29)))
