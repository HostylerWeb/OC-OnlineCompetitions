# MongoDB / data layer audit

**Date:** 2026-03-17 (pass 3 additions 2026-10-02)  
**Scope:** `packages/api/db/**` (Mongoose models, soft-delete plugin, migrations), Better Auth Mongo collections (`user`, `session`, `account`), and query patterns in `packages/api/server/src/**`, `packages/auth/admin/**`, `packages/api/compliance/**`.

**Related app audits:** [admin-audit.md](./admin-audit.md), [client-audit.md](./client-audit.md)

**Method:** Static review of ~45 Mongoose schemas and server route query usage; live inspection of local Docker Mongo (`mongodb://localhost:27017/onlinecompetitions?directConnection=true`, replica set `rs0`, **no authentication** in default dev stack). `mongosh` was not installed; index/collection stats were collected via Bun + Mongoose.

---

## Executive summary

The data model is **mature for a competition platform**: strong ticket uniqueness, rich indexing on orders/tickets/competitions, TTL cleanup for sessions/webhooks/carts/pending orders, and soft-delete on most business entities. **Highest risks** are **split-brain identity** (Better Auth `user` vs `Profile`), **broken role sync queries** that update Profile but not auth `user.role`, **unauthenticated local Mongo**, **public aggregation pipelines** that can be abused for load/ReDoS, and **retention TTLs** on orders that may conflict with finance/compliance needs.

| Severity | Count (approx.) |
|----------|-----------------|
| Critical | 2 |
| High     | 9 |
| Medium   | 16 |
| Low      | 10 |
| Info     | 8 |

---

## Architecture (for context)

| Store | Collections | Purpose |
|-------|-------------|---------|
| **Mongoose / `@oc/api-db`** | `profiles`, `orders`, `tickets`, `competitions`, … (~47 in local DB) | Product data, RBAC mirrors, payments, referrals |
| **Better Auth adapter** | `user`, `session`, `account` (+ optional `verification`) | Credentials, sessions, OAuth links |
| **Linking** | `Profile._id` === Better Auth user id (string/ObjectId) | Created in `createOnline CompetitionsProfile` (`packages/auth/admin/src/auth-hooks.ts`) |

**Authorization at runtime** uses the **session user’s `role`** from Better Auth (`packages/api/server/src/middleware/auth.ts`), not `Profile.isAdmin` alone.

**Connection:** `DATABASE_URL` / `MONGO_URI` via `packages/api/infra/src/db.ts` (pool max 50, primary read preference, session TTL index on connect).

---

## Live database snapshot (local dev, 2026-03-17)

| Observation | Detail |
|-------------|--------|
| Collections | 47 |
| `profiles` | 1 doc; indexes: `email` unique sparse, `referralCode` unique sparse, referral graph indexes |
| `user` | 6 docs (mostly anonymous guest auth users); **only `_id` index** |
| `session` | 7 docs; `expiresAt` TTL with `expireAfterSeconds: 0` ✓ |
| `carts` | 2 docs; `lastActivityAt` TTL (30d) ✓; **missing** schema-defined empty-cart `updatedAt` TTL index |
| `orders` / `tickets` / `competitions` | 0 docs locally; indexes match Mongoose definitions (including order TTL partial indexes) |

Production may differ; treat index drift and counts as **signals to verify in staging/prod**, not guarantees.

---

## Critical

### C1 — Admin role changes may not update Better Auth `user` (RBAC desync)

**Where:**

- `PUT /api/admin/users/:id` — `collection("user").updateOne({ id }, …)`  
  (`packages/api/server/src/routes/admin/users.ts`)
- `POST /api/admin/bulk-actions/users` — `updateMany({ id: { $in: parsed.ids } }, …)`  
  (`packages/api/server/src/routes/admin/bulk-actions.ts`)

**Evidence:** Local `user` documents use **`_id`** (string) and have **no `id` field**. Compliance code correctly uses `{ _id: userId }` (`packages/api/compliance/src/compliance-user-service.ts`).

**Issue:** Profile `role` / `isAdmin` can change while **session `user.role` stays unchanged**. Effects:

- **grant-admin / role elevation in UI:** Profile shows admin; **API may still treat user as non-admin** (session role unchanged) — broken ops.
- **revoke-admin:** Profile demoted; **auth user may remain `admin`/`manager`** — **privilege retention** until sessions expire or manual DB fix.

