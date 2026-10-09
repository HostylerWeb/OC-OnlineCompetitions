import type { StripeWebhookEvent } from "@oc/api-payment-stripe";

export function getStripePaymentIntentIdFromEvent(event: StripeWebhookEvent): string {
  return event.data.object.id as string;
}

export function getStripeChargeLookupIds(event: StripeWebhookEvent): {
  chargeId: string;
  paymentIntentId: string;
} {
  return {
    chargeId: event.data.object.id as string,
    paymentIntentId: event.data.object.payment_intent as string,
  };
}
