#!/bin/sh
set -e

echo "=== MIAS-IO Docker Entrypoint ==="

# 1. Run Prisma migrations
echo "[1/3] Running database migrations..."
npx prisma migrate deploy

# 2. Seed catalog data if tables are empty
echo "[2/3] Checking catalog data..."
DEVICE_COUNT=$(psql "$DATABASE_URL" -t -A -c "SELECT count(*) FROM device_catalog" 2>/dev/null || echo "0")
MODULE_COUNT=$(psql "$DATABASE_URL" -t -A -c "SELECT count(*) FROM module_catalog" 2>/dev/null || echo "0")
USER_COUNT=$(psql "$DATABASE_URL" -t -A -c "SELECT count(*) FROM users" 2>/dev/null || echo "0")

if [ "$DEVICE_COUNT" = "0" ] || [ "$MODULE_COUNT" = "0" ]; then
  echo "  Catalog tables empty — seeding..."

  if [ -f prisma/seed_device_catalog.sql ]; then
    echo "  Seeding device catalog..."
    psql "$DATABASE_URL" < prisma/seed_device_catalog.sql
  fi

  if [ -f prisma/seed_data.sql ]; then
    echo "  Seeding base data..."
    psql "$DATABASE_URL" < prisma/seed_data.sql
  fi

  if [ -f prisma/seed_module_type_codes.sql ]; then
    echo "  Seeding module type codes..."
    psql "$DATABASE_URL" < prisma/seed_module_type_codes.sql
  fi

  if [ -f prisma/seed_diagnostic_flags.sql ]; then
    echo "  Seeding diagnostic flags..."
    psql "$DATABASE_URL" < prisma/seed_diagnostic_flags.sql
  fi

  if [ "$MODULE_COUNT" = "0" ]; then
    echo "  Seeding module catalog (this may take a moment)..."
    npx tsx prisma/seed.ts
  fi

  echo "  Catalog seeding complete."
else
  echo "  Catalog data present (${DEVICE_COUNT} devices, ${MODULE_COUNT} modules) — skipping seed."
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
exec npm run start
