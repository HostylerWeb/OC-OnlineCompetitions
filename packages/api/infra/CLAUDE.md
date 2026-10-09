# @oc/api-infra

Shared server infrastructure for the Hono-based API.

## Source of truth

`onlinecompetitions-api/packages/infra/src` — synced to this repo.

## Key modules

| File | Responsibility |
|------|---------------|
| `env.ts` | Environment context helpers (`getCurrentContext()`) |
| `error-handler.ts` | Sentry error monitoring setup |
| `response.ts` | Response formatting utilities |
| `mongoose.ts` | MongoDB capability detection and query options |
| `pagination.ts` | Pagination helpers |
| `fuzzy.ts` | Fuzzy search utilities |
| `group-by.ts` | Group-by aggregation helper |
| `runtime-config.ts` | Runtime configuration (HSTS, secure cookies, payment bypass) |
| `lifecycle.ts` | Server lifecycle management |

## Env vars

- `NEXT_PUBLIC_APP_URL` — used by `env.ts` and `runtime-config.ts` for context + HSTS detection
- `DATABASE_URL` — required at startup (read in `db.ts` via non-null assertion)
- `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, `SENTRY_TRACES_SAMPLE_RATE` — Sentry server-side init (`sentry.ts`)
- `SECURE_COOKIES` — optional override (defaults to `authUrlIsHttps()`)
- `API_REQUIRE_DB_AT_STARTUP` — fail fast if DB is unavailable
- `API_EXIT_ON_FATAL_ERROR` — exit process on fatal errors
- `ENABLE_LOCAL_PAYMENT_METHOD` — enable local payment provider
- `LOG_ERROR_STACKS`, `LOG_DB_CONNECT_DEBUG` — dev logging toggles
- `MONGODB_RETRY_WRITES`, `MONGODB_FORCE_TRANSACTIONS`, `ALLOW_NON_TX_CIP` — MongoDB capability overrides

## Dependencies

hono, mongoose, @sentry/node, @oc/types, @oc/api-validation
