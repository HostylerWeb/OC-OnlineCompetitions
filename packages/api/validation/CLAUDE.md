# @oc/api-validation

Zod-based request validation for the Hono API.

## Source of truth

`onlinecompetitions-api/packages/validation/src` — synced to this repo.

## Key exports

| Export | Purpose |
|--------|---------|
| `validateBody`, `validateQuery` | Hono middleware — parse requests against Zod schemas |
| Zod schemas | auth, categories, competitions, compliance, orders, instant prizes, ending-soon settings, homepage-layout, common fields |
| Error codes | Standardised validation failure codes |

## Used by

`api-server` route handlers for request body/query validation.
