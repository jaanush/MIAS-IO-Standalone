-- FR-007 raw/scaled split.
--
-- Adds:
--  - signal.iec_path_raw  : optional raw HAL path alongside the existing
--    iec_path (scaled DAO output)
--  - monitoring_mode enum : SCALED | RAW
--  - signal_monitoring.mode : per-subscription mode (default SCALED)
--  - signal_monitoring (signal_id, mode) unique  (replaces unique on
--    signal_id alone — both modes can coexist)
--  - signal_reading_live PK becomes (signal_id, mode), default SCALED
--    so existing rows preserve their meaning
--
-- Forward-compatible: NULL iec_path_raw + SCALED-only subscriptions =
-- pre-FR-007-B behaviour. Plugin can opt in to RAW per signal.

CREATE TYPE "monitoring_mode" AS ENUM ('SCALED', 'RAW');

ALTER TABLE "signal" ADD COLUMN "iec_path_raw" VARCHAR(500);

DROP INDEX "signal_monitoring_signal_id_key";
ALTER TABLE "signal_monitoring" ADD COLUMN "mode" "monitoring_mode" NOT NULL DEFAULT 'SCALED';
CREATE UNIQUE INDEX "signal_monitoring_signal_id_mode_key" ON "signal_monitoring"("signal_id", "mode");

ALTER TABLE "signal_reading_live" DROP CONSTRAINT "signal_reading_live_pkey";
ALTER TABLE "signal_reading_live" ADD COLUMN "mode" "monitoring_mode" NOT NULL DEFAULT 'SCALED';
ALTER TABLE "signal_reading_live" ADD CONSTRAINT "signal_reading_live_pkey" PRIMARY KEY ("signal_id", "mode");
