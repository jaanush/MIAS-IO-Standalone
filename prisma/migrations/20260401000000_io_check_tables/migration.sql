-- IO-Check tables for DevTools commissioning workflow

-- CreateEnum
CREATE TYPE "IoCheckStatus" AS ENUM ('PENDING', 'PASS', 'FAIL', 'SKIPPED');

-- CreateTable
CREATE TABLE "io_check_session" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "plc_id" INTEGER NOT NULL,
    "operator_name" VARCHAR(255),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    CONSTRAINT "io_check_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "io_check_result" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "signal_id" INTEGER NOT NULL,
    "status" "IoCheckStatus" NOT NULL DEFAULT 'PENDING',
    "measured_value" VARCHAR(255),
    "notes" TEXT,
    "checked_at" TIMESTAMP(3),
    CONSTRAINT "io_check_result_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "io_check_session" ADD CONSTRAINT "io_check_session_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "io_check_session" ADD CONSTRAINT "io_check_session_plc_id_fkey" FOREIGN KEY ("plc_id") REFERENCES "plc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "io_check_result" ADD CONSTRAINT "io_check_result_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "io_check_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "io_check_result" ADD CONSTRAINT "io_check_result_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "signal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
