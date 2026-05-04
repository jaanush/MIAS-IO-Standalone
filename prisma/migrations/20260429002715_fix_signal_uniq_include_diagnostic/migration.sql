-- Diagnostic signals legitimately share a (io_card_id, channel_position) tuple
-- with their data parent (ANALOG_STATUS_BYTE) or sit at the diag-channel offset
-- alongside data signals (DIGITAL_PAIRED). The previous unique constraint
-- prevented diag-signal creation by colliding with the parent. Including
-- is_diagnostic in the tuple keeps "one data signal per (card, channel)" and
-- "one diag signal per (card, channel)" but allows the two to coexist.

-- DropIndex
DROP INDEX "signal_io_card_id_channel_position_key";

-- CreateIndex
CREATE UNIQUE INDEX "signal_io_card_id_channel_position_is_diagnostic_key" ON "signal"("io_card_id", "channel_position", "is_diagnostic");
