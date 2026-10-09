import {
  Cart,
  Competition,
  type ICart,
  type ICartItem,
  Order,
  Profile,
} from "@oc/api-db/models";
import { createLogger } from "@oc/api-logger";
import { enrichCartItems } from "@oc/api-tickets/cart-enrichment";
import {
  checkAvailability as checkTicketServiceAvailability,
  countEffectiveOwnedByUserBatch,
  getCompetitionTicketStatsBatch,
} from "@oc/api-tickets/ticket-service";
import { isOpenForTicketSales } from "@oc/api-tickets/competition-sales";
import {
  mergeWalletIntoCheckoutItems,
  type WalletTicketAllocation,
} from "@oc/api-tickets/wallet";
import type { CartAdjustment, CartWalletTicket } from "@oc/types";
import mongoose from "mongoose";

export interface CartCompetitionCacheEntry {
  _id: { toString(): string };
  status: string;
  drawDate?: Date | null;
  endDate?: Date | null;
  maxTicketsPerUser?: number;
  maxTickets?: number;
  title: string;
  slug: string;
  ticketPrice: number;
  originalPrice?: number;
  requireSignIn?: boolean;
  imageUrl?: string;
  prizeImageUrl?: string;
}

export async function checkTicketAvailability(
  competitionId: string,
  targetCartQty: number,
  userId?: string,
  existingCartQty = 0
): Promise<{ available: number; maxTicketsPerUser: number; status: string }> {
  return checkTicketServiceAvailability(competitionId, targetCartQty, userId, existingCartQty);
}

export function mergeCartItem(items: ICartItem[], newItem: ICartItem): ICartItem[] {
  const existingIndex = items.findIndex((i) => i.competitionId.equals(newItem.competitionId));

  if (existingIndex === -1) {
    return [...items, newItem];
  }

  const existing = items[existingIndex]!;
  const mergedQuantity = Math.min(existing.quantity + newItem.quantity, newItem.maxTicketsPerUser);

  return items.map((item, i) =>
    i === existingIndex
      ? {
          ...item,
          quantity: mergedQuantity,
          answerIndex: newItem.answerIndex,
          maxTicketsPerUser: newItem.maxTicketsPerUser,
        }
      : item
  );
}

export async function recalculateCartDiscount(
  cart: ICart,
  subtotal: number,
  competitionCache?: Map<string, CartCompetitionCacheEntry>
): Promise<void> {
  cart.discountAmount = 0;
  cart.discountType = null;

  const enriched = await enrichCartItems(cart.items, competitionCache);
  const monetarySubtotal = computeMonetarySubtotalForCart(cart, enriched);
  const discountBase = monetarySubtotal > 0 ? monetarySubtotal : subtotal;

  const userId = cart.userId?.toString() ?? "";
  const completedOrders = userId
    ? await Order.countDocuments({ userId, status: "completed" }).maxTimeMS(5000)
    : 0;
  const isFirstOrder = completedOrders === 0;

  const cartItems = enriched.map((e) => ({
    competitionId: e.competitionId,
    quantity: e.quantity,
    unitPrice: e.price,
  }));

  let deferredPromo: Awaited<
    ReturnType<(typeof import("@oc/api-tickets/promo-codes"))["validatePromoCode"]>
  > | null = null;

  if (cart.promoCodeId && cart.promoCode) {
    const { validatePromoCode } = await import("@oc/api-tickets/promo-codes");
    const promo = await validatePromoCode(cart.promoCode, discountBase, cartItems, userId);
    if (promo.valid) {
      if (isFirstOrder && cart.referralCode) {
        deferredPromo = promo;
      } else {
        cart.discountAmount = promo.discountAmount ?? 0;
        cart.discountType = promo.discountType ?? null;
        cart.promoDiscountPercent =
          promo.discountType === "percentage" ? promo.discountValue : undefined;
      }
    } else {
      cart.promoCode = undefined;
      cart.promoCodeId = undefined;
      cart.promoDiscountPercent = undefined;
    }
  }

  if (cart.referralCode && !cart.discountType) {
    const { validateReferralCode } = await import("@oc/api-tickets/promo-codes");
    const referral = await validateReferralCode(cart.referralCode, discountBase, userId);
    if (referral.valid) {
      cart.referralDiscountAmount = referral.discountAmount ?? 0;
      cart.referralDiscountPercent = referral.discountValue ?? undefined;
      cart.discountAmount = referral.discountAmount ?? 0;
      cart.discountType = "percentage";
    } else if (deferredPromo) {
      cart.discountAmount = deferredPromo.discountAmount ?? 0;
      cart.discountType = deferredPromo.discountType ?? null;
      cart.promoDiscountPercent =
        deferredPromo.discountType === "percentage" ? deferredPromo.discountValue : undefined;
    } else {
      cart.referralCode = undefined;
      cart.referralDiscountAmount = undefined;
      cart.referralDiscountPercent = undefined;
    }
  } else if (deferredPromo && !cart.discountType) {
    cart.discountAmount = deferredPromo.discountAmount ?? 0;
    cart.discountType = deferredPromo.discountType ?? null;
    cart.promoDiscountPercent =
      deferredPromo.discountType === "percentage" ? deferredPromo.discountValue : undefined;
  }
}

