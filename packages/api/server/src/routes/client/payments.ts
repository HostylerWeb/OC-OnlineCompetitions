import { createHash } from "node:crypto";
import { getAffiliateContext } from "@oc/api-affiliate";
import {
  assertComplianceForCheckout,
  getCheckoutComplianceHints,
} from "@oc/api-compliance/compliance-checks";
import { getComplianceSettings } from "@oc/api-compliance/settings";
import { Competition, Order, PaymentMethod, Profile, ShopOrder } from "@oc/api-db/models";
import { CheckoutError, ComplianceError } from "@oc/api-errors";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import { getCurrentContext } from "@oc/api-infra/env";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { createLogger } from "@oc/api-logger";
import { roundCurrency } from "@oc/utils";
import type { PaytriotResponse } from "@oc/api-payment-paytriot";
import {
  createStripeClient,
  StripeError,
  type StripeWebhookEvent,
} from "@oc/api-payment-stripe";
import { incrementCounter } from "@oc/api-server/lib/observability/metrics";
import { mapInternalCapabilitiesToPublic } from "@oc/api-server/lib/payment/capabilities";
import { ensureLocalPaymentMethod } from "@oc/api-server/lib/payment/ensure-local-payment-method";
import {
  filterEnabledPaymentMethods,
  isCardPaymentProvider,
  isLocalPaymentAllowed,
  isPaymentProviderPubliclyEnabled,
} from "@oc/api-server/lib/payment/local-payment-policy";
import {
  ensurePaytriotPaymentMethod,
  getPaytriotCredentials,
} from "@oc/api-server/lib/payment/ensure-paytriot-payment-method";
import {
  ensureSiteCreditPaymentMethod,
  isSiteCreditWalletEnabled,
  SITE_CREDIT_PROVIDER,
} from "@oc/api-server/lib/payment/ensure-site-credit-payment-method";
import { resolveSiteCreditForCheckout } from "@oc/api-server/lib/payment/site-credit-checkout";
import { ensureStripePaymentMethod } from "@oc/api-server/lib/payment/ensure-stripe-payment-method";
import { getAdapter, paymentProcessors } from "@oc/api-server/lib/payment/providers";
import { dispatchWebhook } from "@oc/api-server/lib/payment/providers/_shared/webhook-helpers";
import { getResolvedWebhookSecret } from "@oc/api-server/lib/payment/providers/stripe";
import type {
  PaymentProviderAdapter,
  PaymentProviderId,
  WebhookResult,
} from "@oc/api-server/lib/payment/providers/types";
import {
  handleShopStripeWebhook,
  reduceInventoryFromOrder,
} from "@oc/api-server/lib/payment/shop-webhook-handler";
import { requireGuestCheckout } from "@oc/api-server/middleware/auth";
import { sendShopOrderConfirmationEmail } from "@oc/api-shop/email";
import { type LoadedCheckoutCart, loadCartForCheckout } from "@oc/api-tickets/load-cart";
import { resolveCheckoutDiscount } from "@oc/api-tickets/resolve-discount";
import { validateBody } from "@oc/api-validation";
import {
  type CreatePaymentSessionInput,
  createPaymentSessionSchema,
} from "@oc/api-validation/schemas/orders";
import { Hono } from "hono";
import { Types } from "mongoose";

const app = new Hono();

app.get("/health", requireGuestCheckout, async (c) => {
  if (process.env.NODE_ENV === "production") {
    return c.json({ status: "ok", checkedAt: new Date().toISOString() });
  }
  const providers: Record<string, string> = {};
  for (const id of ["local", "paytriot"] as const) {
    try {
      const adapter = await getAdapter(id);
      const result = await adapter.testCredentials("sandbox");
      providers[id] = result.success ? "ok" : `misconfigured: ${result.error ?? "unknown"}`;
    } catch (err) {
      providers[id] = `misconfigured: ${err instanceof Error ? err.message : "unknown"}`;
    }
  }
  const allOk = Object.values(providers).every((v) => v === "ok");
  return c.json({
    status: allOk ? "ok" : "degraded",
    providers,
    checkedAt: new Date().toISOString(),
  });
});

// Autofill checkout from the signed-in user's profile only (never lookup by arbitrary email).
app.get("/profile-fill", requireGuestCheckout, async (c) => {
  const empty = {
    firstName: "",
    lastName: "",
    phone: "",
    dateOfBirth: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    postcode: "",
    country: "GB",
    isVerified: false,
  };
  try {
    const userId = c.get("userId");
    if (!userId) {
      return c.json(empty);
    }
    await dbConnect();
    const profile = await Profile.findById(userId).select(
      "firstName lastName phone dateOfBirth addressLine1 addressLine2 city postcode country isGuestCheckout"
    );
    if (!profile) {
      return c.json(empty);
    }
    return c.json({
      firstName: profile.firstName ?? "",
      lastName: profile.lastName ?? "",
      phone: profile.phone ?? "",
      dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.toISOString() : "",
      addressLine1: profile.addressLine1 ?? "",
      addressLine2: profile.addressLine2 ?? "",
      city: profile.city ?? "",
      postcode: profile.postcode ?? "",
      country: profile.country ?? "GB",
      isVerified: !profile.isGuestCheckout,
    });
  } catch (err) {
    log.error("[checkout.profile-fill] lookup failed", {
      userId: c.get("userId"),
      err: err instanceof Error ? err.message : String(err),
    });
    return c.json({
      phone: "",
      dateOfBirth: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      postcode: "",
      country: "GB",
    });
  }
});

