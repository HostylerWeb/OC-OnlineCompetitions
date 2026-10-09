import { Cart, Competition, Profile } from "@oc/api-db/models";
import type { ICart } from "@oc/api-db/models/Cart";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { createLogger } from "@oc/api-logger";
import { validateReferralTicketSpend } from "@oc/api-referrals/referral-ticket-validation";
import { abandonOpenCheckoutOrdersForUser } from "@oc/api-server/lib/checkout/abandon-open-orders";
import { requireSession } from "@oc/api-server/middleware/auth";
import {
  type CartLineItemWithPrice,
  computeCartTotals,
  enrichCartItemsWithStatus,
  finalizeCart,
  isCompetitionAvailableForCart,
  loadCompetitionForCartItem,
  saveCartWithRetry,
} from "@oc/api-tickets/cart";
import { enrichCartItems } from "@oc/api-tickets/cart-enrichment";
import { validateBody } from "@oc/api-validation";
import {
  type AddCartItemInput,
  type ApplyCartWalletInput,
  type ApplyDiscountInput,
  addCartItemSchema,
  applyCartWalletSchema,
  applyDiscountSchema,
  type UpdateCartItemInput,
  updateCartItemSchema,
} from "@oc/api-validation/schemas/orders";
import type { CartWalletTicket } from "@oc/types";
import type { Context } from "hono";
import { Hono } from "hono";
import { Types } from "mongoose";

const app = new Hono();

app.use("*", requireSession);

function cartConflictResponse(c: Context) {
  return error(
    c,
    ErrorCodes.CONFLICT,
    "Your cart was updated elsewhere. Please refresh and try again.",
    409
  );
}

function getUserId(c: { get: (key: "userId") => string | null }): string {
  const userId = c.get("userId")!;
  if (!userId) throw new Error("userId missing after requireSession");
  return userId;
}

async function getOrCreateCart(userId: string) {
  const objectId = new Types.ObjectId(userId);
  let cart = await Cart.findOne({ userId: objectId, deletedAt: null }).exec();
  if (!cart) {
    try {
      cart = await Cart.create({ userId: objectId, items: [] });
    } catch (err: unknown) {
      if ((err as Record<string, unknown>)?.code === 11000) {
        cart = await Cart.findOne({ userId: objectId, deletedAt: null }).exec();
      } else {
        throw err;
      }
    }
  }
  return cart!;
}

function applyReclampedAllocations(cart: ICart, reclamped: CartWalletTicket[]): void {
  const current = cart.walletTicketsByCompetition ?? [];
  if (current.length === reclamped.length) {
    const currentMap = new Map(current.map((w) => [w.competitionId.toString(), w.quantity]));
    let same = true;
    for (const w of reclamped) {
      if (currentMap.get(w.competitionId.toString()) !== w.quantity) {
        same = false;
        break;
      }
    }
    if (same) return;
  }
  cart.walletTicketsByCompetition = reclamped;
  cart.markModified("walletTicketsByCompetition");
}

async function buildCartResponse(
  userId: string,
  cart: InstanceType<typeof Cart>,
  referralLocked = false,
  referredByCode?: string | null,
  isGuest = false,
  precomputed?: {
    enrichedItems?: CartLineItemWithPrice[];
    profile?: Record<string, any> | null;
  }
) {
  const items: CartLineItemWithPrice[] =
    precomputed?.enrichedItems ?? (await enrichCartItemsWithStatus(cart.items, undefined, cart));
  const { subtotal, walletTicketSavings, monetarySubtotal, total } = await computeCartTotals(
    cart,
    items
  );

  const walletAllocations: CartWalletTicket[] = (cart.walletTicketsByCompetition ?? []).map(
    (w) => ({
      competitionId: w.competitionId.toString(),
      quantity: w.quantity,
    })
  );

  const profileForBalance =
    precomputed?.profile ??
    (await Profile.findById(userId).select("referralTierAwardedTickets").lean());

  const discountRequiresAuth =
    isGuest &&
    (Boolean(cart.referralCode) ||
      (Boolean(cart.promoCode) && cart.promoCodeGuestEligible === false));

  const response = {
    id: cart._id.toString(),
    cartVersion: cart.cartVersion,
    items: items.map((item) => ({
      competitionId: item.competitionId,
      competitionTitle: item.competitionTitle,
      competitionSlug: item.slug,
      price: item.price,
      originalPrice: item.originalPrice,
      quantity: item.quantity,
      answerIndex: item.answerIndex,
      imageUrl: item.imageUrl,
      maxTicketsPerUser: item.maxTicketsPerUser,
    })),
    walletTicketsByCompetition: walletAllocations,
    walletTicketsTotal: walletAllocations.reduce((s, w) => s + w.quantity, 0),
    walletBalance: profileForBalance?.referralTierAwardedTickets ?? 0,
    monetarySubtotal,
    promoCode: cart.promoCode,
    referralCode: cart.referralCode,
    referredByCode: referredByCode ?? undefined,
    discountAmount: cart.discountAmount,
    discountType: cart.discountType,
    referralDiscountAmount: cart.referralDiscountAmount,
    referralDiscountPercent: cart.referralDiscountPercent,
    promoDiscountPercent: cart.promoDiscountPercent,
    referralLocked,
    discountRequiresAuth,
    subtotal,
    walletTicketSavings,
    total,
    reclampedAllocations: walletAllocations,
  };

  log.debug(
    ` buildCartResponse: items=${response.items.length} subtotal=${response.subtotal} total=${response.total} monetarySubtotal=${response.monetarySubtotal} walletBalance=${response.walletBalance} walletTicketsTotal=${response.walletTicketsTotal}`
  );
  log.debug(
    ` buildCartResponse items detail: ${JSON.stringify(response.items.map((i) => ({ id: i.competitionId, qty: i.quantity, price: i.price })))}`
  );

  return response;
}

