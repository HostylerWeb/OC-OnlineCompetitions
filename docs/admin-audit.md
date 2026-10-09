# Admin application audit (`apps/admin`)

**Date:** 2026-03-16 (pass 2 — competitions, winners, API deep dive)  
**Scope:** Online Competitions admin dashboard — Next.js app at `apps/admin` plus its embedded Hono API (`app/api/[[...route]]`) and shared backend routes under `packages/api/server/src/routes/admin/**`, `packages/auth/admin/**`, and `packages/api/admin/**`.  
**Out of scope (this pass):** `apps/client`, `apps/shop`, `apps/web-lander`.

**Method:** Static review (~269 TS/TSX files under `apps/admin`), dependency and route mapping, `bun run typecheck` / `lint` in `apps/admin`, and local runtime smoke tests against `http://127.0.0.1:3222` (health, auth-gated admin routes, public common routes, internal jobs, auth-setup).

---

## Executive summary

The admin stack is **feature-rich and generally well structured**: RBAC is enforced on most `/api/admin/*` handlers (`requireAdmin`, `requireStaff`, `requireManager`), page access uses Next `proxy.ts` plus dashboard layouts, and internal cron-style jobs require the emergency secret. **Main risks** are an **expanded public API surface on the admin origin**, **secrets committed in E2E tests**, **production hygiene issues** (debug logging, build ignoring TypeScript errors), and **operational gaps** (setup/account repair failures, uneven test coverage).

| Severity | Count (approx.) |
|----------|-----------------|
| Critical | 2 |
| High     | 10 |
| Medium   | 22 |
| Low      | 12 |
| Info     | 10 |

---

## Architecture (for context)

| Layer | Location | Notes |
|-------|----------|--------|
| UI | `apps/admin/app/**`, `components/**` | App Router; `(dashboard)` and `(studio)` route groups |
| Edge auth | `apps/admin/proxy.ts` | Session check via `/api/auth/get-session`; RBAC for admin-only nav paths |
| API | `apps/admin/app/api/[[...route]]/route.ts` | Full Hono app: Better Auth, **client/common routes**, admin routes, internal jobs |
| Admin API impl | `packages/api/server/src/routes/admin/*.ts` | Shared with client app patterns |
| Auth | `packages/auth/admin/**` | Separate Better Auth instance (`Online CompetitionsAdmin`) |

---

## Critical

### C1 — Hardcoded admin/manager passwords in E2E source

**Where:** `apps/admin/e2e/admin.spec.ts` (constants `ADMIN_PASSWORD`, `MANAGER_PASSWORD`, emails).

**Issue:** Real-looking credentials are committed to the repo. Anyone with repo access can use them if those accounts exist in staging/production.

**Recommendation:** Load credentials from CI secrets / `process.env`, use ephemeral seed users in `e2e/seed.ts`, and rotate any passwords that ever matched these strings.

---

### C2 — Client/public API mounted on admin origin without global auth gate

**Where:** `apps/admin/app/api/[[...route]]/route.ts` mounts `competitions`, `entries`, `winners`, `stats`, `categories`, `landing-page`, `push`, etc., after `sessionMiddleware` only. `isPublicRoute()` in `packages/api/server/src/middleware/auth.ts` treats these prefixes as public (no login required).

**Runtime evidence:** `GET /api/competitions` → **200** without cookies on port 3222.

**Issue:** The admin host exposes the same **public catalogue API** as the customer app. That increases scraping/abuse surface (competition data, entries when parameterized, push endpoints, etc.) on a host meant for staff. CORS limits browser origins but **does not protect server-side or non-browser clients**.

**Recommendation:** Either remove common routes from the admin app entrypoint (admin UI should call only `/api/admin/*` and small shared helpers), or wrap admin-origin common routes with `requireStaff` / IP allowlist / separate `ADMIN_API_PUBLIC=false` flag.

---

## High

### H1 — `typescript.ignoreBuildErrors: true` in admin Next config

**Where:** `apps/admin/next.config.ts`.

**Issue:** Production builds can ship with TypeScript errors; local `tsc --noEmit` passing today does not guarantee future builds are type-safe.

