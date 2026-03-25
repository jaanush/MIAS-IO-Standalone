-- Auxiliary analog variables (_RAW, _SensorFaultAlarm) are no longer stored
-- as separate rows. The base signal name is stored once; the connection
-- resolver strips suffixes when looking up variable references.

ALTER TABLE "codesys_variable" DROP COLUMN IF EXISTS "is_raw";
ALTER TABLE "codesys_variable" DROP COLUMN IF EXISTS "is_sensor_fault";
ALTER TABLE "codesys_variable" DROP COLUMN IF EXISTS "group_tag";
