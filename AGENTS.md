# Online Competitions Turborepo — Workspace Context

## Project
Next.js 16 turborepo: 1 Next.js app, 1 Vike app, 1 lander + ~20 internal packages.

**GitHub:** https://github.com/HostylerWeb/Online Competitions (`git@github.com:HostylerWeb/Online Competitions.git`) — configure `origin` when pushing from `/var/www/onlinecompetitions/turborepo-main`.

## Apps
- `apps/admin/` — Admin dashboard (port 3222)
- `apps/web-lander/` — Competition landing pages (port 3333)
- `apps/client/` — Vike customer app (port 3555, in development)

## Key Packages
- `packages/api-server/` — Hono API server (main backend)
- `packages/api-auth/` — Better Auth builders
- `packages/api-client-next/` — TanStack Query, Zustand, Axios
- `packages/api-db/` — Mongoose models & connection
- `packages/api-tickets/` — Cart, tickets, wallet, promo codes
- `packages/api-payment-core/` — Order fulfillment engine
- `packages/api-server/src/lib/payment/` — Payment provider orchestration
- `packages/ui/` — Shared shadcn/ui components
- `packages/types/` — Shared TypeScript interfaces
- `packages/api-validation/` — Zod schemas
- `packages/content/` — Static copy
- `packages/api-client/` — Vike TanStack Query, Zustand, Axios

- `packages/client-auth/` — Vike Better Auth helpers

## Commands (run from repo root)
- `bun run dev` — dev all apps
- `bun run typecheck` — TypeScript check
- `bun run lint` — Biome lint
- `bun run test` — All tests
- `bun run build` — Build all apps

- `bun run dev --filter=@oc/client` — Vike client dev (port 3555)

## Devserver MCP
Use `devservers_get_devserver_statuses` to check running servers.
Use `devservers_start_server` / `devservers_stop_server` to manage lifecycle.
Dev server names defined in each app's `devservers.yml`.
- client (port 3555) — `devservers_start_server name: "client"`
- admin (port 3222) — `devservers_start_server name: "admin"`
- Always stop before starting: `devservers_stop_server name: "..."`

## Performance
- `turbo.json` `concurrency` is set to `"1"`. **Do not raise it** — the build server has limited RAM (768MB max-old-space-size). Higher concurrency causes OOM kills and hangs.
- Run tasks with `--concurrency=1` explicitly if overriding the config.

## Database
MongoDB with Mongoose. replica set required (for Better Auth sessions + transactions).
Models in `packages/api-db/src/models/`.

## Auth
Better Auth. Two isolated instances: customer + admin.
Cookie sessions (no JWT in localStorage).
Email OTP, magic links, anonymous, Google OAuth.

### Vike App Auth Guards (`apps/client/`)
Three-layer guard system in `src/pages/`:
1. **Global guard** (`+guard.ts`) — protects `/checkout*` and `/dashboard*`; redirects unauthed/anonymous → `/auth/login?returnTo=...`
2. **Auth guard** (`auth/+guard.ts`) — redirects verified users away from `/auth/*` → `returnTo` or `/dashboard`
3. **Dashboard guard** (`dashboard/+guard.ts`) — redirects unauthed/anonymous → `/auth/login`; unverified → `/auth/verify`
- Session fetched server-side in `+onCreatePageContext.server.ts` via in-process Hono API call (`apiApp.fetch()`)
- Anonymous sessions auto-created client-side by `AuthProvider` from `@oc/api-client`
- All other routes (public pages, cart, competitions, etc.) pass through without auth check

## Branch
Working branch: `staging`. Always branch from staging, PR back to staging.

## Code Style
- TypeScript strict mode
- Biome for formatting/linting (no Prettier/ESLint)
- No comments unless explaining why (not what)
- React Server Components by default, 'use client' only when needed
- Async components, async request APIs (Next.js 16)
- Use `cn()` from utils for class merging
- Self-closing tags for components without children

## Key Conventions
- Route handlers in `api-server/src/routes/` (client/, admin/, common/)
- Admin routes use createCrudRouter pattern
- Validation via Zod schemas in `api-validation/src/schemas/`
- Payment providers in `api-server/src/lib/payment/providers/`
- Tests co-located with source files (*.test.ts)

## Paytriot

