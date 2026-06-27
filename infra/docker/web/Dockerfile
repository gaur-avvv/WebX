###############################################################################
# Project Zenith — Next.js Frontend Dockerfile
# Multi-stage build: development → builder → runner (production)
###############################################################################

# ─────────────────────────────────────────────
# Stage 1: Base (shared OS + Node setup)
# ─────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat curl
WORKDIR /app

# Install turbo globally for filtering builds
RUN npm install -g turbo@^2.0.0

# ─────────────────────────────────────────────
# Stage 2: Dependency pruner
# Uses Turborepo pruning to create a minimal monorepo subset
# ─────────────────────────────────────────────
FROM base AS pruner
COPY . .
# Prune to only what @zenith/web and its workspace dependencies need
RUN turbo prune @zenith/web --docker

# ─────────────────────────────────────────────
# Stage 3: Development
# Hot-reloading dev server (used in docker-compose)
# ─────────────────────────────────────────────
FROM base AS development
ENV NODE_ENV=development

# Copy pruned lockfile + package.json manifests
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json

# Install all deps (including devDeps)
RUN npm pkg delete scripts.prepare && npm ci

# Copy pruned source
COPY --from=pruner /app/out/full/ .

# Expose Next.js dev port
EXPOSE 3000

# Start with Turbopack
CMD ["npx", "turbo", "run", "dev", "--filter=@zenith/web"]

# ─────────────────────────────────────────────
# Stage 4: Builder (production build)
# ─────────────────────────────────────────────
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json

# Install production + dev deps needed for build
RUN npm pkg delete scripts.prepare && npm ci

COPY --from=pruner /app/out/full/ .

# Build the Next.js app
ENV NODE_ENV=production
RUN npx turbo run build --filter=@zenith/web

# ─────────────────────────────────────────────
# Stage 5: Production runner (minimal image)
# ─────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