**Recommendation:** Use Better Auth `internalAdapter.updateUser` or update by `{ _id: id }` (and verify id type string vs ObjectId). Add integration tests asserting `user.role` and `Profile.role` after grant/revoke. Audit production for mismatched rows.

---

### C2 — Default dev Mongo has no authentication

**Where:** `docs/local-development.md` — `mongodb://localhost:27017/onlinecompetitions?directConnection=true`; `scripts/mongo-init.js` only runs `rs.initiate` (no users).

**Issue:** Any process on the host can read/write **PII, payment metadata, and admin roles**. Common on developer laptops and misconfigured staging.

**Recommendation:** Enable SCRAM users + least privilege in Docker Compose; require TLS + auth in production `DATABASE_URL`; network isolate DB from public subnets; rotate credentials; never expose 27017 publicly.

---

## High

### H1 — Dual identity: Profile vs Better Auth `user`

**Issue:** Two sources for email, verification, and role. Hooks sync on auth user create/update, but **direct Profile updates** (admin users API, bulk actions, jobs) can drift from auth unless every path updates both consistently (currently broken for role — see C1).

**Recommendation:** Single write path for role/email verification; periodic reconciliation job; document which field is authoritative (auth for RBAC, Profile for product/compliance).

---

### H2 — Public entries API: heavy `$lookup` + unescaped `$regex` search

**Where:** `GET /api/entries` — `packages/api/server/src/routes/common/entries.ts`

**Issue:**

- Pipeline: match sold tickets → `$lookup` orders → `$lookup` profiles → optional `$regex` on `firstName`/`lastName` **without** `escapeRegex` / `substringRegex`.
- Public, cache TTL 30s, no auth — attacker can drive **CPU-heavy aggregations** and **ReDoS** via malicious `search` patterns.

**Recommendation:** Escape regex input; cap `search` length; rate-limit by IP; consider Atlas `$search` or prefix indexes; require staff auth for deep search.

---

### H3 — Order TTL deletes completed/refunded orders after 90 days

**Where:** `OrderSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 90d, partialFilterExpression: { status: { $in: ["completed", "refunded"] } } })` — `packages/api/db/src/models/Order.ts`

**Issue:** Financial, tax, chargeback, and gambling-compliance retention may require **years** of order history. TTL silently removes records (and linked analytics), while soft-delete plugin does not protect TTL deletes.

**Recommendation:** Confirm legal retention period; disable or lengthen TTL in production; archive to cold storage before expiry; exclude `failed` explicitly if retaining for fraud analysis (see H4).

---

### H4 — Failed orders never TTL-expire

**Where:** Pending/processing TTL on `createdAt` (7d); completed/refunded on `updatedAt` (90d); **`failed` in neither partial filter**.

**Issue:** Failed/abandoned payment attempts can **accumulate indefinitely**, increasing storage and admin search cost.

**Recommendation:** Add partial TTL or batch job for stale `failed` orders; index `{ status: 1, updatedAt: 1 }` if queried often.

---

### H5 — Better Auth `user` collection missing secondary indexes

**Live DB:** only `_id` on `user`.

**Issue:** Lookups by `email`, ban state, or role (setup, admin plugin) may **collection-scan** as user count grows.

**Recommendation:** Align with Better Auth / adapter recommended indexes (`email`, `role`, etc.); verify after auth upgrades.

---

### H6 — `session` lacks index on `userId`

**Where:** Session documents include `userId`; ban/revoke uses `session.deleteMany({ userId })` (`compliance-user-service.ts`).

**Issue:** Session revocation and user-scoped session listing **scan** without `{ userId: 1 }` index at scale.

**Recommendation:** `createIndex({ userId: 1 })`; optional compound `{ userId: 1, expiresAt: 1 }`.

---

### H7 — PII concentration in `profiles`

**Fields:** email, phone, DOB, address, spend limits, self-exclusion, affiliate IDs, referral graph (`packages/api/db/src/models/Profile.ts`).

**Issue:** One collection holds **customer PII + staff role flags** (`role`, `isAdmin`). Compromise or over-broad admin export leaks everything.

**Recommendation:** Field-level encryption or separate staff directory; minimize admin API projections; audit log access to full profiles; GDPR export/delete paths documented.

---

### H8 — Soft-delete plugin does not apply to aggregations

**Where:** `packages/api/db/src/plugins/soft-delete.ts` — hooks on `find`, `updateMany`, etc., **not** on `aggregate`.

**Issue:** Raw aggregations (entries, admin dashboards) can include **soft-deleted** orders/profiles unless each pipeline adds `deletedAt: null`.

