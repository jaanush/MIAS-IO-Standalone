-- CreateTable: global module type code lookup
CREATE TABLE "module_type_code" (
    "id" SERIAL NOT NULL,
    "card_type" "io_card_type" NOT NULL,
    "code" CHAR(1) NOT NULL,
    "group_name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(100),
    CONSTRAINT "module_type_code_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "module_type_code_card_type_code_key" ON "module_type_code"("card_type", "code");

-- AlterTable: IoCarrier — add cabinet/carrier identifier fields
ALTER TABLE "io_carrier"
    ADD COLUMN "cabinet_number" SMALLINT,
    ADD COLUMN "carrier_number" SMALLINT;

-- AlterTable: IoCard — add typeCode/instanceNumber identifier fields
ALTER TABLE "io_card"
    ADD COLUMN "type_code" CHAR(1),
    ADD COLUMN "instance_number" SMALLINT;
CREATE UNIQUE INDEX "io_card_carrier_id_type_code_instance_number_key"
    ON "io_card"("carrier_id", "type_code", "instance_number");

-- AlterTable: Signal — add stable hw identifier fields
ALTER TABLE "signal"
    ADD COLUMN "hw_cabinet" SMALLINT,
    ADD COLUMN "hw_carrier" SMALLINT,
    ADD COLUMN "hw_type_code" CHAR(1),
    ADD COLUMN "hw_instance" SMALLINT;

-- AlterFK: Signal.ioCardId → SET NULL on delete (was RESTRICT/NO ACTION)
ALTER TABLE "signal" DROP CONSTRAINT IF EXISTS "signal_io_card_id_fkey";
ALTER TABLE "signal" ADD CONSTRAINT "signal_io_card_id_fkey"
    FOREIGN KEY ("io_card_id") REFERENCES "io_card"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