**Recommendation:** Set to `false` and fix errors; gate CI on `bun run typecheck` for `@oc/admin`.

---

### H2 — Admin setup status is unauthenticated

**Where:** `GET /api/auth-setup` → `getAdminSetupStatus()` (no session).

**Runtime evidence:** `{"data":{"available":false,"requiresSecret":true,"defaultEmail":null}}`.

**Issue:** When no admin exists, responses can reveal `defaultEmail` and whether setup is open — aids targeted takeover attempts (combined with weak/missing `SETUP_SECRET`).

**Recommendation:** Rate-limit, require setup secret for **GET** when `available: true`, or return minimal `{ available: boolean }` only.

---

### H3 — Emergency secret protects internal jobs (good) but shares header with emergency auth

**Where:** `packages/api/server/src/routes/admin/jobs.ts` uses `validateEmergencySecret` on all `POST /api/internal/jobs/*`.

**Runtime evidence:** `POST .../check-competitions-for-draw` without header → **403**.

**Issue:** If `ADMIN_EMERGENCY_SECRET` leaks, attacker can run draw checks, notification processors, order cleanup, etc. Secret rotation and network restriction (Vercel cron only, no public internet) are essential.

**Recommendation:** Separate **job** secret from **account emergency** secret; allowlist caller IPs or use signed JWTs for job runners.

---

### H4 — Dynamic `trustedOrigins` includes request `Origin`

**Where:** `packages/auth/admin/src/admin-auth.ts` — `trustedOrigins` pushes `request.headers.get("Origin")`.

**Issue:** Better Auth may accept additional origins per request, weakening CSRF/origin checks if an attacker can cause a browser to send a crafted Origin with credentials.

**Recommendation:** Use a fixed allowlist (`APP_URL`, staging URLs) only; do not mirror arbitrary `Origin`.

---

### H5 — Global console hijack (“image debug logger”) in root layout

**Where:** `apps/admin/app/layout.tsx` — inline script wraps `console.log/warn/error` and exposes `window.__dumpLogs()`.

**Issue:** Runs for **all** admin users in all environments; adds overhead, complicates debugging, and is atypical for production admin UIs.

**Recommendation:** Remove or guard with `process.env.NODE_ENV === 'development'` and a explicit debug flag.

---

### H6 — `/sentry-debug` triggers test errors for any staff session

**Where:** `apps/admin/app/(dashboard)/sentry-debug/page.tsx` — `useEffect` calls `captureSentryTestError()`.

**Issue:** Not in nav but URL is reachable (also redirected from `/admin/sentry-debug`). Managers/admins auto-generate noise and potential alert fatigue in GlitchTip/Sentry.

**Recommendation:** Admin-only role, env-gated (`STAGING_ONLY`), or remove from production builds.

---

### H7 — Draw Studio Google Sheet settings call wrong API paths (broken feature)

**Where:** `apps/admin/app/(studio)/livestream/draws/full/page.tsx` uses `/api/admin/sheet-settings` (+ POST/DELETE/sync variants).

**Actual routes:** Mounted under livestream router at `/api/admin/livestream/sheet-settings` (`packages/api/server/src/routes/admin/livestream.ts`, registered in admin `route.ts`).

**Runtime evidence (port 3222):**

| Request | HTTP |
|---------|------|
| `GET /api/admin/sheet-settings` | **404** |
| `GET /api/admin/livestream/sheet-settings` (no session) | **401** (route exists) |

**Impact:** Sheet whitelist, Drive folder ID, and sync in Draw Studio cannot load or save until paths are fixed. `create-sheet` correctly uses `/api/admin/livestream/create-sheet`.

---

### H8 — Livestream API is admin-only; managers use Draw Studio in UI

**Where:** `packages/api/server/src/routes/admin/livestream.ts` — `app.use("*", requireAdmin)`.

**Issue:** Nav and E2E treat **managers** as livestream operators (`end-draw`, winner confirmation). They can open Draw Studio, but all livestream endpoints (Google Sheets, sheet settings, create-sheet) return **403** unless role is `admin`. Combined with H7, even admins hit 404 on settings until paths are fixed.