function computeMonetarySubtotalForCart(
  cart: ICart,
  enriched: Array<{ competitionId: string; quantity: number; price: number }>
): number {
  let subtotal = 0;
  for (const item of enriched) {
    subtotal += item.price * item.quantity;
  }

  const itemsById = new Map(enriched.map((i) => [i.competitionId, i]));
  const priceById = new Map(enriched.map((i) => [i.competitionId, i.price]));
  const originalAllocations: WalletTicketAllocation[] = (cart.walletTicketsByCompetition ?? []).map(
    (w) => ({
      competitionId: w.competitionId.toString(),
      quantity: w.quantity,
    })
  );

  const clampedAllocations: WalletTicketAllocation[] = [];
  for (const alloc of originalAllocations) {
    const item = itemsById.get(alloc.competitionId);
    if (!item) continue;
    clampedAllocations.push({
      competitionId: alloc.competitionId,
      quantity: Math.max(0, Math.min(alloc.quantity, item.quantity)),
    });
  }

  const checkoutItems = enriched.map((i) => ({
    competitionId: i.competitionId,
    quantity: i.quantity,
    answerIndex: 0,
  }));
  const merged = mergeWalletIntoCheckoutItems(checkoutItems, clampedAllocations);

  let walletTicketSavings = 0;
  for (const m of merged) {
    const price = priceById.get(m.competitionId) ?? 0;
    walletTicketSavings += price * m.walletQty;
  }

  return Math.max(0, subtotal - walletTicketSavings);
}

export async function sanitizeCart(
  cart: ICart,
  competitionCache?: Map<string, CartCompetitionCacheEntry>
): Promise<ICart> {
  if (cart.items.length === 0) {
    log.debug(" sanitizeCart: empty cart, nothing to sanitize");
    return cart;
  }

  let competitionMap: Map<string, CartCompetitionCacheEntry>;

  if (competitionCache) {
    competitionMap = competitionCache;
  } else {
    const competitionIds = cart.items.map((item) => item.competitionId);
    const competitions = await Competition.find({ _id: { $in: competitionIds } })
      .select("status drawDate endDate maxTicketsPerUser")
      .lean();
    competitionMap = new Map(
      competitions.map((c) => [c._id.toString(), c as unknown as CartCompetitionCacheEntry])
    );
  }

  const validItems: ICartItem[] = [];
  let removedCount = 0;

  for (const item of cart.items) {
    const competition = competitionMap.get(item.competitionId.toString());

    if (competition && isOpenForTicketSales(competition)) {
      validItems.push({
        ...item,
        maxTicketsPerUser: competition.maxTicketsPerUser ?? item.maxTicketsPerUser,
      });
    } else {
      removedCount++;
      log.debug(
        ` sanitizeCart: removing item ${item.competitionId} - competition inactive/expired (status=${competition?.status}, drawDate=${competition?.drawDate})`
      );
    }
  }

  if (removedCount > 0) {
    log.debug(` sanitizeCart: removed ${removedCount} items, ${validItems.length} remaining`);
  }

  if (validItems.length !== cart.items.length) {
    cart.items = validItems;
  }

  return cart;
}

