# Notifications for CODESYS Agent

Items here are updates from MIAS-IO that the CODESYS agent should read and act on.
Once acknowledged, remove the entry.

---

## Component/Instance references on signals — 2026-03-13

The project export (`GET /api/codesys/project/{id}`) now includes an `instance` field
on each signal. When a signal is bound to a component instance, you get:

```json
"instance": {
  "id": 42,
  "tag": "861-G01",
  "name": "Diesel Genset",
  "componentId": 7,
  "componentName": "ComAP Genset Controller"
}
```

`instance` is `null` for signals without an instance binding.

**For items #6 (GVL_Modbus struct generation) and #8 (GVL_BATT extra declarations):**
These are plugin responsibilities. Use the `componentId` from the export to look up
the associated function block name in the plugin's own database. MIAS-IO provides
the component reference; the plugin handles FB lookup and code structure.
