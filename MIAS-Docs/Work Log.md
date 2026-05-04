# Work Log

Reverse chronological. Each entry: date, summary, files touched.

---

## 2026-05-03 — WAGO module imagery + LED layouts imported

User asked to convert all 750-series WAGO module BMPs to PNG and import them with LED layouts and descriptions to feed a richer hardware configuration panel.

### What landed

- **Import script** `scripts/import_wago_modules.py` — walks every `.wdd` config in `C:\Program Files (x86)\WAGO Software\WAGO-IO-CHECK 3\Config\{Coupler,Terminal}`, parses INI metadata (Article-NO + multilingual descriptions + ModuleType/Icon + Consumption/Voltage + LK1/LK2/PE flags + Adjustable + SettingsApp + LED layout with LEDRECT, LEDROWS/LEDCOLS/LEDMAX, per-LED color/flag/label tuples), resolves the bitmap via `Bitmap=` line for terminals or `<stem>.bmp` for couplers, converts BMP → optimised PNG via Pillow, writes the PNG to `public/wago-modules/<articleNumber>.png` and an aggregate JSON to `data/wago/wago_modules.json`.
  - **Result: 1308 WDD files parsed → 455 distinct modules captured → 199 unique BMPs converted (parameter-variant `.wdd`s share base bitmaps and were collapsed to canonical entries).**
  - 91 MB of source BMPs → 12 MB of PNG output (8× smaller).
  - 29 modules in the WAGO install have no bitmap on disk (mostly older or specialty parts); their metadata was still captured.
- **Schema** — new `frontPanel JSONB` column on both `module_catalog` and `device_catalog`. Migration `20260503061500_wago_front_panel`. Mirrors the per-module record shape from the JSON: image URL + dims, LED layout (rows/cols/rect/items[]), descriptions, hardware metadata.
- **Seeder** `prisma/seed_wago_front_panels.ts` — upserts the JSON into catalog rows by `vendorName + articleNumber`. Couplers + controllers go to DeviceCatalog (54 rows updated), other modules to ModuleCatalog (264 rows updated). 137 unmatched (modules in WAGO-IO-CHECK that aren't in mias-io's catalog yet — non-blocking).
- **tRPC `getHardware` query** — added `frontPanel: true` to the catalog selects on cards, carriers, and PLCs, so the data flows through to the hardware page without an extra fetch.
- **Type** — `WagoFrontPanel` exported from `src/lib/types/hardware.ts` (with `WagoLedItem` sub-type). Catalog types carry `frontPanel?: unknown` to match Prisma's `JsonValue` at the wire boundary; consumers narrow at the read site.
- **Visual proof: `RackStripView` component** — horizontal strip rendering of controller + IO modules at proportional sizes (zoom slider 120-420 px height). Drops in above CardList on `PlcDetail` when any local-bus carrier exists. Falls back to a small placeholder for modules without imagery. This is just a first demo of the imagery wired end-to-end — the user wants to design the proper hardware configuration panel next.
- **Proxy update** — `src/proxy.ts` allow-list extended to bypass auth for `/wago-modules/*.png`. Module imagery is non-sensitive catalog data; gating it behind login forced unnecessary 307 redirects on every render.
- **Build / runtime** — tsc clean, `npm run build` clean, `:8080` rebuilt + restarted; `curl http://localhost:8080/wago-modules/750-8210.png` returns 200 with the 54 KB PNG body without auth.

### Coverage check

LasseMaja's 14 part numbers all resolve to PNG + LED metadata:

| Article | LEDs | Image |
|---|---|---|
| 750-8210 (PFC200 G2) | 8 (with 2× PWR labels) | 298×377 |
| 750-362 (coupler) | — | 191 wide |
| 750-1405 (16DI) | 16 (channel-labeled 0-15) | 46 wide |
| 750-1504 (16DO) | 16 | 46 wide |
| 750-1605 / 1607 (field) | per layout | 46 wide |
| 750-451 (4AI RTD) | 16 status | 46 wide |
| 750-483 (2AI ±10V) | 8 | 46 wide |
| 750-496 (4AI ±10V) | 16 | 46 wide |
| 750-508 (2DO relay) | 8 | 46 wide |
| 750-553 (4AO) | 8 | 46 wide |
| 750-626 (filter PSU) | per layout | 46 wide |
| 750-652 (RS-232/485) | 8 (GNGR + GEGR + RTGR bicolour) | 46 wide |
| 750-658 (CAN gw) | 8 (GNGR bicolour) | 46 wide |

### Known LED color codes (catalog vocabulary, not yet mapped to renderable RGB)

- Numeric (`0`, `1`, `10`) — single-state LEDs (off/on/special).
- `GNGR` — green / orange bicolour (most common on IO modules).
- `GEGR` — green / yellow-green bicolour.
- `RTGR` — red / orange bicolour (used on serial gateway error LEDs).

When the user designs the new panel and decides to render live LED state from OPC UA, we'll need a small lookup table mapping these codes → actual RGB pairs.

### Files touched

- `scripts/import_wago_modules.py` — new (270 lines).
- `data/wago/wago_modules.json` — new (700 KB, 455 entries).
- `public/wago-modules/*.png` — 448 files (12 MB total).
- `prisma/schema.prisma` — `frontPanel Json?` on `DeviceCatalog` + `ModuleCatalog`.
- `prisma/migrations/20260503061500_wago_front_panel/migration.sql` — 2 column adds.
- `prisma/seed_wago_front_panels.ts` — new seeder.
- `src/server/routers/projectHardware.ts` — `frontPanel: true` selects on card / carrier / plc catalog includes.
- `src/lib/types/hardware.ts` — `WagoFrontPanel` + `WagoLedItem` types; `frontPanel?: unknown` on catalog types (Prisma JsonValue).
- `src/app/projects/[id]/hardware/_components/RackStripView.tsx` — new visual demo (~110 lines).
- `src/app/projects/[id]/hardware/_components/PlcDetail.tsx` — render `RackStripView` above CardList.
- `src/proxy.ts` — bypass auth for `/wago-modules/*`.

---

## 2026-05-03 — Hardware commissioning UI: panel + project policy form

User correctly called out that the previous evening's commissioning work shipped schema + API but no UI — they expected the full vertical slice. Saved the feedback to memory and built the UI in this session.

