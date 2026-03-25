-- Add subgroup field to io_card
ALTER TABLE "io_card" ADD COLUMN "subgroup" CHAR(1);

-- Widen signal hw_type_code from CHAR(1) to VARCHAR(2) to hold subgroup+typeCode
ALTER TABLE "signal" ALTER COLUMN "hw_type_code" TYPE VARCHAR(2);

-- Drop old unique constraint and create new one including subgroup
DROP INDEX IF EXISTS "io_card_carrier_id_type_code_instance_number_key";
CREATE UNIQUE INDEX "io_card_carrier_id_subgroup_type_code_instance_number_key"
    ON "io_card"("carrier_id", "subgroup", "type_code", "instance_number");

-- Backfill: existing cards without subgroup get default 'A'
UPDATE "io_card" SET "subgroup" = 'A' WHERE "subgroup" IS NULL AND "type_code" IS NOT NULL;

-- Backfill: update signal hw_type_code to include subgroup prefix
UPDATE "signal" SET "hw_type_code" = 'A' || "hw_type_code"
WHERE "hw_type_code" IS NOT NULL AND length("hw_type_code") = 1;
