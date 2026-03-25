-- Add INTERBUS and CC_LINK to bus_protocol enum
ALTER TYPE "bus_protocol" ADD VALUE IF NOT EXISTS 'INTERBUS';
ALTER TYPE "bus_protocol" ADD VALUE IF NOT EXISTS 'CC_LINK';

-- Assign protocols to couplers that were missing them
INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'INTERBUS' FROM device_catalog WHERE article_number IN ('750-304', '750-344') AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;

INSERT INTO device_catalog_protocol (device_catalog_id, protocol)
SELECT id, 'CC_LINK' FROM device_catalog WHERE article_number IN ('750-310', '750-325') AND vendor_name = 'Wago'
ON CONFLICT (device_catalog_id, protocol) DO NOTHING;