**Recommendation:** Split RBAC: `requireStaff` for read/draw-time actions, `requireAdmin` for sheet ACL and destructive sheet ops; fix frontend paths (H7).

---

## Medium

### M1 — RBAC: UI vs API vs layout (defense in depth)

- **UI/nav:** `lib/nav-permissions.ts` + `proxy.ts` hide admin-only paths from managers.
- **Dashboard layout:** `(dashboard)/layout.tsx` checks staff role but **not** admin-only paths (relies on proxy).
- **API:** Mixed `requireManager` / `requireStaff` / `requireAdmin` — generally aligned (e.g. managers blocked from writes via `requireManager`).

**Gap:** Direct navigation / `(studio)/layout.tsx` does not call `isAdminOnlyPath`. Managers can use Draw Studio and other studio routes by URL.

**Recommendation:** Centralize RBAC in a shared helper used by proxy, both layouts, and document manager capabilities.

---

### M2 — Manager can run competition draws but not edit competitions

**Where:** `packages/api/server/src/routes/admin/competitions.ts` — `requireStaff` globally; `/:id` writes require `requireAdmin` except `end-draw`.

**Assessment:** Likely intentional; ensure product/docs state managers may **end draws** but not change catalogue.

---

### M3 — User delete and role changes

**Where:** `packages/api/server/src/routes/admin/users.ts` — router uses `requireManager`; **DELETE** and **PUT** (role changes) are non–read-only, so managers receive **403** from `requireManager`.

**UI:** E2E asserts managers do not see Delete / Grant Admin — **consistent**.

**Note:** Role changes require `reason` and fresh session (&lt; 30 minutes) — good control for admins.

---

### M4 — Admin account bootstrap / repair fragility

**Observed in ops:** `upsertAdminAccount` / Better Auth `createUser` can fail with **“Value must be an array”** when repairing existing users (documented in local runbooks).

**Where:** `packages/auth/admin/src/auth-setup.ts`.

**Recommendation:** Add integration test for setup + re-setup paths; align Better Auth plugin field shapes with `createUser` body.

---

### M5 — Email verification disabled for admin password login

**Where:** `admin-auth.ts` — `requireEmailVerification: false` for email/password.

**Issue:** Admin accounts can sign in without verified email if created outside OTP flow.

**Recommendation:** Enable verification for non-break-glass accounts or enforce verified email before granting `admin` role.

---

### M6 — Google OAuth scopes include Sheets + Drive on admin

**Where:** `admin-auth.ts` social provider scopes.

**Issue:** Broad OAuth scope for an auth provider increases blast radius if admin Google tokens are stored/compromised.

**Recommendation:** Restrict to login scopes on auth; use separate Google integration for Sheets (service account or dedicated connect flow).

---

### M7 — Prefetch burst on every dashboard/studio load

**Where:** `components/layout/PrefetchBurst.tsx` — prefetches competitions, orders, users, winners lists (page 1) on mount.

**Issue:** Extra Mongo/API load on every navigation into dashboard shell; noticeable on cold DB or slow networks.

**Recommendation:** Prefetch on hover/sidebar intent, or only on dashboard home.

---

### M8 — Verbose debug logging in competitions UI

**Where:** `apps/admin/app/(dashboard)/competitions/page.tsx` — multiple `console.log` calls (`handleClose`, orphan cleanup).

**Issue:** Leaks operational details to browser console in production.

**Recommendation:** Remove or use structured logging behind dev flag.

---

### M9 — Biome lint scope excludes most components

**Where:** `apps/admin/package.json` — `lint` only `app/ lib/ components/media/ hooks/`.

**Issue:** Majority of `components/**` (shell, compliance, referral network, etc.) not in default lint path.

**Recommendation:** Expand to `components/` or entire app; run in CI.

---

### M10 — CSP allows `'unsafe-inline'` and `'unsafe-eval'` for scripts

**Where:** `apps/admin/next.config.ts` headers.

**Issue:** Weakens XSS mitigation; may be required by Next/third parties but should be tightened over time.

**Note:** API responses set separate security headers in Hono but **not** the full CSP from Next `headers()`.

