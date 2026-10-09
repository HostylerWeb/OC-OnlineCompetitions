# @oc/api-tickets

Ticket purchasing, cart management, wallet operations, promo codes, and competition interaction logic.

## Source of truth

`onlinecompetitions-api/packages/tickets/src` — synced to this repo.

## Key modules

| File | Responsibility |
|------|---------------|
| `cart.ts` | Cart CRUD, line items |
| `cart-enrichment.ts` | Enrich cart response with competition data |
| `categories.ts` | Category helpers |
| `competitions.ts` | Competition queries & listing |
| `competition-stats.ts` | Aggregated competition statistics |
| `create-session.ts` | Create payment session from cart |
| `instant-prize-allocation.ts` | Allocate instant prizes on purchase |
| `instant-prize-utils.ts` | Instant prize validation & helpers |
| `load-cart.ts` | Load cart with full competition context |
| `promo-codes.ts` | Promo code validation & application |
| `resolve-discount.ts` | Discount resolution pipeline |
| `ticket-service.ts` | Core ticket purchase orchestration |
| `wallet.ts` | Wallet balance redeem via tickets |
| `ticket-errors.ts` | Domain-specific ticket error classes |
| `scoped-ticket-stats.ts` | Filtered ticket statistics |

## Dependencies

- `@oc/api-compliance` — spend limits and safer-play checks during purchase
- `@oc/api-payment-core` — order fulfillment after payment
