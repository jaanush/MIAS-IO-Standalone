CREATE TABLE "codesys_session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "email" VARCHAR(255) NOT NULL,
    "hostname" VARCHAR(255) NOT NULL,
    "plugin_version" VARCHAR(50) NOT NULL,
    "mias_project_id" INTEGER,
    "project_path" VARCHAR(500),
    "project_open" BOOLEAN NOT NULL DEFAULT false,
    "poll_interval" INTEGER NOT NULL DEFAULT 10,
    "last_heartbeat_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "codesys_session_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "codesys_session" ADD CONSTRAINT "codesys_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "codesys_session" ADD CONSTRAINT "codesys_session_mias_project_id_fkey" FOREIGN KEY ("mias_project_id") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