export function computeSubtotal(items: Array<{ price: number; quantity: number }>): number {
  return items.reduce((sum, item) => {
    const price = Number(item.price) || 0;
    const quantity = Number(item.quantity) || 0;
    return sum + price * quantity;
  }, 0);
}

export function computeTotal(
  items: Array<{ price: number; quantity: number }>,
  discountAmount: number,
  _discountType: "percentage" | "fixed" | null,
  referralDiscountAmount?: number,
  referralDiscountPercent?: number
): number {
  const subtotal = computeSubtotal(items);
  let savings = discountAmount ?? 0;

  if (savings <= 0) {
    if (referralDiscountAmount != null && referralDiscountAmount > 0) {
      savings = referralDiscountAmount;
    } else if (referralDiscountPercent != null && referralDiscountPercent > 0) {
      savings = subtotal * (referralDiscountPercent / 100);
    }
  }

  return Math.max(0, subtotal - savings);
}

export async function computeSubtotalForCartItems(
  items: ICartItem[],
  competitionCache?: Map<string, CartCompetitionCacheEntry>
): Promise<number> {
  const enriched = await enrichCartItems(items, competitionCache);
  return computeSubtotal(enriched);
}

export async function ensureReferralDiscountOnCart(
  userId: string,
  cart: ICart,
  options?: {
    competitionCache?: Map<string, CartCompetitionCacheEntry>;
    profile?: Record<string, any> | null;
    completedOrders?: number;
  }
): Promise<boolean> {
  const profile = options?.profile ?? (await Profile.findById(userId).lean());
  if (!profile?.referredByCode) return false;

  const completedOrders =
    options?.completedOrders ??
    (await Order.countDocuments({
      userId,
      status: "completed",
    }).maxTimeMS(5000));
  if (completedOrders > 0) return false;

  const { ReferralSettings } = await import("@oc/api-db/models");
  const settings = await ReferralSettings.findById("referral_settings").lean();
  if (settings?.refereeReward?.enabled === false) return false;

  const subtotal = await computeSubtotalForCartItems(cart.items, options?.competitionCache);
  const referredByCode = profile.referredByCode.toUpperCase();

  const { validateReferralCode } = await import("@oc/api-tickets/promo-codes");

  if (cart.referralCode?.toUpperCase() === referredByCode) {
    const result = await validateReferralCode(referredByCode, subtotal, userId, true);
    if (result.valid) {
      cart.referralDiscountAmount = result.discountAmount ?? 0;
      cart.referralDiscountPercent = result.discountValue ?? undefined;
      cart.discountAmount = result.discountAmount ?? 0;
      cart.discountType = "percentage";
      return true;
    }
    return false;
  }

  if (cart.referralCode) {
    return false;
  }

  const result = await validateReferralCode(referredByCode, subtotal, userId, true);
  if (!result.valid) return false;
  if (cart.promoCodeId || cart.promoCode) return false;

  cart.referralCode = result.code;
  cart.referralDiscountAmount = result.discountAmount ?? 0;
  cart.referralDiscountPercent = result.discountValue ?? undefined;
  cart.discountAmount = result.discountAmount ?? 0;
  cart.discountType = "percentage";

  return true;
}

export function makeAdjustmentId(reason: string, competitionId: string): string {
  return `${reason}:${competitionId}`;
}

