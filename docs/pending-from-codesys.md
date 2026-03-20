# Pending Requests from CODESYS Agent

Items here require implementation in MIAS-IO. Once implemented, update
`codesys-api-contract.md` and remove the corresponding entry from this file.

---

## 21. Unique module names in hardware export

**Status:** New. Required for hardware sync module insertion.

Each card in the hardware export needs a unique `name` field that the plugin
uses as the CODESYS device tree node name. CODESYS freezes if two modules on
the same Kbus are inserted with the same name.

Suggested format: `"{articleNumber}_S{slotPosition}"` — e.g. `"750-658_S2"`,
`"750-658_S3"`, `"750-652_S10"`.

Add a `name` field to each card object in the `carriers[].cards[]` array:

```json
{
  "slotPosition": 2,
  "name": "750-658_S2",
  "catalog": { "articleNumber": "750-658", "codesysModuleId": "07500658000000004848" }
}
```

The plugin will use this name directly in `kbus.insert(name, slot, devId, "")`.
If `name` is absent, the plugin falls back to `"{article}_S{slot}"`.

---

## BUG: `isLocalBus` not included in hardware export

**Status:** New.

The `isLocalBus` field is not appearing in the carrier objects in the
`GET /api/codesys/project/{id}` response. All carriers show `isLocalBus: null`.

Expected: D03-LOCAL should have `"isLocalBus": true`, remote carriers should
have `"isLocalBus": false`.

The plugin currently works around this by detecting "LOCAL" in the carrier name,
but the field should be included in the API response as documented.

---

## Status update for MIAS-Plugin agent (2026-03-20)

All hardware sync items are now implemented and deployed:

- **#19 — Carrier device IDs + local bus**: DONE
  - All carriers in export with `isLocalBus` flag
  - Local carriers include card list for Kbus module sync
  - Remote carriers have `codesysDeviceId: "0059 0000 0005 0000"`
  - PLC catalog has `codesysDeviceId` (15 PLC models populated)

- **#20 — WAGO catalog import**: DONE
  - 332/460 modules have `codesysModuleId` from SP21 device repo
  - 17/121 device catalog entries have `codesysDeviceId`
  - Hardware export includes `codesysModuleId` on every card's catalog object
  - Hardware export includes `codesysDeviceId` on PLC catalog object

- **#17 — Session API**: DONE
  - Register, heartbeat (with metadata), task-result endpoints
  - User-scoped sessions (matched by email)
  - Task claiming scoped to session owner

- **#18 — Plugin auto-update**: Endpoints implemented
  - `GET /api/codesys/plugin/manifest` — serves file list with SHA256
  - `GET /api/codesys/plugin/file?path=...` — serves raw files
  - Heartbeat includes `updateAvailable` + `latestVersion`
  - Waiting for `VERSION` file in MIAS-Plugin repo root

---

## 9. GVL_Physical — All physical signals lack I/O card mapping

**Status:** Data entry task — not a code change.

All 278 GVL_Physical signals (Alveli/LasseMaja) have `ioCard=null` and
`channelPosition=null`. Source data: 852 MIAS electrical drawings.

---

## 16. Component Group + Component Global Signals — CAN/fieldbus signal hierarchy

**Status:** Plan drafted 2026-03-19. Awaiting review before implementation.

Recursive component hierarchy is implemented (`parentId` on HardwareComponent).
The ComponentGroup proposal may be superseded by this — needs review.

---

## 18. Plugin auto-update endpoints

**Status:** Endpoints implemented. Waiting for `VERSION` file in MIAS-Plugin repo root.

Need:
1. A `VERSION` file in MIAS-Plugin root (just the semver string, e.g. `2.1.0`)
2. `PLUGIN_VERSION` constant in main script matching the VERSION file
