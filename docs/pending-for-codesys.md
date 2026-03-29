# Notifications for CODESYS Agent

Items here are updates from MIAS-IO that the CODESYS agent should read and act on.
Once acknowledged, remove the entry.

---

## NEW: Push FB Definitions to MIAS-IO

**Date:** 2026-03-30

MIAS-IO now accepts FB pin definitions via API. The plugin should extract FB
declarations from CODESYS libraries/projects and POST them so the wiring editor
can use them.

### Endpoint: `POST /api/codesys/fb-definitions`

**Auth:** `X-API-Key` header

**Request body** — single object or array:

```json
[
  {
    "fbName": "Editron_Converter_FW11_MC",
    "extendsName": "Editron_Converter_FW11",
    "sourceFile": "METS-LIB.fbslib",
    "parameters": [
      { "name": "Enable", "direction": "VAR_INPUT", "dataType": "BOOL" },
      { "name": "NodeID_stack1", "direction": "VAR_INPUT", "dataType": "DWORD" },
      { "name": "Speed_reference_RPM", "direction": "VAR_INPUT", "dataType": "INT" },
      { "name": "Speed_Actual_RPM", "direction": "VAR_OUTPUT", "dataType": "INT" },
      { "name": "Ready_For_Run", "direction": "VAR_OUTPUT", "dataType": "BOOL" },
      { "name": "CANRxBuffer", "direction": "VAR_IN_OUT", "dataType": "ARRAY [0..255] OF strCanMessage" }
    ]
  }
]
```

| Field | Required | Notes |
|---|---|---|
| `fbName` | yes | FB type name — must match `component.functionBlock` for auto-linking |
| `extendsName` | no | Parent FB name (inheritance tracking) |
| `sourceFile` | no | Source file path (default: `"plugin-api"`) — used for upsert uniqueness |
| `parameters[].name` | yes | Parameter name exactly as declared |
| `parameters[].direction` | yes | `VAR_INPUT`, `VAR_OUTPUT`, `VAR_IN_OUT`, or `VAR` |
| `parameters[].dataType` | yes | IEC 61131-3 data type string |

### What to extract

- All `VAR_INPUT`, `VAR_OUTPUT`, `VAR_IN_OUT` parameters
- Skip `VAR` internal variables
- Skip parameters with `{attribute 'symbol' := 'none'}` (hidden internal vars)
- Include the data type as written in the declaration (e.g. `INT`, `BOOL`, `REAL`, `DWORD`, structs, arrays)

### Behavior

- Upserts by `(fbName, sourceFile)` — re-posting replaces all parameters
- Auto-links to HardwareComponent where `functionBlock = fbName`
- Can batch multiple FBs in one request

### Response

```json
{
  "accepted": true,
  "definitions": [
    {
      "id": 42,
      "fbName": "Editron_Converter_FW11_MC",
      "componentId": 4,
      "componentMatched": true,
      "parametersCount": 6
    }
  ]
}
```

### When to call

- On library sync / import
- When user triggers "Push FB definitions" from plugin UI
- After re-parsing a modified `.fbslib` or `.fbsproj`

---

## NEW: Components Endpoint Available

**Date:** 2026-03-30

`GET /api/codesys/project/{id}/components` is live. Returns all component
instances with PDO configs (including `mappingDword`, `cobIdResolved`,
`timeoutMs`) and wiring data. See `codesys-api-contract.md` for full spec.

This is the endpoint needed for CAN configuration and FB wiring code generation.
