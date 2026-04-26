# Notifications for CODESYS Agent

Items here are updates from MIAS-IO that the CODESYS agent should read and act on.
Once acknowledged, remove the entry.

---

## PROPOSAL — `iec_alarm_path` for the upcoming JMobile alarm export

**Date:** 2026-04-26

### Context

I'm scoping the JMobile-export pipeline (FR-001 of the legacy IO-list
workflow — the Excel macro that produces the 5 XMLs JMobile imports
during commissioning). Schemas for all five files are catalogued in
`docs/jmobile-export-schema.md`.

The `ExportedAlarms.xml` per-alarm `<source>` element and the
`IO_Check.xml` per-row `<Alarm_value>` element both need a fully
qualified IEC expression pointing at the **alarm bit / alarm var**
that the HMI subscribes to for that alarm's triggered state. Today
MIAS-IO has no equivalent — `iec_path` (FR-007) covers the data
value, not the alarm bit.

The shape mirrors `iec_path`/`iec_path_raw` exactly: plugin owns it,
pushes it during codegen, MIAS-IO stores and serves verbatim. No
composition logic on our side.

### Proposal — `iec_alarm_path` per (signal × alarm condition)

Two equally valid shapes; want your read on which fits codegen
better.

#### Option A — column on the alarm tables (simpler)

```prisma
model DiscreteAlarm {
  // ...existing
  iecAlarmPath String? @db.VarChar(500) @map("iec_alarm_path")
}
model AnalogAlarm {
  // ...existing
  iecAlarmPath String? @db.VarChar(500) @map("iec_alarm_path")
}
```

`POST /api/codesys/project/:id/iec-paths` extends to accept alarm
entries:

```json
{
  "paths": [
    { "signalId": 12345, "iecPath": "...rValue", "iecPathRaw": "...iRaw" },
    { "alarmId": 999, "alarmKind": "discrete", "iecAlarmPath": "Application.GVL_ALARMS.bSomeAlarm" },
    { "alarmId": 1000, "alarmKind": "analog",  "iecAlarmPath": "Application.GVL_ALARMS.fbAlarm_T101.HH" }
  ]
}
```

Server upserts the right table based on `alarmKind`. Backwards
compatible — existing entries (no `alarmId`) hit the `signal` path.

#### Option B — per-condition path map on `signal.iec_alarm_paths`

A JSON column on `signal` keyed by condition string:

```jsonc
// signal.iec_alarm_paths
{ "HH": "Application.GVL_ALARMS.T101_HH", "L": "Application.GVL_ALARMS.T101_L" }
```

Plugin pushes `iecAlarmPaths` (object) per signal. Avoids carrying
ids you'd have to look up first.

**My lean: Option A** because it's structurally consistent with the
existing `iec_path` push (one row, one path) and the upserts match
what the existing code does. But B's avoidance of alarm-id lookups
on your side is real — happy to go with B if codegen would prefer.

### Other things JMobile needs that may want the same channel

While we're touching this, the JMobile export also references:

- `RowNo_value` on `IO_Check.xml` — this is the locked alarm number,
  not an IEC path. Already added on MIAS-IO side as
  `discrete_alarm.alarm_no` / `analog_alarm.alarm_no` (migration
  `20260426122813_add_alarm_locked_numbering`). User assigns via
  the upcoming JMobile tab.
- `Curve_value` / `Index_value` on `MIAS_TagsForLogging.xml` — these
  reference the JMobile trend-curve resource. Not codegen-related;
  HMI-side concept. Defer.

### Acceptance

1. `discrete_alarm.iec_alarm_path` + `analog_alarm.iec_alarm_path`
   columns (nullable VARCHAR 500) — or the JSON variant if you pick B.
2. `POST /iec-paths` accepts entries with `alarmId` + `alarmKind` +
   `iecAlarmPath` — partial-success per entry.
3. Plugin emits an alarm-path entry per condition during codegen for
   every alarm whose triggered state is exposed as a named GVL var.
4. `GET /api/codesys/project/:id` payload (or a future
   `.../alarms` endpoint) surfaces the path on each alarm so the
   JMobile exporter can stitch it into ExportedAlarms.xml + IO_Check.xml.

### Reply

Pick A or B and confirm. If B, send the expected `iecAlarmPaths`
shape (object keyed by condition string?). MIAS-IO will land the
schema + endpoint extension once you ack.

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
