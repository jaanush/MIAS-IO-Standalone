-- CreateEnum
CREATE TYPE "codesys_task_status" AS ENUM ('QUEUED', 'CLAIMED', 'SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "codesys_task" (
    "id" UUID NOT NULL,
    "project_id" INTEGER NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "params" JSONB,
    "status" "codesys_task_status" NOT NULL DEFAULT 'QUEUED',
    "claimed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "result_log" TEXT[],
    "result_error" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "codesys_task_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "codesys_task" ADD CONSTRAINT "codesys_task_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codesys_task" ADD CONSTRAINT "codesys_task_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
