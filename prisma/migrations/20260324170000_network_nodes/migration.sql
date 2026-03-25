-- New enum: network node role (CLIENT / SERVER)
CREATE TYPE "network_node_role" AS ENUM ('CLIENT', 'SERVER');

-- New join table: device participation in a network
CREATE TABLE "network_node" (
    "id" SERIAL NOT NULL,
    "network_id" INT NOT NULL,
    "plc_id" INT,
    "carrier_id" INT,
    "role" "network_node_role" NOT NULL DEFAULT 'CLIENT',
    "node_address" SMALLINT,
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "network_node_pkey" PRIMARY KEY ("id")
);

-- Unique constraints: one entry per device per network
CREATE UNIQUE INDEX "network_node_network_id_plc_id_key" ON "network_node"("network_id", "plc_id");
CREATE UNIQUE INDEX "network_node_network_id_carrier_id_key" ON "network_node"("network_id", "carrier_id");

-- Foreign keys
ALTER TABLE "network_node" ADD CONSTRAINT "network_node_network_id_fkey"
    FOREIGN KEY ("network_id") REFERENCES "plc_network"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "network_node" ADD CONSTRAINT "network_node_plc_id_fkey"
    FOREIGN KEY ("plc_id") REFERENCES "plc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "network_node" ADD CONSTRAINT "network_node_carrier_id_fkey"
    FOREIGN KEY ("carrier_id") REFERENCES "io_carrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
