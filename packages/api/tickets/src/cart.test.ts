import type { ICartItem } from "@oc/api-db/models";
import { Cart, Competition } from "@oc/api-db/models";
import { Types } from "mongoose";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const __mockHelpers = vi.hoisted(() => {
  function mockLeanQuery(resolved: unknown) {
    const chain: Record<string, unknown> = {
      select: vi.fn(() => chain),
      lean: vi.fn(async () => resolved),
      exec: vi.fn(async () => resolved),
    };
    return chain;
  }
  return { mockLeanQuery };
});

vi.mock("@oc/api-db/models", () => ({
  Cart: {
    findById: vi.fn(() => __mockHelpers.mockLeanQuery(null)),
    findOne: vi.fn(() => __mockHelpers.mockLeanQuery(null)),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
  Competition: {
    find: vi.fn(() => __mockHelpers.mockLeanQuery([])),
  },
  Order: {
    countDocuments: vi.fn(() => ({
      maxTimeMS: vi.fn().mockResolvedValue(0),
    })),
  },
  Profile: {
    findById: vi.fn(() => ({ lean: async () => null })),
  },
  ReferralSettings: null,
}));

vi.mock("@oc/api-logger", () => ({
  createLogger: vi.fn(() => ({ debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() })),
}));

const mockEnrichCartItems = vi.hoisted(() => vi.fn());
const mockCheckAvailability = vi.hoisted(() => vi.fn());
const mockCountOwnedByUserBatch = vi.hoisted(() => vi.fn());
const mockCountEffectiveOwnedByUserBatch = vi.hoisted(() => vi.fn());
const mockGetCompetitionTicketStatsBatch = vi.hoisted(() => vi.fn());
const mockMergeWalletIntoCheckoutItems = vi.hoisted(() => vi.fn());

vi.mock("@oc/api-tickets/cart-enrichment", () => ({
  enrichCartItems: mockEnrichCartItems,
}));

vi.mock("@oc/api-tickets/ticket-service", () => ({
  checkAvailability: mockCheckAvailability,
  countOwnedByUserBatch: mockCountOwnedByUserBatch,
  countEffectiveOwnedByUserBatch: mockCountEffectiveOwnedByUserBatch,
  getCompetitionTicketStatsBatch: mockGetCompetitionTicketStatsBatch,
}));

vi.mock("@oc/api-tickets/wallet", () => ({
  mergeWalletIntoCheckoutItems: mockMergeWalletIntoCheckoutItems,
  totalWalletTickets: vi.fn(() => 0),
}));

vi.mock("@oc/api-tickets/promo-codes", () => ({
  validatePromoCode: vi.fn(),
  validateReferralCode: vi.fn(),
  releasePromoCodeUsage: vi.fn(),
  reservePromoCodeUsage: vi.fn(),
}));

vi.mock("@oc/api-errors", () => ({
  CheckoutError: class extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number
    ) {
      super(message);
      this.name = "CheckoutError";
    }
  },
}));

vi.mock("@oc/api-infra/error-codes", () => ({
  ErrorCodes: {
    CONFLICT: "CONFLICT",
    NOT_FOUND: "NOT_FOUND",
    FORBIDDEN: "FORBIDDEN",
    CHECKOUT_ERROR: "CHECKOUT_ERROR",
  },
}));

vi.mock("@oc/api-payment-core", () => ({
  normalizeAnswerIndex: vi.fn((idx: number) => idx),
}));

import {
  computeCartTotals,
  computeSubtotal,
  computeTotal,
  finalizeCart,
  mergeCartItem,
  saveCartWithRetry,
} from "@oc/api-tickets/cart";
import { loadCartForCheckout } from "@oc/api-tickets/load-cart";

describe("computeSubtotal", () => {
  test("sums price * quantity for all items", () => {
    expect(
      computeSubtotal([
        { price: 10, quantity: 2 },
        { price: 5, quantity: 3 },
      ])
    ).toBe(35);
  });

  test("returns 0 for empty array", () => {
    expect(computeSubtotal([])).toBe(0);
  });

  test("handles zero and missing values safely", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(computeSubtotal([{ price: 0, quantity: 5 } as any])).toBe(0);
  });
});