---

### M11 — CORS on admin API

**Where:** `route.ts` — localhost any port + `*.onlinecompetitions.co.uk`.

**Issue:** Appropriate for dev; ensure production admin URL is not unnecessarily broad (wildcard subdomains).

---

### M13 — CSV export loads full collections (no pagination cap)

**Where:** `packages/api/server/src/routes/admin/export.ts` — e.g. `Profile.find(filter)` for `/users` with no `limit`; similar patterns for orders (aggregate), winners, promo codes, etc.

**Issue:** Large production datasets can cause **memory/timeouts** on export and browser downloads. Export is correctly gated with `requireAdmin`.

**Recommendation:** Streaming CSV, cursor batches, or hard caps with “export too large” errors.

---

### M14 — Bulk `grant-admin` / `revoke-admin` without compliance audit trail

**Where:** `packages/api/server/src/routes/admin/bulk-actions.ts` updates Profile + auth `user` collection directly.

**Contrast:** Single-user role change via `PUT /api/admin/users/:id` requires `reason`, fresh session, and writes `ComplianceAuditLog`.

**Issue:** Bulk path bypasses those controls — admin-only (`requireAdmin`) but weaker governance and no audit parity.

---

### M15 — Frontend shows admin-only actions to managers (API correctly rejects)

**Examples:**

| UI | API enforcement | Manager experience |
|----|-----------------|-------------------|
| Undraw button on drawn competition (`CompetitionFormSheet.tsx`) | `POST .../undraw` → `requireAdmin` | Sees control; request fails with 403 |
| Winners delete / claim / bulk actions (`winners/page.tsx`) | `/:id` mutations → `requireAdmin`; bulk → `requireAdmin` | Buttons visible; API 403 |
| Export CSV links (orders, winners, competitions pages) | `/api/admin/export/*` → `requireAdmin` | May open tab with error |

**Recommendation:** Gate controls with `useAuth().role === "admin"` (or shared helper) to match API.

---

### M16 — Public SSE `GET /api/competitions/stream` on admin origin

**Where:** `packages/api/server/src/routes/common/competitions.ts` — long-lived SSE with 5s heartbeats.

**Runtime evidence:** Unauthenticated request returns **200** and holds connection (curl times out without `--max-time`).

**Issue:** Same as C2 — extra **persistent connections** on admin host; competes with staff traffic and bypasses intent of isolating admin.

---

### M17 — Public winners list does per-row asset `HEAD` requests

**Where:** `packages/api/server/src/routes/common/winners.ts` — loop with `fetch(url, { method: "HEAD" })` per winner/competition image.

**Issue:** On admin origin, unauthenticated callers can trigger **N outbound HTTP requests** per page view (latency + SSRF-style load if URLs ever user-influenced).

---

### M18 — Media library writes use `requireManager` (not admin-only)

**Where:** `packages/api/server/src/routes/admin/media.ts` — upload, delete, batch delete available to **managers**.

**Issue:** Managers can remove or overwrite S3 assets under allowed prefixes (`prizes/`, `uploads/`, `og-images/`). May be intentional for content ops; confirm product policy.

**Logging:** Upload/delete paths log uploader id and keys to stdout (operational, not secret — but verbose in prod).

---

### M19 — Referral mindmap can return large graphs

**Where:** `GET /api/admin/referral-mindmap` — `depth` up to **8**, optional deleted users (`requireManager`).

**Issue:** Expensive Mongo/graph build; no obvious server-side timeout beyond default; heavy for browser (React Flow on `/referrals/network`).

---

### M20 — Dashboard stats in-memory cache (60s TTL)

**Where:** `packages/api/server/src/routes/admin/dashboard.ts` — module-level `dashboardCache`.

**Issue:** In multi-instance/serverless deployments, **cache is per instance** (stale/inconsistent stats), not shared Redis. Acceptable for dev; document for prod.

---

### M21 — Competition `undraw` only resets primary winner ticket

**Where:** `POST /api/admin/competitions/:id/undraw` soft-deletes winners and resets `competition.winnerTicketNumber` ticket to `available`.