**Recommendation:** Lint/review aggregations; helper `$match` stage; tests for deleted rows excluded on public routes.

---

### H9 — Guest profile hard-delete bypasses soft-delete audit trail

**Where:** `Profile.deleteOne({ _id: guestProfile._id })` in `createOnline CompetitionsProfile` (`auth-hooks.ts`).

**Issue:** Guest merge **permanently removes** a profile document instead of soft-delete — harder forensic recovery if merge logic bugs.

**Recommendation:** Soft-delete guest after transfer + compliance log; or archive collection.

---

## Medium

### M1 — Migration `003-opt-out-privacy.ts` mass `$set` privacy flags to opt-in display

**Where:** `packages/api/db/src/migrations/003-opt-out-privacy.ts` sets `showLastName`, `showLocation`, `showSocials` to **`true`** for profiles not already true.

**Issue:** One-off migration can **override user privacy choices** if run against prod without review; no versioned migration runner in repo (only standalone scripts).

**Recommendation:** Idempotent migrations table; legal review before run; default new users via schema not bulk update.

---

### M2 — No automated index sync / migration pipeline

**Issue:** Mongoose `syncIndexes` not run in CI; local `carts` missing empty-cart TTL index shows **drift** vs schema.

**Recommendation:** Deploy step: `syncIndexes()` or explicit index manifest; diff staging vs prod indexes monthly.

---

### M3 — Admin list/search regex on high-cardinality fields

**Where:** Admin competitions, users, orders, referral purchases, global search — `$regex` with `substringRegex` (escaped but **leading wildcard → no index use**).

**Issue:** Predictable **slow queries** and CPU under admin search load.

**Recommendation:** Atlas Search / text indexes; prefix search only; `maxTimeMS` everywhere (partially present on some aggregates).

---

### M4 — Referral admin search on denormalized emails without text index

**Where:** `referrerEmail`, `referredEmail` on `ReferralPurchase`; admin `$regex` filters.

**Issue:** Full collection scans as referral volume grows.

**Recommendation:** Text index or normalized lowercase + prefix index.

---

### M5 — `Profile` role / `isAdmin` not indexed

**Where:** Admin user list filters `isAdmin`, `isVerified` (`admin/users.ts`).

**Issue:** Filtered admin grids may scan when user base is large.

**Recommendation:** `{ isAdmin: 1, email: 1 }` or partial index on staff roles only.

---

### M6 — `ProcessedWebhook` TTL 24 hours

**Where:** `expireAfterSeconds: 86400` on `processedAt` — `ProcessedWebhook.ts`

**Issue:** Idempotency window for webhook replay investigation is **one day** only.

**Recommendation:** Extend retention or export to log warehouse before TTL.

---

### M7 — Cart TTL on `lastActivityAt` may delete active-looking carts

**Where:** 30-day TTL on all carts with `lastActivityAt` indexed.

**Issue:** Long-idle but valid carts disappear; edge cases for email remarketing.

**Recommendation:** Confirm product intent; tie TTL to empty cart + inactivity composite.

---

### M8 — Duplicate session TTL index creation

**Where:** Both `packages/api/db/src/db.ts` and `packages/api/infra/src/db.ts` ensure `session` TTL on connect.

**Issue:** Harmless duplicate calls but confusing ownership.

**Recommendation:** Single module owns auth index bootstrap.

---

### M9 — `account` collection only `_id` index (local)

**Issue:** OAuth account lookups by `userId` / provider may scan.

**Recommendation:** Follow Better Auth adapter index guidance after upgrade.

---

### M10 — Bulk grant-admin without compliance audit parity

**Where:** `bulk-actions.ts` grant/revoke updates Profile + attempted auth update; **no** `ComplianceAuditLog` entry (contrast with `PUT users/:id` role change).

**Issue:** Weaker accountability for mass privilege changes.

**Recommendation:** Same audit logging and session-age checks as single-user role API.

---

### M11 — Public winners/stats aggregations

**Where:** `packages/api/server/src/routes/common/winners.ts`, `stats.ts` — aggregations and `Winner.find()` without always enforcing tight limits.

**Issue:** Scraping + DB load (see also client/admin audits on public API surface).

**Recommendation:** Strict pagination caps, caching, optional auth for bulk export patterns.

---

### M12 — Transactions used sparingly

**Where:** Explicit `withTransaction` found in jobs like `merge-guest-profile.ts`; ticket/checkout paths rely on replica set but not uniformly transactional.

