# Pending Requests from CODESYS Agent

Items here require implementation in MIAS-IO. Once implemented, update
`codesys-api-contract.md` and remove the corresponding entry from this file.

---

## ~~3. POST hardware write-back endpoint~~ — RESOLVED 2026-03-13

Implemented at `POST /api/codesys/project/{id}/hardware`. Read-compare only (no DB writes).
Matches PLCs by name/IP, carriers by name or card overlap, modules by slot position.
Returns `{ accepted, matched, unrecognised, warnings }`.
See `docs/codesys-api-contract.md` for full spec.

---

## ~~6. GVL_Modbus struct-based generation~~ — REDIRECTED to MIAS-Plugin 2026-03-13

MIAS-IO now provides `instance` (with `componentId` and `componentName`) on each
signal in the project export. The plugin should use `componentId` to look up the
associated FB/struct name and generate the appropriate GVL declarations.
This is a plugin-side code generation concern, not an MIAS-IO API concern.

---

## ~~8. GVL_CAN and GVL_BATT — extra declarations~~ — REDIRECTED to MIAS-Plugin 2026-03-13

> FB_INSTANCES generation mode and component data are in place.
> Signal-bound instances are now exposed via the `instance` field in the project export.

**Remaining — extra declarations (non-signal instances):**
GVL_BATT needs non-signal instances per pack (e.g. `Kreisel_BMS_Comm_FWD : Kreisel_BMS_Comm;`).
Signal-less instances are outside MIAS-IO's signal export scope — the plugin should
handle these as static declarations or request a separate endpoint if needed.

---

## 9. GVL_Physical — All physical signals lack I/O card mapping

**Status:** Data entry task. All 278 GVL_Physical signals have `ioCard=null` and
`channelPosition=null`. The plcAddress computation code is now fixed (carrier offset
accumulation works), but signals need ioCard + channelPosition populated.

Source data: 852 MIAS electrical drawings (852509–852514, I/O SYSTEM D03).

---

## ~~10, 11, 12~~ — WITHDRAWN

> These items incorrectly listed specific signals from the Alveli reference project
> and asked MIAS-IO to add them. Signal definitions must come from each project's
> own design documentation (electrical drawings, system specifications), not be
> reverse-engineered from another project's CODESYS implementation. MIAS-IO is the
> source of truth for signal data — the CODESYS agent consumes it, not the other
> way around.

---

## ~~13. `plcDataType` fallback chain~~ — RESOLVED 2026-03-13

Generator fallback chain implemented. Data population is a per-project task
handled through normal MIAS-IO signal entry, not a CODESYS agent request.

---

## ~~15. HVAC Modbus register metadata~~ — RESOLVED 2026-03-13

All 12 GVL_HVAC signals now have correct registerOffset, bitOffset, and unitId.
Migration: `prisma/migration_hvac_register_metadata.sql`

---

## 16. Component Group + Component Global Signals — CAN/fieldbus signal hierarchy

**Status:** Needs planning. Major schema addition.

This adds a three-level signal hierarchy (group → component → instance) for CAN bus
converter families like Editron. Required for proper GVL_Settings generation and
component-shared configuration parameters.

**ACTION: Plan the schema changes and UI for this three-level signal hierarchy.
Show the plan to the user before implementing.**