app.post(
  "/session",
  requireGuestCheckout,
  async (c, next) => validateBody(c, next, createPaymentSessionSchema),
  async (c) => {
    try {
      await dbConnect();
      const body = c.get("body") as CreatePaymentSessionInput;
      const { provider, contact, shipping, cartId, idempotencyKey, compliance, applySiteCredit } =
        body;
      const userId = c.get("userId")!;
      const { frontendUrl } = getCurrentContext();

      log.debug(
        `[checkout.session.create] ENTER userId=${userId} provider=${provider ?? "<auto>"} cartId=${cartId ?? "<self>"} idempotencyKey=${idempotencyKey ?? "<none>"} contact.email=${contact?.email ?? "<none>"} shipping=${shipping ? JSON.stringify(shipping) : "<none>"}`
      );

      let loadedCart: LoadedCheckoutCart;
      try {
        loadedCart = await loadCartForCheckout({
          cartId,
          userId,
          expectedCartVersion: body.expectedCartVersion,
        });
      } catch (err: unknown) {
        if (err instanceof CheckoutError) {
          log.debug(
            `[checkout.session.create] CheckoutError code=${err.code} status=${err.status} message=${err.message}`
          );
          return error(c, err.code, err.message, err.status);
        }
        throw err;
      }

      // Require email for guest checkout (must be provided in contact)
      const user = c.get("user");
      let _orderUserIdFromGuest: string | undefined;
      if (user?.isAnonymous) {
        const settings = await getComplianceSettings();
        if (!settings.guestCheckoutEnabled) {
          return error(c, ErrorCodes.FORBIDDEN, "Guest checkout is disabled", 403);
        }

        if (!contact?.email) {
          return error(c, ErrorCodes.VALIDATION_ERROR, "Email is required for guest checkout", 400);
        }

        // Guests may only checkout with promo codes that are explicitly
        // marked guest-eligible on the PromoCode doc.
        if (loadedCart.promoCode) {
          const { PromoCode } = await import("@oc/api-db/models");
          const promoDoc = await PromoCode.findOne({
            code: loadedCart.promoCode.toUpperCase(),
          }).lean();
          if (promoDoc && promoDoc.guestEligible === false) {
            return error(
              c,
              ErrorCodes.FORBIDDEN,
              "This promo code requires a registered account. Please sign in to continue.",
              403
            );
          }
        }

        try {
          const { createGuestCheckoutProfile } = await import("@oc/auth-admin/auth-hooks");
          const result = await createGuestCheckoutProfile(userId, {
            guestEmail: contact.email,
            firstName: contact?.firstName,
            lastName: contact?.lastName,
            dob: compliance?.dob,
            phone: contact?.phone,
          });
          _orderUserIdFromGuest = result.orderUserId;
        } catch (err) {
          console.error("[checkout] Guest profile creation failed:", err);
          return error(
            c,
            ErrorCodes.CHECKOUT_ERROR,
            "Unable to start checkout. Please try again.",
            400
          );
        }
      }

      const orderUserId = _orderUserIdFromGuest ?? userId;

      const {
        items,
        subtotal,
        paidSubtotal,
        promoCode,
        discountType,
        promoDiscountPercent,
        referralCode,
        referralBonusTickets,
        referralBalanceUsed,
      } = loadedCart;

      log.debug(
        `[checkout.session.create] loadedCart items=${items.length} subtotal=${subtotal} paidSubtotal=${paidSubtotal} promoCode=${promoCode ?? "<none>"} referralCode=${referralCode ?? "<none>"} referralBonusTickets=${referralBonusTickets} referralBalanceUsed=${referralBalanceUsed}`
      );
      for (let i = 0; i < items.length; i++) {
        const it = items[i]!;
        log.debug(
          `[checkout.session.create] item[${i}] compId=${it.competitionId} qty=${it.quantity} paidQty=${it.paidQty ?? "<undef>"} walletQty=${it.walletQty ?? "<undef>"} answerIndex=${it.answerIndex} status=${it.status} maxTicketsPerUser=${it.maxTicketsPerUser}`
        );
      }

      if (referralBalanceUsed > 0) {
        const walletProfile = await Profile.findById(orderUserId)
          .select("referralTierAwardedTickets")
          .lean();
        const currentBalance = walletProfile?.referralTierAwardedTickets ?? 0;
        if (referralBalanceUsed > currentBalance) {
          log.debug(
            `[checkout.session.create] INSUFFICIENT WALLET BALANCE: referralBalanceUsed=${referralBalanceUsed} currentBalance=${currentBalance}`
          );
          return error(
            c,
            ErrorCodes.VALIDATION_ERROR,
            `Insufficient referral wallet balance. You have ${currentBalance} ticket(s) available but ${referralBalanceUsed} allocated to this cart. Please review your wallet allocation and try again.`,
            400
          );
        }
      }

      // Validate competition status before proceeding
      const { isOpenForTicketSales } = await import("@oc/api-tickets/competition-sales");
      const salesMetaRows = await Competition.find({
        _id: { $in: items.map((i) => i.competitionId) },
      })
        .select("_id status endDate drawDate")
        .lean();
      const salesMetaById = new Map(salesMetaRows.map((r) => [r._id.toString(), r]));

      for (const item of items) {
        const meta = salesMetaById.get(item.competitionId);
        if (!meta || !isOpenForTicketSales(meta)) {
          log.debug(
            `[checkout.session.create] competition ${item.competitionId} is not open for sales — rejecting`
          );
          return error(
            c,
            ErrorCodes.VALIDATION_ERROR,
            `Competition "${item.competitionId}" is no longer available for purchase`,
            400
          );
        }
        if (item.status !== "active") {
          log.debug(
            `[checkout.session.create] competition ${item.competitionId} has status ${item.status} — rejecting`
          );
          return error(
            c,
            ErrorCodes.VALIDATION_ERROR,
            `Competition "${item.competitionId}" is no longer available for purchase`,
            400
          );
        }
      }

      for (const item of items) {
        if (item.quantity <= 0) continue;
        const { getCompetitionTicketStats, countEffectiveOwnedForCap } = await import(
          "@oc/api-tickets/ticket-service"
        );
        const stats = await getCompetitionTicketStats(item.competitionId, {
          status: item.status,
          maxTickets: item.maxTickets,
        });
        const userOwned = await countEffectiveOwnedForCap(item.competitionId, orderUserId);
        const maxPerUser = item.maxTicketsPerUser ?? 0;
        const remainingForUser =
          maxPerUser > 0 ? Math.max(0, maxPerUser - userOwned) : stats.available;
        const maxPurchasable = Math.min(stats.available, remainingForUser);

        if (item.quantity > maxPurchasable) {
          log.debug(
            `[checkout.session.create] qtyExceeded compId=${item.competitionId} requested=${item.quantity} maxPurchasable=${maxPurchasable}`
          );
          return error(
            c,
            ErrorCodes.MAX_TICKETS_PER_USER_EXCEEDED,
            maxPurchasable <= 0
              ? "You have reached the ticket limit for an item in your cart. Please update your cart and try again."
              : `Only ${maxPurchasable} ticket${maxPurchasable !== 1 ? "s" : ""} available for an item in your cart. Please update your cart and try again.`,
            400
          );
        }
      }

      if (items.length === 0) {
        return error(c, ErrorCodes.VALIDATION_ERROR, "Your cart is empty", 400);
      }

      const priceRows = await Competition.find({
        _id: { $in: items.map((i) => i.competitionId) },
      })
        .select("_id ticketPrice")
        .lean();
      const priceById = new Map(priceRows.map((row) => [row._id.toString(), row.ticketPrice ?? 0]));

      const cartItemsForPromo = items.map((item) => ({
        competitionId: item.competitionId,
        quantity: item.quantity,
        unitPrice: priceById.get(item.competitionId) ?? 0,
      }));

      let effectivePaidSubtotal = 0;
      for (const item of items) {
        const paidQty = item.paidQty ?? item.quantity;
        effectivePaidSubtotal += (priceById.get(item.competitionId) ?? 0) * paidQty;
      }

      const effectiveReferralBalanceUsed = items.reduce(
        (sum, item) => sum + (item.walletQty ?? Math.max(0, item.quantity - (item.paidQty ?? item.quantity))),
        0
      );
      if (effectiveReferralBalanceUsed !== referralBalanceUsed) {
        log.debug(
          `[checkout.session.create] wallet allocation mismatch cart=${referralBalanceUsed} recomputed=${effectiveReferralBalanceUsed}`
        );
      }

      const {
        discount: serverDiscount,
        promoCode: serverPromoCode,
        referralCode: serverReferralCode,
      } = await resolveCheckoutDiscount({
        subtotal: effectivePaidSubtotal,
        promoCode,
        referralCode,
        userId: orderUserId,
        isGuest: _orderUserIdFromGuest ? false : (user?.isAnonymous ?? false),
        cartItems: cartItemsForPromo,
      });

      const cartTotal = roundCurrency(
        Math.max(0, (Number(effectivePaidSubtotal) || 0) - (Number(serverDiscount) || 0))
      );
      const competitionIds = items.map((item) => item.competitionId);

      await ensureSiteCreditPaymentMethod();
      const siteCreditWalletEnabled = await isSiteCreditWalletEnabled();
      const wantsSiteCredit =
        Boolean(applySiteCredit) && siteCreditWalletEnabled && !user?.isAnonymous;
      const { siteCreditApplied, gatewayTotal } = await resolveSiteCreditForCheckout({
        userId: orderUserId,
        cartTotal,
        applySiteCredit: wantsSiteCredit,
      });

      if (wantsSiteCredit && siteCreditApplied <= 0 && cartTotal > 0) {
        return error(
          c,
          ErrorCodes.INSUFFICIENT_BALANCE,
          "You do not have enough site credit for this order",
          400
        );
      }

      // A £0-payable cart (free entry, fully wallet-funded, 100% promo, or fully
      // site-credit-funded) cannot go through a gateway — Paytriot rejects a zero
      // amount. Route it through the local fulfillment path instead, even when the
      // local payment method is disabled.
      const isZeroTotal = roundCurrency(gatewayTotal) <= 0;
      let selectedProvider: string;
      let adapter: PaymentProviderAdapter;
      let checkoutMode: "hosted" | "popup" | undefined;

      if (isZeroTotal) {
        selectedProvider = "local";
        adapter = getAdapter("local" as PaymentProviderId);
        checkoutMode = undefined;
      } else {
        await ensureLocalPaymentMethod();
        await ensurePaytriotPaymentMethod();
        await ensureStripePaymentMethod();
        const methods = filterEnabledPaymentMethods(
          await PaymentMethod.find({ enabled: true }).lean()
        ).filter((m) => m.provider !== SITE_CREDIT_PROVIDER);
        if (methods.length === 0) {
          return error(
            c,
            ErrorCodes.PAYMENT_DISABLED,
            "No payment methods are currently enabled",
            400
          );
        }

        if (provider) {
          const isEnabled = methods.some((m) => m.provider === provider);
          if (!isEnabled) {
            return error(
              c,
              ErrorCodes.PROVIDER_UNAVAILABLE,
              `Payment provider '${provider}' is not available`,
              400
            );
          }
          selectedProvider = provider;
        } else {
          const first = methods[0];
          if (!first) {
            return error(
              c,
              ErrorCodes.PAYMENT_DISABLED,
              "No payment methods are currently enabled",
              400
            );
          }
          selectedProvider = first.provider;
        }

        adapter = getAdapter(selectedProvider as PaymentProviderId);

        const selectedMethod = methods.find((m) => m.provider === selectedProvider);
        checkoutMode = (selectedMethod as Record<string, unknown> | undefined)?.checkoutMode as
          | "hosted"
          | "popup"
          | undefined;
      }

      const profile = await Profile.findById(orderUserId).lean();
      const accountEmail = c.get("email") ?? profile?.email ?? "";

      if (!accountEmail && !user?.isAnonymous) {
        return error(
          c,
          ErrorCodes.CHECKOUT_ERROR,
          "Account email not found. Please update your profile.",
          400
        );
      }

      log.debug(
        `[checkout.session.create] discount resolved serverDiscount=${serverDiscount} serverPromoCode=${serverPromoCode ?? "<none>"} serverReferralCode=${serverReferralCode ?? "<none>"} cartTotal=${cartTotal} competitionIds=${JSON.stringify(competitionIds)}`
      );

      log.info("[checkout.session.create] calling adapter.createSession", {
        provider: selectedProvider,
        adapterId: adapter.id,
        itemCount: items.length,
        firstCompetitionId: items[0]?.competitionId ?? "<none>",
        subtotal: effectivePaidSubtotal,
        cartTotal,
        promoCode: serverPromoCode ?? "<none>",
        referralCode: serverReferralCode ?? "<none>",
        userId,
        userEmail: contact?.email ?? accountEmail,
        shippingCity: shipping?.city ?? "<none>",
        idempotencyKey: idempotencyKey ? `${idempotencyKey.slice(0, 12)}...` : "<none>",
      });

      let instantWinInCart = false;
      const willChargeCard =
        !isZeroTotal && isCardPaymentProvider(String(selectedProvider));
      try {
        const complianceResult = await assertComplianceForCheckout({
          userId: orderUserId,
          cartTotal,
          competitionIds,
          blockCardPayment: willChargeCard,
          projectedCreditSpend: willChargeCard
          ? gatewayTotal
          : siteCreditApplied > 0
            ? siteCreditApplied
            : 0,
        });
        instantWinInCart = complianceResult.instantWinInCart;
      } catch (err: unknown) {
        if (err instanceof ComplianceError) {
          return error(c, err.code, err.message, err.status);
        }
        throw err;
      }

      const complianceHints = await getCheckoutComplianceHints(orderUserId, competitionIds);

      const formEmail = contact?.email ?? accountEmail;
      const orderEmail = contact?.email ?? accountEmail;

      const remoteAddress =
        c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
        c.req.header("x-real-ip") ??
        "127.0.0.1";
      const result = await adapter.createSession({
        items,
        userId: orderUserId,
        userEmail: formEmail,
        firstName: profile?.firstName ?? undefined,
        lastName: profile?.lastName ?? undefined,
        isGuestCheckout: user?.isAnonymous ? true : undefined,
        subtotal: effectivePaidSubtotal,
        discount: serverDiscount,
        promoCode: serverPromoCode,
        promoCodeId: loadedCart.promoCodeId,
        discountType,
        promoDiscountPercent,
        referralCode: serverReferralCode,
        orderEmail,
        referralBonusTickets,
        referralBalanceUsed,
        siteCreditApplied: siteCreditApplied > 0 ? siteCreditApplied : undefined,
        frontendUrl,
        userPhone: contact?.phone,
        shippingAddress: shipping,
        cartId,
        idempotencyKey,
        remoteAddress,
        checkoutMode,
      });

      log.info("[checkout.session.create] adapter.createSession DONE", {
        provider: selectedProvider,
        sessionId: result.sessionId,
        orderId: result.orderId ?? "<none>",
        redirectUrl: result.redirectUrl ?? "<none>",
        approvalUrl: result.approvalUrl ?? "<none>",
        instantWinInCart,
      });

      // Persist the affiliate clickid + source onto the order while this
      // request still carries the browser headers (ALS). The payment webhook
      // is server-to-server with no headers, so finalize must read them back
      // from order.metadata.
      const affiliateContext = getAffiliateContext();
      const affiliateClickId = affiliateContext.clickId;
      const affiliateSource = affiliateContext.source;
      if ((affiliateClickId || affiliateSource) && result.orderId) {
        const update: Record<string, unknown> = {};
        if (affiliateClickId) update["metadata.affiliateClickId"] = affiliateClickId;
        if (affiliateSource) update["metadata.affiliateSource"] = affiliateSource;
        void Order.updateOne({ _id: result.orderId }, { $set: update }).catch((err: unknown) => {
          log.warn("[checkout.session.create] failed to persist affiliate context", {
            orderId: result.orderId,
            err: err instanceof Error ? err.message : String(err),
          });
        });
      }

      incrementCounter("payment.session.created");

      return success(c, {
        provider: selectedProvider,
        sessionId: result.sessionId,
        orderId: result.orderId,
        redirectUrl: result.redirectUrl,
        approvalUrl: result.approvalUrl,
        formHtml: result.formHtml,
        fields: result.fields,
        gatewayUrl: result.gatewayUrl,
        instantWinInCart,
        compliance: complianceHints,
        siteCreditApplied: siteCreditApplied > 0 ? siteCreditApplied : undefined,
        gatewayTotal,
        cartTotal,
      });
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Failed to create checkout session";
      if (raw === "INSUFFICIENT_SITE_CREDIT") {
        return error(
          c,
          ErrorCodes.INSUFFICIENT_BALANCE,
          "You do not have enough site credit for this order",
          400
        );
      }
      if (raw.startsWith("TICKETS_SOLD_OUT:")) {
        return error(c, ErrorCodes.TICKETS_SOLD_OUT, raw.replace("TICKETS_SOLD_OUT:", ""), 400);
      }
      if (raw.startsWith("MAX_TICKETS_PER_USER_EXCEEDED:")) {
        return error(
          c,
          ErrorCodes.MAX_TICKETS_PER_USER_EXCEEDED,
          raw.replace("MAX_TICKETS_PER_USER_EXCEEDED:", ""),
          400
        );
      }
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "payments.createSession",
      });
      log.info("[checkout.session.create] UNHANDLED ERROR", {
        error: raw,
        userId: c.get("userId") ?? null,
        provider: c.get("body") ? (c.get("body") as any)?.provider : "<unknown>",
      });
      return error(c, ErrorCodes.CHECKOUT_ERROR, raw, 400);
    }
  }
);

