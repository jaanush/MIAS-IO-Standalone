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
RUN npx prisma generate
RUN npm run build

# Production — install only prod deps
FROM base AS proddeps
COPY package.json package-lock.json ./
COPY prisma/schema.prisma prisma/schema.prisma
COPY prisma.config.ts ./
RUN npm ci --omit=dev

# Production
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=proddeps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma.config.ts ./
# Include prisma CLI for migrate deploy at startup
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/prisma ./node_modules/prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD sh -c "npx prisma migrate deploy && npm run start"
