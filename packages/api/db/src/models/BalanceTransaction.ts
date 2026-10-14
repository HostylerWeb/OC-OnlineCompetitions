import mongoose, { type Document, Schema } from "mongoose";
import { m } from "../db";

export type BalanceTransactionType =
  | "top_up"
  | "withdraw"
  | "withdraw_reversed"
  | "purchase"
  | "purchase_refund"
  | "admin_credit"
  | "admin_debit"
  | "prize_credit";

export type BalanceTransactionStatus = "pending" | "completed" | "failed" | "reversed";

export interface IBalanceTransaction extends Document {
  userId: mongoose.Types.ObjectId;
  type: BalanceTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  status: BalanceTransactionStatus;
  orderId?: mongoose.Types.ObjectId;
  paymentProviderTransactionId?: string;
  withdrawReference?: string;
  note?: string;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BalanceTransactionSchema = new Schema<IBalanceTransaction>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: "Profile" },
    type: {
      type: String,
      required: true,
      enum: [
        "top_up",
        "withdraw",
        "withdraw_reversed",
        "purchase",
        "purchase_refund",
        "admin_credit",
        "admin_debit",
        "prize_credit",
      ],
    },
    amount: { type: Number, required: true },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    status: {
      type: String,
      required: true,
      enum: ["pending", "completed", "failed", "reversed"],
      default: "pending",
    },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    paymentProviderTransactionId: { type: String },
    withdrawReference: { type: String },
    note: { type: String },
    idempotencyKey: { type: String },
  },
  { timestamps: true }
);

BalanceTransactionSchema.index({ userId: 1, createdAt: -1 });
BalanceTransactionSchema.index({ orderId: 1 });
BalanceTransactionSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 90 * 24 * 60 * 60,
    partialFilterExpression: { status: { $in: ["pending", "failed"] } },
  }
);
BalanceTransactionSchema.index({ userId: 1, idempotencyKey: 1 }, { sparse: true, unique: true });

export const BalanceTransaction = m<IBalanceTransaction>(
  "BalanceTransaction",
  BalanceTransactionSchema
);
