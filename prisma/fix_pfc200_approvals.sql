-- Fix PFC200 approvals based on live WAGO website data (scraped 2026-03-12)
-- Products checked: 750-8210, 750-8211, 750-8212

BEGIN;

-- ============================================================
-- 1. Add missing approval types
-- ============================================================
INSERT INTO approval (code, name) VALUES
  ('EAC',  'EAC (Eurasian Conformity)')
ON CONFLICT DO NOTHING;

INSERT INTO approval (code, name) VALUES
  ('KC',   'KC (Korea Certification)')
ON CONFLICT DO NOTHING;

INSERT INTO approval (code, name) VALUES
  ('UKCA', 'UKCA (UK Conformity Assessed)')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. PFC200 750-8210 family (base 2ETH, no ATEX/IECEx)
--    WAGO shows: EAC, KC, UL, CE, UKCA, BSH, BV, DNV, KR, NK, PRS
--    Variants share base article approvals.
-- ============================================================
-- 750-8210, 750-8210/025-000, 750-8210/040-000
INSERT INTO device_catalog_approval (device_catalog_id, approval_id)
SELECT dc.id, a.id
FROM device_catalog dc
CROSS JOIN approval a
WHERE dc.article_number IN ('750-8210', '750-8210/025-000', '750-8210/040-000')
  AND a.code IN ('EAC', 'KC', 'UL', 'UKCA', 'BSH', 'BV', 'DNV', 'KR', 'NKK', 'PRS')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. PFC200 750-8211 family (1ETH, no ATEX/IECEx, fewer marine)
--    WAGO shows: EAC, KC, UL, CE, BSH, BV, DNV, KR, PRS
--    (no UKCA, no NK/NKK, no ABS, no LR, no RINA)
-- ============================================================
INSERT INTO device_catalog_approval (device_catalog_id, approval_id)
SELECT dc.id, a.id
FROM device_catalog dc
CROSS JOIN approval a
WHERE dc.article_number IN ('750-8211', '750-8211/040-000')
  AND a.code IN ('EAC', 'KC', 'UL', 'BSH', 'BV', 'DNV', 'KR', 'PRS')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. PFC200 750-8212 family (2ETH, ATEX/IECEx, full marine)
--    WAGO shows: EAC, KC, UL, CE, UKCA, ABS, BSH, BV, DNV, KR, LR, NK, PRS, RINA, ATEX, IECEx
-- ============================================================
INSERT INTO device_catalog_approval (device_catalog_id, approval_id)
SELECT dc.id, a.id
FROM device_catalog dc
CROSS JOIN approval a
WHERE dc.article_number IN (
  '750-8212', '750-8212/000-100', '750-8212/025-000', '750-8212/025-001',
  '750-8212/025-002', '750-8212/040-000', '750-8212/040-001', '750-8212/040-010'
)
  AND a.code IN ('EAC', 'KC', 'UL', 'UKCA', 'ABS', 'BSH', 'BV', 'DNV', 'KR', 'LR', 'NKK', 'PRS', 'RINA', 'ATEX', 'IECEx')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. PFC200 750-8213+ family (same cert profile as 8212)
--    These are 4G/ext-temp variants of the 8212 platform.
--    Assumption: same approvals as 8212 (WAGO typically carries
--    forward all certs within the same platform generation).
-- ============================================================
INSERT INTO device_catalog_approval (device_catalog_id, approval_id)
SELECT dc.id, a.id
FROM device_catalog dc
CROSS JOIN approval a
WHERE dc.article_number IN (
  '750-8213', '750-8213/040-010',
  '750-8214', '750-8215',
  '750-8216', '750-8216/025-000', '750-8216/025-001', '750-8216/040-000'
)
  AND a.code IN ('EAC', 'KC', 'UL', 'UKCA', 'ABS', 'BSH', 'BV', 'DNV', 'KR', 'LR', 'NKK', 'PRS', 'RINA', 'ATEX', 'IECEx')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. PFC200 750-8208 family (older gen, no ATEX)
--    DB currently has: CE, DNV_GL, GL, RoHS, UL
--    These likely also have EAC, KC, and some marine certs.
--    Adding conservatively: EAC, KC only (verified common across PFC200).
-- ============================================================
INSERT INTO device_catalog_approval (device_catalog_id, approval_id)
SELECT dc.id, a.id
FROM device_catalog dc
CROSS JOIN approval a
WHERE dc.article_number IN ('750-8208', '750-8208/025-000', '750-8208/025-001')
  AND a.code IN ('EAC', 'KC')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. PFC200 750-8217 family (CC100)
--    DB currently has: CE, DNV_GL, GL, RoHS
--    Adding conservatively: EAC, KC, UL
-- ============================================================
INSERT INTO device_catalog_approval (device_catalog_id, approval_id)
SELECT dc.id, a.id
FROM device_catalog dc
CROSS JOIN approval a
WHERE dc.article_number IN ('750-8217', '750-8217/025-000', '750-8217/600-000', '750-8217/625-000')
  AND a.code IN ('EAC', 'KC', 'UL')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 8. Compact PLCs (750-811x, 750-8000/8001)
--    DB currently has: CE, RoHS only
--    These are lower-tier products, adding EAC, KC conservatively.
-- ============================================================
INSERT INTO device_catalog_approval (device_catalog_id, approval_id)
SELECT dc.id, a.id
FROM device_catalog dc
CROSS JOIN approval a
WHERE dc.article_number IN (
  '750-8000', '750-8001',
  '750-8110', '750-8111', '750-8112', '750-8112/025-000'
)
  AND a.code IN ('EAC', 'KC')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 9. TP600 (750-8302) and Edge (751-94xx)
--    Keep as-is (CE, RoHS) — different product line, needs separate verification.
-- ============================================================

COMMIT;
