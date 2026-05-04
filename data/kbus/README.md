# K-bus capacity data

`kbus_module_costs.json` is **synced from `MIAS-ref/docs/databases/wago/kbus_module_costs.json`**. Do not edit it here directly — fix it upstream and re-copy.

The companion JSON Schemas live in `MIAS-ref/docs/schemas/kbus-calc-{input,output}.schema.json`. The TypeScript calculator at `src/lib/kbus/calculate.ts` reads this file at module load and emits results in the schema's output shape.

## When to re-sync

- New WAGO module appears in a project and the calculator emits `MODULE_NOT_IN_COST_TABLE` — add it upstream first, then refresh the copy.
- `mode_multiplier` for `Sniffer` / `Transparent` on `wago:750-658` becomes available from MIAS-ref (currently TBD per NOTIF-008 to mias-plugin) — re-copy to pick up the values.
- Beckhoff formula or per-channel coefficients are revised upstream.

## Sync command

```bash
cp "../MIAS-ref/docs/databases/wago/kbus_module_costs.json" data/kbus/kbus_module_costs.json
```