**Issue:** If multi-winner or ancillary winner records exist, logic may leave **inconsistent ticket/winner state** (verify against product rules for single-winner competitions only).

**UI copy:** States no customer notification on undraw — operational risk if comms expected.

---

### M22 — Managers may confirm winners but not edit fulfilment

**Where:** `packages/api/server/src/routes/admin/winners.ts` — `POST /` (create winner) under `requireStaff`; `PUT/PATCH/DELETE /:id` under `requireAdmin`.

**Assessment:** Aligns with livestream operator model; document clearly. `GET /entries/search` exposes **email + name** for a ticket (staff-only — OK for ops, PII-sensitive).

---

## Pass 3 additions (2026-10-02) — promo codes & admin product gaps

### M23 — Promo codes: `maxUsesPerUser` defaults to 1 with no admin control

**Where:**

- Schema default: `packages/api/db/src/models/PromoCode.ts` (`maxUsesPerUser: 1`, `usedBy[]`).
- Enforcement: `reservePromoCodeUsage` in `packages/api/tickets/src/promo-codes.ts` (blocks same `userId` in `usedBy` when limit is 1).
- Admin UI: `apps/admin/app/(dashboard)/promo-codes/page.tsx` — form has global **Max uses** only.
- API validation: `packages/api/validation/src/schemas/promo-codes.ts` — **`maxUsesPerUser` not accepted** on create/update.

**Issue:** Staff expect reusable campaign codes (e.g. “10% off every order”). In practice every promo created in admin is **one successful checkout per customer**, with no UI to change that. Reported operationally on live sites.

**Recommendation:** Add **Max uses per customer** (including “unlimited”) to admin form, Zod schemas, and promo table; migration note for existing codes.

---

### M24 — No supported way to reset promo usage for support

**Where:** `PUT /api/admin/promo-codes/:id` deletes `usedBy` and `currentUses` from request body (`packages/api/server/src/routes/admin/promo-codes.ts`).

**Issue:** If a user is stuck after a failed/abandoned payment that still reserved usage, or staff need to re-issue a one-time code, support must edit Mongo manually.

**Recommendation:** Admin-only action to decrement `currentUses` / remove a user from `usedBy` with `ComplianceAuditLog` entry.

---

## Pass 4 additions (2026-10-02) — orders, refunds, payments ops

See full domain coverage in [platform-audit-pass4.md](./platform-audit-pass4.md). Admin-relevant highlights:

### P4-H1 — Admin “refund” credits wallet without PSP refund

**Where:** `PUT` order status `refunded` → `rollbackOrderRefund` (`packages/api/payment-core`, `routes/admin/orders.ts`).

**Issue:** Card charges may remain captured while customer receives wallet credit.

**Recommendation:** Integrate Paytriot/Stripe refund before in-system rollback.

---

### P4-H5 — Conversion postback URLs (SSRF)

**Where:** Admin **Conversion tracking** settings → server `fetch` in affiliate tracker.

**Issue:** Staff-configured URLs can target internal networks from API host.

**Recommendation:** HTTPS allowlist and block private IPs.

---

### P4-M10 — Ticketing anomaly job mutates sold/hold counts silently

**Where:** `lib/jobs/ticketing-anomaly-checks.ts`.

**Recommendation:** Alert before auto-repair; audit log when fixing competition counters.

---

### M12 — `meProfile` client route on admin API

**Where:** `app.route("/api/me/profile", meProfile)` with `requireSession`.

**Issue:** Admin users get **client-shaped** profile payloads (orders, guest reassignment). Not necessarily wrong but confusing and may expose client fields staff should not see on wrong account type.

**Recommendation:** Admin-specific profile route or strip client-only fields for staff sessions.

---

## Low

### L1 — `force-dynamic` on root dashboard layout

**Where:** `(dashboard)/layout.tsx`, `(studio)/layout.tsx`.

**Impact:** No static caching for shell; expected for auth’d admin, but increases TTFB vs partial static shells.

---

### L2 — Proxy session fetch uses localhost loopback on HTTPS origins

