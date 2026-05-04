# Lasse-Maja extracted data — access guide

This document tells another Claude instance how to read the Lasse-Maja vessel data extracted by the Drawing Interpreter agent. The data is the canonical, queryable representation of the vessel's electrical CAD package, equipment lists, functional descriptions, IO schedules, and CAN bus definitions.

You are a **consumer** of this data. You do not modify it. If something is missing, wrong, or you need it in a different shape, raise it — do not patch the files.

---

## Where the data lives

Absolute roots (Windows):

```
Tier 2 (full agent-readable cache, source-of-truth transcription):
  C:\Users\jaanus.heeringson\Documents\MIAS\agents\drawing-interpreter\tier2\Lasse-maja\

Tier 1 (normalized entities, relationships — query this first):
  C:\Users\jaanus.heeringson\Documents\MIAS\agents\drawing-interpreter\tier1\Lasse-maja\
```

The directory name is `Lasse-maja` (lowercase `m`). The internal `project_id` field is also `Lasse-maja`. The vessel's commercial project number is `25425`.

---

## Two tiers — read this before anything else

**Tier 1** is the normalized entity model. Use this for almost everything:
- "Show me all cables between panel X and panel Y"
- "What IO modules are in 852-A01?"
- "What CAN messages does node BMS01 send?"
- "Where does signal X-101 land on the PLC?"

**Tier 2** is the verbatim transcription of every source file (Elprocad MDBs, PDFs, Word docs, Excel workbooks, DBC files, DWG attributes, project config). Use Tier 2 only when:
- Tier 1 is missing data you need and you want to verify it isn't in the source
- You need free-text content (functional descriptions, design review notes, narratives)
- You need to debug an extraction by going back to the original

**Never read the original Elprocad/PDF/DWG files directly.** They are agent-hostile (binary, scanned, vector). The Tier 2 JSON is what you read.

---

## Tier 1 — file inventory

All files are JSON. All paths below are relative to `tier1/Lasse-maja/`.

| File | Shape | Purpose |
|------|-------|---------|
| `project.json` | dict | Project metadata: id, name, vessel name, Elprocad version, drawing standard |
| `summary.json` | dict | High-level counts (entities, relationships, conflicts, by entity_type) — read this first to orient |
| `schema.json` | dict | Discovered entity types with attribute frequencies; relationship types with from/to type histograms |
| `systems.json` | list | SFI systems (e.g. 803 = MAIN SWITCHBOARDS, 852 = AUTOMATION) |
| `source_files.json` | list | Every original file processed, with `id` referenced by every `source` block |
| `drawing_pages.json` | list | Drawing pages with system grouping, drawing number, equipment unit |
| `entities.json` | list | **The 4,018 entities.** Equipment, cables, terminals, IO modules, signals, CAN messages, etc. |
| `relationships.json` | list | **The 30,617 relationships.** `connects`, `contains`, `sub_unit_of`, `shown_on`, `monitors`, `cross_references`, `sends` |
| `connectivity.json` | dict | Pre-aggregated panel-to-panel and panel-to-equipment cable bundles (use as an index, derive from relationships if you need fidelity) |
| `containment.json` | dict | Pre-aggregated panel → contents tree (for "what's in this cabinet?") |
| `conflicts.json` | list | Attribute-level conflicts where two sources disagree (~37k entries — most are benign terminal name variations across pages of the same drawing) |
| `coverage.json` | dict | Per-entity flag of which formats contributed (mdb / pdf / docx / xlsx / dbc) |
| `diagrams/`, `diagrams-comm/`, `diagrams-power/` | HTML | Generated validation visualizations per system block. Useful for human review, not for programmatic consumption. |

`summary.json` claims at the time of extraction (2026-03-16):
- 4,018 entities, 30,617 relationships, 431 drawing pages, 80 source files, 18 systems

These numbers may drift if the pipeline re-runs. Always read `summary.json` for current counts; never hardcode them.

---

## Entity model

Every entity in `entities.json` looks like this:

```json
{
  "id": "Lasse-maja:871-001",
  "project_id": "Lasse-maja",
  "tag": "871-001",
  "parent_tag": null,
  "entity_type": "equipment",
  "system_id": null,
  "name": null,
  "description": null,
  "attributes": [
    {
      "id": "attr_1",
      "entity_id": "Lasse-maja:871-001",
      "key": "location",
      "value": "871-MSB1",
      "confidence": "direct",
      "source": {
        "source_file_id": "mdb:24485-871-01",
        "page": "803",
        "area": "",
        "extraction_method": "mdb_parser"
      }
    }
  ]
}
```

Key rules:
- `id` is globally unique: `<project_id>:<tag>`. Use the `id`, not the `tag`, when joining across files.
- `tag` follows the SFI convention: `<system>-<designation><number>` (e.g. `871-Q02`, `625-M01`, `852-A01`). System number prefix is the SFI group.
- `entity_type` is one of ~35 discovered types. Most populous: `io_module` (1261), `cable` (615), `can_message` (499), `signal` (272), `equipment` (244), `terminal` (205), `contactor` (147), `fuse` (140), `circuit_breaker` (104), `panel` (70), `bus` (64), `plc` (27).
- `attributes` is a **list of attribute records**, not a dict. Each attribute has its own `id`, `confidence`, and `source`. The same key can appear multiple times if multiple sources reported it (one with `direct` confidence from the MDB, one with `inferred` from a PDF, etc.).

### Attribute confidence

Three levels:
- `direct` — explicitly shown in the source (e.g. an Elprocad item attribute, a value in an Excel cell)
- `inferred` — deduced from context (e.g. cable class from cable type, connection endpoint from spatial proximity)
- `uncertain` — flagged for human review

Treat `inferred` and `uncertain` as hypotheses, not facts. If your downstream logic depends on certainty, filter to `direct`.

### Attribute keys you will actually use

For most equipment: `location`, `manufacturer`, `type_number`, `article_number`, `denomination`, `description`, `specification`, `supplier`, `component_type`.

For cables: `cable_type` (e.g. `3G1,5/SC`, `CAT6`, `1x70`), `from_equipment`, `to_equipment`, `cable_description`, `description`.

For signals (the IO list): `system`, `card_type` (DI / DO / AI / AO / AO/DO), `plc_controller`, `io_card`, `channel`.

For CAN messages: `message_id` (e.g. `0x380`), `message_name`, `signal_count`, `cycle_time_ms`.

For circuit breakers / contactors / switches: `terminal_1` … `terminal_6`, `rating`, `contact_function`.

The full list of known keys with sample values is in `schema.json`. Read it when you need to know what's available.

---

## Relationship model

Every relationship in `relationships.json` looks like this:

```json
{
  "id": "rel_1",
  "project_id": "Lasse-maja",
  "from_entity_id": "Lasse-maja:871-001",
  "to_entity_id": "Lasse-maja:803",
  "relationship_type": "shown_on",
  "confidence": "direct",
  "source": {
    "source_file_id": "mdb:24485-871-01",
    "page": "803",
    "area": "",
    "extraction_method": "mdb_parser"
  },
  "attributes": {}
}
```

### Relationship types and what they mean

| Type | Count | What it means |
|------|-------|---------------|
| `shown_on` | 18,991 | Entity appears on a drawing page (`to_entity_id` is a drawing-page identifier, not an entity — see caveat below). Use to answer "where is this drawn?" |
| `contains` | 5,862 | Physical/topological containment. Panels contain terminals, modules, contactors. |
| `cross_references` | 1,906 | Cross-reference markers between contact symbols across pages (Elprocad-specific). Mostly contactor coil ↔ contact links. |
| `connects` | 1,612 | **Cable connectivity.** `from_entity_id` is almost always a cable; `to_entity_id` is the endpoint (panel/equipment/terminal). For each cable you'll see two `connects` rows — one per endpoint. |
| `sub_unit_of` | 1,297 | Logical child-of (IO modules → PLC, can_gateway → PLC, power_supply_module → equipment). Different from `contains`. |
| `sends` | 506 | CAN node sends a CAN message. `from` is `can_node`, `to` is `can_message`. |
| `monitors` | 443 | A signal monitors a piece of equipment / a sensor. Source: IO list. |