- **transactionUnique** is suffixed with `-${randomUUID().slice(0, 8)}` for both Order and ShopOrder flows to avoid Paytriot's duplicate rejection (responseCode 65554). The webhook handler strips the suffix to find the order by ID prefix.
- **Frictionless test cards** are rejected in the Paytriot sandbox — the test account needs additional card BINs enabled by Paytriot support. This is a sandbox configuration issue, not a code bug.
- **Payment provider adapter**: `api-server/src/lib/payment/providers/paytriot.ts`
- **Paytriot SDK**: `packages/api/payment-paytriot/`
- **Return endpoint** is registered as `app.all("/paytriot/return")` (handles both POST and GET).
- **Phone number** is passed as `customerPhone` in the GatewayRequest.
- **ShopOrder** has a `metadata` field (`Schema.Types.Mixed`) for storing paytriot form HTML and other provider data.
- **`paytriotTransactionId`** is stored in `order.metadata.paytriotTransactionId` on successful webhook for retry support.
- **No `callbackURL`** in the Paytriot SDK — the hosted form only POSTs to `redirectURL`. Our `callbackURL` is ignored by Paytriot's hosted form handler.
- **Hosted form flow**: Paytriot handles 3DS internally (iframe to ACS). After completion, it POSTs the final result to `redirectURL` with `responseCode=0` on success. No intermediate 3DS redirect needed.
- **Popup checkout mode**: Alternative to hosted redirect. Controlled by `checkoutMode` on `PaymentMethod` doc (`"hosted"` or `"popup"`, default `"hosted"`). Admin toggle at `/payment-methods`.
  - **Assets**: `apps/client/public/paytriot/paytriot-popup.js`, `paytriot-popup.css`, `paytriotlogo.svg`, `Paytriotlogo.png` — served as static files.
  - **Frontend**: `PaytriotCheckout.tsx` calls `window.PaytriotCheckout.initPopup()` then `window.PaytriotCheckout.open({ fields, gatewayUrl, logoUrl, onClose })`. The SDK manages overlay DOM, popup open/close, blocker detection, and postMessage redirect listener.
  - **Backend**: `getSignedFields()` on `Gateway` class returns field key-value pairs (no HTML). Gateway URL for popup mode is `https://gateway.paytriot.co.uk/hosted/modal/`. The `redirectURL` has `?popup=1` appended; `/paytriot/return` detects this and returns breakout HTML (postMessage to `window.opener` then `window.close()`) instead of a 302 redirect.
  - **Retries**: Signed fields stored in `order.metadata.paytriotFields` + `order.metadata.paytriotGatewayUrl` for retry path.
- **Codes file** (`packages/api/payment-paytriot/src/codes.ts`): Every Paytriot response code from 0–66417 explicitly mapped to `PaytriotErrorCategory`, user-facing title/description/recommendedAction, severity, wasCharged. Includes AVS/CV2-derived subcategories (CVV_FAILED, ADDRESS_FAILED, POSTCODE_FAILED). Use `getPaytriotErrorInfo(input)` for the full mapping. The success page renders category-specific UI from `payment=failed&code=<code>&title=<title>&msg=<msg>&action=<action>` URL params.
- **Signature algorithm** (`packages/api/payment-paytriot/src/signature.ts`):
  - Outbound (request) signing is verified byte-for-byte against Paytriot's `sigtest.php` dev tool. The canary test (`signature.test.ts` "reproduces Paytriot Appendix A-11 example exactly") confirms our `sign()` algorithm matches the official SDK.
  - Inbound (response) signature is verified leniently: when `responseCode=0`, the order proceeds even if signature verification fails. The mismatch is logged in `order.metadata.paytriotSigAcceptedWithWarning` for manual review. Paytriot's hosted form response contains auto-added fields (`__wafRequestID`, `threeDSDetails[*]`, `deviceChannel`, `acquirerResponseCode`, etc.) whose exact canonical form we could not reproduce despite testing >10 subset strategies. The card is actually charged by Paytriot before the response is sent, so accepting on `responseCode=0` is safe.
  - `urlencode()` DOES encode `*` as `%2A` and `~` as `%7E` (matches PHP `urlencode()` behavior used by Paytriot). Without these substitutions, Paytriot rejects the request with responseCode=66343 (INVALID_SIGNATURE) whenever a field contains `*` (e.g. `statementNarrative1=Paytrio*Ukcomp`). JavaScript's `encodeURIComponent` leaves `*` and `~` unencoded, so explicit `.replace()` calls are needed.