**Issue:** Partial failure can leave **tickets sold without order** or duplicate counters under race conditions (mitigated elsewhere by unique indexes — verify at payment layer).

**Recommendation:** Document which invariants are index-enforced vs transaction-enforced; expand transactions for ticket allocation + order completion if races observed.

---

### M13 — `metadata` / `Schema.Types.Mixed` on orders and competitions

**Issue:** Unschema’d blobs can grow unbounded; may store sensitive debug fields if adapters are careless.

**Recommendation:** Size limits; allowlist keys; avoid PAN/ CVV in Mongo.

---

### M14 — Scheduled notifications query Profile by `role`

**Where:** `process-scheduled-notifications.ts` — `Profile.find({ role: { $in: … } })`

**Issue:** Uses Profile role, not auth role — wrong audience if desynced (C1).

**Recommendation:** Fix role sync first; query auth or reconciled view.

---

## Low

### L1 — Email unique index is **sparse**

**Where:** `ProfileSchema.index({ email: 1 }, { unique: true, sparse: true })`

**Issue:** Multiple docs with **missing** email could theoretically coexist (edge case).

**Recommendation:** Non-sparse unique where email always required for non-guest.

---

### L2 — Referral code generation loops with `findOne` (save hook)

**Issue:** Contention under burst signups; rare collision retries.

**Recommendation:** Retry on E11000; use counter-based codes for scale.

---

### L3 — Guest email canonicalization reduces uniqueness enforcement

**Where:** Gmail dot/plus stripping in `canonicalizeEmail`.

**Issue:** Intentional alias merging; document for support to avoid “wrong account merged” disputes.

---

### L4 — `Order` soft-delete + TTL interaction

**Issue:** Soft-deleted orders may still TTL if status matches partial filter and `deletedAt` not in filter.

**Recommendation:** Include `deletedAt: null` in TTL partial expressions if deleted rows must be retained.

---

### L5 — Collection naming inconsistency (`Profile` → `profiles`, Better Auth lowercase)

**Issue:** Operational confusion in ad-hoc queries and `$lookup` `from` strings.

**Recommendation:** Internal ER diagram in docs.

---

### L6 — `winners` / `tickets` zero local data — index validation untested at volume

**Issue:** Production ticket cardinality stress-tests unique `(competitionId, number)` — good design but untested locally.

**Recommendation:** Load test ticket sale + entries aggregation on staging clone.

---

### L7 — `Balance` / shop collections empty locally

**Issue:** Secondary product lines may ship with fewer production hardening reviews.

**Recommendation:** Include shop models in next audit pass when enabled.

---

### L8 — Redis cache on entries list masks DB pain

**Where:** `redisCacheRoute` 30s on entries.

**Issue:** Cache stampede after expiry under attack.

**Recommendation:** Singleflight / stale-while-revalidate.

---

### L9 — `avatar-storage.ts` queries `user` by `{ id: userId }`

**Same class as C1** — avatar fetch may miss if only `_id` stored.

**Recommendation:** Unify id query helper.

---

### L10 — Replica set required for transactions; standalone fails silently in some tests

**Where:** `mongo-capabilities.test.ts`, local `rs0` init script.

**Issue:** Dev without replica set hides transaction bugs until deploy.

**Recommendation:** Document replica set as mandatory in local-development.

---

## Pass 3 additions (2026-10-02) — promo usage data model

### M15 — `PromoCode.usedBy` array can grow large

**Where:** `PromoCode` schema — `usedBy: [String]`; `reservePromoCodeUsage` uses `$addToSet` (limit 1 per user) or `$push` (when `maxUsesPerUser > 1`).

**Issue:** High-traffic codes store one entry per redemption pattern; document size grows without archival. No secondary index for “all codes used by user X”.

**Recommendation:** Normalize to `PromoRedemption` collection `{ promoId, userId, orderId, createdAt }` or cap array with summary counts.

---

### M16 — Promo usage not tied to order rows

**Where:** Enforcement via `usedBy` userId strings and `currentUses` counter, not foreign keys to `orders`.

**Issue:** Finance/support cannot join promo redemptions to orders from exports alone; `releasePromoCodeUsage` on rollback must stay in sync or users stay blocked (see client-audit **H9**).

**Recommendation:** Store `orderId` on redemption; admin view of redemptions per code.

---

## Pass 4 additions (2026-10-02) — retention & ledger

### P4-M15 — `PaymentAttempt` 90-day TTL vs disputes