**Where:** `proxy.ts` — if `origin.startsWith("https")`, `baseURL` becomes `http://localhost:${PORT}`.

**Issue:** Can break session resolution in production HTTPS if internal fetch port/env wrong.

**Recommendation:** Use `APP_URL` or internal `http://127.0.0.1:3222` from env documented for the deployment platform.

---

### L3 — `hono-rate-limiter` dependency unused in admin route

**Where:** `apps/admin/package.json` depends on `hono-rate-limiter`; admin `route.ts` does not apply it (Better Auth has its own rate limiter).

**Recommendation:** Remove unused dep or add limiters for heavy export/search endpoints.

---

### L4 — Request logging logs all API paths to stdout

**Where:** `route.ts` JSON access logs.

**Issue:** Volume/cost in serverless; ensure no sensitive query params logged.

---

### L5 — Unused import lint in `nav-permissions.ts`

**Where:** Biome warning for unused `NavItem` type import.

---

### L6 — PWA + service worker on admin

**Where:** `layout.tsx` — manifest, `sw-register.js`, install prompt.

**Issue:** Admin PWA increases cache/session exposure on shared devices.

**Recommendation:** Document security expectations; optional disable in production.

---

### L7 — Umami analytics script on admin

**Where:** `layout.tsx` when `NEXT_PUBLIC_UMAMI_WEBSITE_ID` set.

**Issue:** Staff usage tracked to third party; ensure privacy policy compliance.

---

### L8 — Legacy URL redirects permanently expose old paths

**Where:** `next.config.ts` `OLD_ADMIN_REDIRECTS` (301 to new paths).

**Info:** Good for bookmarks; `/admin/sentry-debug` still reachable via redirect.

---

### L9 — Health endpoints unauthenticated

**Where:** `/api/health`, `/api/health/ready`.

**Assessment:** Standard; ready check exposes DB/Redis status — acceptable internally, avoid public exposure without network ACL.

---

### L10 — Duplicate route mounting pattern

**Where:** Multiple `app.route("/api/admin/users", ...)` modules (compliance, profile, referral, users).

**Assessment:** Works if Hono merge order is stable; fragile when adding conflicting paths — prefer single router composition.

---

## Testing & quality gaps

| Area | Status |
|------|--------|
| `bun run typecheck` (`apps/admin`) | Passes (2026-03-16) |
| `bun run lint` | 1 warning (unused import) |
| E2E (`apps/admin/e2e/admin.spec.ts`) | Broad coverage for core tables/nav; **hardcoded secrets**; many `waitForTimeout` flakes; **missing** shop, media, notifications, bonus-awards subroutes, referral network, conversion tracking, SEO, push subscriptions |
| Unit tests | Live under `packages/api/server` (admin route tests); **no** dedicated test script in `apps/admin/package.json` |
| Build | TypeScript errors ignored at build time (see H1) |

---

## Admin API surface map (embedded Hono)

Prefix: all routes served from `apps/admin` at `http://<host>:3222` unless noted.

### Auth & setup (no staff session required for listed routes)

| Prefix | Auth | Purpose |
|--------|------|---------|
| `/api/auth/*` | Better Auth | Login, session, OAuth |
| `/api/auth-setup` | Setup secret when configured | Bootstrap first admin |
| `/api/auth-emergency` | Emergency secret | Break-glass account recovery |
| `/api/health`, `/api/health/ready`, `/api/version` | None | Ops probes |

### Public / client-shared (no login — **see C2**)

| Prefix | Notes |
|--------|--------|
| `/api/competitions`, `/api/competitions/stream` (SSE) | List, detail, stream |
| `/api/categories`, `/api/winners`, `/api/stats`, `/api/entries` | Catalogue / entries |
| `/api/landing-page`, `/api/competitions/:slug/landing-page` | Marketing |
| `/api/push/*` | Subscribe/preferences (preferences needs session user) |

### Staff API — RBAC summary

| Middleware | Routes (examples) |
|------------|-------------------|
| `requireManager` | `/api/admin/dashboard`, orders, users (read), search, media, referrals, mindmap, most tables |
| `requireStaff` | `/api/admin/competitions` (read + `end-draw`), `/api/admin/winners` (read + create) |
| `requireAdmin` | export, bulk, balances, compliance settings, payment methods, livestream, livestream sheets, conversion, SEO, email settings, competition writes (non-draw), winner fulfilment writes |