export async function applyCartAutoAdjustments(
  userId: string,
  cart: ICart,
  competitionCache?: Map<string, CartCompetitionCacheEntry>
): Promise<{ cart: ICart; adjustments: CartAdjustment[] }> {
  if (cart.items.length === 0) {
    log.debug(" applyCartAutoAdjustments: empty cart, no adjustments needed");
    return { cart, adjustments: [] };
  }

  let competitionMap: Map<string, CartCompetitionCacheEntry>;

  if (competitionCache) {
    competitionMap = competitionCache;
  } else {
    const competitionIds = cart.items.map((i) => i.competitionId);
    const competitions = await Competition.find({ _id: { $in: competitionIds } })
      .select("_id title maxTicketsPerUser")
      .lean();
    competitionMap = new Map(
      competitions.map((c) => [c._id.toString(), c as unknown as CartCompetitionCacheEntry])
    );
  }

  const adjustments: CartAdjustment[] = [];

  // Batch-fetch stats + per-user owned counts for every item in a single
  // round-trip each, eliminating the previous N+1 (one aggregate + one count
  // per cart item). Existing per-competition helpers are wrapped to keep the
  // single-item call sites unchanged.
  const itemMetaInputs = cart.items.map((i) => {
    const compId = i.competitionId.toString();
    const competition = competitionMap.get(compId);
    return {
      id: compId,
      status: (competition?.status as string | undefined) ?? "active",
      maxTickets: competition?.maxTickets as number | undefined,
    };
  });
  const [statsMap, ownedMap] = await Promise.all([
    getCompetitionTicketStatsBatch(itemMetaInputs),
    countEffectiveOwnedByUserBatch(
      cart.items.map((i) => i.competitionId.toString()),
      userId
    ),
  ]);

  for (const item of cart.items) {
    const compId = item.competitionId.toString();
    const competition = competitionMap.get(compId);
    if (!competition) {
      log.debug(` applyCartAutoAdjustments: competition ${compId} not found in DB, skipping`);
      continue;
    }

    const stats = statsMap.get(compId);
    if (!stats) {
      log.debug(` applyCartAutoAdjustments: no stats for ${compId}, skipping`);
      continue;
    }
    const userOwned = ownedMap.get(compId) ?? 0;
    const maxPerUser = competition.maxTicketsPerUser ?? item.maxTicketsPerUser;

    // totalLimit = max tickets this user can own (purchased + cart combined)
    const totalLimit = maxPerUser > 0 ? Math.max(0, maxPerUser - userOwned) : stats.available;

    // available = how many are left in the pool OR personal limit, whichever is tighter
    const available = Math.min(stats.available, totalLimit);

    const previousQty = item.quantity;

    log.debug(
      ` applyCartAutoAdjustments: comp=${compId} qty=${item.quantity} stats.available=${stats.available} userOwned=${userOwned} maxPerUser=${maxPerUser} totalLimit=${totalLimit} available=${available}`
    );

    // Removed: user already owns their full limit AND competition is sold out / no avail
    if ((stats.available <= 0 || totalLimit <= 0) && item.quantity > 0) {
      const isMaxPerUser = maxPerUser > 0 && userOwned >= maxPerUser;
      const reason: CartAdjustment["reason"] = isMaxPerUser ? "max_per_user" : "availability";
      const message = isMaxPerUser
        ? `You've reached your limit of ${maxPerUser} tickets for this competition — removed from cart`
        : "This competition sold out — removed from cart";
      log.debug(
        ` applyCartAutoAdjustments: REMOVING item ${compId} reason=${reason} qty=${previousQty}`
      );
      cart.items = cart.items.filter((i) => i.competitionId.toString() !== compId);
      adjustments.push({
        id: makeAdjustmentId(reason, compId),
        competitionId: compId,
        competitionTitle: competition.title ?? "Unknown Competition",
        previousQuantity: previousQty,
        adjustedQuantity: 0,
        available: 0,
        maxPerUser,
        reason,
        message,
      });
    } else if (item.quantity > available) {
      // Adjusted down: cart has more tickets than this user can have
      const reason: CartAdjustment["reason"] =
        stats.available < item.quantity ? "availability" : "max_per_user";
      const adjustedQty = Math.max(0, available);
      const message =
        reason === "max_per_user"
          ? `You've reached your limit of ${maxPerUser} tickets for this competition — quantity adjusted from ${previousQty}`
          : `Only ${stats.available} ticket${stats.available !== 1 ? "s" : ""} left — quantity adjusted from ${previousQty}`;
      log.debug(
        ` applyCartAutoAdjustments: ADJUSTING item ${compId} from ${previousQty} to ${adjustedQty} reason=${reason}`
      );
      item.quantity = adjustedQty;
      adjustments.push({
        id: makeAdjustmentId(reason, compId),
        competitionId: compId,
        competitionTitle: competition.title ?? "Unknown Competition",
        previousQuantity: previousQty,
        adjustedQuantity: adjustedQty,
        available: stats.available,
        maxPerUser,
        reason,
        message,
      });
    }
  }

  log.debug(
    ` applyCartAutoAdjustments: done. ${adjustments.length} adjustments, ${cart.items.length} items remaining`
  );
  return { cart, adjustments };
}

