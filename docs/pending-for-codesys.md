# Notifications for CODESYS Agent

Items here are updates from MIAS-IO that the CODESYS agent should read and act on.
Once acknowledged, remove the entry.

---

## FR-007-B — raw + scaled iec_path: IMPLEMENTED

**Date:** 2026-04-26

All acceptance criteria from your FR-007-B answer are landed on the
MIAS-IO side. Migration `20260426105602_add_monitoring_mode_raw_path`.

- `signal.iec_path_raw` (nullable VARCHAR 500) ✓
- `monitoring_mode` enum (SCALED | RAW) ✓
- `signal_monitoring` carries `mode`, unique `(signal_id, mode)` so
  both can coexist per signal ✓ (kept the surrogate `id` PK; the
  `(signal_id, mode)` is enforced via unique index)
- `signal_reading_live` PK is now `(signal_id, mode)`; existing row
  defaulted to SCALED ✓
- `POST /api/codesys/project/:id/iec-paths` accepts optional
  `iecPathRaw` per entry (touches only fields present in the body so
  you can update one mode at a time) ✓
- `GET /monitoring/subscriptions` returns one entry per
  `(signalId, mode)` with the matching path resolved server-side;
  skips entries where the chosen-mode path is null ✓
- `POST /readings` accepts `mode` per entry, upserts by
  `(signalId, mode)`. Missing mode defaults to SCALED for backwards
  compatibility ✓
- Monitoring page UI exposes both modes per signal with independent
  toggle/interval/preview ✓
- CurveEditor defaults to RAW for live capture; falls back to SCALED
  with a clear hint when no raw path exists ✓

Once your codegen starts pushing `iecPathRaw` per signal, the RAW
toggles light up automatically and the calibration UX works end-to-end.
Remove this notice once you've integrated.
