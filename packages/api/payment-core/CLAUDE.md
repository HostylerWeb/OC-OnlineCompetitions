# @oc/api-payment-core

Order fulfillment engine and answer index — shared payment logic used by all payment providers.

## Source of truth

`onlinecompetitions-api/packages/payment/core/src` — synced to this repo.

## Purpose

Runs after a payment session is completed to allocate tickets, record order items, and maintain the answer-number index for draw resolution.

## Key modules

| File | Responsibility |
|------|---------------|
| `order-fulfillment.ts` | `fulfillOrder` — create order doc, allocate tickets, award instant prizes, process referral awards |
| `answer-index.ts` | Maintains answer-number → competition mapping for draw resolution |
