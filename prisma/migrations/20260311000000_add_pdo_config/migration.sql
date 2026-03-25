-- Create PDO direction enum
CREATE TYPE "pdo_direction" AS ENUM ('TPDO', 'RPDO');

-- Create PDO config table
-- Stores CANopen PDO communication parameters written to devices via SDO during commissioning
CREATE TABLE "pdo_config" (
    "id" SERIAL NOT NULL,
    "component_id" INTEGER NOT NULL,
    "direction" "pdo_direction" NOT NULL,
    "pdo_number" INTEGER NOT NULL,
    "node_id" SMALLINT,
    "cob_id" INTEGER,
    "transmission_type" SMALLINT,
    "event_timer_ms" INTEGER,
    "inhibit_time_us" INTEGER,
    "sync_window_us" INTEGER,
    "description" VARCHAR(255),

    CONSTRAINT "pdo_config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pdo_config_component_id_direction_pdo_number_key"
    ON "pdo_config"("component_id", "direction", "pdo_number");

ALTER TABLE "pdo_config"
    ADD CONSTRAINT "pdo_config_component_id_fkey"
    FOREIGN KEY ("component_id") REFERENCES "hardware_component"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Add pdo_config_id FK to component_signal
ALTER TABLE "component_signal" ADD COLUMN "pdo_config_id" INTEGER;

ALTER TABLE "component_signal"
    ADD CONSTRAINT "component_signal_pdo_config_id_fkey"
    FOREIGN KEY ("pdo_config_id") REFERENCES "pdo_config"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
