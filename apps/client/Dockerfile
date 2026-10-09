# =============================================================================
# Stage 1: Prune
# Generate a partial monorepo with `turbo prune` for the target app
# =============================================================================
FROM oven/bun:1-alpine AS prune

RUN apk add --no-cache ffmpeg openssl ca-certificates

WORKDIR /app

COPY . .

RUN bun install --no-verify --ignore-scripts

RUN bunx turbo prune --docker --out-dir=out @oc/client

# =============================================================================
# Stage 2: Builder
# Install deps (json/) then copy source (full/)
# =============================================================================
FROM oven/bun:1-alpine AS builder

RUN apk add --no-cache ffmpeg openssl ca-certificates

WORKDIR /app

COPY --from=prune /app/out/json/ .
RUN bun install --no-verify --ignore-scripts

COPY --from=prune /app/out/full/ .
COPY --from=prune /app/tsconfig.base.json .

RUN BUILD_TS=$(date +%s) && echo "VITE_APP_VERSION=$BUILD_TS" > /app/apps/client/.env.production

WORKDIR /app/apps/client
RUN NODE_OPTIONS='--max-old-space-size=2048' bun run build

# =============================================================================
# Stage 3: Runtime
# =============================================================================
FROM oven/bun:1-alpine

RUN apk add --no-cache ffmpeg openssl ca-certificates curl

WORKDIR /app

COPY --from=prune /app/out/json/ .
RUN bun install --no-verify --ignore-scripts

COPY --from=builder /app/apps/client/dist ./dist
COPY --from=builder /app/apps/client/public ./public
COPY --from=builder /app/packages ./packages
ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=2 \
  CMD curl -f http://127.0.0.1:${PORT:-3000}/health || exit 1

CMD ["bun", "run", "/app/dist/server/index.mjs"]