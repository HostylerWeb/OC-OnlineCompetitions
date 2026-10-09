# @oc/api-compliance

Regulatory compliance logic for UK gambling: age verification, card scheme detection, spend tracking, safer-play settings, and instant-win limits.

## Source of truth

`onlinecompetitions-api/packages/compliance/src` — synced to this repo.

## Key modules

| File | Responsibility |
|------|---------------|
| `age-verification.ts` | Age verification checks |
| `card-scheme.ts` | Card scheme detection & validation |
| `compliance-checks.ts` | Composite compliance check pipeline |
| `compliance-user-service.ts` | Per-user compliance state management |
| `ComplianceError.ts` | Compliance-specific error class |
| `instant-win.ts` | Instant win prize compliance limits |
| `settings.ts` | Compliance settings queries |
| `spend-tracking.ts` | Deposit & spend limit tracking |

## Used by

`@oc/api-server` for compliance middleware in payment/ticket flows.