app.get("/session/:provider/:sessionId", requireGuestCheckout, async (c) => {
  try {
    await dbConnect();
    const { provider, sessionId } = c.req.param();
    const userId = c.get("userId") ?? undefined;
    const adapter = getAdapter(provider as PaymentProviderId);
    const result = await adapter.getSessionStatus(sessionId as string, userId);
    return success(c, result);
  } catch (err: unknown) {
    const e = err as { errorCode?: string; errorMessage?: string; code?: string; message?: string };
    const errorCode = e.errorCode ?? e.code ?? ErrorCodes.SESSION_ERROR;
    const message = e.errorMessage ?? e.message ?? "Failed to get session status";
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "payments.getSession",
    });
    return error(c, errorCode, message, 400);
  }
});

app.post("/session/:provider/:sessionId/capture", requireGuestCheckout, async (c) => {
  try {
    await dbConnect();
    const { provider, sessionId } = c.req.param();
    const userId = c.get("userId") ?? undefined;
    const adapter = getAdapter(provider as PaymentProviderId);
    const result = await adapter.captureSession(sessionId as string, userId);
    incrementCounter("payment.captured");
    return success(c, {
      status: result.status,
      orderId: result.orderId,
    });
  } catch (err: unknown) {
    const e = err as { errorCode?: string; errorMessage?: string; code?: string; message?: string };
    const errorCode = e.errorCode ?? e.code ?? ErrorCodes.SESSION_ERROR;
    const message = e.errorMessage ?? e.message ?? "Failed to capture payment";
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "payments.captureSession",
    });
    return error(c, errorCode, message, 400);
  }
});