export function isCompetitionAvailableForCart(competition: {
  status: string;
  drawDate?: Date | null;
  endDate?: Date | null;
}): boolean {
  return isOpenForTicketSales(competition);
}

export async function loadCompetitionForCartItem(competitionId: string) {
  return Competition.findById(competitionId)
    .select("status drawDate endDate maxTicketsPerUser questionOptions requireSignIn")
    .lean<{
      status: string;
      drawDate?: Date | null;
      endDate?: Date | null;
      maxTicketsPerUser?: number;
      questionOptions?: string[];
      requireSignIn?: boolean;
    }>();
}

export interface CartLineItemWithPrice {
  competitionId: string;
  competitionTitle: string;
  slug: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  answerIndex: number;
  imageUrl?: string;
  maxTicketsPerUser: number;
  status: string;
  drawDate?: Date | null;
}

export async function enrichCartItemsWithStatus(
  items: ICartItem[],
  competitionCache?: Map<string, CartCompetitionCacheEntry>,
  cart?: ICart
): Promise<CartLineItemWithPrice[]> {
  if (items.length === 0) {
    log.debug(" enrichCartItemsWithStatus: empty items array");
    return [];
  }

  let compById: Map<string, CartCompetitionCacheEntry>;

  if (competitionCache) {
    compById = competitionCache;
  } else {
    const competitionIds = items.map((i) => i.competitionId);
    const competitions = await Competition.find({ _id: { $in: competitionIds } })
      .select(
        "_id title slug ticketPrice imageUrl prizeImageUrl maxTicketsPerUser status drawDate originalPrice requireSignIn"
      )
      .lean();
    compById = new Map(
      competitions.map((c) => [c._id.toString(), c as unknown as CartCompetitionCacheEntry])
    );
  }

  const removedCompIds: mongoose.Types.ObjectId[] = [];
  const result: CartLineItemWithPrice[] = [];
  for (const item of items) {
    const comp = compById.get(item.competitionId.toString());
    if (!comp) {
      log.debug(
        ` enrichCartItemsWithStatus: competition ${item.competitionId} not found, skipping item`
      );
      removedCompIds.push(item.competitionId);
      continue;
    }
    result.push({
      competitionId: item.competitionId.toString(),
      competitionTitle: comp.title,
      slug: comp.slug,
      price: comp.ticketPrice,
      originalPrice: comp.originalPrice,
      quantity: item.quantity,
      answerIndex: item.answerIndex,
      imageUrl: comp.imageUrl ?? comp.prizeImageUrl,
      maxTicketsPerUser: comp.maxTicketsPerUser ?? item.maxTicketsPerUser,
      status: comp.status,
      drawDate: comp.drawDate,
    });
  }
  if (removedCompIds.length > 0 && cart) {
    log.warn(`[cart] removing ${removedCompIds.length} cart items for deleted competitions`);
    await Cart.updateOne(
      { _id: cart._id },
      { $pull: { items: { competitionId: { $in: removedCompIds } } } }
    );
  }

  log.debug(
    ` enrichCartItemsWithStatus: ${result.length} items enriched from ${items.length} cart items`
  );
  return result;
}