**Where:** `packages/api/db/src/models/PaymentAttempt.ts`.

**Issue:** Decline/3DS attempt history expires while chargebacks may still arrive. Details in [platform-audit-pass4.md](./platform-audit-pass4.md).

**Recommendation:** Archive attempts or disable TTL in production.

---

### P4-L6 — Balance top-ups stored as competition `Order` documents

**Where:** Local top-up flow in payment `local.ts`.

**Issue:** Skews order analytics and interacts with order TTL (see pass 4).

**Recommendation:** Separate collection or exclude from competition order metrics.

---

## Security exploits (threat-oriented)

| Threat | Mechanism | Mitigations |
|--------|-----------|-------------|
| **DB exfiltration** | Open Mongo port, no auth (dev pattern) | Auth, TLS, private network, encryption at rest |
| **Privilege retention** | Revoke admin updates Profile only (C1) | Fix auth updates; session invalidation on role change |
| **Scrape / DoS** | Public `/api/entries` aggregations + regex search | Rate limits, regex escape, CAPTCHA, remove from admin origin |
| **PII harvesting** | Public entries `$lookup` profiles (first/last name rules) | Minimize projected fields; rate limit; legal basis |
| **NoSQL injection** | Mostly typed Mongoose; aggregations use parsed ObjectIds | Keep banning raw `$where`; audit new raw queries |
| **Webhook replay window** | 24h processed webhook TTL | Longer retention + idempotency keys on orders |
| **Insider bulk grant** | Bulk admin without audit | Audit log + MFA for role changes |

---

## Performance hotspots

1. **`GET /api/entries`** — multi-stage `$lookup` + facet pagination per competition.  
2. **Admin global search** — parallel regex queries across competitions, profiles, orders, tickets.  
3. **Referral mindmap / purchases** — large aggregations (`referral-purchases.ts`).  
4. **Landing page** — multiple prize/winner aggregations per request.  
5. **Ticket indexes** — good coverage for sale/draw; ensure aggregations `$match` on `competitionId` + `status` first.

**Positive patterns:** `maxTimeMS` on several admin aggregates; compound indexes on orders for spend tracking; unique ticket `(competitionId, number)`.

---

## Integrity & consistency checklist

| Invariant | Enforcement |
|-----------|-------------|
| One ticket number per competition | Unique index on `Ticket` |
| One order number globally | Unique on `Order.orderNumber` |
| One referral record per order | Unique on `ReferralPurchase.orderId` |
| Idempotent checkout | `userId + idempotencyKey` unique on `Order` |
| Session expiry | TTL on `session.expiresAt` |
| Profile email uniqueness | Unique sparse on `email` |

---

## Recommended backlog (priority)

1. **Fix Better Auth user updates** to use `_id` or internal adapter (C1); invalidate sessions on role change.  
2. **Production Mongo hardening** — auth, TLS, backups, least privilege (C2).  
3. **Escape/limit public entries search** (H2).  
4. **Legal review of order TTL** (H3–H4).  
5. **Add `userId` index on `session`, email index on `user`** (H5–H6).  
6. **Index sync job + migration registry** (M2).  
7. **Audit log for bulk grant/revoke** (M10).  
8. **Reconciliation job: Profile.role vs user.role** (H1).  
9. **Promo redemption model** — normalize usage vs `usedBy` array (M15–M16).  
10. **PaymentAttempt retention** and top-up order noise (P4-M15, P4-L6) — [platform-audit-pass4.md](./platform-audit-pass4.md).

---

## Key file reference

| Area | Path |
|------|------|
| Models | `packages/api/db/src/models/**` |
| Soft delete | `packages/api/db/src/plugins/soft-delete.ts` |
| DB connect | `packages/api/infra/src/db.ts`, `packages/api/db/src/db.ts` |
| Auth ↔ Profile hooks | `packages/auth/admin/src/auth-hooks.ts` |
| Role API | `packages/api/server/src/routes/admin/users.ts`, `bulk-actions.ts` |
| Public entries | `packages/api/server/src/routes/common/entries.ts` |
| Regex helpers | `packages/api/infra/src/fuzzy-search.ts` |
| Local Mongo init | `scripts/mongo-init.js` |

---

*Re-run live index audit after deploys: connect with authenticated `DATABASE_URL`, run `db.getCollectionNames()` and `getIndexes()` on `profiles`, `user`, `session`, `orders`, `tickets`, compare to Mongoose schema definitions.*