- **Probe script** at `packages/api/payment-paytriot/docs/probe.ts` for verifying our signing against Paytriot's `sigtest.php?key=…` endpoint.

## Stripe

- **Payment provider adapter**: `api-server/src/lib/payment/providers/stripe.ts`
- **Stripe SDK**: `packages/api/payment-stripe/` (`@oc/api-payment-stripe`)
- **Webhook endpoint (unified)**: one endpoint per environment — `POST /api/payments/webhook/stripe` — delivers BOTH shop and orders events. The `stripe-signature` header is verified once at the route against the resolved webhook secret (memory → env → DB); since Stripe retries non-2xx responses, a webhook is never acknowledged until fully processed. Routing is by event type: `checkout.session.completed` → shop fulfillment path (`handleShopStripeWebhook` in `api-server/src/lib/payment/shop-webhook-handler.ts`); everything else → orders flow (`dispatchWebhook` → stripe adapter `handleWebhook`, whose own verification is preserved). There is no separate shop webhook endpoint anymore.
- **Events handled**: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`, plus `checkout.session.completed` (shop). Events that cannot be matched to an order/session are parked in `pending_webhooks` storage and acked 200 (`cleanup-abandoned-orders` job retries them once the order is found); unhandled event types return 200 without side effects. A `payment_intent.succeeded` arriving for an order already marked failed claims an auto-refund (`metadata.refundProcessedAt` guard, never throws).
- **Env resolution**: `STRIPE_ENVIRONMENT` (`test`|`live`, default `test`) selects `STRIPE_TEST_*` or `STRIPE_LIVE_*` keys; `STRIPE_SECRET_KEY`/`STRIPE_PUBLISHABLE_KEY`/`STRIPE_WEBHOOK_SECRET` act as fallbacks.
- **Payment intent ID** is stored in `order.metadata.stripePaymentIntentId` (orders) / `ShopOrder.metadata` (shop); card type/last4/brand are written to order metadata on `payment_intent.succeeded`.
- **Refund idempotency**: `charge.refunded` claims the order via `metadata.refundProcessedAt` before running the refund rollback, then pushes `{refundId, source: "stripe_webhook", at}` into `metadata.refunds`.
- **Stuck fulfillment**: `retryStuckStripeFulfillment()` resolves the capture ID from `metadata.stripePaymentIntentId`.
- **Bootstrap**: `ensureStripePaymentMethod()` upserts a default `PaymentMethod` doc on server start and in the admin payment-methods route (`ACTIVE_PROVIDERS` includes `stripe`).
- **Webhook auto-registration**: `registerStripeWebhooks()` (called after the ensures in the payment-config bootstrap) creates the single unified webhook endpoint (orders + shop events) by URL when missing — idempotent (matched by exact URL, never duplicated) — and reconciles event drift on every bootstrap (missing events are re-added). Skipped when `STRIPE_WEBHOOK_SECRET` env is set (manual mode) or the resolved public URL is a local dev host. Public base URL: `PUBLIC_WEBHOOK_URL` override, else `APP_URL`. One signing secret is persisted: returned at creation, cached in memory, and written to the `PaymentMethod` doc (`sandboxCredentials`/`liveCredentials.webhookSecret` per active environment) so verification survives restarts; `getResolvedWebhookSecret()` resolves in that order (memory → env → DB).
- **Credentials test**: `testCredentials()` probes a dummy `pi_test_credentials_validation` intent — `AUTH_FAILED` = bad key, `INVALID_REQUEST`/`INVALID_INTENT` = key valid.
- **Client session creation is click-only**: `StripeCheckout` never auto-creates a session (no effect); the Pay button starts creation with a single-flight `creatingRef` guard, so exactly one `POST /api/payments/session` per order. Post-await and success-navigation paths re-check `isActive` (provider switch mid-flight never navigates or lands stale state on a hidden panel; switching away resets the panel). A Payment Element `onLoadError` flips the panel to session-expired with an inline message instead of silently retrying, and confirm stays gated on `onReady`/`elements.submit()`. The confirm phase runs `elements.submit()` first (inline field validation), is gated on the Payment Element's `onReady`, and is protected by a synchronous `processingRef`; all card-payment errors stay inline — the page-level banner only surfaces session-creation failures (it skips empty-clear pings). Payment Element appearance uses the `night` theme with white `colorText` variables; wallets (`applePay`/`googlePay`) are `auto` on `layout: "tabs"`. Apple Pay additionally requires the dashboard domain registration + the `apple-developer-merchantid-domain-association` file served at the domain root (`apps/client/public`); Google Pay's manifest probe needs `https://www.google.com` (+ `pay.google.com`/`payments.google.com`) in the API CSP `connect-src`.

