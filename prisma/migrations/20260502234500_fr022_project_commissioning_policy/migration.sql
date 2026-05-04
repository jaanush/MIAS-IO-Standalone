-- FR-022 Path B: project-level commissioning policy.
--
-- Drives plugin codegen of GVL_MIAS.xLocalCommReq + GVL_Commission.xRun
-- initial values + SAVE_FLASH scheduling in the IEC commissioner.
--
-- Defaults are safe for new projects: MANUAL_ONLY policy +
-- xLocalCommReq=TRUE + xRunPlaybook=FALSE (commissioner task active but
-- operator must pulse xRun to start). Existing projects backfill to
-- these defaults.

-- CreateEnum
CREATE TYPE "commissioning_policy" AS ENUM ('AUTO', 'MANUAL_ONLY', 'DISABLED');

-- CreateEnum
CREATE TYPE "commissioning_reboot_strategy" AS ENUM ('BATCH_LAST_STEP', 'PER_SLOT');

-- AlterTable
ALTER TABLE "project"
    ADD COLUMN "commissioning_policy" "commissioning_policy" NOT NULL DEFAULT 'MANUAL_ONLY',
    ADD COLUMN "commissioning_initial_x_local_comm_req" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "commissioning_initial_x_run_playbook" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "commissioning_reboot_strategy" "commissioning_reboot_strategy" NOT NULL DEFAULT 'BATCH_LAST_STEP';
