-- JMobile/legacy IO-list locked alarm numbering. Per-project sequential
-- alarm IDs that, once assigned, persist across reorderings so the JMobile
-- HMI's import targets stay stable (mirrors the Excel macro's BO/BA
-- "Locked alarm no." workflow). NULL = not yet numbered.

ALTER TABLE "discrete_alarm" ADD COLUMN "alarm_no" SMALLINT;
ALTER TABLE "analog_alarm"   ADD COLUMN "alarm_no" SMALLINT;
