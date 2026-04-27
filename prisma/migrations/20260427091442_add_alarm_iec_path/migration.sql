-- FR-011: per-alarm IEC path (Option A).
--
-- Each discrete_alarm and analog_alarm row gets an optional iec_alarm_path
-- column carrying the fully-qualified IEC expression for that alarm's
-- triggered-state var/bit. Plugin populates during codegen via the
-- existing POST /api/codesys/project/:id/iec-paths endpoint (extended
-- to accept alarm entries alongside signal entries).
--
-- For analog alarms, each row covers one condition (HH/H/L/LL) so the
-- path points at THAT condition's bit (e.g. "...fbAlarm_T101.HH"). For
-- discrete alarms, the path is the alarm bit/var directly.

ALTER TABLE "discrete_alarm" ADD COLUMN "iec_alarm_path" VARCHAR(500);
ALTER TABLE "analog_alarm"   ADD COLUMN "iec_alarm_path" VARCHAR(500);
