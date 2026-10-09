# @oc/api-server

Main Hono API server — mounts all routes, orchestrates the full backend.

## Source of truth

`onlinecompetitions-api/packages/api/src` — synced to this repo.

## Architecture

Wires together every `api-*` package:
- **Routes:** client, admin, and common route mounts
- **Middleware:** rate limiting, auth/session extraction (Better Auth), request validation (Zod)
- **Payment orchestration:** DNA Payments, GoCardless, PayPal, Local (bypass), Stripe — orchestrated through `@oc/api-payment-core`
- **Stripe:** adapter `src/lib/payment/providers/stripe.ts`, SDK `@oc/api-payment-stripe` (`packages/api/payment-stripe/`)
- **File processing:** image upload with FFmpeg processing

## Context variables

Declares Hono's `ContextVariableMap` with `requestId`, `user`, `session`, `isAdmin`, etc.

## Tests

Vitest with `mongodb-memory-server` for integration tests under `test/`.
