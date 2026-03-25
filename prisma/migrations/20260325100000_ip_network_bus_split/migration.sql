-- New table: IP network infrastructure
CREATE TABLE "ip_network" (
    "id" SERIAL NOT NULL,
    "project_id" INT NOT NULL,
    "name" VARCHAR(100),
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ip_network_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ip_network" ADD CONSTRAINT "ip_network_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "project"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Add ip_network_id FK to plc_network (now called Bus in Prisma)
ALTER TABLE "plc_network" ADD COLUMN "ip_network_id" INT;

ALTER TABLE "plc_network" ADD CONSTRAINT "plc_network_ip_network_id_fkey"
    FOREIGN KEY ("ip_network_id") REFERENCES "ip_network"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
