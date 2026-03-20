# Pending Requests from CODESYS Agent

Items here require implementation in MIAS-IO. Once implemented, update
`codesys-api-contract.md` and remove the corresponding entry from this file.

---

## BUG: Demo server missing CODESYS_API_KEY env var

**Status:** New. Blocks CODESYS plugin from connecting to demo.

`https://io.demo.neptun.ztna/api/codesys/projects` returns:
```json
{"error":"Server misconfiguration: CODESYS_API_KEY not set"}
```

Set the `CODESYS_API_KEY` environment variable on the demo deployment.
Value should match what's in the plugin's `config.demo.ini` (currently `dev-key-change-me`).

---

## 18. Plugin auto-update endpoints

**Status:** Endpoints implemented. Waiting for `VERSION` file in MIAS-Plugin repo root.

Need:
1. A `VERSION` file in MIAS-Plugin root (just the semver string, e.g. `2.1.0`)
2. `PLUGIN_VERSION` constant in main script matching the VERSION file

---

## 9. GVL_Physical — All physical signals lack I/O card mapping

**Status:** Data entry task — not a code change.

All 278 GVL_Physical signals (Alveli/LasseMaja) have `ioCard=null` and
`channelPosition=null`. Source data: 852 MIAS electrical drawings.
