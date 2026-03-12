# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MIAS-IO** is a PLC hardware management system ("MIAS I/O Editor") — a web application for managing PLC hardware setups, IO configurations, and signal definitions.

**Tech stack:**
- **Frontend:** Next.js 15 + TypeScript (App Router, Turbopack)
- **UI:** shadcn/ui (Radix UI + Tailwind CSS)
- **API:** tRPC v11 + TanStack Query v5
- **ORM:** Prisma 6
- **Database:** PostgreSQL 16
- **Forms:** React Hook Form + Zod
- **Tables:** TanStack Table
- **State:** Zustand
- **Drag and drop:** dnd-kit
- **Target:** Desktop browser only

## Local Development

**Prerequisites:** Node.js 20+ LTS, Docker Desktop

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and fill in values
cp .env.example .env.local

# 3. Start PostgreSQL
docker compose up -d

# 4. Apply schema (creates tables from prisma/schema.prisma)
npm run db:migrate

# 5. Start dev server
npm run dev
```

**Other useful commands:**
```bash
npm run db:studio      # Prisma Studio GUI for the database
npm run db:generate    # Regenerate Prisma client after schema changes
```

**Adding shadcn/ui components:**
```bash
npx shadcn@latest add button
npx shadcn@latest add table
npx shadcn@latest add dialog
# etc. — components are added to src/components/ui/
```

**Note on views and functions:** `prisma/plc_schema.sql` contains PostgreSQL views (`v_project_signals`, `v_instance_signal_resolved`), triggers, and rollback functions that Prisma does not manage. Apply these manually with `psql` against the local database after the initial migration if needed.

## Database Architecture

`project` is the top-level container — all data is segmented by project.

**Hierarchy:**
```
project → plc → io_carrier → io_card → signal → alarm
```

- `plc_network` is hosted by either the PLC CPU (`io_card_id = NULL`) or an `io_card` (`provides_network = TRUE`)
- `io_carrier` connects to PLC optionally via `plc_network` (NULL = local)
- `signal` uses **vertical inheritance**: base `signal` table + child tables `discrete_signal` / `analog_signal` (1:1 FK). Never merge them.
- `engineering_unit` is **global** (not project-scoped)
- `hardware_template` is currently **global** (open question: should it be project-scoped?)

**Template system:** `instance_signal.decoupled = FALSE` means inherit from template defaults. Set `decoupled = TRUE` and populate override columns to customize. Use `rollback_instance_signal(id)` or `rollback_template_instance(id)` to reset overrides.

## Schema Management

- **Application schema** is managed by Prisma via `prisma/schema.prisma` + `prisma migrate dev`
- **`prisma/plc_schema.sql`** is the reference for PostgreSQL-specific objects (views, triggers, rollback functions) that Prisma cannot manage — apply manually with `psql` as needed
- When changing the data model, edit `prisma/schema.prisma` and run `npm run db:migrate`
- Wago seed functions must use `INT` (not `SMALLINT`) in signatures — PostgreSQL resolves integer literals as INT and will fail to match SMALLINT signatures

## Deployment (MeTSTech Developer Kit)

Scripts are in `MeTSTech-Developer-Kit/`. Deploy flow:

```
local code → Azure DevOps git (HTTPS+PAT) → Coolify (nixpacks build) → Traefik routing
```

- **Coolify portal:** `https://demo.neptun.oborgen.ztna` (requires FortiClient VPN)
- **SSH:** `ssh -i ~/.ssh/neptun_key admin_mets@neptun-ssh.oborgen.ztna`
- **Environments:** `demos` | `staging` | `production`
- **Secrets:** get `.coolify-env` from Johan (contains `AZURE_PAT` + `COOLIFY_TOKEN`) — never commit this file

**Deploy a new app:**
```bash
source MeTSTech-Developer-Kit/.coolify-env
APP_NAME=mias-io APP_PORT=3000 NEEDS_DB=true bash MeTSTech-Developer-Kit/deploy-coolify-azure.sh
```