describe("computeTotal", () => {
  const items = [{ price: 50, quantity: 2 }];

  test("subtracts discount amount from subtotal", () => {
    expect(computeTotal(items, 20, null)).toBe(80);
  });

  test("uses referral discount when no primary discount given", () => {
    expect(computeTotal(items, 0, null, 15)).toBe(85);
  });

  test("uses referral percent when no other discount given", () => {
    expect(computeTotal(items, 0, null, undefined, 10)).toBe(90);
  });

  test("primary discount takes precedence over referral", () => {
    expect(computeTotal(items, 20, null, 15)).toBe(80);
  });

  test("never returns negative", () => {
    expect(computeTotal(items, 200, null)).toBe(0);
  });

  test("returns subtotal when no discount", () => {
    expect(computeTotal(items, 0, null)).toBe(100);
  });
});

describe("mergeCartItem", () => {
  const compA = new Types.ObjectId();
  const compB = new Types.ObjectId();

  test("adds item when competition not in cart", () => {
    const items: ICartItem[] = [
      { competitionId: compA, quantity: 2, answerIndex: 0, maxTicketsPerUser: 10 },
    ];
    const newItem: ICartItem = {
      competitionId: compB,
      quantity: 3,
      answerIndex: 0,
      maxTicketsPerUser: 5,
    };

    const result = mergeCartItem(items, newItem);
    expect(result).toHaveLength(2);
    expect(result[1]?.quantity).toBe(3);
  });

  test("merges quantities for same competition", () => {
    const items: ICartItem[] = [
      { competitionId: compA, quantity: 2, answerIndex: 0, maxTicketsPerUser: 10 },
    ];
    const newItem: ICartItem = {
      competitionId: compA,
      quantity: 3,
      answerIndex: 1,
      maxTicketsPerUser: 10,
    };

    const result = mergeCartItem(items, newItem);
    expect(result).toHaveLength(1);
    expect(result[0]?.quantity).toBe(5);
  });

  test("caps merged quantity at maxTicketsPerUser", () => {
    const items: ICartItem[] = [
      { competitionId: compA, quantity: 8, answerIndex: 0, maxTicketsPerUser: 10 },
    ];
    const newItem: ICartItem = {
      competitionId: compA,
      quantity: 5,
      answerIndex: 0,
      maxTicketsPerUser: 10,
    };

    const result = mergeCartItem(items, newItem);
    expect(result[0]?.quantity).toBe(10);
  });

  test("updates answerIndex and maxTicketsPerUser from new item", () => {
    const items: ICartItem[] = [
      { competitionId: compA, quantity: 1, answerIndex: 0, maxTicketsPerUser: 10 },
    ];
    const newItem: ICartItem = {
      competitionId: compA,
      quantity: 1,
      answerIndex: 2,
      maxTicketsPerUser: 15,
    };

    const result = mergeCartItem(items, newItem);
    expect(result[0]?.answerIndex).toBe(2);
    expect(result[0]?.maxTicketsPerUser).toBe(15);
  });
});

describe("computeCartTotals", () => {
  const compId = new Types.ObjectId().toString();

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("computes subtotal, wallet savings, and total", async () => {
    mockMergeWalletIntoCheckoutItems.mockReturnValue([
      { competitionId: compId, walletQty: 1, paidQty: 2 },
    ]);

    const cart = {
      items: [],
      discountAmount: 10,
      discountType: "fixed" as const,
      referralDiscountAmount: undefined,
      referralDiscountPercent: undefined,
      walletTicketsByCompetition: [{ competitionId: new Types.ObjectId(), quantity: 1 }],
    };

    const items = [
      {
        competitionId: compId,
        competitionTitle: "Test Comp",
        slug: "test-comp",
        price: 20,
        quantity: 3,
        answerIndex: 0,
        maxTicketsPerUser: 10,
        status: "active",
      },
    ];

    const result = await computeCartTotals(cart, items);

    expect(result.subtotal).toBe(60);
    expect(result.walletTicketSavings).toBe(20);
    expect(result.monetarySubtotal).toBe(40);
    expect(result.total).toBe(30);
  });

  test("handles empty wallet allocations", async () => {
    mockMergeWalletIntoCheckoutItems.mockReturnValue([
      { competitionId: compId, walletQty: 0, paidQty: 3 },
    ]);

    const cart = {
      items: [],
      discountAmount: 0,
      discountType: null,
      referralDiscountAmount: undefined,
      referralDiscountPercent: undefined,
      walletTicketsByCompetition: [],
    };

    const items = [
      {
        competitionId: compId,
        competitionTitle: "Test Comp",
        slug: "test-comp",
        price: 20,
        quantity: 3,
        answerIndex: 0,
        maxTicketsPerUser: 10,
        status: "active",
      },
    ];

    const result = await computeCartTotals(cart, items);

    expect(result.subtotal).toBe(60);
    expect(result.walletTicketSavings).toBe(0);
    expect(result.monetarySubtotal).toBe(60);
    expect(result.total).toBe(60);
  });
});

