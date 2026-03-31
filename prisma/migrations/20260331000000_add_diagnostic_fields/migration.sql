-- CreateEnum
CREATE TYPE "diagnostic_type" AS ENUM ('NONE', 'DIGITAL_PAIRED', 'ANALOG_STATUS_BYTE');

-- AlterTable
ALTER TABLE "module_catalog" ADD COLUMN     "diagnostic_bits_per_channel" INTEGER,
ADD COLUMN     "diagnostic_type" "diagnostic_type" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "has_diagnostics" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "io_card" ADD COLUMN     "diagnostic_bits_per_channel" INTEGER,
ADD COLUMN     "diagnostic_type" "diagnostic_type" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "has_diagnostics" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "signal" ADD COLUMN     "diagnostic_parent_id" INTEGER,
ADD COLUMN     "is_diagnostic" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "signal" ADD CONSTRAINT "signal_diagnostic_parent_id_fkey" FOREIGN KEY ("diagnostic_parent_id") REFERENCES "signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
