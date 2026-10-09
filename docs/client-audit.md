# Client & client-mobile audit

**Date:** 2026-03-17 (pass 3 additions 2026-10-02)  
**Scope:**

| App | Path | Stack | Port (dev) |
|-----|------|-------|------------|
| **Client (web)** | `apps/client` | Vike SSR + React 19; API via `@oc/api-server/app` in `+server.ts` | **3555** |
| **Client-mobile** | `apps/client-mobile` | Vite SPA + Capacitor 7; API via `@oc/api-client` / `@oc/auth-client` to `VITE_API_URL` | **3666** |

**Shared backend:** Both depend on the same Hono app in `packages/api/server/src/bootstrap.ts` (client hosts it; mobile calls it remotely). Findings on that API apply to **both** unless noted.

**Method:** Static review (~371 client + ~305 mobile TS/TSX files), `bootstrap.ts` / auth / checkout routes, `bun run typecheck` and `lint` on both apps. Runtime smoke tests on `:3555` were **not** run (dev server was down during audit); patterns match admin audit where server was up.

**Related:** [admin-audit.md](./admin-audit.md) (admin duplicates much of the public API on a separate origin).

---

## Executive summary

The **web client** is the canonical product surface: SSR, nonce/CSP wiring, affiliate cookies, and co-located API with Redis-backed rate limits on auth and payments. **Client-mobile** is a parallel SPA fork with Capacitor packaging; it does **not** embed the API and has several **wiring gaps** (dead code, unrouted pages, default API host pointing at staging).

