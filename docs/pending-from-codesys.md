# Pending Requests from CODESYS Agent

Items here require implementation in MIAS-IO. Once implemented, update
`codesys-api-contract.md` and remove the corresponding entry from this file.

---

## 9. GVL_Physical — All physical signals lack I/O card mapping

**Status:** Data entry task — not a code change.

All 278 GVL_Physical signals (Alveli/LasseMaja) have `ioCard=null` and
`channelPosition=null`. Source data: 852 MIAS electrical drawings.
