FROM node:22-alpine AS base
WORKDIR /app

# Install ALL dependencies (dev needed for build)
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma/schema.prisma prisma/schema.prisma
COPY prisma.config.ts ./
RUN npm ci

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `prisma generate` reads prisma.config.ts which requires DATABASE_URL via
# env(). It doesn't connect to a DB at generate time — it just needs the
# variable resolvable. Provide a build-time placeholder; docker-compose
# overrides at runtime.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate
RUN npm run build

# Production
FROM base AS runner
ENV NODE_ENV=production

# Install psql client for entrypoint seed scripts
RUN apk add --no-cache postgresql-client

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Use full node_modules from builder (includes prisma CLI for migrations)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/src/server/lib ./src/server/lib
COPY --from=builder /app/src/lib ./src/lib
# Static catalog data consumed by seeders (commissioning JSON + WAGO module
# metadata + K-bus cost table). Required at runtime when the entrypoint
# refreshes per-row JSON columns on existing catalog rows.
COPY --from=builder /app/data ./data

# Entrypoint script + seed files
COPY --from=builder /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
RUN chmod +x ./scripts/docker-entrypoint.sh

# Create writable storage directory for plugin uploads
RUN mkdir -p /app/storage/plugin && chown -R nextjs:nodejs /app/storage

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Default: Coolify deploy flow (migrate + start, no seed)
CMD sh -c "npx prisma migrate deploy && npm run start"