**Manage running apps:**
```bash
bash MeTSTech-Developer-Kit/coolify-manage.sh status
bash MeTSTech-Developer-Kit/coolify-manage.sh logs <app>
bash MeTSTech-Developer-Kit/coolify-manage.sh rollback <app>
```

The deploy script auto-detects `prisma/schema.prisma` and sets `npx prisma migrate deploy` as the post-deploy command. If using Prisma seed with `create` (not `upsert`) for relational data, run it manually once:
```bash
docker exec <container> npx tsx prisma/seed.ts
```

**Known Coolify quirks:**
- Coolify `/applications/public` misparses HTTPS URLs — the script patches `git_repository` after creation
- Databases are created via `/databases/{type}` (not `/databases`)
- Docker coolify-network must not have IPv6 (causes `ParseAddr` errors in Docker 27.0.3)

## SQL Files

| File | Description |
|---|---|
| `prisma/plc_schema.sql` | Full schema — run this on a fresh database |

All migrations are additive ALTER TABLE files. Never rewrite `prisma/plc_schema.sql` once deployed; add `migration_NNN_description.sql` files instead.

## CODESYS Integration

MIAS-IO exposes a read-only REST API that CODESYS IronPython scripts consume to
generate GVLs and hardware configuration in CODESYS projects.

**Companion repo:** `../MIAS-Plugin` — all CODESYS script code lives there.
**Full contract:** `docs/codesys-api-contract.md` — authoritative spec for both sides.

### MIAS-IO agent responsibilities

- Implement and maintain `src/app/api/codesys/` route handlers
- Auth: validate `X-API-Key` header against `process.env.CODESYS_API_KEY`
- Compute `plcAddress` server-side from slot/channel positions (see contract for rules)
- Return data exactly as typed in `docs/codesys-api-contract.md`
- Never break a field that exists in the contract — add fields, don't rename/remove
- Do not modify anything in `../MIAS-Plugin`

### Change protocol

If the CODESYS scripts need data not in the current API response:
1. CODESYS agent writes the request to `docs/pending-from-codesys.md` (in this repo)
2. MIAS-IO agent reads that file, implements the endpoints, updates `docs/codesys-api-contract.md`, and removes the entry from `pending-from-codesys.md`

No human relay required — `docs/` is the shared coworking area for both agents.
Check `docs/pending-from-codesys.md` at the start of any session involving the CODESYS API.

## Key Design Rules

1. Never merge `discrete_signal` and `analog_signal` into the base `signal` table (vertical inheritance)
2. `alarm` tables are split by type: `discrete_alarm` → `discrete_signal`, `analog_alarm` → `analog_signal`. This is DB-enforced via FK — never use a combined alarm table
3. `engineering_unit` is global — not scoped per project
4. `io_card.provides_network = TRUE` means one or more `plc_network` rows reference that card via `io_card_id`
5. `plc_network.io_card_id = NULL` means the network is hosted by the PLC CPU; SET means hosted by that IO card
6. `hardware_template.project_id = NULL` = global/shared template; SET = project-private
7. `instance_signal.decoupled = FALSE` → inherit from `template_signal` defaults (override columns are NULL). `decoupled = TRUE` → override columns take precedence. Use `rollback_instance_signal(id)` or `rollback_template_instance(id)` to reset
8. Wago module catalog data goes in `module_catalog` table — not as a fake ARCHIVED project
9. Wago seed functions must use `INT` (not `SMALLINT`) in signatures — PostgreSQL resolves integer literals as INT
10. Hard delete on `plc`, `io_carrier`, `io_card` — soft delete was removed; `deletedAt`/`deleted_at` columns no longer exist on these models
11. **Before changing enums, schema fields, default values, catalog data, or signal logic** — consult `docs/dependency-registry.md`. It maps non-obvious data relationships (enum sync chains, catalog→project data flow, template inheritance, computed values, cascade impact, CODESYS API contract). Use the cross-file search checklist at the bottom to find all affected files.