## Referral Data Semantics

### "Active referral" — canonical formula

A referral purchase is **active** iff ALL of:
1. `ReferralPurchase.deletedAt == null`
2. The referred `Profile` exists with a non-null `createdAt`
3. `purchasedAt ≤ referredUser.createdAt + settings.activityWindowDays` (rolling mode)
   — OR — `purchasedAt`'s UTC day ≤ `settings.monthlyCutoffDay` (fixed_day_of_month mode)
4. `purchaseAmount ≥ settings.minFirstOrderSpend`
5. (Grace period: extends #3 by `settings.gracePeriod.days` when enabled and not deferred)

Canonical implementation: `@oc/api-referrals/leaderboard.ts` (`getTopActiveReferrers`).

### "Active referrer count" — what it means

The number of **unique referred users** (deduped by `referredUserId`) who have at least
one active purchase. NOT the number of qualifying purchase rows.

### Where the count is shown (all use the same formula)

| Surface | Endpoint | What it counts |
|---|---|---|
| User dashboard leaderboard | `GET /api/me/referrals` | Top 10 by unique active referees (windowed) |
| Admin TopReferrersWidget | `GET /api/admin/referral-stats/top-referrers` | Same formula, top N (windowed) |
| Admin ReferralSummaryCards "Active referrers" | `GET /api/admin/referral-stats/summary` | Distinct count (windowed) |
| Admin ReferralSummaryCards "Tickets minted" | `GET /api/admin/referral-stats/summary` | `Σ ticketsAwarded` on non-deleted purchases |
| Admin TierDistributionWidget | `GET /api/admin/referral-stats/distribution` | Bucketed by unique active count |
| Admin referral-purchases table "Active" column | `GET /api/admin/referral-purchases` | Per-referrer count of unique active pairs |
| Per-user stats | `GET /api/admin/users/:id/referral-stats` | `isQualifyingReferralPurchase` + dedupe (same formula) |

### `Profile.referralCount` — fast-path counter

`referralCount` is a denormalized counter maintained alongside the canonical
aggregation. It can drift from live state and is **NOT** used for ranking or
widgets. It's used for:
- `Profile` exports / CSV
- Quick O(1) lookups where approximate is OK

Maintenance: updated on every `recordReferralPurchase` (recordReferralPurchase), plus
reconciliation on admin soft-delete/restore/reassign via
`@oc/api-referrals/referral-counter` (`reconcileReferralCountOnDelete`,
`reconcileReferralCountOnRestore`, `reconcileReferralCountOnReassign`).

Backfill (idempotent, recomputes from live state):

```bash
bun run packages/api/server/src/lib/jobs/recompute-referral-counts.ts --dry-run
bun run packages/api/server/src/lib/jobs/recompute-referral-counts.ts --apply
bun run packages/api/server/src/lib/jobs/recompute-referral-counts.ts --userId=<oid>
```

## Coolify Health Check Paths
- **Client app** (Vike): health endpoint is `/health` (`+server.ts:42`)
- **Admin/Shop** (Next.js): health endpoint is `/api/health`
- Client was misconfigured as `/api/health` in Coolify UI — caused 502 on deploy (rolling updates couldn't verify readiness, fell back to stop-then-start)

## Local Dev Services (docker-compose.dev.yml)
- **Mailpit** (email catcher) — SMTP port 1025, Web UI + API at port 1080 (not 8025)
  - API: `http://localhost:1080/api/v1/messages`
  - Web UI: `http://localhost:1080/`
- **MongoDB** — port 27017
- **MinIO** (S3-compatible storage) — port 9011 (S3 API only; use admin Media Library, not MinIO console)

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
