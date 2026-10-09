import { Cart, Competition } from "@oc/api-db/models";
import { CheckoutError } from "@oc/api-errors";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { createLogger } from "@oc/api-logger";
import { normalizeAnswerIndex } from "@oc/api-payment-core";
import {
  mergeWalletIntoCheckoutItems,
  totalWalletTickets,
  type WalletTicketAllocation,
} from "@oc/api-tickets/wallet";
import { Types } from "mongoose";

export interface CheckoutLineItem {
  competitionId: string;
  quantity: number;
  answerIndex: number;
  walletQty?: number;
  paidQty?: number;
  status?: string;
  maxTickets?: number;
  maxTicketsPerUser?: number;
}

export interface LoadedCheckoutCart {
  items: CheckoutLineItem[];
  /** Full cart value before wallet tickets */
  subtotal: number;
  /** Cash subtotal after wallet tickets (before promo/referral discount) */
  paidSubtotal: number;
  referralBonusTickets: number;
  referralBalanceUsed: number;
  promoCode?: string;
  promoCodeId?: string;
  discountType?: string;
  promoDiscountPercent?: number;
  referralCode?: string;
}

export interface LoadCartParams {
  cartId?: string;
  userId: string;
  expectedCartVersion?: number;
}

async function normalizeCheckoutItems(
  rawItems: Array<{ competitionId: Types.ObjectId; quantity: number; answerIndex: number }>
): Promise<CheckoutLineItem[]> {
  if (rawItems.length === 0) return [];

  const competitionIds = rawItems.map((item) => item.competitionId);
  const competitions = await Competition.find({ _id: { $in: competitionIds } })
    .select("_id ticketPrice questionOptions status maxTickets maxTicketsPerUser")
    .lean();
  const optionsById = new Map(
    competitions.map((comp) => [comp._id.toString(), comp.questionOptions])
  );
  const compMetaById = new Map(
    competitions.map((comp) => [
      comp._id.toString(),
      {
        status: comp.status,
        maxTickets: comp.maxTickets,
        maxTicketsPerUser: comp.maxTicketsPerUser,
      },
    ])
  );

  return rawItems.map((item) => {
    const meta = compMetaById.get(item.competitionId.toString());
    return {
      competitionId: item.competitionId.toString(),
      quantity: item.quantity,
      answerIndex: normalizeAnswerIndex(
        item.answerIndex,
        optionsById.get(item.competitionId.toString())
      ),
      status: meta?.status,
      maxTickets: meta?.maxTickets,
      maxTicketsPerUser: meta?.maxTicketsPerUser,
    };
  });
}

function walletFromCart(
  walletTickets?: Array<{ competitionId: Types.ObjectId | string; quantity: number }>
): WalletTicketAllocation[] {
  if (!walletTickets?.length) return [];
  return walletTickets.map((w) => ({
    competitionId: w.competitionId.toString(),
    quantity: w.quantity,
  }));
}

async function buildLoadedCart(
  rawItems: Array<{ competitionId: Types.ObjectId; quantity: number; answerIndex: number }>,
  walletTickets: WalletTicketAllocation[],
  promoCode?: string,
  referralCode?: string,
  discountType?: string,
  promoDiscountPercent?: number,
  promoCodeId?: string
): Promise<LoadedCheckoutCart> {
  const items = await normalizeCheckoutItems(rawItems);
  const competitionIds = items.map((item) => item.competitionId);
  const competitions = await Competition.find({ _id: { $in: competitionIds } })
    .select("_id ticketPrice status maxTickets maxTicketsPerUser")
    .lean();
  const priceById = new Map(competitions.map((comp) => [comp._id.toString(), comp.ticketPrice]));
  const metaById = new Map(
    competitions.map((comp) => [
      comp._id.toString(),
      {
        status: comp.status,
        maxTickets: comp.maxTickets,
        maxTicketsPerUser: comp.maxTicketsPerUser,
      },
    ])
  );

  let fullSubtotal = 0;
  for (const item of items) {
    const ticketPrice = priceById.get(item.competitionId);
    if (ticketPrice == null) {
      throw new CheckoutError(
        ErrorCodes.NOT_FOUND,
        `Competition ${item.competitionId} not found`,
        404
      );
    }
    fullSubtotal += ticketPrice * item.quantity;
  }

  log.debug("[loadCart.mergeWallet]", {
    rawItemsCount: items.length,
    walletTicketsCount: walletTickets.length,
  });
  const withWallet = mergeWalletIntoCheckoutItems(items, walletTickets);
  const itemsWithPaidQty = withWallet.filter((i) => i.paidQty !== undefined && i.paidQty > 0);
  log.debug("[loadCart.mergeWallet.result]", {
    outputItemsCount: withWallet.length,
    itemsWithPaidQty: itemsWithPaidQty.length,
    itemsWithPaidQtyDetails: itemsWithPaidQty.map((i) => ({
      competitionId: i.competitionId,
      paidQty: i.paidQty,
    })),
  });
  let monetarySubtotal = 0;
  for (const item of withWallet) {
    const ticketPrice = priceById.get(item.competitionId)!;
    const qty = Number(item.paidQty) || 0;
    monetarySubtotal += ticketPrice * qty;
  }

  const checkoutItems: CheckoutLineItem[] = withWallet.map((item) => {
    const meta = metaById.get(item.competitionId);
    return {
      competitionId: item.competitionId,
      quantity: item.quantity,
      answerIndex: item.answerIndex,
      walletQty: item.walletQty,
      paidQty: item.paidQty,
      status: meta?.status,
      maxTickets: meta?.maxTickets,
      maxTicketsPerUser: meta?.maxTicketsPerUser,
    };
  });

  const walletTicketCount = totalWalletTickets(withWallet);

  const result = {
    items: checkoutItems,
    subtotal: fullSubtotal,
    paidSubtotal: monetarySubtotal,
    referralBonusTickets: walletTicketCount,
    referralBalanceUsed: walletTicketCount,
    promoCode,
    promoCodeId,
    discountType,
    promoDiscountPercent,
    referralCode,
  };
  log.debug("[loadCart.exit]", {
    keys: Object.keys(result),
    itemsCount: result.items.length,
    subtotal: result.subtotal,
    paidSubtotal: result.paidSubtotal,
    referralBonusTickets: result.referralBonusTickets,
    promoCode: result.promoCode,
    referralCode: result.referralCode,
  });
  return result;
}

