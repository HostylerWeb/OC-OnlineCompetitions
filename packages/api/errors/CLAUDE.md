# @oc/api-errors

Shared error class hierarchy used across all API packages. Provides consistent HTTP error responses, domain errors, and internal failure types.

## Source of truth

`onlinecompetitions-api/packages/errors/src` — synced to this repo.

## Key exports

| File | Exports |
|------|---------|
| `errors.ts` | `AppError`, `NotFoundError`, `ValidationError`, `AuthError`, `PaymentError`, `ComplianceError`, `ConflictError` |

## Error pattern

All errors extend `AppError` with a stable `statusCode`, `code` string, and optional `details` payload. Used by Hono error middleware in `@oc/api-server`.
