-- FR-007: Live signal monitoring scaffold.
--
--  - signal.iec_path stores the fully-qualified CODESYS variable expression
--    that the plugin produces during codegen (NULL = "plugin hasn't generated
--    this yet, skip from monitoring subscriptions").
--  - signal_monitoring is the desired-state subscription list (per signal,
--    poll interval, enabled flag).
--  - signal_reading_live is the upsert-only latest-reading store. No history.

-- AlterTable
ALTER TABLE "signal" ADD COLUMN "iec_path" VARCHAR(500);

-- CreateTable
CREATE TABLE "signal_monitoring" (
    "id" SERIAL NOT NULL,
    "signal_id" INTEGER NOT NULL,
    "project_id" INTEGER NOT NULL,
    "interval_ms" INTEGER NOT NULL DEFAULT 1000,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "signal_monitoring_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signal_reading_live" (
    "signal_id" INTEGER NOT NULL,
    "value" JSONB NOT NULL,
    "value_str" VARCHAR(255) NOT NULL,
    "iec_type" VARCHAR(20) NOT NULL,
    "state" VARCHAR(20) NOT NULL,
    "error_msg" VARCHAR(500),
    "ts_plugin" TIMESTAMP(3) NOT NULL,
    "ts_server" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "signal_reading_live_pkey" PRIMARY KEY ("signal_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "signal_monitoring_signal_id_key" ON "signal_monitoring"("signal_id");
CREATE INDEX "signal_monitoring_project_id_enabled_idx" ON "signal_monitoring"("project_id", "enabled");

-- AddForeignKey
ALTER TABLE "signal_monitoring" ADD CONSTRAINT "signal_monitoring_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "signal_monitoring" ADD CONSTRAINT "signal_monitoring_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "signal_reading_live" ADD CONSTRAINT "signal_reading_live_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