export async function loadCartForCheckout(params: LoadCartParams): Promise<LoadedCheckoutCart> {
  log.debug("[loadCart.enter]", { userId: params.userId, cartId: params.cartId });
  const { cartId, userId } = params;

  if (cartId) {
    const cart = await Cart.findById(cartId).lean();
    if (!cart) {
      throw new CheckoutError(ErrorCodes.NOT_FOUND, "Cart not found", 404);
    }
    if (cart.userId?.toString() !== userId) {
      throw new CheckoutError(ErrorCodes.FORBIDDEN, "Cart does not belong to you", 403);
    }

    if (params.expectedCartVersion != null && cart.cartVersion !== params.expectedCartVersion) {
      // cartVersion is not a reliable optimistic-concurrency token: it is
      // bumped on read-time finalize/save, so a stale client value must not
      // hard-block checkout with a 409. Log and proceed with the authoritative
      // cart contents instead.
      log.warn(
        `[loadCart.enter] expectedCartVersion ${params.expectedCartVersion} !== cart.cartVersion ${cart.cartVersion} — proceeding`
      );
    }

    return buildLoadedCart(
      cart.items,
      walletFromCart(cart.walletTicketsByCompetition),
      cart.promoCode,
      cart.referralCode,
      cart.discountType ?? undefined,
      (cart as any).promoDiscountPercent,
      cart.promoCodeId?.toString()
    );
  }

  const cart = await Cart.findOne({ userId: new Types.ObjectId(userId) }).lean();
  if (!cart || cart.items.length === 0) {
    throw new CheckoutError(ErrorCodes.CHECKOUT_ERROR, "No items to fulfill", 400);
  }

  if (params.expectedCartVersion != null && cart.cartVersion !== params.expectedCartVersion) {
    // See above — a stale cartVersion must not block checkout.
    log.warn(
      `[loadCart.enter] expectedCartVersion ${params.expectedCartVersion} !== cart.cartVersion ${cart.cartVersion} — proceeding`
    );
  }

  return buildLoadedCart(
    cart.items,
    walletFromCart(cart.walletTicketsByCompetition),
    cart.promoCode,
    cart.referralCode,
    cart.discountType ?? undefined,
    (cart as any).promoDiscountPercent,
    cart.promoCodeId?.toString()
  );
}

export async function clearCheckoutCart(cartId?: string): Promise<void> {
  if (cartId) {
    await Cart.findByIdAndDelete(cartId);
    return;
  }
}

export async function clearCheckoutCartFromMetadata(
  metadata?: Record<string, unknown>,
  userId?: string
): Promise<void> {
  const cartId = metadata?.cartId;
  if (typeof cartId === "string" && cartId.length > 0) {
    await clearCheckoutCart(cartId);
    return;
  }

  if (userId) {
    await clearUserCart(userId);
  }
}

export async function clearUserCart(userId: string): Promise<void> {
  await Cart.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) },
    {
      $set: {
        items: [],
        walletTicketsByCompetition: [],
        promoCode: null,
        promoCodeId: null,
        promoDiscountPercent: null,
        referralCode: null,
        referralDiscountAmount: null,
        referralDiscountPercent: null,
        discountAmount: 0,
        discountType: null,
      },
    }
  );
}

const log = createLogger("cart");