### What landed

- **`src/app/projects/[id]/hardware/_components/CommissioningPanel.tsx`** — reusable collapsible panel shared by PLC and IoCard. Lazy-loads catalog + override data via `plcCommissioningList` / `ioCardCommissioningList` only when the user expands it (matters with 49+ cards on LasseMaja). Renders a settings table with: name + datatype + register/object + value range + description tooltip + writable_via lock badge for IEC-unreachable settings; effective value + factory default + MIAS convention shown side-by-side; override input (Select for ENUM/BOOL with parsed value_range options, numeric/text Input for others); per-row "Override" / "Edit" / "Cancel" / Save / "Clear" buttons; per-row notes field; constraints + apply method (immediate/EEPROM-save/runtime-restart/full-PFC-reboot) shown above the table; "verified against running hardware" badge on entries cited as such. Colour token: amber background tint on rows that carry an active project override, matching the override-indicator pattern from feedback_ui_patterns.md.
- **`PlcDetail.tsx`** — added `<CommissioningPanel kind="plc" plcId={plc.id} />` below the K-bus health check section.
- **`CardList.tsx`** — wrapped each card row in a `<div class="contents">` and rendered the panel directly underneath as a sibling. Lazy-loaded so 49 cards × 1 query per card don't fire on tree expand.
- **`/projects/[id]/details/page.tsx`** — new "Hardware Commissioning Policy" section in the project form. Two `Select` dropdowns (`policy`, `rebootStrategy`) + two checkboxes (`initialXLocalCommReq`, `initialXRunPlaybook`). Per-option help text changes with selection. Wired through `project.update` tRPC mutation (extended its zod input to accept the four new fields).

### Type / build / runtime checks

- `npx tsc --noEmit` clean.
- `npm run build` produced full bundle without warnings.
- `:8080` rebuilt + restarted (was stopped after the prior `prisma generate`); `GET /api/codesys/project/1` confirmed top-level + per-PLC + per-card commissioning blocks all live in the response. UI is rendering against this build.

### Files touched

- `src/app/projects/[id]/hardware/_components/CommissioningPanel.tsx` — new (~280 lines).
- `src/app/projects/[id]/hardware/_components/PlcDetail.tsx` — import + render.
- `src/app/projects/[id]/hardware/_components/CardList.tsx` — render under each card row.
- `src/app/projects/[id]/details/page.tsx` — schema + form section.
- `src/server/routers/project.ts` — `update` zod input extended with the four commissioning fields.

---

## 2026-05-03 — FR-022 round-trip: project-level commissioning policy

Plugin filed revised FR-022 in parallel with my NOTIF-027 push. They scoped the original Path A+B request down to just Path B (project-level commissioning policy) — said NOTIF-027 already covered the per-card / per-PLC overrides path adequately. Closed via NOTIF-028 round-trip on the same evening.

### What landed