app.get("/providers", async (c) => {
  try {
    await dbConnect();
    await ensureLocalPaymentMethod();
    await ensurePaytriotPaymentMethod();
    await ensureStripePaymentMethod();

    const methods = await PaymentMethod.find().lean();
    const methodsByProvider = new Map<string, (typeof methods)[number]>(
      methods.map((m) => [m.provider, m])
    );

    const providers = paymentProcessors
      .filter((p) => p.id !== "site_credit")
      .map((p) => {
      const method = methodsByProvider.get(p.id);
      const dbEnabled = Boolean(method?.enabled);
      return {
        id: p.id,
        name: p.name,
        enabled: isPaymentProviderPubliclyEnabled(p.id, dbEnabled),
        isDefault: Boolean(method?.isDefault) && isPaymentProviderPubliclyEnabled(p.id, dbEnabled),
        capabilities: mapInternalCapabilitiesToPublic(p.capabilities),
        checkoutMode:
          ((method as Record<string, unknown> | undefined)?.checkoutMode as
            | "hosted"
            | "popup"
            | undefined) ?? "hosted",
      };
    });

    return success(c, providers);
  } catch (err: unknown) {
    console.error("Error fetching payment providers:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/paytriot/form", requireGuestCheckout, async (c) => {
  try {
    const orderId = c.req.query("orderId");
    const userId = c.get("userId");
    if (!orderId) return error(c, ErrorCodes.VALIDATION_ERROR, "Missing orderId", 400);

    const order = await Order.findOne({
      _id: orderId,
      userId: new Types.ObjectId(userId!),
      provider: "paytriot",
    }).lean();

    if (!order) {
      const shopOrder = await ShopOrder.findOne({
        _id: orderId,
        userId: new Types.ObjectId(userId!),
        provider: "paytriot",
      }).lean();
      if (shopOrder) {
        const formHtml = ((shopOrder.metadata ?? {}) as Record<string, unknown>).paytriotFormHtml as
          | string
          | undefined;
        if (!formHtml) return error(c, ErrorCodes.NOT_FOUND, "Payment form not yet generated", 404);
        const _amountMatch = formHtml?.match(/name="amount"\s+value="(\d+)"/);
        return success(c, { formHtml });
      }
      return error(c, ErrorCodes.NOT_FOUND, "Order not found", 404);
    }
    const formHtml = ((order.metadata ?? {}) as Record<string, unknown>).paytriotFormHtml as
      | string
      | undefined;
    if (!formHtml) return error(c, ErrorCodes.NOT_FOUND, "Payment form not yet generated", 404);
    const _amountMatch = formHtml?.match(/name="amount"\s+value="(\d+)"/);
    return success(c, { formHtml });
  } catch (err) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "paytriot.form",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Failed to retrieve payment form", 500);
  }
});

app.post("/webhook/:provider", async (c) => {
  let body = "";
  try {
    await dbConnect();
    const { provider } = c.req.param();
    body = await c.req.text();
    const { ProcessedWebhook } = await import("@oc/api-db/models");
    const eventId = createHash("sha256").update(body).digest("hex");

    /**
     * Paytriot (and other hosted-redirect providers) may fire BOTH the
     * redirectURL (browser POST) and the callbackURL (server-to-server POST)
     * for the same transaction. The POST bodies are byte-identical, so
     * deduping by SHA-256(body) ensures only one fulfillment runs even when
     * both arrive.
     */
    const existing = await ProcessedWebhook.findOne({ provider, eventId }).lean();
    if (existing) {
      incrementCounter("webhook.duplicate");
      log.debug(`[webhook] Duplicate event skipped provider=${provider}`);
      return success(c, { eventType: "DUPLICATE_SKIPPED", sessionId: "", status: "completed" });
    }

    incrementCounter("webhook.received");

    const allHeaders: Record<string, string | null | undefined> = {};
    c.req.raw.headers.forEach((v, k) => {
      allHeaders[k] = v;
    });

    let result: WebhookResult;

    if (provider === "stripe") {
      /**
       * The unified Stripe endpoint delivers BOTH shop events
       * (checkout.session.completed) and orders events. Verify the signature
       * once at the route so we can route by event type:
       *   checkout.session.completed  -> shop fulfillment path
       *   everything else             -> orders flow (adapter.handleWebhook,
       *                                   whose own verification is preserved)
       */
      const signatureHeader = allHeaders["stripe-signature"] ?? null;
      if (!signatureHeader) {
        return error(c, ErrorCodes.WEBHOOK_ERROR, "Missing stripe signature", 400);
      }
      const event = await verifyStripeWebhookEvent(body, signatureHeader);
      if (!event) return error(c, ErrorCodes.WEBHOOK_ERROR, "Invalid signature", 400);

      if (event.type === "checkout.session.completed") {
        result = await handleShopStripeWebhook(body, event, { signature: signatureHeader });
      } else {
        result = await dispatchWebhook(provider, body, allHeaders);
      }
    } else if (provider === "paytriot") {
      // Preserve the former shop-router paytriot webhook branch: a
      // server-to-server postback for a ShopOrder completes that order
      // directly. Competition orders fall through to the orders flow.
      result =
        (await handleShopPaytriotWebhook(body)) ??
        (await dispatchWebhook(provider, body, allHeaders));
    } else {
      result = await dispatchWebhook(provider, body, allHeaders);
    }

    await ProcessedWebhook.create({ provider, eventId, processedAt: new Date() }).catch(
      (dupErr: unknown) => {
        if ((dupErr as { code?: number }).code !== 11000) throw dupErr;
      }
    );

    incrementCounter("webhook.processed");

    log.info("[payment.webhook] processed successfully", {
      provider,
      eventId: eventId.slice(0, 12),
      eventType: result.eventType,
      status: result.status,
      sessionId: result.sessionId,
      orderId: result.orderId,
    });

    return success(c, result);
  } catch (err: unknown) {
    incrementCounter("webhook.error");
    console.error(
      "Webhook error:",
      err instanceof Error ? err.message : "Webhook processing failed"
    );
    log.error(
      `[webhook] Dead-letter: provider=${c.req.param("provider")} hash=${createHash("sha256").update(body).digest("hex")}`
    );
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "payments.webhook",
    });
    return error(c, ErrorCodes.WEBHOOK_ERROR, "Webhook processing failed", 502);
  }
});