async function isReferralLocked(
  userId: string,
  cart: InstanceType<typeof Cart>,
  precomputedProfile?: Record<string, any> | null,
  precomputedCompletedOrders?: number
): Promise<boolean> {
  const { Order, Profile } = await import("@oc/api-db/models");
  const profile = precomputedProfile ?? (await Profile.findById(userId).lean());
  if (!profile?.referredByCode || !cart.referralCode) return false;

  const completedOrders =
    precomputedCompletedOrders ??
    (await Order.countDocuments({ userId, status: "completed" }).maxTimeMS(5000));
  if (completedOrders > 0) return false;

  return cart.referralCode.toUpperCase() === profile.referredByCode.toUpperCase();
}

async function respondWithCart(
  userId: string,
  cart: InstanceType<typeof Cart>,
  isGuest = false,
  precomputed?: {
    enrichedItems?: CartLineItemWithPrice[];
    profile?: Record<string, any> | null;
    completedOrdersCount?: number;
  }
): Promise<ReturnType<typeof buildCartResponse>> {
  const profile = precomputed?.profile ?? (await Profile.findById(userId).lean());
  const referralLocked = await isReferralLocked(
    userId,
    cart,
    profile,
    precomputed?.completedOrdersCount
  );
  return buildCartResponse(
    userId,
    cart,
    referralLocked,
    profile?.referredByCode,
    isGuest,
    precomputed
  );
}

