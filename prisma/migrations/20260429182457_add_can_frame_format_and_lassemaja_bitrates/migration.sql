-- Make CAN frame format (11-bit / 29-bit / mixed) first-class on Bus, and
-- back-fill the LasseMaja Kreisel buses with their known bitrates and
-- (implicit) frame format. The Editron CANopen buses get frame_format
-- defaulted to STANDARD too — CANopen uses 11-bit COB-IDs by definition —
-- but their bitrate stays NULL until verified against vendor docs.

-- ──────────────────────────────────────────────────────────────────────
-- 1) Schema: new enum + column
-- ──────────────────────────────────────────────────────────────────────
CREATE TYPE can_frame_format AS ENUM ('STANDARD', 'EXTENDED', 'MIXED');

ALTER TABLE plc_network
  ADD COLUMN can_frame_format can_frame_format;

-- ──────────────────────────────────────────────────────────────────────
-- 2) LasseMaja (project_id=1) Kreisel buses — bitrate + frame format
-- ──────────────────────────────────────────────────────────────────────
-- PTCAN production bus (Kreisel ESS standard): 500 kbit/s, 11-bit IDs
UPDATE plc_network
   SET baud_rate_kbit = 500, can_frame_format = 'STANDARD'
 WHERE id IN (21, 22);

-- Debug PCAN: 1000 kbit/s, 11-bit IDs (max ID = 0x304 = 772)
UPDATE plc_network
   SET baud_rate_kbit = 1000, can_frame_format = 'STANDARD'
 WHERE id IN (20, 23);

-- ──────────────────────────────────────────────────────────────────────
-- 3) Editron CANopen buses — frame format defaulted to STANDARD;
--    bitrate left NULL pending verification against Editron FW11 manual.
-- ──────────────────────────────────────────────────────────────────────
UPDATE plc_network
   SET can_frame_format = 'STANDARD'
 WHERE id IN (16, 17, 18, 19);
