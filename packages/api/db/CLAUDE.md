# @oc/api-db

MongoDB/Mongoose connection manager and domain models.

## Source of truth

`onlinecompetitions-api/packages/db/src` — synced to this repo.

## Key modules

| File | Responsibility |
|------|---------------|
| `db.ts` | `dbConnect()` — connection manager (connection pooling, retry, replica set detection) |
| `models/` | Mongoose schemas for Balance, Cart, Competition, Order, Ticket, Profile, PromoCode, Winner, EmailSettings, and all other domain entities |
| `m.ts` | Lazy model registration helper to avoid circular imports |

## Used by

Virtually every `api-*` package that needs database access.