### Internal

| Prefix | Auth |
|--------|------|
| `/api/internal/jobs/*` | `X-Emergency-Secret` (same validator as emergency auth) |

**Duplicate mount:** Four modules attach to `/api/admin/users` (users, user-profile, user-compliance, user-referral) — works via Hono merge but order-sensitive for new paths.

---

## Competitions — backend & UI

### Key admin endpoints (`/api/admin/competitions`)

| Method | Path | Who | Notes |
|--------|------|-----|--------|
| GET | `/`, `/:id`, `/deleted` | Staff | Aggregations, 5s `maxTimeMS` on lists |
| POST | `/` | Admin | Create |
| PUT | `/:id`, landing-video flows | Admin | Large handler (~1.3k lines file) |
| DELETE | `/:id` | Admin | Soft delete |
| POST | `/:id/end-draw` | **Staff** | Sets status `paused` for livestream |
| POST | `/:id/undraw` | Admin | Reverts draw; audit fields in `undrawHistory` |
| POST | `/:id/restore` | Admin | Restore deleted competition |

### UI (`app/(dashboard)/competitions/page.tsx`)

- Heavy client page: streams, ending-soon settings mutations, image orphan cleanup with **`console.log` debug** (M8).
- On save/close, fires **parallel** `api.delete("/api/admin/media/assets")` for removed URLs — can race with cache invalidation (comments in code acknowledge cache edge cases).
- Export opens `/api/admin/export/competitions` (admin-only).
- **Undraw** UI visible for any staff when status is `drawn`; API admin-only (M15).

### Common `/api/competitions` on same host

- Cached public list/detail; **SSE stream** for live ticket/competition updates (M16).
- Admin UI may also use admin list endpoints — two sources of truth for “live” data (admin mutations vs public cache invalidation).

---

## Winners — backend & UI

### Key admin endpoints (`/api/admin/winners`)

| Method | Path | Who | Notes |
|--------|------|-----|--------|
| GET | `/`, `/:id`, `/deleted`, `/entries/search` | Staff | Search returns PII for ticket lookup |
| POST | `/` | Staff | Confirm/create winner after draw |
| PUT/PATCH/DELETE | `/:id`, `/restore` | Admin | Fulfilment edits, claim, delete |

Side effects on create: emails (`WinNotificationEmail`), push (`sendPushNotification`), cache invalidation.

### UI (`app/(dashboard)/winners/page.tsx`)

- Create winner form, image/portrait uploads, bulk bar (claim/unclaim/delete), export link.
- No `useAuth()` role gating — managers see destructive controls (M15).
- Uses `/api/admin/bulk/winners` for bulk (admin-only).

### Public `/api/winners` on admin host

- Paginated winner gallery for client; **no auth** (verified **200** unauthenticated).
- Image HEAD checks per row (M17).

---

## Livestream & Draw Studio

| Component | Path | Status |
|-----------|------|--------|
| Livestream draws table | `/livestream/draws` | Uses admin competitions + winner search APIs |
| Draw Studio (fullscreen) | `/livestream/draws/full` | `(studio)` layout; `end-draw` via API |
| Sheet settings UI | Wrong `/api/admin/sheet-settings` | **Broken (H7)** |
| Google sheet create | `/api/admin/livestream/create-sheet` | Path correct; **admin-only (H8)** |

---

## Runtime verification (pass 2, localhost:3222)

Unauthenticated unless noted:

| Endpoint | Result |
|----------|--------|
| `GET /api/competitions` | 200 |
| `GET /api/winners` | 200 |
| `GET /api/stats` | 200 |
| `GET /api/admin/dashboard` | 401 |
| `GET /api/admin/export/users` | 401 |
| `GET /api/admin/search?q=test` | 401 |
| `GET /api/admin/winners/entries/search?...` | 401 |
| `POST /api/internal/jobs/check-competitions-for-draw` | 403 |
| `GET /api/admin/sheet-settings` | **404** |
| `GET /api/admin/livestream/sheet-settings` | 401 |
| `GET /api/competitions/stream` | 200 (long-lived SSE) |