/** Verify a Stripe webhook payload and parse it into an event. Returns null when the signature is invalid (route responds 400). */
async function verifyStripeWebhookEvent(
  body: string,
  signature: string
): Promise<StripeWebhookEvent | null> {
  try {
    const webhookSecret = await getResolvedWebhookSecret();
    const client = createStripeClient();
    return await client.verifyWebhookSignature(body, signature, webhookSecret);
  } catch (err) {
    if (err instanceof StripeError && err.code === "WEBHOOK_INVALID") return null;
    throw err;
  }
}

/**
 * Shop-order paytriot postback (kept from the former shop-router webhook).
 * Returns null when the payload does not reference a ShopOrder, so the
 * caller can fall through to the orders flow.
 */
async function handleShopPaytriotWebhook(body: string): Promise<WebhookResult | null> {
  const { httpParseQuery, verifyResponse } = await import("@oc/api-payment-paytriot");
  let response: PaytriotResponse;
  try {
    response = httpParseQuery(body) as unknown as PaytriotResponse;
  } catch {
    return null;
  }
  const transactionUnique =
    typeof response.transactionUnique === "string" ? response.transactionUnique : "";
  if (!transactionUnique) return null;

  const shopOrder = await ShopOrder.findOne({ providerSessionId: transactionUnique });
  if (!shopOrder) return null;

  const sessionId = transactionUnique;
  const orderId = shopOrder._id.toString();

  try {
    const creds = getPaytriotCredentials();
    verifyResponse(response as unknown as Record<string, unknown>, creds.merchantSecret);

    const respCode = Number(response.responseCode);
    if (respCode === 0) {
      shopOrder.status = "paid";
      shopOrder.paidAt = new Date();
      await shopOrder.save();
      await reduceInventoryFromOrder(shopOrder);
      await invalidateByChannelSafe(CH.shopProducts, CH.shopProduct, CH.shopCategories);
      void sendShopOrderConfirmationEmail(shopOrder).catch(() => {});
      log.info(`[payment.webhook] Shop order ${shopOrder.orderNumber} paid via Paytriot webhook`);
      return { eventType: "PAYTRIOT.SHOP_COMPLETED", sessionId, status: "completed", orderId };
    }

    shopOrder.status = "cancelled";
    await shopOrder.save();
    log.info(
      `[payment.webhook] Shop order ${shopOrder.orderNumber} cancelled via Paytriot webhook (code ${respCode})`
    );
    return { eventType: "PAYTRIOT.SHOP_FAILED", sessionId, status: "failed", orderId };
  } catch (err) {
    log.error("[payment.webhook] Paytriot shop signature verification failed:", err);
    return { eventType: "PAYTRIOT.SHOP_SIG_ERROR", sessionId, status: "failed", orderId };
  }
}