app.get("/", async (c) => {
  try {
    const userId = getUserId(c);
    const user = c.get("user");
    const isGuest = user?.isAnonymous ?? false;
    const cart = await getOrCreateCart(userId);
    log.debug(
      ` GET / ENTER: userId=${userId} cartId=${cart._id} items.length=${cart.items.length}`
    );

    const result = await finalizeCart(userId, cart, { force: true });
    applyReclampedAllocations(cart, result.reclampedAllocations);

    const saveResult = await saveCartWithRetry(cart, async (fresh) => {
      const { reclampedAllocations: freshReclamped } = await finalizeCart(userId, fresh, {
        force: true,
      });
      applyReclampedAllocations(fresh, freshReclamped);
    });
    if (!saveResult.ok) {
      log.debug(` GET / CONFLICT: cart save failed`);
      return cartConflictResponse(c);
    }

    const response = await respondWithCart(userId, saveResult.cart, isGuest, {
      enrichedItems: result.enrichedItems,
      profile: result.profile,
      completedOrdersCount: result.completedOrdersCount,
    });
    log.debug(
      ` GET / EXIT OK: items=${response.items.length} adjustments=${result.adjustments.length}`
    );
    return success(c, { ...response, autoAdjustments: result.adjustments });
  } catch (err: unknown) {
    log.debug(` GET / ERROR:`, err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "cart.list",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/buying-power", async (c) => {
  try {
    const userId = getUserId(c);
    const cart = await getOrCreateCart(userId);

    if (cart.items.length === 0) {
      return success(c, { items: [] });
    }

    const { getCompetitionTicketStatsBatch, countEffectiveOwnedByUserBatch } = await import(
      "@oc/api-tickets/ticket-service"
    );
    const profile = await Profile.findById(userId).lean();
    const walletBalance = profile?.referralTierAwardedTickets ?? 0;

    // Batch all per-item lookups into 3 round-trips instead of 2N+1:
    //   1. Competition.find() with $in for all items
    //   2. getCompetitionTicketStatsBatch() for ticket counts
    //   3. countOwnedByUserBatch() for per-user owned counts
    const itemIds = cart.items.map((i) => i.competitionId.toString());
    const competitions: Array<{
      _id: { toString(): string };
      status?: string;
      maxTickets?: number;
      maxTicketsPerUser?: number;
    }> = await Competition.find({ _id: { $in: itemIds } })
      .select("_id status maxTickets maxTicketsPerUser")
      .lean();

    const competitionMap = new Map<string, (typeof competitions)[number]>(
      competitions.map((c) => [c._id.toString(), c])
    );

    const statsMap = await getCompetitionTicketStatsBatch(
      cart.items.map((i) => {
        const comp = competitionMap.get(i.competitionId.toString());
        return {
          id: i.competitionId.toString(),
          status: comp?.status,
          maxTickets: comp?.maxTickets,
        };
      })
    );
    const ownedMap = await countEffectiveOwnedByUserBatch(itemIds, userId);

    const results: Array<{
      competitionId: string;
      maxPurchasable: number;
      inCart: number;
      remainingForUser: number;
      walletSpendable: number;
    }> = [];

    for (const item of cart.items) {
      const compId = item.competitionId.toString();
      const competition = competitionMap.get(compId);
      if (!competition) continue;

      const stats = statsMap.get(compId);
      if (!stats) continue;
      const userOwned = ownedMap.get(compId) ?? 0;
      const maxPerUser = competition.maxTicketsPerUser ?? 0;
      const remainingForUser =
        maxPerUser > 0 ? Math.max(0, maxPerUser - userOwned - item.quantity) : stats.available;
      const maxPurchasable = Math.min(stats.available, remainingForUser);
      const walletSpendable = Math.min(walletBalance, remainingForUser);

      results.push({
        competitionId: compId,
        maxPurchasable,
        inCart: item.quantity,
        remainingForUser,
        walletSpendable,
      });
    }

    return success(c, { items: results });
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "cart.buyingPower",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post(
  "/items",
  async (c, next) => validateBody(c, next, addCartItemSchema),
  async (c) => {
    try {
      const userId = getUserId(c);
      const user = c.get("user");
      const isGuest = user?.isAnonymous ?? false;

      const body = c.get("body") as AddCartItemInput;

      log.debug(
        ` POST /items ENTER: userId=${userId} competitionId=${body.competitionId} quantity=${body.quantity} answerIndex=${body.answerIndex}`
      );

      const competition = await loadCompetitionForCartItem(body.competitionId);
      if (!competition) {
        log.debug(` POST /items: competition ${body.competitionId} not found`);
        return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
      }
      if (!isCompetitionAvailableForCart(competition)) {
        log.debug(
          ` POST /items: competition ${body.competitionId} not available (status=${competition.status}, drawDate=${competition.drawDate})`
        );
        return error(c, ErrorCodes.VALIDATION_ERROR, "Competition is not available for purchase");
      }

      if (isGuest && competition.requireSignIn) {
        log.debug(
          ` POST /items: competition ${body.competitionId} requires sign-in, guest user blocked`
        );
        return error(c, ErrorCodes.FORBIDDEN, "Sign-in required to enter this competition");
      }

      const cart = await getOrCreateCart(userId);
      log.debug(
        ` POST /items: cart before merge: items=${JSON.stringify(cart.items.map((i) => ({ compId: i.competitionId.toString(), qty: i.quantity, answerIndex: i.answerIndex })))}`
      );

      const { mergeCartItem } = await import("@oc/api-tickets/cart");
      const newItem = {
        competitionId: new Types.ObjectId(body.competitionId),
        quantity: body.quantity,
        answerIndex: body.answerIndex ?? 0,
        maxTicketsPerUser: competition.maxTicketsPerUser ?? 10,
      };
      cart.items = mergeCartItem(cart.items, newItem);
      cart.markModified("items");
      log.debug(
        ` POST /items: cart after merge: items=${JSON.stringify(cart.items.map((i) => ({ compId: i.competitionId.toString(), qty: i.quantity })))}`
      );

      const { adjustments, reclampedAllocations, enrichedItems, profile, completedOrdersCount } =
        await finalizeCart(userId, cart, { force: true });
      applyReclampedAllocations(cart, reclampedAllocations);

      let retryEnriched: CartLineItemWithPrice[] | null = null;
      const saveResult = await saveCartWithRetry(cart, async (fresh) => {
        log.debug(
          ` POST /items: retry - fresh cart items=${JSON.stringify(fresh.items.map((i) => ({ compId: i.competitionId.toString(), qty: i.quantity })))}`
        );
        fresh.items = mergeCartItem(fresh.items, newItem);
        fresh.markModified("items");
        const r = await finalizeCart(userId, fresh, { force: true });
        retryEnriched = r.enrichedItems ?? null;
        applyReclampedAllocations(fresh, r.reclampedAllocations);
      });
      if (!saveResult.ok) {
        log.debug(` POST /items: save conflict after retries`);
        return cartConflictResponse(c);
      }

      log.debug(
        ` POST /items: saved cart items=${JSON.stringify(saveResult.cart.items.map((i) => ({ compId: i.competitionId.toString(), qty: i.quantity })))} adjustments=${adjustments.length}`
      );

      const responseEnriched = retryEnriched ?? enrichedItems;
      const response = await respondWithCart(userId, saveResult.cart, isGuest, {
        enrichedItems: responseEnriched,
        profile,
        completedOrdersCount,
      });
      return success(c, { ...response, autoAdjustments: adjustments });
    } catch (err: unknown) {
      log.debug(` POST /items ERROR:`, err);
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "cart.addItem",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.put(
  "/items/:competitionId",
  async (c, next) => validateBody(c, next, updateCartItemSchema),
  async (c) => {
    try {
      const userId = getUserId(c);
      const user = c.get("user");
      const isGuest = user?.isAnonymous ?? false;
      const { competitionId } = c.req.param();
      const body = c.get("body") as UpdateCartItemInput;
      log.debug(
        `[cart.update] ENTER: competitionId=${competitionId} userId=${userId} newQuantity=${body.quantity}`
      );

      const cart = await Cart.findOne({ userId: new Types.ObjectId(userId) }).exec();
      if (!cart) {
        log.debug(`[cart.update] competitionId=${competitionId} cart NOT FOUND`);
        return error(c, ErrorCodes.NOT_FOUND, "Cart not found", 404);
      }

      const itemIndex = cart.items.findIndex((i) => i.competitionId.toString() === competitionId);
      if (itemIndex === -1) {
        log.debug(`[cart.update] competitionId=${competitionId} ITEM NOT IN CART`);
        return error(c, ErrorCodes.NOT_FOUND, "Item not in cart", 404);
      }

      const item = cart.items[itemIndex]!;
      const competition = await loadCompetitionForCartItem(competitionId);
      if (competition?.maxTicketsPerUser != null) {
        item.maxTicketsPerUser = competition.maxTicketsPerUser;
      }

      item.quantity = body.quantity;
      if (body.answerIndex !== undefined && competition?.questionOptions) {
        const { normalizeAnswerIndex } = await import("@oc/api-payment-core");
        item.answerIndex = normalizeAnswerIndex(body.answerIndex, competition.questionOptions);
      }
      cart.markModified("items");
      log.debug(
        `[cart.update] competitionId=${competitionId} validation OK: quantity=${body.quantity}`
      );

      const result = await finalizeCart(userId, cart, { force: true });
      applyReclampedAllocations(cart, result.reclampedAllocations);

      const targetQuantity = cart.items[itemIndex]?.quantity ?? body.quantity;
      const targetAnswerIndex = cart.items[itemIndex]?.answerIndex ?? item.answerIndex;
      const targetMaxTicketsPerUser =
        cart.items[itemIndex]?.maxTicketsPerUser ?? item.maxTicketsPerUser;
      const needsUpdateAnswerIndex = body.answerIndex !== undefined;

      const saveResult = await saveCartWithRetry(cart, async (fresh) => {
        const freshIndex = fresh.items.findIndex(
          (i) => i.competitionId.toString() === competitionId
        );
        if (freshIndex === -1) return;

        const freshItem = fresh.items[freshIndex]!;
        freshItem.quantity = targetQuantity;
        if (needsUpdateAnswerIndex) freshItem.answerIndex = targetAnswerIndex;
        freshItem.maxTicketsPerUser = targetMaxTicketsPerUser;
        fresh.markModified("items");
        const { reclampedAllocations: freshReclamped } = await finalizeCart(userId, fresh, {
          force: true,
        });
        applyReclampedAllocations(fresh, freshReclamped);
      });
      if (!saveResult.ok) {
        log.debug(`[cart.update] competitionId=${competitionId} CONFLICT`);
        return cartConflictResponse(c);
      }

      log.debug(`[cart.update] EXIT: competitionId=${competitionId} success`);
      const response = await respondWithCart(userId, saveResult.cart, isGuest, {
        enrichedItems: result.enrichedItems,
        profile: result.profile,
        completedOrdersCount: result.completedOrdersCount,
      });
      return success(c, { ...response, autoAdjustments: result.adjustments });
    } catch (err: unknown) {
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "cart.updateItem",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.delete("/items/:competitionId", async (c) => {
  try {
    const userId = getUserId(c);
    const user = c.get("user");
    const isGuest = user?.isAnonymous ?? false;
    const { competitionId } = c.req.param();
    log.debug(`[cart.delete] ENTER: competitionId=${competitionId} userId=${userId}`);

    const cart = await Cart.findOne({ userId: new Types.ObjectId(userId) }).exec();
    if (!cart) {
      log.debug(`[cart.delete] competitionId=${competitionId} cart NOT FOUND`);
      return error(c, ErrorCodes.NOT_FOUND, "Cart not found", 404);
    }

    const itemsBefore = cart.items.length;
    cart.items = cart.items.filter((i) => i.competitionId.toString() !== competitionId);
    const deletedCount = itemsBefore - cart.items.length;
    log.debug(`[cart.delete] competitionId=${competitionId} deletedCount=${deletedCount}`);
    cart.markModified("items");

    const result = await finalizeCart(userId, cart, { force: true });
    applyReclampedAllocations(cart, result.reclampedAllocations);

    const saveResult = await saveCartWithRetry(cart, async (fresh) => {
      fresh.items = fresh.items.filter((i) => i.competitionId.toString() !== competitionId);
      fresh.markModified("items");
      const { reclampedAllocations: freshReclamped } = await finalizeCart(userId, fresh, {
        force: true,
      });
      applyReclampedAllocations(fresh, freshReclamped);
    });
    if (!saveResult.ok) {
      log.debug(`[cart.delete] competitionId=${competitionId} CONFLICT`);
      return cartConflictResponse(c);
    }

    log.debug(`[cart.delete] EXIT: competitionId=${competitionId} deletedCount=${deletedCount}`);
    return success(
      c,
      await respondWithCart(userId, saveResult.cart, isGuest, {
        enrichedItems: result.enrichedItems,
        profile: result.profile,
        completedOrdersCount: result.completedOrdersCount,
      })
    );
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "cart.removeItem",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.delete("/items", async (c) => {
  try {
    const userId = getUserId(c);
    const cart = await Cart.findOne({ userId: new Types.ObjectId(userId) }).exec();

    if (!cart) {
      return success(c, { items: [], subtotal: 0, total: 0, discountAmount: 0 });
    }

    cart.items = [];
    cart.promoCode = undefined;
    cart.promoCodeId = undefined;
    cart.promoCodeGuestEligible = undefined;
    cart.promoDiscountPercent = undefined;
    cart.referralCode = undefined;
    cart.referralDiscountAmount = undefined;
    cart.referralDiscountPercent = undefined;
    cart.walletTicketsByCompetition = [];
    cart.discountAmount = 0;
    cart.discountType = null;
    cart.markModified("items");
    cart.markModified("walletTicketsByCompetition");

    const saveResult = await saveCartWithRetry(cart, async (fresh) => {
      fresh.items = [];
      fresh.promoCode = undefined;
      fresh.promoCodeId = undefined;
      fresh.promoCodeGuestEligible = undefined;
      fresh.promoDiscountPercent = undefined;
      fresh.referralCode = undefined;
      fresh.referralDiscountAmount = undefined;
      fresh.referralDiscountPercent = undefined;
      fresh.walletTicketsByCompetition = [];
      fresh.discountAmount = 0;
      fresh.discountType = null;
      fresh.markModified("items");
      fresh.markModified("walletTicketsByCompetition");
    });
    if (!saveResult.ok) {
      return cartConflictResponse(c);
    }

    void abandonOpenCheckoutOrdersForUser(userId).catch((err) =>
      console.warn("[cart.clear] abandonOpenCheckoutOrdersForUser failed:", err)
    );

    return success(c, {
      id: saveResult.cart._id.toString(),
      items: [],
      reclampedAllocations: [],
      walletTicketsByCompetition: [],
      promoCode: undefined,
      discountAmount: 0,
      discountType: null,
      subtotal: 0,
      total: 0,
    });
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "cart.clearItems",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post(
  "/discount",
  async (c, next) => validateBody(c, next, applyDiscountSchema),
  async (c) => {
    try {
      const userId = getUserId(c);
      const body = c.get("body") as ApplyDiscountInput;
      body.code = body.code.trim();

      const cart = await getOrCreateCart(userId);

      const { computeSubtotalForCartItems } = await import("@oc/api-tickets/cart");
      const subtotal = await computeSubtotalForCartItems(cart.items);

      const { validatePromoCode, validateReferralCode, validatePendingReferralCode } = await import(
        "@oc/api-tickets/promo-codes"
      );
      const { Order, Profile, PromoCode } = await import("@oc/api-db/models");

      const buyerProfile = await Profile.findById(userId).lean();
      const completedOrders = await Order.countDocuments({ userId, status: "completed" }).maxTimeMS(
        5000
      );
      const isFirstOrder = completedOrders === 0;

      type ValidateResult = {
        valid: boolean;
        error?: string;
        code?: string;
        discountAmount?: number;
        discountType?: string;
        discountValue?: number;
      };

      let result: ValidateResult;

      if (body.codeType === "referral") {
        result = await validateReferralCode(
          body.code,
          subtotal,
          userId,
          isFirstOrder && Boolean(buyerProfile?.referredByCode)
        );
        if (result.valid) {
          const { applyReferralToProfile } = await import("@oc/auth-admin/auth-hooks");
          try {
            await applyReferralToProfile(userId, body.code);
          } catch {
            // non-blocking: discount still applies even if profile update fails
          }
        }
      } else if (body.codeType === "pending_referral") {
        if (isFirstOrder && buyerProfile?.referredByCode) {
          result = await validateReferralCode(buyerProfile.referredByCode, subtotal, userId, true);
        } else {
          result = await validatePendingReferralCode(body.code, subtotal, userId);
        }
      } else {
        const enrichedItems = await enrichCartItems(cart.items);
        const validationItems = enrichedItems.map((e) => ({
          competitionId: e.competitionId,
          quantity: e.quantity,
          unitPrice: e.price,
        }));
        result = await validatePromoCode(body.code, subtotal, validationItems, userId);

        if (!result.valid) {
          const referralResult = await validateReferralCode(body.code, subtotal, userId);
          if (referralResult.valid) {
            result = referralResult;
            const { applyReferralToProfile } = await import("@oc/auth-admin/auth-hooks");
            try {
              await applyReferralToProfile(userId, body.code);
            } catch {
              // non-blocking: discount still applies even if profile update fails
            }
          }
        }
      }

      if (!result.valid) {
        return success(c, { valid: false, error: result.error });
      }

      const user = c.get("user");
      const isGuest = user?.isAnonymous ?? false;

      let promoDoc: { _id: Types.ObjectId; guestEligible?: boolean } | null = null;
      if (result.code) {
        promoDoc = await PromoCode.findOne({ code: result.code.toUpperCase() }).lean();
      }

      // Guests may only apply promo codes that are explicitly marked
      // guest-eligible. Referral codeTypes bypass this gate entirely.
      if (isGuest && body.codeType !== "referral" && body.codeType !== "pending_referral") {
        if (!promoDoc || promoDoc.guestEligible === false) {
          return c.json({
            success: false,
            error:
              "Promo codes require a registered account. Please sign in to use this promo code.",
          });
        }
      }

      if (result.code) {
        if (promoDoc) {
          cart.promoCode = result.code;
          cart.promoCodeId = promoDoc._id;
          cart.promoCodeGuestEligible = promoDoc.guestEligible;
          cart.promoDiscountPercent = result.discountValue ?? undefined;
          cart.referralCode = undefined;
          cart.referralDiscountAmount = undefined;
          cart.referralDiscountPercent = undefined;
        } else {
          cart.referralCode = result.code;
          cart.referralDiscountAmount = result.discountAmount ?? 0;
          cart.referralDiscountPercent = result.discountValue ?? undefined;
          cart.promoCode = undefined;
          cart.promoCodeId = undefined;
          cart.promoCodeGuestEligible = undefined;
        }
      }
      cart.discountAmount = result.discountAmount ?? 0;
      cart.discountType = (result.discountType ?? null) as "percentage" | "fixed" | null;

      const { adjustments, reclampedAllocations } = await finalizeCart(userId, cart, {
        force: true,
      });
      applyReclampedAllocations(cart, reclampedAllocations);

      const appliedDiscountAmount = cart.discountAmount;
      const appliedDiscountType = cart.discountType;
      const appliedPromoCode = cart.promoCode;
      const appliedPromoCodeId = cart.promoCodeId;
      const appliedPromoCodeGuestEligible = cart.promoCodeGuestEligible;
      const appliedPromoDiscountPercent = cart.promoDiscountPercent;
      const appliedReferralCode = cart.referralCode;
      const appliedReferralDiscountAmount = cart.referralDiscountAmount;
      const appliedReferralDiscountPercent = cart.referralDiscountPercent;

      const saveResult = await saveCartWithRetry(cart, async (fresh) => {
        fresh.discountAmount = appliedDiscountAmount;
        fresh.discountType = appliedDiscountType;
        fresh.promoCode = appliedPromoCode;
        fresh.promoCodeId = appliedPromoCodeId;
        fresh.promoCodeGuestEligible = appliedPromoCodeGuestEligible;
        fresh.promoDiscountPercent = appliedPromoDiscountPercent;
        fresh.referralCode = appliedReferralCode;
        fresh.referralDiscountAmount = appliedReferralDiscountAmount;
        fresh.referralDiscountPercent = appliedReferralDiscountPercent;
        const { reclampedAllocations: freshReclamped } = await finalizeCart(userId, fresh, {
          force: true,
        });
        applyReclampedAllocations(fresh, freshReclamped);
      });
      if (!saveResult.ok) {
        return cartConflictResponse(c);
      }

      const savedCart = saveResult.cart;
      const enrichedItems = await enrichCartItems(savedCart.items);
      const { total } = await computeCartTotals(
        savedCart,
        enrichedItems.map((e) => ({ ...e, status: "active", drawDate: null }))
      );

      const codeType: "promo" | "referral" = promoDoc ? "promo" : "referral";

      return success(c, {
        valid: true,
        code: result.code,
        codeType,
        discountAmount: savedCart.discountAmount,
        discountType: savedCart.discountType,
        total,
        adjustments,
      });
    } catch (err: unknown) {
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "cart.applyDiscount",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.put(
  "/wallet",
  async (c, next) => validateBody(c, next, applyCartWalletSchema),
  async (c) => {
    try {
      const userId = getUserId(c);
      const user = c.get("user");
      const isGuest = user?.isAnonymous ?? false;
      const body = c.get("body") as ApplyCartWalletInput;

      const allocations = body.walletTicketsByCompetition ?? [];
      const totalWalletQty = allocations.reduce((s, a) => s + a.quantity, 0);
      log.debug(
        `[cart.patch] ENTER: userId=${userId} allocations=${JSON.stringify(allocations)} totalWalletQty=${totalWalletQty}`
      );
      const cart = await getOrCreateCart(userId);

      const profile = await Profile.findById(userId).lean();
      const walletBalance = profile?.referralTierAwardedTickets ?? 0;
      log.debug(`[cart.patch] userId=${userId} walletBalance=${walletBalance}`);

      let totalRequested = 0;
      for (const alloc of allocations) {
        const cartItem = cart.items.find((i) => i.competitionId.toString() === alloc.competitionId);
        if (!cartItem) {
          log.debug(`[cart.patch] competitionId=${alloc.competitionId} NOT IN CART`);
          return error(c, ErrorCodes.VALIDATION_ERROR, "Competition not in cart", 400);
        }
        if (alloc.quantity > cartItem.quantity) {
          log.debug(
            `[cart.patch] quantity exceeds cart: allocQty=${alloc.quantity} cartQty=${cartItem.quantity}`
          );
          return error(
            c,
            ErrorCodes.VALIDATION_ERROR,
            `Cannot apply more wallet tickets than cart quantity for ${alloc.competitionId}`,
            400
          );
        }
        if (alloc.quantity > 0) {
          const competition = await loadCompetitionForCartItem(alloc.competitionId);
          if (!competition) {
            log.debug(`[cart.patch] competitionId=${alloc.competitionId} NOT FOUND`);
            return error(c, ErrorCodes.NOT_FOUND, "Competition not found", 404);
          }
          const maxPerUser = competition.maxTicketsPerUser ?? 0;
          if (maxPerUser > 0) {
            const { countEffectiveOwnedForCap } = await import("@oc/api-tickets/ticket-service");
            const userOwned = await countEffectiveOwnedForCap(alloc.competitionId, userId);
            const totalAfterPurchase = userOwned + cartItem.quantity;
            if (totalAfterPurchase > maxPerUser) {
              log.debug(
                `[cart.patch] maxTicketsPerUser exceeded: owned=${userOwned} cart=${cartItem.quantity} limit=${maxPerUser}`
              );
              return error(
                c,
                ErrorCodes.MAX_TICKETS_PER_USER_EXCEEDED,
                `This cart has ${cartItem.quantity} ticket${cartItem.quantity !== 1 ? "s" : ""} but you can only hold ${Math.max(0, maxPerUser - userOwned)} more for this competition (limit ${maxPerUser}).`,
                400
              );
            }
          }
          const validation = await validateReferralTicketSpend({
            userId,
            competitionId: alloc.competitionId,
            quantity: alloc.quantity,
            walletBalance: walletBalance - totalRequested,
            existingCartQty: cartItem.quantity,
          });
          if (!validation.ok) {
            log.debug(`[cart.patch] VALIDATION FAILED: ${validation.message}`);
            return error(c, ErrorCodes.VALIDATION_ERROR, validation.message, 400);
          }
        }
        totalRequested += alloc.quantity;
      }

      if (totalRequested > walletBalance) {
        log.debug(
          `[cart.patch] INSUFFICIENT BALANCE: requested=${totalRequested} balance=${walletBalance}`
        );
        return error(
          c,
          ErrorCodes.VALIDATION_ERROR,
          `Insufficient wallet balance. You have ${walletBalance} ticket(s) available`,
          400
        );
      }

      log.debug(
        `[cart.patch] VALIDATION PASSED: totalRequested=${totalRequested} walletBalance=${walletBalance}`
      );

      const walletAllocations = allocations
        .filter((a) => a.quantity > 0)
        .map((a) => ({
          competitionId: new Types.ObjectId(a.competitionId),
          quantity: a.quantity,
        }));

      cart.walletTicketsByCompetition = walletAllocations;
      cart.markModified("walletTicketsByCompetition");

      const result = await finalizeCart(userId, cart, { force: true });
      applyReclampedAllocations(cart, result.reclampedAllocations);

      const saveResult = await saveCartWithRetry(cart, async (fresh) => {
        fresh.walletTicketsByCompetition = walletAllocations.map((a) => ({
          competitionId: a.competitionId,
          quantity: a.quantity,
        }));
        fresh.markModified("walletTicketsByCompetition");
        const { reclampedAllocations: freshReclamped } = await finalizeCart(userId, fresh, {
          force: true,
        });
        applyReclampedAllocations(fresh, freshReclamped);
      });
      if (!saveResult.ok) {
        log.debug(`[cart.patch] CONFLICT`);
        return cartConflictResponse(c);
      }

      log.debug(`[cart.patch] EXIT: success`);
      return success(
        c,
        await respondWithCart(userId, saveResult.cart, isGuest, {
          enrichedItems: result.enrichedItems,
          profile: result.profile,
          completedOrdersCount: result.completedOrdersCount,
        })
      );
    } catch (err: unknown) {
      captureRouteError(err, {
        requestId: c.get("requestId"),
        path: c.req.path,
        userId: c.get("userId") ?? null,
        operation: "cart.applyWallet",
      });
      return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
    }
  }
);

app.delete("/discount", async (c) => {
  try {
    const userId = getUserId(c);
    const cart = await Cart.findOne({ userId: new Types.ObjectId(userId) }).exec();
    if (!cart) {
      return error(c, ErrorCodes.NOT_FOUND, "Cart not found", 404);
    }

    const { Order, Profile } = await import("@oc/api-db/models");
    const profile = await Profile.findById(userId).lean();
    const completedOrders = await Order.countDocuments({ userId, status: "completed" }).maxTimeMS(
      5000
    );

    if (
      completedOrders === 0 &&
      profile?.referredByCode &&
      cart.referralCode?.toUpperCase() === profile.referredByCode.toUpperCase()
    ) {
      return error(c, ErrorCodes.FORBIDDEN, "Referral discount is locked for your first order");
    }

    cart.promoCode = undefined;
    cart.promoCodeId = undefined;
    cart.promoCodeGuestEligible = undefined;
    cart.promoDiscountPercent = undefined;
    cart.referralCode = undefined;
    cart.referralDiscountAmount = undefined;
    cart.referralDiscountPercent = undefined;
    cart.discountAmount = 0;
    cart.discountType = null;

    const { reclampedAllocations } = await finalizeCart(userId, cart, { force: true });
    applyReclampedAllocations(cart, reclampedAllocations);

    const saveResult = await saveCartWithRetry(cart, async (fresh) => {
      fresh.promoCode = undefined;
      fresh.promoCodeId = undefined;
      fresh.promoCodeGuestEligible = undefined;
      fresh.promoDiscountPercent = undefined;
      fresh.referralCode = undefined;
      fresh.referralDiscountAmount = undefined;
      fresh.referralDiscountPercent = undefined;
      fresh.discountAmount = 0;
      fresh.discountType = null;
      const { reclampedAllocations: freshReclamped } = await finalizeCart(userId, fresh, {
        force: true,
      });
      applyReclampedAllocations(fresh, freshReclamped);
    });
    if (!saveResult.ok) {
      return cartConflictResponse(c);
    }

    const enrichedItems = await enrichCartItems(saveResult.cart.items);
    const { subtotal, total } = await computeCartTotals(
      saveResult.cart,
      enrichedItems.map((e) => ({ ...e, status: "active", drawDate: null }))
    );

    return success(c, {
      promoCode: undefined,
      discountAmount: 0,
      discountType: null,
      subtotal,
      total,
    });
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "cart.removeDiscount",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;

const log = createLogger("cart");
