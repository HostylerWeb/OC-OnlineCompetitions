# Security & quality audits

Periodic audits of the Online Competitions monorepo. When adding a new audit, link it here and in [README.md](./README.md).

| Audit | Scope | File |
|-------|--------|------|
| **Admin** | `apps/admin`, embedded API, admin routes & auth | [admin-audit.md](./admin-audit.md) |
| **Client** | `apps/client`, `apps/client-mobile`, shared public API | [client-audit.md](./client-audit.md) |
| **Database** | MongoDB, Mongoose models, Better Auth collections, query patterns | [database-audit.md](./database-audit.md) |
| **Pass 4 (full sweep)** | Orders, payments, compliance, email, competitions, profile, shop, jobs, coverage matrix | [platform-audit-pass4.md](./platform-audit-pass4.md) |

**Suggested review order:** database (identity & retention) → admin (staff surface) → client (customer surface) → pass 4 cross-domain backlog.

**Pass 3 (2026-10-02):** Promo-code behaviour — admin **M23–M24**, client **H8–H10**, database **M15–M16**.

**Pass 4 (2026-10-02):** Full platform sweep — see [platform-audit-pass4.md](./platform-audit-pass4.md). **Remediation:** [audit-fix-tracker.md](./audit-fix-tracker.md).

**Pass 5 (2026-10-02):** Cart, checkout, promos, ticket caps, countdown, listings, account history, instant-prize editor — [client-audit.md](./client-audit.md) §Pass 5 and [admin-audit.md](./admin-audit.md) §Pass 5 (`P5-H1`–`P5-H17`, `P5-M1`–`P5-M8`).

**Last updated:** 2026-10-02
