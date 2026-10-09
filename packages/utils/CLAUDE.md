# @oc/utils

Shared pure utility functions used by both the API and frontends.

## Source of truth

`onlinecompetitions-api/packages/utils/src` — sync into this repo via `scripts/sync-shared-packages.sh`.

## Key exports

| Module | Exports |
|--------|---------|
| `cn.ts` | `cn()` — clsx + tailwind-merge |
| `competition.ts` | `formatCurrency`, ticket/progress helpers (en-GB locale) |
| `referral.ts` | Cookie helpers, `getReferralCodeFromCookie` |
| `ending-soon.ts` | Ending-soon competition filters |
| `index.ts` | Barrel |

## Tests

`packages/utils/test/` — Vitest.

## Sync

Full copy to web — no allowlist. Do not add web-only files under API `src/`; add web-only tests only under web `packages/utils/test/` if needed.