app.all("/paytriot/return", async (c) => {
  log.info("[paytriot/return] ENTER", {
    path: c.req.path,
    method: c.req.method,
    contentType: c.req.header("content-type") ?? null,
  });
  let body = "";
  let parsed: PaytriotResponse | null = null;
  const isPopup = c.req.query("popup") === "1";
  try {
    await dbConnect();
    const provider = "paytriot";
    body = await c.req.text();
    if (!body) {
      const url = new URL(c.req.url);
      body = url.searchParams.toString();
    }

    const { httpParseQuery } = await import("@oc/api-payment-paytriot");
    parsed = httpParseQuery(body) as unknown as PaytriotResponse;

    const { ProcessedWebhook } = await import("@oc/api-db/models");
    const eventId = createHash("sha256").update(body).digest("hex");
    const existing = await ProcessedWebhook.findOne({ provider, eventId }).lean();
    if (existing) {
      incrementCounter("webhook.duplicate");
      log.info("[paytriot/return] Duplicate event skipped", {
        eventId,
        transactionUnique: parsed.transactionUnique,
      });
      const { frontendUrl } = getCurrentContext();
      const rawUnique = parsed.transactionUnique ?? "";
      let dupOrderId = rawUnique.split("-")[0] ?? "";
      let dupOrderMeta: Record<string, unknown> = {};
      if (rawUnique) {
        try {
          const dupOrder = await Order.findOne({
            $or: [
              { providerSessionId: rawUnique },
              ...(/^[a-f\d]{24}$/i.test(dupOrderId) ? [{ _id: dupOrderId }] : []),
            ],
            provider: "paytriot",
          })
            .select(
              "_id status metadata.fulfillmentFailedAfterCapture metadata.paytriotErrorCategory metadata.paytriotErrorTitle metadata.paytriotErrorUserMessage metadata.paytriotErrorRecommendedAction metadata.paytriotErrorWasCharged metadata.paytriotReferralPhone metadata.paytriotAvs metadata.paytriotThreeDS"
            )
            .lean();
          if (dupOrder) {
            dupOrderId = dupOrder._id.toString();
            dupOrderMeta =
              (dupOrder as { metadata?: Record<string, unknown> } | null)?.metadata ?? {};
          }
        } catch {}
      }
      // Step 6: if a refresh/duplicate-visit lands on an order that was
      // captured but failed to fulfill, surface the right state instead of
      // a misleading "payment=duplicate" success.
      const dupFulfillmentFailed =
        (dupOrderMeta as { fulfillmentFailedAfterCapture?: boolean } | undefined)
          ?.fulfillmentFailedAfterCapture === true;
      const dupParams = new URLSearchParams();
      dupParams.set("provider", "paytriot");
      dupParams.set("session_id", rawUnique);
      dupParams.set("order_id", dupOrderId);
      dupParams.set("payment", dupFulfillmentFailed ? "captured-but-not-fulfilled" : "duplicate");
      if (dupFulfillmentFailed) {
        const dupErrorParams = buildPaytriotErrorUrlParams(dupOrderMeta);
        for (const [k, v] of Object.entries(dupErrorParams)) {
          dupParams.set(k, v);
        }
      }
      const fullUrl = `${frontendUrl}/checkout/success?${dupParams.toString()}`;
      log.info("[paytriot/return] FINAL URL (duplicate)", {
        paymentParam: dupParams.get("payment"),
        fullUrl,
      });
      if (isPopup) return renderPopupRedirect(c, fullUrl);
      return c.redirect(fullUrl, 302);
    }

    const { dispatchWebhook } = await import(
      "@oc/api-server/lib/payment/providers/_shared/webhook-helpers"
    );
    const result = await dispatchWebhook(provider, body, {});
    log.info("[paytriot/return] dispatchWebhook result", {
      eventType: result.eventType,
      status: result.status,
      sessionId: result.sessionId,
      orderId: result.orderId,
    });

    const { frontendUrl } = getCurrentContext();
    const sessionId = result.sessionId ?? "";
    const orderId = result.orderId ?? "";
    const success = result.status === "completed" || result.status === "processing";
    const urlParams = new URLSearchParams();
    urlParams.set("provider", "paytriot");
    urlParams.set("session_id", sessionId);
    urlParams.set("order_id", orderId);

    // Always fetch order metadata to determine the actual outcome.
    // Critical: fulfillment can fail AFTER a successful capture, leaving
    // order.status="failed" even when dispatchWebhook returned "completed".
    let orderMeta: Record<string, unknown> = {};
    let latestAttempt: Record<string, unknown> | null = null;
    if (orderId) {
      const orderCheck = await Order.findById(orderId)
        .select(
          "status metadata.fulfillmentFailedAfterCapture metadata.fulfillmentError metadata.paytriotErrorCategory metadata.paytriotErrorTitle metadata.paytriotErrorUserMessage metadata.paytriotErrorRecommendedAction metadata.paytriotErrorWasCharged metadata.paytriotReferralPhone metadata.paytriotAvs metadata.paytriotThreeDS"
        )
        .lean();
      orderMeta = (orderCheck as any)?.metadata ?? {};

      // Phase 3+: also read PaymentAttempt for authoritative per-transaction data.
      try {
        const { PaymentAttempt } = await import("@oc/api-db/models");
        latestAttempt = (await (PaymentAttempt as any)
          .findOne({ orderId })
          .sort({ attemptNumber: -1 })
          .lean()) as Record<string, unknown> | null;
      } catch {} // non-fatal — fall back to orderMeta

      log.info("[paytriot/return] order meta fetched", {
        orderId,
        orderStatus: orderCheck?.status,
        hasFulfillmentFailedAfterCapture: orderMeta.fulfillmentFailedAfterCapture ?? false,
        fulfillmentErrorMessage:
          (orderMeta.fulfillmentError as { message?: string } | undefined)?.message ?? null,
        errorCategory: orderMeta.paytriotErrorCategory ?? null,
        errorUserMessage: orderMeta.paytriotErrorUserMessage ?? null,
        hasLatestAttempt: !!latestAttempt,
        attemptStatus: latestAttempt?.status ?? null,
        attemptCategory: latestAttempt?.category ?? null,
        attemptFulfillmentFailed: latestAttempt?.fulfillmentFailed ?? null,
        attemptWasCharged: latestAttempt?.wasCharged ?? null,
      });
    }

    // Decision logic — PaymentAttempt-based.
    const paymentParam = decidePaytriotPaymentParam(result.status, orderMeta, latestAttempt as any);

    log.info("[paytriot/return] payment param decision", {
      dispatchStatus: result.status,
      success,
      hasFulfillmentFailedAfterCapture: !!orderMeta.fulfillmentFailedAfterCapture,
      hasLatestAttempt: !!latestAttempt,
      attemptStatus: latestAttempt?.status ?? null,
      attemptFulfillmentFailed: latestAttempt?.fulfillmentFailed ?? null,
      paymentParam,
    });

    urlParams.set("payment", paymentParam);

    // Step 4: also surface rich error params for captured-but-not-fulfilled.
    // The catch block in finalizeSuccessfulOrder writes a complete
    // paytriotError* set with category=FULFILLMENT_FAILED. If those
    // fields are present, surface them in the URL so the success page
    // doesn't need to refetch the order detail to render the specific
    // failure message (TICKETS_SOLD_OUT, MAX_TICKETS_PER_USER_EXCEEDED, etc).
    if (paymentParam === "failed" || paymentParam === "captured-but-not-fulfilled") {
      // Prefer PaymentAttempt data over orderMeta for error params.
      const attemptMeta = latestAttempt
        ? {
            paytriotErrorCategory: latestAttempt.category,
            paytriotErrorTitle: latestAttempt.errorTitle,
            paytriotErrorUserMessage: latestAttempt.errorUserMessage,
            paytriotErrorRecommendedAction: latestAttempt.errorRecommendedAction,
            paytriotErrorWasCharged: latestAttempt.wasCharged,
            paytriotReferralPhone: orderMeta.paytriotReferralPhone,
            paytriotAvs: orderMeta.paytriotAvs,
            paytriotThreeDS: orderMeta.paytriotThreeDS,
          }
        : orderMeta;
      const errorParams = buildPaytriotErrorUrlParams(attemptMeta);
      for (const [k, v] of Object.entries(errorParams)) {
        urlParams.set(k, v);
      }
    }

    const fullUrl = `${frontendUrl}/checkout/success?${urlParams.toString()}`;
    log.info("[paytriot/return] FINAL URL", {
      paymentParam,
      hasReferralPhone: !!orderMeta.paytriotReferralPhone,
      hasErrorCategory: !!orderMeta.paytriotErrorCategory,
      urlLength: fullUrl.length,
    });

    // Step 7: persist ProcessedWebhook so a subsequent browser refresh or
    // duplicate POST hits the duplicate-path branch (with fulfillment-aware
    // override) instead of re-running dispatchWebhook. This narrows the
    // race window between /paytriot/return and /webhook/:provider.
    await ProcessedWebhook.create({ provider, eventId, processedAt: new Date() }).catch(
      (dupErr: unknown) => {
        if ((dupErr as { code?: number }).code !== 11000) {
          log.error("[paytriot/return] ProcessedWebhook create failed", {
            eventId,
            err: dupErr instanceof Error ? dupErr.message : String(dupErr),
          });
        }
      }
    );

    if (isPopup) return renderPopupRedirect(c, fullUrl);
    return c.redirect(fullUrl, 302);
  } catch (err) {
    log.error("[paytriot/return] UNHANDLED EXCEPTION", {
      err: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      parsedResponseCode: parsed?.responseCode,
      parsedTransactionUnique: parsed?.transactionUnique,
      parsedState: parsed?.state,
    });
    incrementCounter("webhook.error");
    captureRouteError(err, { path: c.req.path, operation: "paytriot.return" });
    const { frontendUrl } = getCurrentContext();
    const rawUnique = parsed?.transactionUnique ?? "";
    let resolvedOrderId = rawUnique.split("-")[0] ?? "";
    if (rawUnique) {
      try {
        const order = await Order.findOne({
          $or: [
            { providerSessionId: rawUnique },
            ...(/^[a-f\d]{24}$/i.test(resolvedOrderId) ? [{ _id: resolvedOrderId }] : []),
          ],
          provider: "paytriot",
        })
          .select("_id")
          .lean();
        if (order) resolvedOrderId = order._id.toString();
      } catch {}
    }
    // Step 3: re-read order state to detect post-capture fulfillment failure.
    // finalizeSuccessfulOrder catches TICKETS_SOLD_OUT etc. internally and
    // sets status="failed" + fulfillmentFailedAfterCapture=true. If the
    // dispatch threw AFTER the catch block ran (e.g., a transient MongoDB
    // blip on the post-fulfillment metadata write), the order is in
    // "captured-but-not-fulfilled" state even though the route threw.
    // Route the customer to the right UI instead of the misleading
    // generic "unknown" failure.
    // Check whether the CURRENT webhook indicates a declined transaction,
    // rather than relying on stale order metadata from a previous attempt.
    const currentResponseCode = parsed?.responseCode ? Number(parsed.responseCode) : null;
    const currentDeclined =
      parsed?.state === "declined" || (currentResponseCode !== null && currentResponseCode !== 0);

    let exceptionOrderMeta: Record<string, unknown> = {};
    let exceptionPaymentParam: "unknown" | "failed" | "captured-but-not-fulfilled" = "unknown";

    if (currentDeclined) {
      exceptionPaymentParam = "failed";
      if (parsed) {
        try {
          const apiPaymentPaytriot = await import("@oc/api-payment-paytriot");
          const { getPaytriotErrorInfo, sanitizeUserMessage } = apiPaymentPaytriot;
          const errorInfo = getPaytriotErrorInfo({
            responseCode: Number(parsed.responseCode),
            responseMessage: parsed.responseMessage,
            state: parsed.state,
            cv2Check: parsed.cv2Check,
            addressCheck: parsed.addressCheck,
            postcodeCheck: parsed.postcodeCheck,
            avsResponseMessage: parsed.avscv2ResponseMessage,
            threeDSEnrolled: parsed.threeDSEnrolled,
            threeDSAuthenticated: parsed.threeDSAuthenticated,
            threeDSErrorCode: parsed.threeDSErrorCode,
            threeDSErrorDescription: parsed.threeDSErrorDescription,
            referralPhone: parsed.referralPhone,
            vcsResponseCode: parsed.vcsResponseCode,
            vcsResponseMessage: parsed.vcsResponseMessage,
          });
          exceptionOrderMeta = {
            paytriotErrorCategory: errorInfo.category,
            paytriotErrorTitle: errorInfo.title,
            paytriotErrorUserMessage: sanitizeUserMessage(errorInfo.description),
            paytriotErrorRecommendedAction: errorInfo.recommendedAction,
            paytriotErrorWasCharged: errorInfo.wasCharged,
          };
        } catch {
          // non-fatal — generic failure UX is acceptable
        }
      }
    } else {
      // Transaction was captured (responseCode=0) but fulfillment threw.
      // Route to captured-but-not-fulfilled with the correct category.
      exceptionPaymentParam = "captured-but-not-fulfilled";
      exceptionOrderMeta = {
        paytriotErrorCategory: "FULFILLMENT_FAILED",
        paytriotErrorTitle: "Payment received — completing your order",
        paytriotErrorUserMessage:
          "Your payment was received but we could not fully process your order. " +
          "Your card has been charged and our team will resolve this shortly.",
        paytriotErrorRecommendedAction: "contact_support",
        paytriotErrorWasCharged: true,
      };
    }
    log.info("[paytriot/return] exception-path order state", {
      orderId: resolvedOrderId,
      exceptionPaymentParam,
      currentDeclined,
      hasFulfillmentFailedAfterCapture: !!exceptionOrderMeta.fulfillmentFailedAfterCapture,
      storedCategory: exceptionOrderMeta.paytriotErrorCategory ?? null,
    });
    const errParams = new URLSearchParams();
    errParams.set("provider", "paytriot");
    errParams.set("session_id", rawUnique);
    errParams.set("order_id", resolvedOrderId);
    errParams.set("payment", exceptionPaymentParam);
    // Surface rich error params in all exception-path scenarios.
    if (
      exceptionPaymentParam === "captured-but-not-fulfilled" ||
      exceptionPaymentParam === "failed"
    ) {
      const errorParams = buildPaytriotErrorUrlParams(exceptionOrderMeta);
      for (const [k, v] of Object.entries(errorParams)) {
        errParams.set(k, v);
      }
    }
    const fullUrl = `${frontendUrl}/checkout/success?${errParams.toString()}`;
    log.info("[paytriot/return] FINAL URL (exception)", {
      exceptionPaymentParam,
      fullUrl,
    });
    if (isPopup) return renderPopupRedirect(c, fullUrl);
    return c.redirect(fullUrl, 302);
  }
});

