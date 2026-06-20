###############################################################################
# Project Zenith — Satellite Service Dockerfile (Node.js 20)
# Multi-stage: base → development → builder → runner
###############################################################################

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat curl
WORKDIR /app
RUN npm install -g turbo@^2.0.0

# ─────────────────────────────────────────────
# Prune to satellite-service workspace subset
# ─────────────────────────────────────────────
FROM base AS pruner
COPY . .
RUN turbo prune @zenith/satellite-service --docker

# ─────────────────────────────────────────────
# Development — hot reload with tsx
# ─────────────────────────────────────────────
FROM base AS development
ENV NODE_ENV=development

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json
RUN npm ci

COPY --from=pruner /app/out/full/ .

# Generate Prisma client
RUN npx prisma generate --schema=apps/satellite-service/prisma/schema.prisma

EXPOSE 4001
CMD ["turbo", "run", "dev", "--filter=@zenith/satellite-service"]

# ─────────────────────────────────────────────
# Builder — compile TypeScript
# ─────────────────────────────────────────────
FROM base AS builder
ENV NODE_ENV=production

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json
RUN npm ci

COPY --from=pruner /app/out/full/ .

RUN npx prisma generate --schema=apps/satellite-service/prisma/schema.prisma
RUN turbo run build --filter=@zenith/satellite-service

# ─────────────────────────────────────────────
# Production runner
# ─────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache curl
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 satellite

# Copy built artifacts and production deps
COPY --from=builder /app/apps/satellite-service/dist ./dist
COPY --from=builder /app/apps/satellite-service/package.json .
COPY --from=builder /app/apps/satellite-service/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/satellite-service/node_modules ./apps/satellite-service/node_modules

USER satellite

EXPOSE 4001
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:4001/health || exit 1

CMD ["node", "dist/server.js"]
