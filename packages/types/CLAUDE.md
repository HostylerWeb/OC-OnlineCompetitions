# @oc/types

Shared TypeScript interfaces consumed by both API and frontends. No runtime code.

## Source of truth

`onlinecompetitions-api/packages/types/src` — sync into this repo via `scripts/sync-shared-packages.sh`.

## Auth types

Use **`SessionUser`** and Better Auth session shapes from `auth.ts` — not legacy `JWTPayload`.

## Module index

| File | Contents |
|------|----------|
| `admin.ts` | `AdminCompetition`, `AdminOrder`, `AdminUser`, admin dashboard types |
| `auth.ts` | Session user, auth responses |
| `competitions.ts` | `Competition`, `CompetitionDetail`, `RawCompetitionResponse` |
| `compliance.ts` | `ComplianceSettings`, `SaferPlayState`, `SelfExcludeResponse` |
| `orders.ts` | Orders, cart, checkout |
| `payments.ts` | Payment sessions, providers |
| `referrals.ts` | Referral settings, tiers |
| `user.ts` | Profile, entries |
| `winners.ts` | Winner types |
| `api.ts` | `ApiResponse<T>`, pagination meta |
| `index.ts` | Re-exports |

## Sync

```bash
./scripts/sync-shared-packages.sh   # from onlinecompetitions-multirepo parent
```

Admin-only payment UI fields stay in web components — do not add web-only fields to API types.
