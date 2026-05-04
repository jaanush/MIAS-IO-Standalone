# FR-015 — Auto-fill wiring recipes — Session handoff

**As of 2026-05-01 19:25 UTC.**

This is a draft handoff for the next MIAS-IO session continuing FR-015 (auto-wire engine for `WiringRecipe` rows). It links to the live inbox file rather than copy-pasting it — read the inbox sections directly so you stay in sync with whatever plugin appended after this doc was written.

## Where to start (read in this order)

1. `docs/pending-for-codesys.md` — sections **FR-015** (the original ask + plugin's reply) and **NOTIF-023** (my schema/governance/protocol confirmations). These two together are the authoritative spec.
2. `docs/pending-from-codesys.md` — check for any new plugin activity since 2026-05-01 19:25 UTC.
3. `prisma/migrations/20260501104500_add_wiring_hint_and_gap/migration.sql` — what the schema looks like in the DB now.
4. `prisma/schema.prisma`, search for `CodesysFbParameterHint` and `WiringRecipeGap` — Prisma side of the same.
5. `docs/codesys-api-contract.md` — the existing FB-definitions push contract (still pre-`wiringHint`; needs an update once the endpoint is extended).

## What's already done

- **Schema migrated** (`20260501104500_add_wiring_hint_and_gap`): four enums (`wiring_hint_kind`, `wiring_hint_value_role`, `wiring_hint_command_kind`, `wiring_gap_reason`), `codesys_fb_parameter_hint` table (1:1 with `codesys_fb_parameter`), `wiring_recipe_gap` table, plus `always_review` + `hint_schema_version` columns on `codesys_fb_definition`. Applied to local DB; Prisma client regenerated.
- **NOTIF-023 sent** confirming the protocol shape: per-FB push, `hintSchemaVersion` starts at `"1.0.0"`, full reason vocabulary for the gap log, deferred per-instance `wiringHintOverride` to v2 (use `fb.alwaysReview = true` for firmware-variant FBs in MVP).
- **Prod build** `bu5rbmesy`, server `bufvgyb1g` on :8080 — has the new types loaded but no endpoint changes yet.

## What plugin is doing in parallel

Curating `wiringHint` blocks for the 28 `FB_Hmi*` FBs (~600 pins). Plugin will push them via the existing `POST /api/codesys/fb-definitions` endpoint as soon as the endpoint accepts `wiringHint`. They've estimated ~80% auto-extractable on this family + one afternoon of human curation.

Their next deliverable: per-FB pushes with `wiringHint` populated. Until the endpoint is extended, those pushes will silently drop the `wiringHint` field (the existing endpoint ignores unknown keys), so **the endpoint extension is the immediate blocker**.

## Plan for next session(s)

### Session A — endpoint extension + contract update

1. Open `src/app/api/codesys/fb-definitions/route.ts` (or wherever `POST /api/codesys/fb-definitions` is; grep for the route file). Extend the Zod request schema to accept the optional `wiringHint` object per parameter and the FB-level `alwaysReview` + `hintSchemaVersion` fields.
2. The exact request shape is in **NOTIF-023 → "Push protocol — per-FB" → strawman contract**. Mirror it precisely; deviations break plugin's curated-payload roundtrip.
3. Persist via Prisma:
   - Upsert `codesys_fb_definition` setting `alwaysReview` and `hintSchemaVersion`.
   - For each parameter row, if `wiringHint` is present, upsert `codesys_fb_parameter_hint` keyed by `parameter_id`. Omitted hint = no row written (don't create empty hint rows).
   - Watch for the version-major check: if the inbound `hintSchemaVersion`'s major doesn't equal the matcher's expected major, the endpoint should still accept the push but record a `WiringRecipeGap` reason `INCOMPATIBLE_HINT_VERSION` lazily at match time, not at push time. (Push-time rejection would block plugin cold — bad UX.)
4. Update `docs/codesys-api-contract.md`: new section on `wiringHint` structure, new top-level fields, version-major rule.
5. Append the dated entry to `MIAS-Docs/Work Log.md`.
6. Write a tiny smoke test (a hand-crafted curl/test request) that pushes one FB with one full hint and verifies all the fields land correctly. Check via `prisma studio` or a quick `psql` query.
7. Send `NOTIF-024` to plugin saying the endpoint accepts hints — **this is what unblocks them**.

### Session B — matcher core (the hard part)

Goal: take a `ComponentInstance` + its FB definition's parameters + their hints + the project's signals, produce one row per parameter:
- a `WiringRecipeParam` proposal with a confidence score, OR
- a `WiringRecipeGap` row with a reason if no confident match exists.

Suggested matcher design (open to revision before coding):

```
inputs:
  - parameter (with hint, possibly inherited from extendsName chain)
  - candidate signals (project-scoped, filtered by ComponentInstance's component_tag)
  - flat config: confidence threshold (default 0.75), gap reason policy

steps per parameter:
  1. if hint missing → log NO_HINT gap; skip
  2. if fb.alwaysReview → set needs_review regardless; still propose best match
  3. if hint.kind === "parameter":
       use defaultLiteral as the proposed value (no signal matching)
       if defaultLiteral null → log NO_HINT gap (under-specified)
  4. if hint.kind === "signal":
       a. filter candidates: matching expectedUnit (within unit-conversion family),
          matching valueRole (actual vs setpoint discrimination is critical here),
          matching instrumentClass when both have one
       b. score each remaining candidate:
          + tag-suffix match against hint.matchTag (high weight)
          + semantic-keyword match against signal.system / signal.description (medium)
          + structRole match if struct-typed pin (high)
          + arrayCardinality cardinality-match (high if applicable)
       c. pick top scorer:
          - if score >= threshold and unique → propose
          - if score >= threshold but ambiguous (top-2 tied) → log AMBIGUOUS_MATCH
          - if score < threshold but candidates exist → log LOW_CONFIDENCE (with top-3)
          - if no candidates after filter → log NO_CANDIDATE_SIGNAL
  5. if hint.humanReview → mark proposal as needs_review even if confident
```

The matcher should be a pure function that takes input data and returns proposals + gaps. Don't bake DB writes into it; let a thin wrapper persist the output. That makes it testable.

### Session C — UI

Two surfaces:
- **Needs-review queue** per `ComponentInstance`: list of parameters the matcher couldn't confidently bind, with operator's controls to accept/override/skip.
- **Gap-log browser** per project: filter by `reason`, sort by FB / parameter; resolved-at column for closed gaps.

Probably lives at `/projects/[id]/wiring-review` or similar. UI work is gated on the matcher producing real output, so don't start until B is done.

## Specific design decisions already locked in (don't re-litigate)

- Per-FB push (not single payload). Reason: failure isolation + matches existing protocol.
- Hint stored 1:1 with parameter, not nested-JSON column. Reason: matcher needs to filter/score on individual fields fast.
- `wiringHintOverride` per ComponentInstance is **deferred to v2** — for the few firmware-variant FBs that need different hints per instance, set `fb.alwaysReview = true` so the matcher always pauses for human input. Don't add an override table yet.
- VAR_IN_OUT / HMI page-driven pins are signaled by `defaultLiteral != null` (or `kind: "parameter"`), not a separate flag.
- Inherited pins: matcher walks `extendsName` chain at match time; pin-level hint on the leaf overrides the base. Don't pre-flatten at push time.

## Open questions for the matcher (decide before coding session B)

1. **Unit-conversion family**: when the hint says `expectedUnit: "kW"` and a candidate signal's unit is `"W"`, do we auto-convert (and apply the conversion in the recipe) or treat as no-match? Recommendation: auto-convert across the same physical quantity (the new EU `quantity` + `scaleToPrimary` columns make this trivial), but log a low-key audit field on the proposal so the operator knows.
2. **Confidence threshold default**: 0.75 is a starting point. Likely needs project-level override. Add `Project.matcherThreshold` column? Or keep global until we have data?
3. **Matcher trigger**: explicit button per ComponentInstance? Auto-run on instance creation? Both? Recommendation: explicit button + button on hardware-tree node.
4. **Re-runs over existing recipes**: when the matcher is re-run, does it overwrite an existing `WiringRecipeParam`? Recommendation: only if `WiringRecipeParam.lockedAt` is null. Add a `lockedAt` column on the recipe param so operator-confirmed bindings survive future matcher runs.

## State of inboxes at handoff

- `pending-for-codesys.md` — FR-015 (open coordination, plugin will reply when first FB_Hmi* hints land); FR-016, FR-017 (closed via NOTIF-020 round-trip; plugin keeping as reference); NOTIF-023 (just sent, awaiting plugin's pickup).
- `pending-from-codesys.md` — empty.
- `MIAS-ref/docs/pending-from-docs.md` and `pending-for-docs.md` — both empty (only header templates).
- Watchers running (PIDs 1078/1080 + 1125/1127). Cron poll cancelled per user instruction.

## Other context worth carrying forward

- Prod runs on :8080 via `npm run start:ws` (PORT=8080 NODE_ENV=production) — that's the WS-bridge-augmented Next server, not plain `next start`.
- DevTools live monitor + IO-Check session both got OPC UA quality coloring (`src/lib/opcua-quality.ts`) and analog raw values via `.AsRaw` (after FR-021 round-trip; `.AsRaw` resolves through override chain — swap to `.AsLastGood` after plugin's HAL/DAO refactor lands).
- Database migrations in this codebase use the `prisma migrate diff --from-config-datasource --to-schema` form (Prisma 7 dropped `--from-schema-datasource` and `--from-url`). Apply via `docker exec -i mias-io-postgres-1 psql -U mias -d mias_io < migration.sql` to avoid the dev-server DLL lock on Windows.