### Caveat on `shown_on`

The `to_entity_id` for `shown_on` rows is a page-level ID (e.g. `Lasse-maja:803`) which **may not exist** as an entity in `entities.json`. Drawing pages live in `drawing_pages.json`, not `entities.json`. If you naively join `shown_on.to_entity_id` to `entities.json`, you'll get nulls — that's expected. Join to `drawing_pages.json` instead, matching on `id`.

The validation visualizer drops `shown_on` rows when rendering for this reason.

---

## Provenance — every fact carries its origin

Every attribute and every relationship has a `source` block:

```json
{
  "source_file_id": "mdb:24485-871-01",
  "page": "803",
  "area": "",
  "extraction_method": "mdb_parser"
}
```

- `source_file_id` joins to `source_files.json` → tells you which original file (and its on-disk path)
- `page` is the page identifier within that source (Elprocad page number, PDF page, Excel sheet name, etc.)
- `area` is a region-within-page hint when meaningful, empty otherwise
- `extraction_method` tells you which tool produced the record (`mdb_parser`, `pdf_text_extractor`, `xlsx_extractor`, `docx_extractor`, `dbc_parser`, `dwg_attribute_extractor`)

When you cite data downstream, propagate the source. Never present extracted facts as authorless.

---

## Conflicts

`conflicts.json` records cases where two sources disagreed on the same attribute of the same entity. Example:

```json
{
  "entity_id": "Lasse-maja:871-001",
  "tag": "871-001",
  "attribute_key": "terminal_1",
  "value_a": "BLÅ",
  "source_a": { "source_file_id": "mdb:24485-871-01", "page": "803" },
  "value_b": "BRUN",
  "source_b": { "source_file_id": "mdb:24485-871-01", "page": "803" }
}
```

There are ~37,000 conflicts. **Most are benign**: the same terminal appears on multiple pages of an Elprocad drawing with slightly different free-text labels. Do not panic. If you need to filter:
- Same source file + same page = almost always cosmetic (whitespace, color name in Swedish vs English, character encoding)
- Different source files = potentially meaningful — could be a real spec disagreement between, say, the equipment list and the schematic

The data model preserves both values with both sources. Resolution is a downstream concern.

---

## Coverage — which entities came from where

`coverage.json` tells you, per entity tag, which formats reported it. Example:

```json
"871-W101": {
  "dbc": false,
  "docx": false,
  "mdb": true,
  "pdf": true,
  "xlsx": false
}
```

Whole-corpus split (`format_counts`):
- `mdb`: 2,298 entities (Elprocad — the electrical CAD)
- `pdf`: 633 entities
- `xlsx`: 501 entities (equipment lists, IO lists, cable schedules)
- `dbc`: 520 entities (CAN bus definitions)
- `docx`: 2 entities (functional descriptions — mostly contributing free text, not entities)

If you only see an entity in one format, treat the data as single-sourced (no cross-validation).

---

## Tier 2 — when you need verbatim source content

Subdirectories under `tier2/Lasse-maja/`:

```
config/   project_config (Elprocad lookup tables, designation maps, terminal definitions)
mdb/      Elprocad binary database transcriptions (the bulk of the electrical content)
dbc/      CAN bus definitions
dwg/      DWG block attribute dumps
docx/     Functional descriptions, design review checklists, ventilation notes
xlsx/     Equipment lists, IO lists, cable lists, BOMs, wire numbers
pdf/      PDF schematic transcriptions (text + identifier extraction)
```

Each file is one source document. Match by `source_file_id` from a Tier 1 record's `source` block: e.g. `mdb:24485-871-01` → `tier2/Lasse-maja/mdb/24485-871-01.json`.

Use Tier 2 to look up:
- Free-text functional descriptions ("How is the fire pump auto-start specified?")
- Design review notes
- Drawing register entries
- Anything that is narrative rather than entity-shaped

---

## Common queries — recipes

These are starting points. Implement them by reading the JSON files (Python, jq, etc.) — there is no query API.