describe("finalizeCart cartVersion", () => {
  const compId = new Types.ObjectId();

  beforeEach(() => {
    mockEnrichCartItems.mockResolvedValue([{ price: 10, quantity: 1 }]);
    mockCountOwnedByUserBatch.mockResolvedValue(new Map([[compId.toString(), 0]]));
    mockCountEffectiveOwnedByUserBatch.mockResolvedValue(new Map([[compId.toString(), 0]]));
    mockGetCompetitionTicketStatsBatch.mockResolvedValue(
      new Map([[compId.toString(), { available: 100 }]])
    );
    mockMergeWalletIntoCheckoutItems.mockReturnValue([
      { competitionId: compId.toString(), walletQty: 0, paidQty: 1 },
    ]);
    const compData = [
      {
        _id: compId,
        title: "Test Comp",
        slug: "test-comp",
        ticketPrice: 10,
        status: "active",
        maxTicketsPerUser: 10,
        maxTickets: 100,
        drawDate: null,
        imageUrl: null,
      },
    ];
    (vi.mocked(Competition.find) as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      select: vi.fn(() => ({
        lean: vi.fn(async () => compData),
        exec: vi.fn(async () => compData),
      })),
      lean: vi.fn(async () => compData),
      exec: vi.fn(async () => compData),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("does not increment cartVersion when nothing changed (cartVersion 0)", async () => {
    const cart: Record<string, unknown> = {
      items: [
        {
          competitionId: compId,
          quantity: 1,
          answerIndex: 0,
          maxTicketsPerUser: 10,
        },
      ],
      discountAmount: 0,
      discountType: null,
      promoCodeId: undefined,
      promoCode: undefined,
      referralCode: undefined,
      referralDiscountAmount: undefined,
      referralDiscountPercent: undefined,
      walletTicketsByCompetition: [],
      cartVersion: 0,
    };

    const result = await finalizeCart("user_id", cart as never);

    expect(result.cart.cartVersion).toBe(0);
  });

  test("does not increment cartVersion when nothing changed (existing value)", async () => {
    const cart: Record<string, unknown> = {
      items: [
        {
          competitionId: compId,
          quantity: 1,
          answerIndex: 0,
          maxTicketsPerUser: 10,
        },
      ],
      discountAmount: 0,
      discountType: null,
      promoCodeId: undefined,
      promoCode: undefined,
      referralCode: undefined,
      referralDiscountAmount: undefined,
      referralDiscountPercent: undefined,
      walletTicketsByCompetition: [],
      cartVersion: 5,
    };

    const result = await finalizeCart("user_id", cart as never);

    expect(result.cart.cartVersion).toBe(5);
  });

  test("increments cartVersion when cart content changes (quantity clamped)", async () => {
    const cart: Record<string, unknown> = {
      items: [
        {
          competitionId: compId,
          quantity: 15,
          answerIndex: 0,
          maxTicketsPerUser: 10,
        },
      ],
      discountAmount: 0,
      discountType: null,
      promoCodeId: undefined,
      promoCode: undefined,
      referralCode: undefined,
      referralDiscountAmount: undefined,
      referralDiscountPercent: undefined,
      walletTicketsByCompetition: [],
      cartVersion: 0,
    };

    const result = await finalizeCart("user_id", cart as never);

    expect(result.cart.cartVersion).toBe(1);
  });

  test("clears stale promo/discount fields when the cart becomes empty", async () => {
    const cart: Record<string, unknown> = {
      items: [],
      discountAmount: 3.3,
      discountType: "percentage",
      promoCode: "CAYENNE",
      promoCodeId: new Types.ObjectId(),
      promoCodeGuestEligible: true,
      promoDiscountPercent: 40,
      referralCode: "REF",
      referralDiscountAmount: 1,
      referralDiscountPercent: 10,
      walletTicketsByCompetition: [{ competitionId: compId, quantity: 2 }],
      cartVersion: 4,
      markModified: vi.fn(),
    };

    const result = await finalizeCart("user_id", cart as never);

    expect(result.cart.promoCode).toBeUndefined();
    expect(result.cart.promoCodeId).toBeUndefined();
    expect(result.cart.promoCodeGuestEligible).toBeUndefined();
    expect(result.cart.promoDiscountPercent).toBeUndefined();
    expect(result.cart.referralCode).toBeUndefined();
    expect(result.cart.referralDiscountAmount).toBeUndefined();
    expect(result.cart.referralDiscountPercent).toBeUndefined();
    expect(result.cart.discountAmount).toBe(0);
    expect(result.cart.discountType).toBeNull();
    expect(result.cart.walletTicketsByCompetition).toEqual([]);
  });

  test("clears stale promo fields when auto-adjust empties the cart", async () => {
    // Override stats so applyCartAutoAdjustments removes the only item
    // (sold out) AFTER the empty-early-return — the gap this fix closes.
    mockGetCompetitionTicketStatsBatch.mockResolvedValue(
      new Map([[compId.toString(), { available: 0 }]])
    );

    const cart: Record<string, unknown> = {
      items: [
        {
          competitionId: compId,
          quantity: 1,
          answerIndex: 0,
          maxTicketsPerUser: 10,
        },
      ],
      discountAmount: 3.3,
      discountType: "percentage",
      promoCode: "CAYENNE",
      promoCodeId: new Types.ObjectId(),
      promoCodeGuestEligible: true,
      promoDiscountPercent: 40,
      walletTicketsByCompetition: [],
      cartVersion: 5,
      markModified: vi.fn(),
    };

    const result = await finalizeCart("user_id", cart as never);

    expect(result.cart.items).toEqual([]);
    expect(result.cart.promoCode).toBeUndefined();
    expect(result.cart.promoCodeId).toBeUndefined();
    expect(result.cart.promoDiscountPercent).toBeUndefined();
    expect(result.cart.discountAmount).toBe(0);
    expect(result.cart.cartVersion).toBe(6);
    expect(result.adjustments.length).toBeGreaterThan(0);
  });
});

describe("saveCartWithRetry persistence", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("persists without bumping cartVersion (finalizeCart owns the version)", async () => {
    const mockSave = vi.fn().mockResolvedValue(undefined);
    const cart = {
      _id: new Types.ObjectId(),
      cartVersion: 0,
      lastActivityAt: new Date(),
      save: mockSave,
    };

    const result = await saveCartWithRetry(cart as never, vi.fn());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cart.cartVersion).toBe(0);
    }
  });

  test("preserves the existing cartVersion on save", async () => {
    const mockSave = vi.fn().mockResolvedValue(undefined);
    const cart = {
      _id: new Types.ObjectId(),
      cartVersion: 3,
      lastActivityAt: new Date(),
      save: mockSave,
    };

    const result = await saveCartWithRetry(cart as never, vi.fn());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cart.cartVersion).toBe(3);
    }
  });
});

