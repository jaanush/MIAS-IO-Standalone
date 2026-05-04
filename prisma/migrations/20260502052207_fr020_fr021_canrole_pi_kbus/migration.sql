-- FR-019 follow-up + FR-020 + FR-021:
--   * canRole enum + Bus.canRole — structured CAN bus role distinction
--     (PT_CAN / P_CAN_DEBUG / GENERIC). Drives renderer + Kreisel
--     auto-wiring without parsing free-form bus descriptions.
--   * Bus.processImageBytes — WAGO 750-658 K-bus PI size (bytes/dir).
--     Allowed values 8/12/16/20/24/32/40/48 enforced at API.
--   * Plc.kbusCycleTimeMs — PFC200 K-bus device parameter Id=128.
--     Range 1..50 enforced at API.

-- CreateEnum
CREATE TYPE "can_role" AS ENUM ('PT_CAN', 'P_CAN_DEBUG', 'GENERIC');

-- AlterTable
ALTER TABLE "plc_network"
  ADD COLUMN "can_role"            "can_role",
  ADD COLUMN "process_image_bytes" INTEGER;

-- AlterTable
ALTER TABLE "plc"
  ADD COLUMN "kbus_cycle_time_ms" INTEGER;