export default app;

/**
 * Decision logic for the /paytriot/return URL builder.
 * Extracted as a pure function so the matrix of dispatch-status ×
 * fulfillment-failure flags can be unit-tested.
 *
 * Order of precedence (most specific first):
 *   Decides the payment= URL param for Paytriot order redirects.
 *
 *   Order of precedence (first match wins):
 *   1. PaymentAttempt (from PaymentAttempt collection) — if available,
 *      its capture status is the authoritative source of truth for the
 *      current transaction.
 *   2. Legacy: orderMeta?.fulfillmentFailedAfterCapture as fallback for
 *      pre-migration orders that don't have PaymentAttempt records.
 *   3. dispatchWebhook status for the fallback case.
 *
 *   A dispatchStatus of "completed"/"processing" means the gateway
 *   transaction succeeded (paytriot returned responseCode=0 and finalize
 *   didn't throw). The PaymentAttempt may additionally show
 *   fulfillmentFailed=true, which returns "captured-but-not-fulfilled".
 */
export function decidePaytriotPaymentParam(
  dispatchStatus: string,
  orderMeta: Record<string, unknown> | null,
  latestAttempt?: {
    status?: string;
    fulfillmentFailed?: boolean;
    wasCharged?: boolean;
    category?: string;
    errorTitle?: string;
    errorUserMessage?: string;
    errorRecommendedAction?: string;
  } | null
): "success" | "failed" | "captured-but-not-fulfilled" {
  const captured = dispatchStatus === "completed" || dispatchStatus === "processing";

  // Check PaymentAttempt first — authoritative source for current transaction.
  if (latestAttempt) {
    if (latestAttempt.status === "captured" && latestAttempt.fulfillmentFailed) {
      return "captured-but-not-fulfilled";
    }
    if (latestAttempt.status === "captured") {
      return "success";
    }
    // declined or errored: current transaction didn't capture
    return "failed";
  }

  // Fallback: legacy order metadata
  if (orderMeta?.fulfillmentFailedAfterCapture) {
    return "captured-but-not-fulfilled";
  }
  if (!captured) {
    return "failed";
  }
  return "success";
}

