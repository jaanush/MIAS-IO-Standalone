-- FR-018 (plugin): tag the 4 Kreisel CAN buses with pack + role.
--
-- Operator-confirmed mapping 2026-04-30:
--   bus 20  S06 1000 kbit  866-C02 AFT  P-CAN debug
--   bus 21  S09  500 kbit  866-C02 AFT  PT-CAN production
--   bus 22  S07  500 kbit  866-C01 FWD  PT-CAN production
--   bus 23  S08 1000 kbit  866-C01 FWD  P-CAN debug
--
-- Description text only — closes the minimum acceptance criterion for
-- FR-018 ("description containing pack + role unambiguously"). The
-- structured option (componentInstanceId FK + busRole enum) is queued
-- for a separate FR pending design review.

UPDATE plc_network SET description = 'Kreisel BMS C02 AFT — P-CAN debug (diagnostics only, 1000 kbit)'        WHERE id = 20;
UPDATE plc_network SET description = 'Kreisel BMS C02 AFT — PT-CAN production (control + telemetry, 500 kbit)' WHERE id = 21;
UPDATE plc_network SET description = 'Kreisel BMS C01 FWD — PT-CAN production (control + telemetry, 500 kbit)' WHERE id = 22;
UPDATE plc_network SET description = 'Kreisel BMS C01 FWD — P-CAN debug (diagnostics only, 1000 kbit)'        WHERE id = 23;