### "What equipment is in panel 852-A01?"
1. Read `containment.json` and look up the `852-A01` key.
2. For full detail, find all `relationships.json` rows where `relationship_type == "contains"` and the from-entity has `tag == "852-A01"`. Resolve `to_entity_id` against `entities.json`.

### "What are the cables between panel 871-MSB01 and panel 871-MSB1 DC?"
1. Quick: read `connectivity.json` — pre-aggregated bundles by `(from_tag, to_tag)`.
2. Detailed: filter `entities.json` for `entity_type == "cable"` whose attributes include `from_equipment == "871-MSB01"` and `to_equipment == "871-MSB1 DC"`.
3. Or: filter `relationships.json` for `connects` rows where the cable's other `connects` row points to the second panel.

### "What signals does PLC D03 read?"
Filter `entities.json` for `entity_type == "signal"` and an attribute with `key == "plc_controller"`, `value == "D03"`. Group by `card_type` (DI / DO / AI / AO).

### "What CAN messages does the BMS send?"
Filter `relationships.json` for `relationship_type == "sends"` and resolve `to_entity_id` to the `can_message` entities. Their attributes give `message_id`, `cycle_time_ms`, `signal_count`.

### "Where does cable 871-W101 connect to?"
Filter `relationships.json` for `from_entity_id == "Lasse-maja:871-W101"` and `relationship_type == "connects"`. You'll get two rows (both endpoints).

### "On which drawing pages does pump 625-M01 appear?"
Filter `relationships.json` for `from_entity_id == "Lasse-maja:625-M01"` and `relationship_type == "shown_on"`. The `to_entity_id` values join to `drawing_pages.json`.

### "Get the functional description of the fire-fighting system"
Read `tier2/Lasse-maja/docx/25425-852-51 Functional description.json` (or grep `tier2/Lasse-maja/docx/` for the matching system).

---

## Things to know before you start

1. **The vessel project number is 25425, but you'll see related project codes** (`24485-871-01`, `25425-852-51`, etc.) in source file names. That's the Elprocad sub-document numbering — same vessel, different drawing packages.
2. **Encoding**: a few files contain mojibake (`BL�` for `BLÅ`, etc.) where Swedish characters didn't survive Elprocad export. Don't infer that those are missing values — re-check Tier 2 if it matters.
3. **Tags are not always unique across sources.** The same designation may appear on multiple drawings; Tier 1 has merged them into one entity by tag. Trust `id`, not raw `tag` matching.
4. **Don't trust `entity_count` and `relationship_count` to be stable.** The pipeline re-runs. Read `summary.json` to get current counts.
5. **Cable classification (`power` / `signal` / `comm`)** is an inference based on `cable_type`, not a directly-extracted fact. It's correct in aggregate but check edge cases.
6. **`bus` entities are inferred topology** — they represent electrical buses derived from cable connectivity, not explicit bus tags from the drawings. Bus assignment has known issues; use with care.

---

## What you cannot do from this data alone

- You cannot get pixel-accurate geometry. Drawings are extracted as entities + relationships, not as 2D layouts.
- You cannot get vendor-specific PLC project files (CODESYS source, IEC 61131-3 code) — those live in this repo, not in the extracted data.
- You cannot get the runtime/operational state of a vessel. This is design-time data only.
- You cannot regenerate the original drawing 1:1. The interpreter validation visualizer can produce a domain-agnostic graph, but that's a sanity check, not a faithful redraw.

---

## Boundaries — what to do, what not to do

You are reading this data to inform PLC development work in MIAS-Plugin. **Do not write to the extraction directories.** If you find an extraction problem:

1. Don't patch the JSON. The extraction will be re-run and your patch will be overwritten.
2. Don't re-extract from originals yourself. The Drawing Interpreter agent owns extraction.
3. Write a bug report to `C:\Users\jaanus.heeringson\Documents\MIAS\agents\drawing-interpreter\inbox\` describing what you saw, in which file, and what you expected.

If you need the data in a different shape (flattened, denormalized, joined to a specific view), build that view inside MIAS-Plugin. Don't ask the Drawing Interpreter to pre-shape data for your consumption — it intentionally serves a normalized model.