| Severity | Count (approx.) |
|----------|-----------------|
| Critical | 2 |
| High     | 9 |
| Medium | 21 |
| Low | 12 |
| Info | 10 |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  apps/client (:3555)                                        │
│  Vike SSR ──► +server.ts ──► Hono (api-server/app)          │
│              └── same-origin cookies, CSP nonce             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  apps/client-mobile (:3666)                                 │
│  Vite SPA (capacitor:// or https://localhost)               │
│       └── axios ──► VITE_API_URL (cross-origin)             │
└─────────────────────────────────────────────────────────────┘
```

---

## Critical

### C1 — Better Auth request logging may capture credentials

**Where:** `packages/api/server/src/bootstrap.ts` — on selected auth paths, logs `body: loggedBody` for POST `/api/auth/sign-in/email`, sign-up, etc., plus cookie prefixes.

**Issue:** Email/password sign-in bodies typically include **`password`**. Logs go to stdout (Docker, Coolify, etc.) → credential exposure in log aggregators.

**Recommendation:** Redact `password`, `token`, `otp`, and `cookie` fields before logging; restrict verbose auth logging to `NODE_ENV=development`.

---

### C2 — Local balance top-up mints wallet funds (production risk)

**Where:** `POST /api/balance/top-up` → `createLocalBalanceTopUpSession` (`packages/api/server/src/routes/client/balance.ts`, `lib/payment/providers/local.ts`).

**Issue:** Only `local` provider is accepted; session completes synchronously and credits **cash wallet** without a card gateway. Documented as **P4-C1** in [platform-audit-pass4.md](./platform-audit-pass4.md).

**Recommendation:** Disable route outside dev; real Paytriot/Stripe top-up for production.

---

## High

### H1 — Client auth `trustedOrigins` mirrors arbitrary `Origin` header

**Where:** `packages/auth/admin/src/client-auth.ts` — `getTrustedOrigins()` pushes `request.headers.get("Origin")` into the allow list (same pattern as admin auth).

**Issue:** Weakens Better Auth origin/CSRF protections for any request that supplies a crafted `Origin` with credentials.

**Recommendation:** Fixed allowlist: `APP_URL`, `www.`, staging, `capacitor://localhost`, known app domains — not dynamic Origin reflection.

---

### H2 — Contact form API has no rate limiting

**Where:** `POST /api/contact` (`packages/api/server/src/routes/client/contact.ts`).

**Issue:** Unauthenticated email relay; trivial abuse for spam to support inbox and SES/email cost.

**Recommendation:** IP/user rate limits (Redis), CAPTCHA, or honeypot; align with auth email rate limiter patterns.

---

### H3 — Rate limiting fails open when Redis is unavailable

**Where:** `packages/api/server/src/middleware/rate-limit.ts` — `if (!redis) return next()` for email and payment limiters.

**Issue:** Auth brute-force, magic-link spam, and payment session abuse if Redis is down or misconfigured.

**Recommendation:** Fail closed in production or use in-memory fallback with conservative caps.

---

### H4 — Production CSP allows `'unsafe-inline'` scripts on API responses

**Where:** `bootstrap.ts` security middleware — prod `script-src` includes `'unsafe-inline'` (nonce is generated but not applied to `script-src`).

**Issue:** Weak XSS mitigation on HTML/API responses that set CSP.

**Note:** Dev also allows `'unsafe-eval'`.

---

### H5 — Mobile app defaults API to staging when env is missing

**Where:** `apps/client-mobile/src/main.tsx`:

```ts
const API_URL = import.meta.env.VITE_API_URL || "https://staging.onlinecompetitions.co.uk";
```

**Issue:** Local/dev builds without `.env` hit **staging** (real data, real payments config), not localhost `:3555`.

**Contrast:** `.env.example` documents `https://api.onlinecompetitions.co.uk`; `src/lib/api.ts` still defaults to `http://localhost:3000` but appears **unused** (dead duplicate client).

**Recommendation:** Default local dev to `http://127.0.0.1:3555`; fail fast if `VITE_API_URL` unset in production builds.

---

### H6 — Cross-origin mobile auth depends on cookie `SameSite=None` + `Secure`

**Where:** `packages/auth/admin/src/build-auth.ts` — `defaultCookieAttributes: { sameSite: secureCookies ? "none" : "lax" }`.

**Issue:** Mobile WebView loads app from `capacitor://localhost` or `https://localhost` while API is on another host. Session cookies only work if **`SECURE_COOKIES=true`**, HTTPS API, and CORS `credentials: true` are correctly set. Misconfiguration → silent auth failures or accidental lax cookies on wrong hosts.

**Recommendation:** Document Capacitor cookie checklist; E2E auth on real device/simulator against staging API.

---

### H7 — Public entries API exposes participant display data

**Where:** `GET /api/entries?competitionId=...` (`packages/api/server/src/routes/common/entries.ts`) — public, cached 30s; aggregates ticket holders with first/last name rules.

**Issue:** Intended transparency for competitions, but enables **scraping** of entry lists and names; admin origin also exposed this (see admin-audit C2).

**Recommendation:** Pagination caps, rate limits, or blur until draw closes; document GDPR/legitimate interest.

---

### H8 — Promo codes limited to one use per customer (default) with no admin override

**Where:** `PromoCode.maxUsesPerUser` default `1` and `reservePromoCodeUsage` (`packages/api/tickets/src/promo-codes.ts`); admin cannot change field (see admin-audit **M23**).

**Issue:** Customers cannot reuse legitimate campaign codes on second orders; staff see “code worked once” in admin usage counters.

**Recommendation:** Same as M23 — product fix plus checkout error copy when reservation fails.

---

### H9 — Promo validation vs reservation mismatch (late checkout failure)

**Where:**

- `POST /api/promo-codes/validate` → `validatePromoCode()` **without** `userId` / `usedBy` check (`packages/api/server/src/routes/client/promo-codes.ts`).
- Payment fulfilment → `reservePromoCodeUsage()` enforces per-user and stricter date query.

**Issue:** Checkout UI can show a **valid** promo until payment, then fail with “could not be reserved / maximum uses” (`packages/api/server/src/lib/payment/providers/paytriot.ts` and peers).

**Recommendation:** Pass `userId` into validation (or shared `assertPromoRedeemable`); return the same errors at apply-code and pay time.

---

### H10 — Open-ended promo dates fail at reservation

**Where:** `reservePromoCodeUsage` initial query requires `validFrom: { $lte: now }` and `validUntil: { $gte: now }` even when those fields are unset (`packages/api/tickets/src/promo-codes.ts`).

**Issue:** `validatePromoCode` allows promos with no end date; reservation returns `null` → pay failure for otherwise valid codes (legacy rows or admin omitting dates).

**Recommendation:** Only add date clauses when `validFrom` / `validUntil` exist on the document.

---

## Medium

### M1 — `GET /api/_debug/env` in non-production

**Where:** `bootstrap.ts` — exposes env sanity (DB host fragment, `APP_URL`, Mongo readyState).

**Issue:** Information disclosure on staging/preview if `NODE_ENV` is not strictly `production`.

---

### M2 — Verbose API error middleware logs full stacks to stdout

**Where:** `bootstrap.ts` `app.onError` — JSON + stack for every API error.

**Issue:** Noise, possible PII in error messages; cost in serverless/log storage.

---

### M3 — Public winners list: N+1 outbound `HEAD` requests per image

**Where:** `packages/api/server/src/routes/common/winners.ts`.

**Issue:** Latency and outbound HTTP load; potential SSRF stress if asset URLs were ever attacker-controlled.

---

### M4 — Public SSE `GET /api/competitions/stream`

**Where:** `competitions.ts` — long-lived connections, 5s heartbeats.

**Issue:** Connection exhaustion if abused; acceptable for product but needs proxy timeouts tuned.

---

### M5 — `setInterval` bonus-award job inside API process (non-Vercel)

**Where:** `bootstrap.ts` — every 5 minutes when `VERCEL !== "1"`.

**Issue:** Duplicate work if multiple client API instances run; no distributed lock (unlike `/api/internal/jobs` on admin).

---

### M6 — Affiliate/ref cookies set on HTML responses without `Secure` in local dev

**Where:** `apps/client/+server.ts` — `onlinecompetitions_ref`, `_aff_clickid`, `_aff_source` cookies `SameSite=Lax` only.

**Issue:** Fine for localhost; ensure production HTML paths always use HTTPS so ref attribution is not leaked on insecure networks.

---

### M7 — Sitemap internal fetch uses meaningless `X-Internal` header

**Where:** `+server.ts` fetches `/api/competitions` with `X-Internal: 1` — **no server middleware honors it** (grep: no handlers).

**Info:** Harmless; header does nothing. Competitions list is public anyway.

---

### M8 — Shop API mounted, no customer shop UI in client or mobile

**Where:** `bootstrap.ts` — `/api/shop/*`; no `shop` routes in `apps/client` or `apps/client-mobile` page trees.

**Issue:** Incomplete product surface; API attack surface without corresponding UX tests.

---

### M9 — Large duplicate codebase (client vs client-mobile)

**Issue:** ~600 TS/TSX files combined, largely mirrored pages/components. Drift risk (auth paths, checkout, compliance copy, fixes applied to one app only).

**Recommendation:** Shared package for pages/hooks or generate mobile from client; track parity checklist in CI.

---

### M10 — Mobile: referral landing page not routed

**Where:** `apps/client-mobile/src/pages/r/@code/+Page.tsx` exists; **`AppRoutes` has no `/r/:code` route** (web uses server `/r` redirect in API).

**Issue:** Short referral links may 404 in the native app/WebView shell.

---

### M11 — Mobile: `useDeepLinkHandler` never mounted

**Where:** `apps/client-mobile/src/lib/deep-links.ts` — navigates to `url.pathname` from external URLs **without allowlist**.

**Issue:** If wired later without validation → in-app open redirect / phishing. Currently **dead code** (not imported in `App.tsx`).

---

### M12 — Mobile: Sentry debug page is orphan

**Where:** `apps/client-mobile/src/pages/__debug/sentry/+Page.tsx` — not registered in `routes.tsx`.

**Issue:** Low risk today; if routed in future without gating, triggers test errors in production builds.

---

### M13 — Mobile: unused `src/lib/api.ts` with wrong default

**Where:** `API_BASE = ... || "http://localhost:3000"` — wrong port (client API is **3555**); no imports found.

**Issue:** Confusing for future devs; delete or align with `@oc/api-client`.

---

### M14 — Mobile: no Capacitor push integration in source

**Where:** `@capacitor/push-notifications` in `package.json`; no usage in `src/**`.

**Issue:** Dependency weight; web push via `/api/push` may be web-only. Native push incomplete.

---

### M15 — Mobile: production build ships source maps

**Where:** `vite.config.ts` — `build.sourcemap: true`.

**Issue:** Easier reverse-engineering of client logic in shipped APK/IPA bundles.

---

## Pass 3 additions (2026-10-02) — checkout, payments, satellite apps

### M17 — First order with promo + referral: promo discount dropped

**Where:** `packages/api/tickets/src/resolve-discount.ts` — when `promoCode` validates and `isFirstOrder && referralCode`, referral path wins; promo amount is not applied.

**Issue:** Users entering both codes on first purchase may get referral discount only with no message that promo was ignored.

**Recommendation:** Explicit stacking rules in UI and resolver; or reject dual entry with clear error.

---

### M18 — `resolveCheckoutDiscount` skips all discounts for guest sessions

**Where:** `resolveCheckoutDiscount` returns `{ discount: 0 }` when `isGuest` (`packages/api/tickets/src/resolve-discount.ts`).

**Contrast:** Cart apply-code path allows `guestEligible` promos (`packages/api/server/src/routes/client/cart.ts`).

**Issue:** Totals can disagree between cart preview and payment session creation for anonymous/guest checkout.

**Recommendation:** Single discount pipeline; honor `guestEligible` in resolver.

---

### M19 — Cashflows payment provider not implemented in codebase

**Where:** `packages/api/server/src/lib/payment/providers/index.ts` registers **`local`**, **`paytriot`**, **`stripe`** only (grep: no `cashflows` adapter).

**Issue:** Commercial docs may promise Cashflows; production integration requires new adapter + admin payment-methods UI wiring (today Paytriot-heavy in routes).

**Recommendation:** Track as delivery item; until shipped, document live providers as Paytriot/Stripe/local only.

---

### M20 — `typescript.ignoreBuildErrors: true` on shop and web-lander

**Where:** `apps/shop/next.config.ts`, `apps/web-lander/next.config.ts` (admin already flagged in admin-audit **H1**).

**Issue:** Type errors can ship in satellite Next apps used for landings and shop staff UI.

---

### M21 — `apps/web-lander` out of prior audit scope

**Where:** `apps/web-lander` — SSR fetches public API via `CLIENT_APP_URL` / `FRONTEND_URL` (`apps/web-lander/lib/api.ts`); dev port **3333** (`docs/local-development.md`).

**Issue:** Landers depend on client API uptime and env alignment; no E2E; `ignoreBuildErrors` (M20). Product still routes ad traffic to main site checkout — broken API URL breaks all lander pages.

**Recommendation:** Add smoke tests; document required env for Coolify; optional dedicated web-lander audit pass.

---

### M16 — Client SSR bundles heavy server packages

**Where:** `apps/client/vite.config.ts` `ssr.noExternal` includes `@oc/api-server`, `@oc/auth-admin`, `@oc/api-db`.

**Issue:** Larger server bundle, more server-side code paths in SSR process; ensure no admin-only code paths reachable from client auth instance.

---

## Low

### L1 — Client `+server.ts` swallows specific ReadableStream locked rejections

**Issue:** May hide real streaming bugs during SSR/API compose.

---

### L2 — Client includes `@oc/auth-admin` dependency

**Used for:** `getClientAuth` lives in `packages/auth/admin` (naming confusion). Not the admin dashboard app, but shared package with admin plugins available — review exports so client build cannot enable admin-only plugins via misconfig.

---

### L3 — Payment config public endpoint caches 10 minutes

**Where:** `GET /api/public/payment-config` — reveals enabled providers and Stripe publishable key (expected), but keep webhook registration side effects (`registerStripeWebhooks`) understood on every cache miss.

---

### L4 — Promo validation requires auth (`POST /api/promo-codes/validate`)

**Good:** Limits anonymous enumeration; cart still needs session for checkout.

**Gap:** Does not enforce per-user redemption limits — see **H8–H9**.

---

### L5 — Cart routes require session

**Where:** `packages/api/server/src/routes/client/cart.ts` — `requireSession`.

**Good:** Anonymous/guest flows handled via Better Auth anonymous plugin at auth layer (verify guest checkout compliance flags in UI).

---

### L6 — Client-mobile lint: 8 Biome warnings

**Where:** `bun run lint` — e.g. unused `Navigate` import in `routes.tsx`.

---

### L7 — Client-mobile i18n: `en` + `ro` only

**Issue:** Product/copy parity with web client locales if web adds languages.

---

### L8 — Capacitor iOS `limitsNavigationsToAppBoundDomains: true`

**Good:** Reduces arbitrary WebView navigation.

---

### L9 — CORS allows `capacitor://localhost`

**Where:** `bootstrap.ts` — required for mobile HTTP client.

---

### L10 — No dedicated E2E in `apps/client` or `apps/client-mobile`

**Issue:** Regressions rely on manual QA and API tests in `packages/api/server`.

---

## Client (web) — strengths

1. **Single origin** — cookies, CSRF, and CSP simpler than mobile cross-origin.
2. **SSR + referral ref cookies** on HTML responses (`+server.ts`).
3. **Affiliate middleware** before auth handler for attribution on signup.
4. **Rate limits** on auth email endpoints and payment/cart/discount paths (when Redis up).
5. **Email verification required** for client email/password (`requireEmailVerification: true`).
6. **Hydration diff detector** dev-only, tree-shaken in prod.
7. **Apple Pay domain association** route on same host.
8. **Typecheck passes** (`apps/client`).

---

## Client-mobile — strengths

1. **Capacitor 7** with sensible iOS navigation limits.
2. **Uses shared `@oc/api-client` / `@oc/auth-client`** — not a bespoke axios layer (except dead `lib/api.ts`).
3. **Typecheck passes**.
4. **Feature parity** on core flows: auth, competitions, cart, checkout, dashboard, legal pages.
5. **Haptics** on route changes (`useRouteChangeHaptics`).

---

## Parity gaps (web has / mobile missing or broken)

| Feature | Web (`apps/client`) | Mobile |
|---------|---------------------|--------|
| SSR / SEO | Vike SSR, sitemap | CSR only |
| Referral short URL `/r/:code` | API route `/r` | Page file exists, **not routed** |
| Deep links | N/A | Hook **not wired** |
| Shop | API only (no UI in either app) | Same |
| Push (web) | `/api/push` | No native push code |
| API host default | Same as `:3555` server | **staging.onlinecompetitions.co.uk** if env missing |
| Debug Sentry page | (check web pages) | Orphan file |

---

## API route map (customer-facing, via `bootstrap.ts`)

| Area | Prefix | Auth (typical) |
|------|--------|----------------|
| Auth | `/api/auth/*` | Better Auth |
| Catalogue | `/api/competitions`, `/api/categories`, `/api/winners`, `/api/entries`, `/api/stats` | Mostly public |
| Settings | `/api/compliance-settings`, `/api/referral-settings`, `/api/seo-settings`, … | Public read |
| Checkout | `/api/cart`, `/api/orders`, `/api/payments`, `/api/promo-codes` | Session + rate limits |
| Account | `/api/me/*` | Session |
| Shop | `/api/shop/*` | Mixed |
| Misc | `/api/contact`, `/api/public/payment-config`, `/api/push` | Contact public; push notify admin-only on POST `/notify` |

---

## Recommended priority backlog

1. **Stop logging auth passwords** (C1).  
2. **Fix mobile API default** and remove dead `lib/api.ts` (H5, M13).  
3. **Rate-limit contact** and harden Redis fail-open behavior (H2, H3).  
4. **Tighten client `trustedOrigins`** (H1).  
5. **Route `/r/:code` on mobile**; wire or delete deep-link handler with allowlist (M10, M11).  
6. **Tighten CSP** (`script-src` nonces) (H4).  
7. **Cap CSV/export/scrape abuse** on public entries/winners (H7, M3).  
8. **Document Capacitor cookie/CORS setup** (H6).  
9. **Reduce client/mobile duplication** or add parity tests (M9).  
10. **Disable source maps** in mobile release builds (M15).  
11. **Remove or gate `/api/_debug/env`** on all deployed non-local envs (M1).  
12. **Promo codes:** per-user limits + validate/reserve parity (H8–H10, admin M23).  
13. **Payment provider roadmap:** Cashflows adapter vs docs (M19).  
14. **Shop/web-lander** typecheck in CI (M20–M21).  
15. **Pass 4 backlog:** [platform-audit-pass4.md](./platform-audit-pass4.md) — local provider lockdown, spend reservations, confirmation email retry, compliance at checkout (P4-C1, P4-H2–H5, P4-M1–M7).

---

## Related docs

- [local-development.md](./local-development.md) — ports **3555** (client+API), **3666** (mobile shell)  
- [admin-audit.md](./admin-audit.md) — admin app and duplicated public routes on `:3222`  
- `apps/client/.env.example`, `apps/client-mobile/.env.example`

---

*Next pass (optional): runtime verification with `bun run dev` on `:3555`, DAST on checkout/auth, and Capacitor device auth matrix.*

---

## Pass 5 — product flow review (2026-10-02)

Static review of cart, checkout limits, promo reserve/release, competition `maxTicketsPerUser`, and countdown display. This is **not** a claim that the product is bug-free; only issues verified in code are listed.

### P5-H1 — Wallet ticket apply double-counts cart quantity against per-user limit

**Where:** `packages/api/server/src/routes/client/cart.ts` (cart PATCH wallet allocations); same formula in `packages/api/referrals/src/redeem-wallet.ts` (`existingCartQty + quantity` plus tickets already owned).

**Issue:** Referral/wallet quantity must already be ≤ cart quantity (`mergeWalletIntoCheckoutItems` sets `paidQty = quantity - walletQty`). The limit check treats wallet tickets as extra entries. A cart of 6 with 5 wallet tickets is rejected when the limit is 10, even though the customer is only taking 6 tickets. The cart PATCH path also ignores tickets the user already owns.

### P5-M1 — Promo release removes every per-user use, not one

**Where:** `releasePromoCodeUsage` in `packages/api/tickets/src/promo-codes.ts`.

**Issue:** Reserve with `maxUsesPerUser > 1` `$push`es the user id once per use. Release `$inc`s `currentUses` by −1 but `$pull`s the user id, which removes **every** matching entry in `usedBy`. One refund/abandon can wipe the user’s usage history while only returning a single global use, so later reserves no longer match `maxUsesPerUser`.

### P5-H2 — Checkout clamps ticket quantity after the charge amount is fixed

**Where:** `packages/api/server/src/routes/client/payments.ts` (session create, quantity clamp loop, then `effectivePaidSubtotal = paidSubtotal`).

**Issue:** If the buyer is over remaining stock or `maxTicketsPerUser`, the server lowers `item.quantity` / `item.paidQty` (and can drop the line) but still charges `paidSubtotal` from before the clamp. A cart of 5 with only 2 still allowed can be charged for 5 and fulfilled for 2. A missing `maxTicketsPerUser` is treated as 10 here (`?? 10`); cart auto-adjust treats a non-positive cap as the remaining pool.

### P5-H3 — Competition promo scope is skipped at checkout

**Where:** `validatePromoCode` in `packages/api/tickets/src/promo-codes.ts` (competition rules run only when `items` is passed). `resolveCheckoutDiscount` in `packages/api/server/src/routes/client/payments.ts` is called without `cartItems`.

**Issue:** Cart validation scopes a competition percentage to matching lines. Checkout omits line items, so the same code is a percentage of the whole cash subtotal, and minimum-ticket / “not valid for this cart” checks are skipped. A fixed competition discount is also not capped to the matching lines.

### P5-H4 — Percentage promo on the cart ignores wallet tickets; checkout does not

**Status:** **DONE** — cart totals and discount recalculation use post-wallet (cash) subtotal; percentage promos stored via `promoDiscountPercent`.

### P5-H5 — First-order referral replaces an applied promo

**Status:** **DONE** — `ensureReferralDiscountOnCart` no longer clears an existing promo; auto-referral skipped when `promoCode` / `promoCodeId` is set.

### P5-H6 — Cart can show promo and referral together; checkout keeps one

**Status:** **DONE** — `recalculateCartDiscount` mirrors checkout (single discount; deferred promo fallback if referral invalid).

### P5-H7 — Reused payment sessions are not checked against the new total

**Status:** **DONE** — Stripe and Paytriot idempotent reuse require matching order total (Paytriot lost-claim path included).

### P5-H8 — Guest checkout onto an existing account uses the anonymous id for the ticket cap

**Status:** **DONE** — checkout cap uses `orderUserId` from guest profile resolution.

### P5-H9 — Checkout still sells after the draw countdown hits zero

**Status:** **DONE** — `isOpenForTicketSales` on checkout, cart sanitize, and ticket availability; draw job closes sales on earliest of `endDate` / `drawDate`.

### P5-H10 — Closing sales jumps straight to `pending_draw`

**Status:** **DONE** — `pending_draw` only when `drawDate` is due (or `endDate` when no draw date).

### P5-H11 — Repeat guest checkout drops prior tickets off the per-person cap

**Status:** **DONE** — guest profile merge reassigns `Ticket.ownerId` to the new profile.

### P5-H12 — A partial instant-win hold releases every reserved ticket for that prize

**Status:** **DONE** — partial hold failure releases only ticket numbers attempted in that hold call.

### P5-M2 — Sale close uses `drawDate` in the cart and `endDate` for wallet spend

**Status:** **DONE** — shared `competition-sales` + `getCompetitionCountdownTarget` on cards and detail countdown.

### P5-M3 — Per-person cap ignores other unpaid orders

**Status:** **DONE** — `countEffectiveOwnedForCap` / batch helpers include pending/processing order quantities.

### P5-M5 — Printed draw time uses the browser timezone

**Status:** **DONE** — `formatDateTime` uses `Europe/London`.

### P5-M7 — Order status filter only searches loaded rows

**Status:** **DONE** — orders page auto-fetches further pages while a filter is active and no matches are loaded yet.

### P5-M8 — Failed/refunded orders have no detail link

**Status:** **DONE** — `getOrderDetailHref` links all statuses to checkout success with `order_id`.

### P5-M4 — Guest competition page ignores tickets already in the cart

**Status:** **DONE** — guests load cart + limits on competition detail.

### P5-H13 — Progress bars use sold count only (not held)

**Status:** **WONTFIX** — product rule: held tickets in carts do not reduce the public “tickets left” / progress display; only sold (and API `availableTickets` when enriched) drive availability messaging.

### P5-H14 — Category filter is seeded with the wrong list

**Status:** **DONE** — category changes refetch; no stale `initialData` reuse.

### P5-H15 — Competition list never loads past the first 20

**Status:** **DONE** — list requests `limit=100`.

### P5-H16 — Sign-in-required competitions still show the entry form to guests

**Status:** **DONE** — `requireSignIn` mapped; guest gate on detail page.

### P5-M6 — Order, ticket, and win history never load past page 1

**Status:** **DONE** — SSR seeds `meta.hasMore` for orders infinite query.