- **Schema** — added 4 typed columns on `project`: `commissioningPolicy CommissioningPolicy @default(MANUAL_ONLY)`, `commissioningInitialXLocalCommReq Boolean @default(true)`, `commissioningInitialXRunPlaybook Boolean @default(false)`, `commissioningRebootStrategy CommissioningRebootStrategy @default(BATCH_LAST_STEP)`. New enums: `CommissioningPolicy` (`AUTO`/`MANUAL_ONLY`/`DISABLED`) and `CommissioningRebootStrategy` (`BATCH_LAST_STEP`/`PER_SLOT`). Migration `20260502234500_fr022_project_commissioning_policy`.
- **GET response top-level `commissioning` block** at `GET /api/codesys/project/{id}`, sibling to `project` / `codesysSettings` / `plcs` / etc. Includes `policy`, `initialXLocalCommReq`, `initialXRunPlaybook`, `rebootStrategy`, `catalogVersion`. Plugin codegen reads this for `GVL_MIAS.xLocalCommReq` / `GVL_Commission.xRun` initial values + SAVE_FLASH placement.
- **PATCH endpoint** — `PATCH /api/codesys/projects/{id}/commissioning`. Partial update of any subset of the 4 supported fields. Empty body returns 400. Echoes the full block in response. Auth via `X-API-Key`.
- **Bonus: per-card / per-PLC `commissioning` block** (Path A from the original FR-022, kept since the catalog data was already on the card via the previous evening's work). New helper `src/app/api/codesys/_commissioning.ts` renders the joined catalog + project view per IoCard / Plc with `partId`, `moduleClass`, `needsCommissioning`, `iecGlobalsPath` (slot-resolved from the catalog `<slot>` placeholder), `libraryFb`, `applyMethod`, `settings[]` with `effectiveValue` resolution (override → mias_convention_value → default_value → null) + `writableFromIec` + `operatorInstruction` for IEC-unreachable settings, plus `monitoringSignals[]` and `constraints[]`. `miasOpCode` mapping stays plugin-side per FR-022's accepted split.
- **LasseMaja backfilled** to `policy = AUTO` per plugin's "preserve existing behaviour" ask. New projects default to `MANUAL_ONLY` (deploy-safety: operator opts into automation rather than the other way around).
- **Contract** updated with the new top-level field, the per-card/per-PLC `commissioning` notes (separate from `commissioningOverrides`), and the new `PATCH /commissioning` endpoint section.

### Round-trip closures

- **NOTIF-027** (mias-io's commissioning announce) — plugin acked, closed pending DLL deploy + smoke test.
- **FR-022** (plugin's revised project-policy ask) — closed via NOTIF-028 same evening.
- `pending-from-codesys.md` cleaned: "(no open items — FR-019/020/021 closed via NOTIF-026; FR-022 closed via NOTIF-028)".

### Files touched

- `prisma/schema.prisma` — `CommissioningPolicy` + `CommissioningRebootStrategy` enums; 4 new fields on `Project`.
- `prisma/migrations/20260502234500_fr022_project_commissioning_policy/migration.sql`.
- `src/app/api/codesys/_commissioning.ts` — new helper (rendering + part-id formatting + IEC-reach test).
- `src/app/api/codesys/project/[id]/route.ts` — top-level `commissioning` field + per-card / per-PLC `commissioning` blocks via the helper, catalog `commissioningData` selects on plc.catalog + card.catalog.
- `src/app/api/codesys/projects/[id]/commissioning/route.ts` — new PATCH endpoint.
- `docs/codesys-api-contract.md` — top-level block, per-card/per-PLC notes, PATCH endpoint section.
- `docs/pending-for-codesys.md` — NOTIF-028 appended.
- `docs/pending-from-codesys.md` — cleared (closure summary in the standard "(no open items)" form).

---

## 2026-05-02 — Hardware commissioning layer + NOTIF-011/NOTIF-012 inbox drain

### Inbox replies

- **NOTIF-011** (docs → mias-io, module commissioning catalog schema review). Reply added under `MIAS-ref/docs/pending-from-docs.md` covering: (a) request to widen `monitoring_signals[*].alarm_thresholds` from the flat `{warn_above, warn_below, alarm_above, alarm_below, alarm_on_change}` shape to a per-threshold array `{condition, setpoint, hysteresis, severity, delay_seconds, message_template}` matching `prisma.AnalogAlarm` / `DiscreteAlarm` row shape. Minimum-viable fallback offered. (b) Add `"Modbus RTU"` to `readable_via` enum (mias-io `SignalOrigin` distinguishes RTU from TCP). (c) Accept ownership split (mias-plugin owns catalog content, mias-io supplies threshold conventions). Docs agent had already integrated the additions and closed the NOTIF by the time I tailed the watcher.
- **NOTIF-012** (docs → mias-io, canonical LasseMaja BOM). Delivered as **`MIAS-ref/docs/databases/lassemaja_hardware_inventory.json`** (option 1 from the three offered). Cross-referenced project_id=1 DB rows against `lasse_maja_mias_technical_document.md`. WAGO + DEIF + Editron + Kreisel + Advantics confirmed with quantities and project tags; ComAp + Kongsberg flagged HIGH discovery priority; MOXA / Exor / IXON / CCS Electronics MEDIUM; Phoenix Contact / Schneider / Rittal / ABB / Weidmüller / Deltaco / ELFA LOW with per-vendor recommendations on which parts deserve full records vs commodity-skip. Two tag discrepancies flagged (875-P10/P30 vs 875-P01/P02 for DEIF meters; 861-U01 vs 861-U02 for Editron genset converter). Coordination question answered: yes to project-side BOM ownership, but suggest treating it as a docs-side projection rebuilt from mias-io on demand rather than hand-maintained.

### New: hardware commissioning layer

User asked to prepare configuration data on project hardware + defaults on hardware catalog, initially scoped to PLC hardware. Schema infrastructure landed end-to-end so the plugin's IEC commissioning function can consume it:

- **Catalog defaults** — added `commissioning_data JSONB` to `device_catalog` and `module_catalog` (Plc / coupler / IO module rows). Mirrors the canonical docs JSON shape (`MIAS-ref/docs/databases/wago/module_commissioning.json`). Vendored copy at `data/commissioning/wago_module_commissioning.json` + `README.md` with sync instructions.
- **Project overrides** — `plc_commissioning` and `io_card_commissioning` tables, composite-unique on `(plc_id, name)` and `(io_card_id, name)`. `name` matches a `commissioning_settings[].name` from the catalog. Cascade-deleted with parent. Schema mirrors the kbus calc cost table layout — values stored as text, interpreted per the catalog setting's `data_type`.
- **Migration** `prisma/migrations/20260502230000_hardware_commissioning_layer/migration.sql` applied to local DB. Skipped a Prisma diff drift block (unrelated FK/index renames) — wrote clean SQL. Marked applied in `_prisma_migrations`.
- **Seeder** `prisma/seed_commissioning_catalog.ts` walks `data/commissioning/*_module_commissioning.json`, parses `part_id` (`wago:NNN-NNN` form), tries `module_catalog` first then falls back to `device_catalog`. Run: 17 of 19 entries upserted (15 modules + 2 PLC/coupler). Two unmatched (`wago:787-2801` + `wago:857-411`) — those parts aren't in the WAGO module catalog yet (DC/DC + isolation amp; referenced in tech doc but not loaded as catalog rows). Small backfill task for later.
- **CODESYS API** — `GET /api/codesys/project/{id}` now includes `commissioningOverrides: [{name, value, notes}]` on every PLC + every IO card. Catalog data NOT in the response (plugin reads its own canonical JSON file; no point duplicating). Added `?include=commissioning_catalog` toggle as a future option in NOTIF-027 if the plugin wants the merged shape.
- **tRPC router** — added 6 procs on `projectHardware`: `plcCommissioningList` / `Set` / `Clear` and `ioCardCommissioningList` / `Set` / `Clear`. List returns catalog `commissioningData` + override rows in one round-trip for UI rendering. tsc clean.
- **API contract** updated under "Notes on `commissioningOverrides`" with effective-value resolution order, MIAS-convention notes, and the bus-level/PLC-level overlap (FR-019/020/021 fields stay first-class; commissioning overrides are for everything else).
- **NOTIF-027** posted to `docs/pending-for-codesys.md` — full description of what landed, plugin's next steps, the `?include=` toggle question, and the rule about first-class fields vs override rows.

Did not build UI for editing overrides yet — schema + API surface only. Tomorrow's UI work would attach a "Commissioning" tab to PlcDetail and CarrierDetail showing the catalog settings table with override columns.

### Files touched

- `prisma/schema.prisma` — `commissioningData Json?` on `DeviceCatalog` + `ModuleCatalog`; `PlcCommissioning` + `IoCardCommissioning` models with back-relations.
- `prisma/migrations/20260502230000_hardware_commissioning_layer/migration.sql` — 2 column adds, 2 tables, 4 indexes, 2 FKs.
- `prisma/seed_commissioning_catalog.ts` — new (idempotent upsert).
- `data/commissioning/wago_module_commissioning.json` — vendored copy.
- `data/commissioning/README.md` — sync instructions.
- `src/server/routers/projectHardware.ts` — 6 new procs at end of router.
- `src/app/api/codesys/project/[id]/route.ts` — `commissioning` selects + `commissioningOverrides` arrays in response.
- `docs/codesys-api-contract.md` — sample payload + notes section.
- `docs/pending-for-codesys.md` — NOTIF-027 appended.
- `MIAS-ref/docs/databases/lassemaja_hardware_inventory.json` — NOTIF-012 reply (created in MIAS-ref repo, not this one).
- `MIAS-ref/docs/pending-from-docs.md` — NOTIF-011 reply + NOTIF-012 reply pointer.

---

## 2026-05-02 — K-bus health check on the carrier configuration view

### Calculator + cost table (sourced from MIAS-ref)
- **Cost table** copied from `../MIAS-ref/docs/databases/wago/kbus_module_costs.json` to `data/kbus/kbus_module_costs.json` with a `data/kbus/README.md` flagging it as upstream-owned. Avoids runtime sibling-repo dependency in production.
- **Pure-TS calculator** (`src/lib/kbus/calculate.ts`) implements the Beckhoff formula `T_cyc_us = N_cycles × (600 + N_DI × 2.5 + N_AI × 32 + N_AO × 42)` with operating-mode multipliers, global N_cycles ≥ 2 rule, specialty-module byte-cost placeholder (100 µs/byte until upstream NOTIF-008 closes), and the full warning-code vocabulary from MIAS-ref's `kbus-calc-output.schema.json` (`CONTROLLER_NOT_IN_COST_TABLE`, `MODULE_NOT_IN_COST_TABLE`, `MODULE_LIMIT_EXCEEDED`, `CYCLE_INEFFECTIVE`, `WATCHDOG_VIOLATION`, `CYCLE_OUT_OF_RANGE`, `MODE_MULTIPLIER_MISSING`, `OPERATING_MODE_UNKNOWN`).
- **TIER 2** (CPU-load prediction) is left null with the upstream-supplied disclaimer; we don't pretend to estimate CPU% before MIAS-ref has the empirical curve.

### Hardware-tree adapter
- **`src/lib/kbus/from-hardware.ts`** — given a `Plc` and its tree, builds calculator input by aggregating every local carrier (`busId == null`) on the PLC. The K-bus chain is per-PLC, not per-carrier, so the calculator sees the whole chain regardless of which carrier the user is looking at. Extension hops (`750-628` count) feed into the with-extension module-count limit.
- **750-658 PI** resolved from the bus the card hosts via FR-020's `Bus.processImageBytes`; if unset, falls back to the cost table's documented default (or convention).
- **Operating mode** for 750-658 defaulted to `Transparent` — that's what every current MIAS rack runs per MIAS-ref's `Techdata/PLC/wago_pfc200_kbus_capacity.md` §typical configuration. Calculator emits `MODE_MULTIPLIER_MISSING` until upstream resolves NOTIF-008. Picking "Mapped" instead would silently underestimate cycle time on every project.
- Returns `{ ok: false }` for not-applicable cases (non-WAGO controller, no local carriers, no cards yet) so the UI renders an empty state without erroring.

### UI component
- **`KbusHealthCheck`** (`src/app/projects/[id]/hardware/_components/KbusHealthCheck.tsx`) — collapsed by default; the header line shows a green/amber/red icon + computed-vs-configured cycle in ms. Expanding reveals: cycle-time bars (computed / configured / watchdog), headroom badges (vs configured / vs watchdog — go red on negative, amber under 1 ms), per-warning rows with `[CODE]` prefix + description, a per-module breakdown table (slot, part, µs contribution, channel counts or specialty bytes, mode + multiplier), and the upstream tier-2 disclaimer.
- **Wired into `CarrierDetail`** below the card list, only on local-bus carriers (`busId == null`) — remote-coupler carriers (modbus / fieldbus) skip the section since the cost table only knows PFC controllers. `page.tsx` resolves the parent PLC from the hardware tree and passes it to `CarrierDetail`.

### Why on the carrier view (not the PLC view)
The carrier configuration window is where modules actually get added/removed (the `CardList` mutates the chain). Putting the health check next to that mutation surface gives the operator immediate feedback: add a 750-455 4-channel AI, the cycle-time bar updates and a `CYCLE_INEFFECTIVE` warning fires if the configured cycle is now too short.

### Files touched
- `data/kbus/kbus_module_costs.json` (new — copy of MIAS-ref upstream)
- `data/kbus/README.md` (new — sync instructions)
- `src/lib/kbus/calculate.ts` (new — pure-TS calculator)
- `src/lib/kbus/from-hardware.ts` (new — hardware-tree adapter)
- `src/app/projects/[id]/hardware/_components/KbusHealthCheck.tsx` (new — UI)
- `src/app/projects/[id]/hardware/_components/CarrierDetail.tsx` — wire health check, accept `parentPlc` prop
- `src/app/projects/[id]/hardware/page.tsx` — resolve parent PLC for selected carrier, pass through

### Open follow-ups (upstream)
- MIAS-ref NOTIF-008 to mias-plugin: quantify `Sniffer` and `Transparent` mode multipliers for `wago:750-658`. Until then, the calculator emits `MODE_MULTIPLIER_MISSING` on every Transparent-mode 750-658 (which is every current MIAS rack).
- MIAS-ref TIER 2: empirical CPU%-vs-cycle curve. Open NOTIFs in `MIAS-ref/docs/pending-from-docs.md`.
- 750-658 documented default PI size: tracked as NOTIF-007 item 1 to mias-plugin in MIAS-ref.

---

## 2026-05-02 — FR-019 follow-up + FR-020 + FR-021: canRole, processImageBytes, kbusCycleTimeMs

### Schema additions
- **`Bus.canRole : CanRole?`** — new enum `CanRole { PT_CAN, P_CAN_DEBUG, GENERIC }`. Plugin-driven distinction so the renderer + Kreisel auto-wiring can read a structured field instead of parsing free-form bus description strings. Maps directly to `FB_KreiselBMS.pIface` (PT) vs `pPCanDevice` (P-debug).
- **`Bus.processImageBytes : Int?`** — WAGO 750-658 K-bus PI size, bytes per direction. Allowed values 8/12/16/20/24/32/40/48 enforced at the API boundary. Setting a value triggers a commissioning step in the plugin renderer that calls `FbModuleConfigurationAndStatus` with `xCmdWriteFlash` (controller restart per WAGO manual page 56).
- **`Plc.kbusCycleTimeMs : Int?`** — PFC200 K-bus device parameter Id=128 (range 1..50 ms, default 10 ms). Per-PLC, lives at the PLC level (not the bus). Renderer emits the value into `Kbus.device.xml.v3` Id=128.
- Migration `20260502052207_fr020_fr021_canrole_pi_kbus` — one CREATE TYPE + two ALTER TABLE statements, applied to local DB. Prisma client regenerated.

### Endpoint changes
- **Bus PATCH extended** (`src/app/api/codesys/projects/[id]/can-buses/[busId]/route.ts`) — was single-field cycle-cadence in FR-019, now a 3-field partial update covering `cyclicCallIntervalMs`, `canRole`, `processImageBytes`. Each field independently optional; `null` clears. Body must contain at least one supported field. Response always echoes all three so plugin can verify state on one round-trip. `canRole` accepts case-insensitive input (`"generic"` → `"GENERIC"`); the other two are strict-typed.
- **PLC PATCH new** (`src/app/api/codesys/projects/[id]/plcs/[plcId]/route.ts`) — `kbusCycleTimeMs` only today; partial-update shape for forward extension. Validation: integer in `[1, 50]` or `null`. PLC-must-belong-to-project guard.
- **GET response** (`src/app/api/codesys/project/[id]/route.ts`) — added `canRole` + `processImageBytes` to both bus selects (busNodes.bus and hostedBuses) and to the response mapping. Added `codesysDeviceName` + `kbusCycleTimeMs` to the PLC select and mapping (`codesysDeviceName` was on the schema but not surfaced).

### LasseMaja backfill
- **`canRole`** populated for all 8 CAN buses on project 1: Editron CANopen (16/17/18/19) → `GENERIC`, Kreisel debug (20, 23) → `P_CAN_DEBUG`, Kreisel production (21, 22) → `PT_CAN`. Mapping per the resolution in NOTIF-025 (GVL_MIAS_COM comment authoritative). `processImageBytes` and `kbusCycleTimeMs` left null pending plugin's commissioning rollout.
- **AFT/FWD swap fix** on the 4 debug ComponentInstances on CAN_20 and CAN_23 — flagged in NOTIF-025 as adjacent data-quality issue, fixed in same session per user direction. Local DB only.

### Smoke matrix (all on local dev :3000)
- **GET response** — verified all three new fields appear at the right level for all 8 CAN buses + the D01 PLC.
- **Bus PATCH positive** — all-three-fields write, partial canRole-only `null` clear (other two preserved), case-insensitive `"generic"` acceptance.
- **Bus PATCH reject** — bad enum value, bad PI value (36), PI float (48.5), empty body, PI on non-CAN bus (MODBUS_RTU bus 24).
- **PLC PATCH positive** — set 10, clear with `null`.
- **PLC PATCH reject** — 0 (below 1), 51 (above 50), float (10.5), empty body, PLC-not-in-project (PLC 7 in project 99 → 400), nonexistent PLC (id 99999 → 404).

### Contract
- **`docs/codesys-api-contract.md`** — GET response sample updated; new field notes for `canRole` (enum semantics + Kreisel mapping) and `processImageBytes` (allowed sizes + commissioning-time caveat); Bus PATCH section rewritten as 3-field partial update; new top-level section for PLC PATCH.

### Inbox housekeeping
- **`pending-from-codesys.md`** — collapsed all three (FR-019 closure block + FR-020 + FR-021) into the "no open items" placeholder pointing at NOTIF-026.
- **`pending-for-codesys.md`** — appended **NOTIF-026** with field tables, sample payload, LasseMaja backfill list, plugin-blocker callout (their PATCH retry is now unblocked on :3000), and structured "what's left" closure list.

### Files touched
- `prisma/schema.prisma` — `CanRole` enum, three field additions
- `prisma/migrations/20260502052207_fr020_fr021_canrole_pi_kbus/migration.sql` (new)
- `src/app/api/codesys/project/[id]/route.ts` — selects + response mapping
- `src/app/api/codesys/projects/[id]/can-buses/[busId]/route.ts` — extended to 3-field partial update
- `src/app/api/codesys/projects/[id]/plcs/[plcId]/route.ts` (new) — PLC PATCH
- `docs/codesys-api-contract.md` — GET + field notes + Bus PATCH rewrite + new PLC PATCH section
- `docs/pending-from-codesys.md` — cleared to placeholder
- `docs/pending-for-codesys.md` — NOTIF-026
- `MIAS-Docs/Work Log.md` — this entry

---

## 2026-05-02 — FR-019 landed: per-bus `cyclicCallIntervalMs`

### Schema + migration
- **`Bus.cyclicCallIntervalMs : Int?`** (column `cyclic_call_interval_ms` on `plc_network`). Pragma allows null; range/multiple-of-10 enforced at the API boundary, not the DB, since the constraint is plugin-domain (CAN_Task cycle granularity) rather than data-integrity.
- Migration `20260501221614_fr019_bus_cyclic_call_interval_ms` — applied to local DB; the `prisma migrate diff` output showed unrelated FK/index renames as drift (cosmetic), stripped them out and committed only the additive `ADD COLUMN` statement.

### GET response
- **`src/app/api/codesys/project/[id]/route.ts`** — added `cyclicCallIntervalMs` in three places: outer `select` for `busNodes.bus`, inner `select` for `hostedBuses` (cards that host networks), and the response-mapping object. Null on every existing row — no behavior change for projects today.

### Write endpoint
- **`PATCH /api/codesys/projects/{id}/can-buses/{busId}`** (`src/app/api/codesys/projects/[id]/can-buses/[busId]/route.ts`) — new file. Partial-update shape; today only the one field but extensible. Validation order: integer-or-null → range `[10, 200]` → multiple-of-10 → bus belongs to project → bus protocol is CAN-family. Each rejection emits a distinct error message naming the failing constraint.
- **Hand-validation, no Zod** — matches the existing `/discovered/` sibling style; the rest of `src/app/api/codesys/` doesn't use Zod either.
- **Why partial-update PATCH instead of POST `/cadence`**: cadence is one of several plugin-owned bus configuration values that may grow over time; PATCH on the resource is the natural extension point.

### Smoke matrix (local dev, 8 cases)
- Valid 50 → `accepted: true`; GET response shows the value.
- 55 (not multiple of 10) → 400 with multiple-of-10 message.
- 5 (below 10) → 400 with range message.
- 250 (above 200) → 400 with range message.
- 50.5 (float) → 400 with integer-or-null message.
- Empty body `{}` → 400 with missing-field message.
- Non-CAN bus (MODBUS_RTU bus 24) → 400 with protocol message.
- `null` → clears the override; DB shows NULL again.

### Turbopack stale-route cache (note for next time)
- After creating the new route file, Next 16 + Turbopack returned 404 for both the new route AND the pre-existing `discovered` sibling. `touch`-ing both `route.ts` files forced a recompile and routes went live. Already documented in `feedback_turbopack_stale_route.md` — flagged here because it's recurring and the time-cost is meaningful.

### Contract
- **`docs/codesys-api-contract.md`** — added `cyclicCallIntervalMs` to the GET response example, added a field-note paragraph under "Notes on network / bus fields", and added a new top-level section for the PATCH endpoint with full request/response/error schemas.

### Inbox
- **`docs/pending-from-codesys.md`** — collapsed FR-019 into a `<details>` block with a closure marker pointing at NOTIF-025; plugin will remove the body when they ack. **FR-020 (`processImageBytes`) and FR-021 (`kbusCycleTimeMs`) landed in the same inbox poll** but are deferred to user direction — they're sibling K-bus / CAN-perf knobs, MEDIUM priority, no implementation work yet.
- **`docs/pending-for-codesys.md`** — appended **NOTIF-025** with implementation summary, smoke-test results, and a structured side-question reply punting the Kreisel PT-CAN/P-CAN mapping back to the human (Jaanus).

### Files touched
- `prisma/schema.prisma` — `Bus.cyclicCallIntervalMs`
- `prisma/migrations/20260501221614_fr019_bus_cyclic_call_interval_ms/migration.sql` (new)
- `src/app/api/codesys/project/[id]/route.ts` — three `select` clauses + response mapping
- `src/app/api/codesys/projects/[id]/can-buses/[busId]/route.ts` (new) — PATCH handler
- `docs/codesys-api-contract.md` — GET sample + field note + new PATCH section
- `docs/pending-from-codesys.md` — FR-019 collapsed
- `docs/pending-for-codesys.md` — NOTIF-025
- `MIAS-Docs/Work Log.md` — this entry

---

## 2026-05-01 — FR-015 Session A: fb-definitions endpoint accepts `wiringHint`

### Endpoint extension
- **`POST /api/codesys/fb-definitions`** (`src/app/api/codesys/fb-definitions/route.ts`) — accepts the FR-015 / NOTIF-023 payload: FB-level `alwaysReview` + `hintSchemaVersion`, plus `wiringHint` per parameter. Hand-validates against existing endpoint style (no Zod elsewhere in `api/codesys/`). Validation rejects bad enum values, bad scalar types, and malformed `matchTag` arrays with HTTP 400 and a clear `wiringHint on <fb>.<param>: …` message. Lowercase strawman enums normalized to Prisma's uppercase enum form at the boundary.
- **Persistence**: replaced the `createMany` parameter-insert path with a per-row `create` so hints can be attached inline as a Prisma nested write. Hint omitted on a parameter = no `codesys_fb_parameter_hint` row written (don't materialize empty hint rows). FB-level `hintSchemaVersion` is copied onto each hint row at write time so old hints can't be silently re-interpreted under a new matcher.
- **Versioning rule** — push is always accepted regardless of `hintSchemaVersion`. Push-time rejection on major mismatch would block the plugin cold; instead, the matcher will log a `wiring_recipe_gap` row with reason `INCOMPATIBLE_HINT_VERSION` lazily at match time. Documented in the contract.
- **Response shape extended** — adds `hintsCount`, `alwaysReview`, `hintSchemaVersion` per definition so the plugin can verify its curated hints landed.

### Smoke test (local dev :3000, MIAS-IO db)
- **One FB, four pins** (one full hint, one partial-hint with `commandKind: "pulse"` + `humanReview: true`, one `kind: "parameter"` with `defaultLiteral`, one no-hint pin). All four parameters created; 3 of 4 hint rows written; enums normalized correctly (`SIGNAL`/`ACTUAL`/`PULSE`/`PARAMETER`); `match_tag` TEXT[] preserved; `hint_schema_version` echoed onto every hint row.
- **Re-push (full replacement)** — re-POSTed the same FB with one parameter; old 4 params + 3 hints cascaded out; new 1 param + 1 hint in; `always_review` updated `false → true`. Idempotent.
- **Validation rejection** — `valueRole: "bogus"` → HTTP 400 + clear message; `alwaysReview: "yes"` → HTTP 400. No partial writes on rejection.
- Smoke rows dropped via `DELETE FROM codesys_fb_definition WHERE name LIKE '__SMOKE_%'`.

### Contract + protocol docs
- **`docs/codesys-api-contract.md`** — full rewrite of `POST /api/codesys/fb-definitions` section: documents the new top-level fields, full `wiringHint` field reference (15 fields), full-replacement re-push semantics, version-major rule, response shape (with `hintsCount`).
- **`docs/pending-for-codesys.md`** — appended **NOTIF-024**: endpoint live, push the FB_Hmi* batch; response now carries `hintsCount` for verification; heads-up that prod build on :8080 lags master until next rebuild.

### Notes for next session (Session B — matcher core)
- Open questions in handoff doc still need decisions before coding: unit-conversion family (auto-convert across same `engineering_unit.quantity` vs. treat as no-match), confidence threshold (default 0.75 vs. per-project), trigger model (auto-on-create vs. explicit button), re-run policy (need a `WiringRecipeParam.lockedAt` column).
- Plugin's curated FB_Hmi* push is the next external event we're waiting on. Once it lands, pick `Kreisel Electric BMS` for the first worked example as planned in NOTIF-023.

### Files touched
- `src/app/api/codesys/fb-definitions/route.ts` — extended endpoint, hand-validation, hint normalization, nested-write persistence
- `docs/codesys-api-contract.md` — rewrote fb-definitions section with wiringHint reference
- `docs/pending-for-codesys.md` — appended NOTIF-024
- `MIAS-Docs/Work Log.md` — this entry

---

## 2026-04-30 / 2026-05-01 — DevTools quality + raw values, FR-015 wiring-hint protocol locked

### DevTools — OPC UA quality coloring + raw analog values
- **Quality classifier** (`src/lib/opcua-quality.ts`): three-tier (`good`/`uncertain`/`bad`) from OPC UA StatusCode top 2 bits via `(code >>> 30)`; helpers `qualityDotClass`, `qualityTextClass`, `qualityBadgeClass`.
- **Live monitor** (`src/app/devtools/[projectId]/monitor/[plcId]/page.tsx`): dot color = quality, stale (> 5s) shown as a yellow ring around the dot instead of conflicting with quality color; value text picks up quality color; tooltip shows `<statusName> (0x<code>)`.
- **IO-Check session** (`src/app/devtools/[projectId]/io-check/session/[sessionId]/page.tsx`): scaled value + status pill colored by quality; for analog signals, raw counts shown faintly under the scaled value via a parallel `useLiveValues(..., "raw")` subscription (analog only).
- **WS protocol extended** (`src/server/lib/ws/protocol.ts`, `src/server/lib/ws/handlers.ts`, `src/server/lib/opcua/subscription-manager.ts`): `SubscribeMessage`/`UnsubscribeMessage`/`ValuesMessage` gain `mode: "scaled" | "raw"`. Subscription manager fans out per-mode and emits one `ValuesMessage` per mode per batch; raw subscriptions co-exist with scaled (different leaf nodeIds). `useLiveValues` filters incoming values by mode.
- **Node-id helpers** (`src/server/lib/opcua/node-id.ts`): added `buildRawReadNodeId` returning `<base>.AsRaw` for analog, `null` for discrete. Initially guessed `.AsDint`; flipped to `.AsRaw` after plugin reply (FR-021). Plugin confirmed `AsRaw` returns `__XWORD` raw counts via DAO; resolves through override chain (HMI override → returns override-equivalent counts, not physical card reading). Future swap to `.AsLastGood` after plugin's HAL/DAO refactor lands for source-only semantics.
- **Smoke test** (`scripts/smoke-d01-nodeids.ts`): pulls 5 D01 signals, builds nodeIds, reads via OPC UA. Validated `LT_FUEL_…` ≈ 99.999 scaled before PLC went offline for the rest of the day.

### FR-015 — Auto-fill wiring recipes (joint design with plugin)
- **Plugin's reply** received 2026-04-30 23:15 UTC inside FR-015 body in `pending-for-codesys.md`. Confirmed direction; proposed schema additions (`valueRole`, `humanReview`, `structRole`, `arrayCardinality`, top-level `kind`); vocabulary additions; governance asks (`hintSchemaVersion`, gaps log, `fb.alwaysReview`); honest auto-extraction estimate (~60% codebase, ~80% on FB_Hmi*); confirmed FB_Hmi* beachhead.
- **NOTIF-023 sent** (2026-05-01 19:25 UTC): all four schema additions accepted; vocabulary changes accepted (10 additions; `command_pulse` → `command_*` + `commandKind`; dropped `parent_composite_role`); governance accepted (`hintSchemaVersion` starts at `"1.0.0"`, gaps log table with full reason vocabulary, `fb.alwaysReview` at FB level); per-FB push protocol confirmed; edges accepted (VAR_IN_OUT via `defaultLiteral != null`, inherited pin propagation at match time, per-instance `wiringHintOverride` deferred to v2 with `fb.alwaysReview = true` as MVP fallback for firmware-variant FBs).
- **Schema migrated** (`prisma/migrations/20260501104500_add_wiring_hint_and_gap`):
  - 4 new enums: `wiring_hint_kind`, `wiring_hint_value_role`, `wiring_hint_command_kind`, `wiring_gap_reason`
  - `codesys_fb_definition` gains `always_review` BOOL + `hint_schema_version` VARCHAR(20)
  - New `codesys_fb_parameter_hint` table (1:1 with `codesys_fb_parameter`, full hint blob)
  - New `wiring_recipe_gap` table (project / instance / parameter FKs, reason enum, `resolved_at`)
- **Handoff doc** for next session: `MIAS-Docs/MIAS 2.0/CODESYS Integration/FR-015-handoff.md` — read-order list, what's done, plugin's parallel work (curating FB_Hmi* hints), three-session plan (A: endpoint extension + contract + smoke + NOTIF-024 unblock; B: matcher core; C: UI), locked-in design decisions, four open matcher questions.

### FR-016 / FR-017 / FR-021 round-trips
- **NOTIF-020** posted closing FR-016 (`wontfix-use-existing` — DevTools writes use `_rHmiValue`/`_xHmiBool`/`_bHmiOverrideActive`, no plugin code change) and FR-017 (HAL tag rule reimplemented per plugin's `DaoVarName` algorithm — component-tag-anchored substring with IEC digit-prefix and 64-char cap). Plugin removed NOTIF-020 from queue overnight.
- **FR-021** filed asking which getter exposes analog raw counts. Plugin replied: `AsRaw` not `AsDint`; resolves through override chain; future `AsLastGood` is the source-only path.
- **NOTIF-022** posted confirming `.AsDint → .AsRaw` flip + override-chain caveat documented in tooltip. Plugin removed both FR-021 and NOTIF-022 from queue at 10:44 UTC the next day.

### Schema management note
- Prisma 7 dropped `--from-schema-datasource` and `--from-url` from `prisma migrate diff`. Replacement form: `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`. Apply via `docker exec -i mias-io-postgres-1 psql -U mias -d mias_io < migration.sql` to avoid the dev-server DLL lock on Windows.

### Files touched
- `src/lib/opcua-quality.ts` (new)
- `src/server/lib/opcua/node-id.ts` (added `buildRawReadNodeId`, flipped `.AsDint` → `.AsRaw`)
- `src/server/lib/opcua/subscription-manager.ts` (per-mode fanout, `nodeMode` map, mode-grouped flushBatch)
- `src/server/lib/ws/protocol.ts` (mode field on Subscribe/Unsubscribe/ValuesMessage)
- `src/server/lib/ws/handlers.ts` (resolveSignalNodeIds gains "raw" mode; subscribe/unsubscribe pass mode through)
- `src/hooks/use-live-values.ts` (mode parameter, filters incoming by mode)
- `src/app/devtools/[projectId]/monitor/[plcId]/page.tsx` (quality coloring, ring for staleness)
- `src/app/devtools/[projectId]/io-check/session/[sessionId]/page.tsx` (quality coloring + raw value display + override-chain tooltip)
- `prisma/schema.prisma` (CodesysFbDefinition gains alwaysReview + hintSchemaVersion; new CodesysFbParameterHint, WiringRecipeGap, four new enums; back-relations on Project + ComponentInstance + CodesysFbParameter)
- `prisma/migrations/20260501104500_add_wiring_hint_and_gap/migration.sql` (new — applied to local DB)
- `scripts/smoke-d01-nodeids.ts` (new — D01 smoke test)
- `docs/pending-for-codesys.md` (FR-021, NOTIF-022, NOTIF-023 added; NOTIF-020 removed by plugin)
- `MIAS-Docs/MIAS 2.0/CODESYS Integration/FR-015-handoff.md` (new — handoff doc for next session)

---

## 2026-04-17 — Wiring Recipe Layer System (FR-001)

### Design & Function Request
- **Designed multi-layer wiring recipe system** for automatic component → HMI block and component → PMS wrapper connections
- Three code-generation layers per ComponentInstance: CONTROL (existing), HMI (`FB_Hmi*` in `GVL_HMI`), PMS (`FB_PMS*` in `GVL_PMS`)
- WiringRecipe model already supports this — needs a `layer` enum (`CONTROL`, `HMI`, `PMS`, `HAL`, `ALARM`) and recipe CRUD on the components router
- Cross-layer reference resolution: HMI/PMS recipes reference the control-layer instance via `INSTANCE_FB` source type
- PMS registration (`fbPms.RegisterComponent(ADR(...))`) is implicit from PMS-layer recipe existence
- **Filed as FR-001** in `docs/pending-from-codesys.md` for MIAS-IO agent to implement

### Files touched
- `docs/pending-from-codesys.md` — full function request with schema, API, UI, seed data specs

---

## 2026-04-16 / 2026-04-17 — DevTools + MIAS_Core PMS + Simulation + Components

### MIAS-IO Web App
- **DevTools feature**: OPC UA bridge (`src/server/lib/opcua/`), WebSocket server (`src/server/lib/ws/`), custom `server.ts`, mobile pages (`src/app/devtools/`), IO-Check schema + tRPC router
- **Local Docker**: `docker-compose.local.yml`, `scripts/docker-entrypoint.sh`, auto-seed on first boot
- **Plugin README**: `GET/POST /api/codesys/plugin/readme`, collapsible markdown viewer on Settings > Remote
- **Dual auth**: `requireApiKeyOrSession()` for upload + readme endpoints
- **Project dataVersion**: migration `20260331020000`, auto-increment trigger, included in export/import
- **7 slash commands**: `/inbox`, `/migrate`, `/seed-deploy`, `/version`, `/deploy`, `/export-check`, `/audit-schema`
- **Deployed**: v0.6.11 to demo

### MIAS_Core PLC Library
- **PMS core updates**: `FB_PMS` — voltage-based blackout, spinning reserve, optional equalization, fast ROC tracking. `FB_PMSComponent` — priority preset support (`ST_PMSModePreset`, `ST_PMSPriorityTable`), health span bounds
- **Kreisel BMS driver**: `HAL/CAN/BMS/FB_KreiselBMS` with CBM lifecycle, 5 enums (E_KreiselState, E_KreiselHvilState, E_KreiselIsolationState, E_KreiselIsolationError, E_KreiselStringState)
- **Battery pack management**: `PMS/FB_BatteryPack` with CBM — string connection, overload protection, charge management with hysteresis, nightly calibration state machine
- **Direct battery updates**: `FB_PMSDirectBattery` — BatteryPack integration, dynamic priority (cPrio increases at low SOC)
- **Genset separation principle**: `FB_PMSGenset` — always reports capacity when available, non-zero setpoint triggers start, spinning reserve = headroom at current RPM
- **Simulation framework**: `Sim/` folder — FB_SimDCBus (capacitor model), FB_SimBattery (SOC + OCV + state machine), FB_SimConverter (state + first-order lag), FB_SimGensetEngine (RPM + thermal + ComAP states), FB_SimPropulsion (quadratic lever), FB_SimShore, FB_SimController (8 scenarios), E_SimScenario enum
- **Engineering objects**: `DAO/FB_TankSensor` (CHARCURVE-based), `Components/FB_DiscreteActuator` (CBM, DO+DI+DI), `Components/FB_AnalogActuator` (CBM, AO+AI+deviation)

### Obsidian Vault (MIAS-Docs/)
- **Created vault structure**: MIAS-Legacy/, MIAS 2.0/, Lasse-Maja/, Reference/
- **Legacy analysis**: Alveli PMS Architecture, Deep Dive (batteries/charging/propulsion/Editron), Alarm System, HMI Objects
- **MIAS 2.0 architecture**: PMS Separation Principle, Self-Regulating PMS Concept, CBM Lifecycle Pattern, Legacy vs New PMS Analysis, Component Inventory & Feasibility, Outstanding Questions (21/21 resolved), Kreisel BMS CAN Protocol, Simulation Framework, Component Composition Patterns
- **Lasse-Maja**: Functional Description (converted from docx), Battery Calibration Procedure

### Key Design Decisions Made
- Ship modes ARE priority presets (table of pPrio/cPrio per component type per mode)
- Components report what they CAN provide, not what they ARE providing
- PMS only writes setpoints — components manage their own lifecycle
- Genset spinning reserve = headroom at current RPM, not theoretical max
- Equalization optional (disabled by default)
- Direct-connected batteries: passive in PMS (ApplySetpoint is no-op)
- All control FBs use CBM composition (LConC) — no exceptions
- Single signal = DAO extension, multiple signals = Component
- Kreisel: PT-CAN required, P-CAN optional
- Battery ±4V voltage matching, nightly calibration HMI-controlled
- No PLC redundancy on Lasse-Maja
- HMI via CODESYS proprietary protocol (not OPC UA) to EXOR/JMobile panels
- Remote access via IXON router during development