export interface ComputeCartTotalsResult {
  subtotal: number;
  walletTicketSavings: number;
  monetarySubtotal: number;
  total: number;
  walletReclampAdjustments: CartAdjustment[];
  clampedAllocations: WalletTicketAllocation[];
}

export async function computeCartTotals(
  cart: ICart,
  items: CartLineItemWithPrice[]
): Promise<ComputeCartTotalsResult> {
  let subtotal = 0;
  for (const item of items) {
    subtotal += item.price * item.quantity;
  }
  log.debug(
    ` computeCartTotals: subtotal=${subtotal} items=${items.length} discountAmount=${cart.discountAmount} discountType=${cart.discountType}`
  );

  const originalAllocations: WalletTicketAllocation[] = (cart.walletTicketsByCompetition ?? []).map(
    (w) => ({
      competitionId: w.competitionId.toString(),
      quantity: w.quantity,
    })
  );
  log.debug(` computeCartTotals: wallet allocations=${JSON.stringify(originalAllocations)}`);

  const itemsById = new Map(items.map((i) => [i.competitionId, i]));
  const priceById = new Map(items.map((i) => [i.competitionId, i.price]));

  const clampedAllocations: WalletTicketAllocation[] = [];
  const walletReclampAdjustments: CartAdjustment[] = [];

  for (const alloc of originalAllocations) {
    const item = itemsById.get(alloc.competitionId);
    if (!item) continue;
    const clamped = Math.max(0, Math.min(alloc.quantity, item.quantity));
    clampedAllocations.push({ competitionId: alloc.competitionId, quantity: clamped });
    if (clamped !== alloc.quantity) {
      walletReclampAdjustments.push({
        id: makeAdjustmentId("wallet_reclamp", alloc.competitionId),
        competitionId: alloc.competitionId,
        competitionTitle: item.competitionTitle,
        previousQuantity: alloc.quantity,
        adjustedQuantity: clamped,
        available: item.quantity,
        maxPerUser: item.maxTicketsPerUser,
        reason: "wallet_reclamp",
        message: "Wallet tickets reduced to match new quantity",
      });
    }
  }

  const checkoutItems = items.map((i) => ({
    competitionId: i.competitionId,
    quantity: i.quantity,
    answerIndex: i.answerIndex,
  }));
  const merged = mergeWalletIntoCheckoutItems(checkoutItems, clampedAllocations);

  let walletTicketSavings = 0;
  for (const m of merged) {
    const price = priceById.get(m.competitionId) ?? 0;
    walletTicketSavings += price * m.walletQty;
  }

  const monetarySubtotal = Math.max(0, subtotal - walletTicketSavings);

  const totalItems = merged.map((m) => ({
    price: priceById.get(m.competitionId) ?? 0,
    quantity: m.paidQty,
  }));

  const effectiveDiscount = resolveCartDisplayDiscount(
    cart,
    subtotal,
    monetarySubtotal
  );

  const total = computeTotal(
    totalItems,
    effectiveDiscount,
    cart.discountType,
    cart.referralDiscountAmount,
    cart.referralDiscountPercent
  );

  return {
    subtotal,
    walletTicketSavings,
    monetarySubtotal,
    total,
    walletReclampAdjustments,
    clampedAllocations,
  };
}

