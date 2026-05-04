# Module Commissioning Catalog

Vendored copy of the canonical module commissioning JSON from the docs agent.

**Source of truth:** `MIAS-ref/docs/databases/wago/module_commissioning.json`
(owned by `mias-plugin` per the NOTIF-011 ownership split — schema is in
`MIAS-ref/docs/schemas/module-commissioning.schema.json`).

**Sync command:**

```bash
cp "C:/onedrive/OneDrive - IT Borgen/Dokument/GitHub/MIAS-ref/docs/databases/wago/module_commissioning.json" \
   data/commissioning/wago_module_commissioning.json
```

After re-syncing, run:

```bash
npx tsx prisma/seed_commissioning_catalog.ts
```

That seeder upserts `commissioningData JSON` onto `module_catalog` /
`device_catalog` rows by `vendor_name + article_number`, matching against
the `part_id` field in the JSON (format `wago:NNN-NNN`).

## Why vendored

We don't read this file from `MIAS-ref/` at runtime because:

1. mias-io ships standalone (Coolify deploy doesn't include `MIAS-ref/`).
2. The catalog is small (~45 KB, 19 modules) and changes slowly.
3. mias-io is a thin consumer — schema fields live in docs/, content is
   cached in mias-io DB rows, project overrides on top of that.

Re-vendor when the docs catalog changes structure (rare) or gains entries
(more common — currently the LasseMaja-used inventory; will grow as new
projects encounter modules).

## Per-vendor split

If we later catalog non-WAGO modules (e.g. Phoenix Contact CBM E8 trip
diagnostics, Editron BMS-side commissioning), add per-vendor JSON files
beside this one (`phoenix_module_commissioning.json` etc.) and update the
seeder to walk the directory.