describe("loadCartForCheckout expectedCartVersion", () => {
  const cartId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();

  beforeEach(() => {
    mockMergeWalletIntoCheckoutItems.mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("proceeds when expectedCartVersion does not match (cartId path)", async () => {
    (vi.mocked(Cart.findById) as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      select: vi.fn(() => ({
        lean: vi.fn(async () => ({
          _id: cartId,
          userId: new Types.ObjectId(userId),
          cartVersion: 1,
          items: [],
          walletTicketsByCompetition: [],
        })),
        exec: vi.fn(),
      })),
      lean: vi.fn(async () => ({
        _id: cartId,
        userId: new Types.ObjectId(userId),
        cartVersion: 1,
        items: [],
        walletTicketsByCompetition: [],
      })),
      exec: vi.fn(),
    }));

    const result = await loadCartForCheckout({ cartId, userId, expectedCartVersion: 2 });

    expect(result.items).toEqual([]);
  });

  test("passes when expectedCartVersion matches (cartId path)", async () => {
    (vi.mocked(Cart.findById) as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      select: vi.fn(() => ({
        lean: vi.fn(async () => ({
          _id: cartId,
          userId: new Types.ObjectId(userId),
          cartVersion: 2,
          items: [],
          walletTicketsByCompetition: [],
        })),
        exec: vi.fn(),
      })),
      lean: vi.fn(async () => ({
        _id: cartId,
        userId: new Types.ObjectId(userId),
        cartVersion: 2,
        items: [],
        walletTicketsByCompetition: [],
      })),
      exec: vi.fn(),
    }));

    const result = await loadCartForCheckout({
      cartId,
      userId,
      expectedCartVersion: 2,
    });

    expect(result.items).toEqual([]);
  });
});
