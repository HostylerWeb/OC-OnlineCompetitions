# @oc/api-payment-local

In-process "bypass" payment provider for local development. Mirrors the shape of other SDKs (client, webhooks, env, currency, types) but has no third-party — all methods are no-ops or local DB operations.

## Source of truth

`onlinecompetitions-api/packages/payment/local/src` — synced to this repo.

## Public surface

- `LocalClient`, `createLocalClient`
- Methods: `createSessionId`, `validateAmount`, `resolveSession`, `voidSession`, `testConnection`
- Webhooks: `parseLocalWebhook`, `verifyLocalWebhook` (no-op pass-through — local has no external webhooks)
- `LocalError` (codes: `LOCAL_BYPASS_DISABLED`, `LOCAL_INVALID_AMOUNT`, `LOCAL_INVALID_ORDER_ID`)
- Types: `LocalConfig`, `LocalSessionResult`
- `LOCAL_CURRENCY` const
- `getLocalEnabledFromEnv()`, `hasLocalEnvCredentials()` (always true)

## Env vars

`ENABLE_LOCAL_PAYMENT_METHOD` (true|false), `NODE_ENV` (enabled outside production by default).

## Used by

`api-server` payment provider orchestration + `createLocalBalanceTopUpSession` for `/api/balance/top-up`.