function resolveCartDisplayDiscount(
  cart: ICart,
  fullSubtotal: number,
  monetarySubtotal: number
): number {
  const paidBase = monetarySubtotal > 0 ? monetarySubtotal : fullSubtotal;
  if (cart.discountType === "percentage") {
    if (cart.promoCodeId && cart.promoDiscountPercent != null) {
      return paidBase * (cart.promoDiscountPercent / 100);
    }
    if (cart.referralDiscountPercent != null) {
      return paidBase * (cart.referralDiscountPercent / 100);
    }
  }
  if (cart.referralDiscountPercent != null && monetarySubtotal < fullSubtotal) {
    return monetarySubtotal * (cart.referralDiscountPercent / 100);
  }
  return cart.discountAmount ?? 0;
}

export interface FinalizeResult {
  cart: ICart;
  adjustments: CartAdjustment[];
  reclampedAllocations: CartWalletTicket[];
  enrichedItems: CartLineItemWithPrice[];
  profile: Record<string, any> | null;
  completedOrdersCount: number;
}

// cartVersion must reflect actual cart mutations, not read-time finalization.
// GET /api/cart runs finalizeCart on every poll, so snapshot the mutable state
// and only bump the counter when the cart content (items, wallet allocations,
// discount/referral fields) actually changed.
function cartMutationState(cart: ICart): string {
  return JSON.stringify([
    cart.items.map((i) => [
      i.competitionId.toString(),
      i.quantity,
      i.answerIndex,
      i.maxTicketsPerUser,
    ]),
    (cart.walletTicketsByCompetition ?? []).map((w) => [w.competitionId.toString(), w.quantity]),
    cart.discountAmount,
    cart.discountType,
    cart.promoCode,
    cart.promoCodeId?.toString(),
    cart.promoCodeGuestEligible,
    cart.promoDiscountPercent,
    cart.referralCode,
    cart.referralDiscountAmount,
    cart.referralDiscountPercent,
  ]);
}

// An emptied cart must not keep a stale promo/discount — otherwise the stored
// code gets silently re-applied the next time items are added.
function clearCartDiscountFields(cart: ICart): void {
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
}

