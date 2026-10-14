import { z } from "zod";
import { ukCountryCodeOptionalSchema } from "./address";

export const addCartItemSchema = z.object({
  competitionId: z.string().min(1, "competitionId is required"),
  quantity: z.number().int().min(1, "quantity must be at least 1"),
  answerIndex: z.number().int().min(0).optional(),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1, "quantity must be at least 1"),
  answerIndex: z.number().int().min(0).optional(),
});

export const walletTicketAllocationSchema = z.object({
  competitionId: z.string().min(1),
  quantity: z.number().int().min(0),
});

export const applyCartWalletSchema = z.object({
  walletTicketsByCompetition: z.array(walletTicketAllocationSchema).optional(),
});

export const applyDiscountSchema = z.object({
  code: z.string().min(1, "code is required"),
  codeType: z.enum(["promo", "referral", "pending_referral"]).optional(),
});

const checkoutPhoneSchema = z.string().trim().min(5, "Phone number is required").max(30);

export const createPaymentSessionSchema = z.object({
  provider: z.string().optional(),
  contact: z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().email().optional(),
      phone: checkoutPhoneSchema,
    })
    .optional(),
  shipping: z
    .object({
      addressLine1: z.string().min(1),
      addressLine2: z.string().optional(),
      city: z.string().min(1),
      postcode: z.string().min(1),
      country: ukCountryCodeOptionalSchema,
    })
    .optional(),
  cartId: z.string().optional(),
  expectedCartVersion: z.number().int().optional(),
  idempotencyKey: z.string().optional(),
  paymentIntentId: z.string().optional(),
  returnUrl: z.string().url().optional(),
  compliance: z
    .object({
      dob: z.string().optional(),
    })
    .optional(),
  applySiteCredit: z.boolean().optional(),
});

export const updateOrderStatusSchema = z
  .object({
    status: z.enum(["pending", "processing", "completed", "failed", "refunded"]),
    reason: z.string().optional(),
  })
  .refine((data) => data.status !== "refunded" || (data.reason && data.reason.length > 0), {
    message: "Reason is required when refunding an order",
    path: ["reason"],
  });

export const balanceTopUpSchema = z.object({
  amount: z.number().positive("amount must be positive"),
  idempotencyKey: z.string().optional(),
});

export const balanceWithdrawSchema = z.object({
  amount: z.number().min(1, "amount must be at least 1"),
  reference: z.string().optional(),
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type ApplyCartWalletInput = z.infer<typeof applyCartWalletSchema>;
export type ApplyDiscountInput = z.infer<typeof applyDiscountSchema>;
export type CreatePaymentSessionInput = z.infer<typeof createPaymentSessionSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type BalanceTopUpInput = z.infer<typeof balanceTopUpSchema>;
export type BalanceWithdrawInput = z.infer<typeof balanceWithdrawSchema>;
