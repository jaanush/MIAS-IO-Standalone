#!/bin/sh
set -e

echo "=== MIAS-IO Docker Entrypoint ==="

# 1. Sync schema. We use `prisma db push` instead of `migrate deploy` because
#    several migrations carry project-specific data updates (LasseMaja DEIF
#    instances, Kreisel bus role rebuilds, etc.) that assume rows from the
#    seed already exist — rows that the docker-entrypoint hasn't seeded yet
#    on a fresh container. `db push` syncs schema declaratively in one shot,
#    is idempotent, and skips the migration-history machinery the standalone
#    Docker doesn't need.
#
#    Ops note: this means the standalone container doesn't preserve a
#    migration-history snapshot. That's fine for offline / commissioning use.
#    The Coolify production deploy uses `prisma migrate deploy` separately.
echo "[1/3] Syncing database schema (prisma db push)..."
npx prisma db push --accept-data-loss

# 2. Seed catalog data if tables are empty
echo "[2/3] Checking catalog data..."
DEVICE_COUNT=$(psql "$DATABASE_URL" -t -A -c "SELECT count(*) FROM device_catalog" 2>/dev/null || echo "0")
MODULE_COUNT=$(psql "$DATABASE_URL" -t -A -c "SELECT count(*) FROM module_catalog" 2>/dev/null || echo "0")
USER_COUNT=$(psql "$DATABASE_URL" -t -A -c "SELECT count(*) FROM users" 2>/dev/null || echo "0")

if [ "$DEVICE_COUNT" = "0" ] || [ "$MODULE_COUNT" = "0" ]; then
  echo "  Catalog tables empty — seeding..."

  # `prisma/seed.ts` does TRUNCATE + load of seed_data.sql wrapped in
  # session_replication_role=replica so FK ordering doesn't matter (the
  # pg_dump output isn't ordered for replay). It's the canonical loader for
  # device_catalog + module_catalog + project + signals + everything else.
  echo "  Loading seed_data.sql via prisma/seed.ts..."
  npx tsx prisma/seed.ts

  if [ -f prisma/seed_module_type_codes.sql ]; then
    echo "  Seeding module type codes..."
    psql "$DATABASE_URL" < prisma/seed_module_type_codes.sql
  fi

  if [ -f prisma/seed_diagnostic_flags.sql ]; then
    echo "  Seeding diagnostic flags..."
    psql "$DATABASE_URL" < prisma/seed_diagnostic_flags.sql
  fi

  echo "  Catalog seeding complete."
else
  echo "  Catalog data present (${DEVICE_COUNT} devices, ${MODULE_COUNT} modules) — skipping seed."
fi

# 2b. Refresh per-row JSON catalog columns (idempotent — safe on every boot).
#     These touch existing catalog rows by article_number; they don't create
#     rows, so they only do work after the base catalog seed has populated
#     module_catalog / device_catalog. Cheap (~few hundred upserts).
if [ -f data/commissioning/wago_module_commissioning.json ]; then
  echo "  Refreshing commissioning catalog JSON..."
  npx tsx prisma/seed_commissioning_catalog.ts || echo "  WARN: commissioning catalog seed failed (non-fatal)"
fi

if [ -f data/wago/wago_modules.json ]; then
  echo "  Refreshing WAGO front-panel data..."
  npx tsx prisma/seed_wago_front_panels.ts || echo "  WARN: WAGO front-panel seed failed (non-fatal)"
fi

# 3. Seed default admin user if no users exist
if [ "$USER_COUNT" = "0" ]; then
  echo "  No users found — creating default admin (admin@mias.io / admin)..."
  psql "$DATABASE_URL" -c "
    INSERT INTO users (id, email, name, role, password_hash, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'admin@mias.io',
      'Admin',
      'ADMIN',
      '\$2b\$10\$/daqrs4XpOgxWBUgMH9D2uVFxz0GzsfmVNRO8q5ZvlFptOJYAKb32',
      NOW(), NOW()
    )
    ON CONFLICT (email) DO NOTHING;
  "
fi

# 4. Start the application
echo "[3/3] Starting MIAS-IO..."
if [ "$MIAS_START_CMD" = "ws" ]; then
  echo "  Using WebSocket-enabled server (start:ws)"
  exec npm run start:ws
else
  exec npm run start
fi
