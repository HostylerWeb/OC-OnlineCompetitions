# =============================================================================
# Stage 1: Prune
# Generate a partial monorepo with `turbo prune` for the target app
# =============================================================================
FROM oven/bun:1.2.23-alpine AS prune

RUN apk add --no-cache ffmpeg openssl ca-certificates

WORKDIR /app

COPY . .

RUN bun install --no-verify --ignore-scripts

RUN bunx turbo prune --docker --out-dir=out @oc/shop

# =============================================================================
# Stage 2: Builder
# Install deps (json/) then copy source (full/)
# =============================================================================
FROM oven/bun:1.2.23-alpine AS builder

RUN apk add --no-cache ffmpeg openssl ca-certificates

WORKDIR /app

COPY --from=prune /app/out/json/ .
RUN bun install --no-verify --ignore-scripts

COPY --from=prune /app/out/full/ .
COPY --from=prune /app/tsconfig.base.json .

WORKDIR /app/apps/shop
RUN BUILD_TS=$(date +%s) && echo "NEXT_PUBLIC_APP_VERSION=$BUILD_TS" > /app/apps/shop/.env.production
RUN NODE_OPTIONS='--max-old-space-size=2048 --max-semi-space-size=64' \
    bun run build

# =============================================================================
# Stage 3: Runtime
# =============================================================================
FROM oven/bun:1.2.23-alpine

RUN apk add --no-cache ffmpeg openssl ca-certificates curl

WORKDIR /app

COPY --from=prune /app/out/json/ .
RUN bun install --no-verify --ignore-scripts

COPY --from=builder /app/apps/shop/.next ./apps/shop/.next
COPY --from=builder /app/apps/shop/public ./apps/shop/public
COPY --from=builder /app/apps/shop/next.config.* ./apps/shop/
COPY --from=builder /app/packages ./packages

ENV NODE_ENV=production
EXPOSE 3000

WORKDIR /app/apps/shop

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=2 \
  CMD curl -f http://127.0.0.1:${PORT:-3000}/api/health || exit 1

CMD ["bun", "run", "start"]