/**
 * Extract rich error-context URL params from order metadata for the
 * `payment=failed` case.
 */
export function buildPaytriotErrorUrlParams(
  orderMeta: Record<string, unknown> | null
): Record<string, string> {
  if (!orderMeta) return {};
  const params: Record<string, string> = {};
  if (orderMeta.paytriotErrorCategory) params.code = String(orderMeta.paytriotErrorCategory);
  if (orderMeta.paytriotErrorTitle) params.title = String(orderMeta.paytriotErrorTitle);
  if (orderMeta.paytriotErrorUserMessage) params.msg = String(orderMeta.paytriotErrorUserMessage);
  if (orderMeta.paytriotErrorRecommendedAction)
    params.action = String(orderMeta.paytriotErrorRecommendedAction);
  if (orderMeta.paytriotErrorWasCharged != null)
    params.wasCharged = String(orderMeta.paytriotErrorWasCharged);
  if (orderMeta.paytriotReferralPhone)
    params.referralPhone = String(orderMeta.paytriotReferralPhone);
  if (orderMeta.paytriotAvs) {
    const avs = orderMeta.paytriotAvs as Record<string, unknown>;
    if (
      avs.cv2Check &&
      typeof avs.cv2Check === "string" &&
      avs.cv2Check !== "matched" &&
      avs.cv2Check !== "not known" &&
      avs.cv2Check !== "not checked"
    )
      params.avsField = "cvv";
    if (
      avs.addressCheck &&
      typeof avs.addressCheck === "string" &&
      avs.addressCheck !== "matched" &&
      avs.addressCheck !== "not known" &&
      avs.addressCheck !== "not checked"
    )
      params.avsField = "address";
    if (
      avs.postcodeCheck &&
      typeof avs.postcodeCheck === "string" &&
      avs.postcodeCheck !== "matched" &&
      avs.postcodeCheck !== "not known" &&
      avs.postcodeCheck !== "not checked"
    )
      params.avsField = "postcode";
  }
  if (orderMeta.paytriotThreeDS) {
    const threeDS = orderMeta.paytriotThreeDS as Record<string, unknown>;
    if (
      threeDS.authenticated === "N" ||
      threeDS.authenticated === "U" ||
      threeDS.authenticated === "E"
    ) {
      params.threeDS = String(threeDS.authenticated);
    }
  }
  return params;
}

function renderPopupRedirect(c: any, targetUrl: string) {
  const safeUrl = targetUrl.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Redirecting...</title></head>
<body>
<script>
var url = ${JSON.stringify(safeUrl)};
if (window.opener) {
  try { window.opener.postMessage({ action: "paytriot_redirect", url: url }, "*"); } catch(e) {}
  try { if (!window.opener.closed) { window.opener.location.href = url; } } catch(e) {}
}
window.close();
setTimeout(function() { window.location.href = url; }, 2000);
<${""}/script>
</body>
</html>`);
}

const log = createLogger("checkout");