export async function finalizeCart(
  userId: string,
  cart: ICart,
  _opts?: { force?: boolean }
): Promise<FinalizeResult> {
  log.debug(
    ` finalizeCart ENTER: userId=${userId} items.length=${cart.items.length} items=${JSON.stringify(cart.items.map((i) => ({ compId: i.competitionId.toString(), qty: i.quantity, answerIndex: i.answerIndex })))} wallet=${JSON.stringify((cart.walletTicketsByCompetition ?? []).map((w) => ({ compId: w.competitionId.toString(), qty: w.quantity })))}`
  );

  const stateBefore = cartMutationState(cart);

  let competitionCache: Map<string, CartCompetitionCacheEntry> | undefined;
  let profile: Record<string, any> | null = null;
  let completedOrdersCount = 0;

  if (cart.items.length > 0) {
    const competitionIds = cart.items.map((i) => i.competitionId);
    const competitions = await Competition.find({ _id: { $in: competitionIds } })
      .select(
        "_id status drawDate endDate maxTicketsPerUser maxTickets title slug ticketPrice originalPrice imageUrl prizeImageUrl"
      )
      .lean();
    competitionCache = new Map(
      competitions.map((c) => [c._id.toString(), c as unknown as CartCompetitionCacheEntry])
    );

    [profile, completedOrdersCount] = await Promise.all([
      Profile.findById(userId).lean(),
      Order.countDocuments({ userId, status: "completed" }).maxTimeMS(5000),
    ]);
  }

  await sanitizeCart(cart, competitionCache);

  if (cart.items.length === 0) {
    log.debug(` finalizeCart: items empty after sanitize, returning early`);
    clearCartDiscountFields(cart);
    if (cartMutationState(cart) !== stateBefore) {
      cart.cartVersion = (cart.cartVersion ?? 0) + 1;
      cart.lastFinalizedAt = new Date();
    }
    return {
      cart,
      adjustments: [],
      reclampedAllocations: [],
      enrichedItems: [],
      profile,
      completedOrdersCount,
    };
  }

  await ensureReferralDiscountOnCart(userId, cart, {
    competitionCache,
    profile,
    completedOrders: completedOrdersCount,
  });

  const { adjustments: autoAdjustments } = await applyCartAutoAdjustments(
    userId,
    cart,
    competitionCache
  );

  // applyCartAutoAdjustments can remove ALL items (sold-out / max-per-user),
  // leaving the cart empty AFTER the early-return above. Clear the stale
  // discount fields so a leftover promo isn't re-applied on the next add.
  if (cart.items.length === 0) {
    log.debug(` finalizeCart: items emptied by auto-adjust, clearing discount fields`);
    clearCartDiscountFields(cart);
    if (cartMutationState(cart) !== stateBefore) {
      cart.cartVersion = (cart.cartVersion ?? 0) + 1;
    }
    cart.lastFinalizedAt = new Date();
    return {
      cart,
      adjustments: autoAdjustments,
      reclampedAllocations: [],
      enrichedItems: [],
      profile,
      completedOrdersCount,
    };
  }

  const subtotal = await computeSubtotalForCartItems(cart.items, competitionCache);
  await recalculateCartDiscount(cart, subtotal, competitionCache);

  const items = await enrichCartItemsWithStatus(cart.items, competitionCache, cart);
  const { walletReclampAdjustments, clampedAllocations } = await computeCartTotals(cart, items);

  const adjustments = [...autoAdjustments, ...walletReclampAdjustments];

  const reclampedAllocations: CartWalletTicket[] = [];
  for (const clamped of clampedAllocations) {
    if (clamped.quantity <= 0) continue;
    const original = (cart.walletTicketsByCompetition ?? []).find(
      (w) => w.competitionId.toString() === clamped.competitionId
    );
    if (!original) continue;
    reclampedAllocations.push({
      competitionId: original.competitionId.toString(),
      quantity: clamped.quantity,
    });
  }

  if (cartMutationState(cart) !== stateBefore) {
    cart.cartVersion = (cart.cartVersion ?? 0) + 1;
  }
  cart.lastFinalizedAt = new Date();

  log.debug(
    ` finalizeCart EXIT: items.length=${cart.items.length} adjustments=${adjustments.length} reclampedAllocations=${reclampedAllocations.length} items=${JSON.stringify(cart.items.map((i) => ({ compId: i.competitionId.toString(), qty: i.quantity })))}`
  );
  if (adjustments.length > 0) {
    log.debug(` finalizeCart adjustments: ${JSON.stringify(adjustments)}`);
  }

  return {
    cart,
    adjustments,
    reclampedAllocations,
    enrichedItems: items,
    profile,
    completedOrdersCount,
  };
}

export type SaveCartResult =
  | { ok: true; cart: InstanceType<typeof Cart> }
  | { ok: false; conflict: true };

function isVersionError(err: unknown): boolean {
  return (
    err instanceof mongoose.Error.VersionError ||
    (err instanceof Error && err.name === "VersionError")
  );
}

export async function saveCartWithRetry(
  cart: InstanceType<typeof Cart>,
  reapplyChanges: (freshCart: InstanceType<typeof Cart>) => void | Promise<void>,
  maxRetries = 3
): Promise<SaveCartResult> {
  let current = cart;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      current.lastActivityAt = new Date();
      await current.save();
      return { ok: true, cart: current };
    } catch (err) {
      if (!isVersionError(err)) {
        throw err;
      }
      if (attempt >= maxRetries) {
        return { ok: false, conflict: true };
      }

      const fresh = await Cart.findById(current._id).exec();
      if (!fresh) {
        throw err;
      }

      await reapplyChanges(fresh);
      current = fresh;
    }
  }

  return { ok: false, conflict: true };
}

const log = createLogger("cart");