---

## Feature / product completeness (admin UI)

Routes present under `app/(dashboard)/` align well with `config/adminNavigation.ts`. Notable items:

| Feature | Route | Notes |
|---------|-------|--------|
| Shop | `/shop/*` | Backend routes exist; **not** in default E2E sidebar list |
| Notifications | `/notifications/*` | Push + campaigns; limited E2E |
| Bonus awards | `/bonus-awards/*` | Subroutes for fires/wins |
| Referral network | `/referrals/network` | Heavy client graph (React Flow) — performance test on large graphs not evident |
| Conversion tracking | `/conversion-tracking` | Admin-only nav |
| Media library | `/media` | S3/MinIO dependent |
| Ending soon settings | Embedded in competitions UI | No dedicated nav item (by design) |
| Livestream Draw Studio | `/livestream/draws/full` | Sheet settings **broken (H7)**; manager vs admin API mismatch (H8) |

No `TODO/FIXME` markers in `apps/admin` source (excluding `node_modules` / `.next`).

---

## Security controls that work (positive findings)

1. **Admin dashboard API** requires auth — e.g. `GET /api/admin/dashboard` without session → `UNAUTHORIZED` (verified).
2. **Internal jobs** reject missing emergency secret (verified 403).
3. **Security headers** on API responses: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, optional HSTS.
4. **Body size limit** 10MB aligned with media upload cap.
5. **Manager read-only** enforced at middleware for mutating HTTP methods on `requireManager` routers.
6. **Competition mutations** restricted to `admin` role (except draw execution for staff).
7. **Page protection** via `proxy.ts` matcher excluding static assets; unauthenticated users redirected to login (E2E covered).
8. **robots: noindex** in admin metadata.

---

## Recommended priority backlog

1. Remove/rotate E2E credentials (C1).  
2. Reduce public API on admin origin (C2, M16–M17).  
3. **Fix Draw Studio sheet-settings URLs (H7)** and livestream RBAC for managers (H8).  
4. Fix `ignoreBuildErrors` and expand CI lint (H1, M9).  
5. Remove debug console wrapper and competitions logs (H5, M8).  
6. Harden setup + emergency endpoints (H2, H3).  
7. Tighten Better Auth origins (H4).  
8. Gate or remove sentry-debug in production (H6).  
9. Align UI with API RBAC (M15); bulk role changes audit parity (M14).  
10. Cap or stream CSV exports (M13).  
11. Fix admin bootstrap/createUser array error (M4).  
12. Expand E2E to shop/notifications/livestream sheet settings; no committed secrets.  
13. Promo per-user limits in admin UI and API (M23); support reset for `usedBy` (M24).  
14. **Pass 4:** admin refund vs PSP (P4-H1), affiliate SSRF (P4-H5), ticket counter auto-fix (P4-M10) — [platform-audit-pass4.md](./platform-audit-pass4.md).

---

## Related docs

- [local-development.md](./local-development.md) — ports, admin login, env  
- `apps/admin/.env.example` — required secrets (`SETUP_SECRET`, `ADMIN_EMERGENCY_SECRET`, `DATABASE_URL`, etc.)

---

*Next audit pass (when requested): `apps/client` + shared client API entrypoint for comparison with admin-origin exposure.*

---

## Pass 5 — admin UI (2026-10-02)

### P5-H17 — Editing an instant prize can delete slots

**Where:** `CompetitionInstantPrizesTab.tsx` clamps quantity to `maxAssignableQty`, then saves a decrease with `{ quantity, absolute: true }`. Capacity in `validate-instant-prize-assignment.ts` counts pickable tickets with this assignment’s winning numbers excluded, and `remainingSlots` is extra room after other assignments (`excludeCipId`).

**Issue:** `maxAssignableQty` is how many more slots can be added, not the assignment’s absolute size. Opening an existing prize can lower the field to that extra room. Saving then cuts the assignment to whatever is still free in the pool.
