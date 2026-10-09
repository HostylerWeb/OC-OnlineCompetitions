import { Balance, BalanceTransaction, ComplianceAuditLog, Profile } from "@oc/api-db/models";
import {
  assertNotEffectivelySelfExcluded,
  reconcileSelfExclusionOnRead,
} from "@oc/api-compliance/compliance-user-service";
import { getComplianceSettings } from "@oc/api-compliance/settings";
import dbConnect from "@oc/api-infra/db";
import { getRedis } from "@oc/api-infra/cache/redis";
import { getCurrentContext } from "@oc/api-infra/env";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { parsePagination } from "@oc/api-infra/pagination";
import { error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { isLocalPaymentAllowed } from "@oc/api-server/lib/payment/local-payment-policy";
import { auth } from "@oc/api-server/middleware/auth";
import { validateBody } from "@oc/api-validation";
import { getEnv } from "@oc/env/server";
import {
  type BalanceTopUpInput,
  type BalanceWithdrawInput,
  balanceTopUpSchema,
  balanceWithdrawSchema,
} from "@oc/api-validation/schemas/orders";

import { Hono } from "hono";
import mongoose from "mongoose";

const app = new Hono();

app.use("*", auth);

app.get("/", async (c) => {
  try {
    const userId = c.get("userId")!;
    await dbConnect();

    let balance = await Balance.findOne({ userId: new mongoose.Types.ObjectId(userId) }).lean();
    if (!balance) {
      balance = await Balance.create({
        _id: new mongoose.Types.ObjectId(),
        userId: new mongoose.Types.ObjectId(userId),
        available: 0,
        pending: 0,
        currency: "GBP",
      });
    }

    return success(c, balance);
  } catch (err: unknown) {
    console.error("Error fetching balance:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "balance.get",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/transactions", async (c) => {
  try {
    const userId = c.get("userId")!;
    const { limit, page, skip } = parsePagination(c);
    await dbConnect();

    const [transactions, total] = await Promise.all([
      BalanceTransaction.find({ userId: new mongoose.Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BalanceTransaction.countDocuments({ userId: new mongoose.Types.ObjectId(userId) }).maxTimeMS(
        5000
      ),
    ]);

    return paginated(c, transactions, total, page, limit);
  } catch (err: unknown) {
    console.error("Error fetching transactions:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "balance.transactions",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post(
  "/top-up",
  async (c, next) => validateBody(c, next, balanceTopUpSchema),
  async (c) => {
    try {
      const userId = c.get("userId")!;
      const { frontendUrl } = getCurrentContext();
      await dbConnect();

      const body = c.get("body") as BalanceTopUpInput;
      const { amount, idempotencyKey } = body;

      if (!isLocalPaymentAllowed()) {
        return error(
          c,
          ErrorCodes.PAYMENT_DISABLED,
          "Balance top-up is not available in this environment",
          403
        );
      }

      const profile = await Profile.findById(userId).lean();
      if (!profile) {
        return error(c, ErrorCodes.NOT_FOUND, "Profile not found", 404);
      }

      const { createLocalBalanceTopUpSession } = await import(
        "@oc/api-server/lib/payment/providers/local"
      );

      const existingBalance = await Balance.findOne({
        userId: new mongoose.Types.ObjectId(userId),
      }).lean();
      let balanceSnapshot: { available: number };
      if (!existingBalance) {
        const created = await Balance.create({
          _id: new mongoose.Types.ObjectId(),
          userId: new mongoose.Types.ObjectId(userId),
          available: 0,
          pending: 0,
          currency: "GBP",
        });
        balanceSnapshot = { available: (created as any).available };
      } else {
        balanceSnapshot = { available: existingBalance.available };
      }

      let transaction;
      const pendingTopUpId = new mongoose.Types.ObjectId();
      const topUpIdempotencyKey =
        idempotencyKey ?? `top-up-pending:${pendingTopUpId.toString()}`;
      try {
        transaction = await BalanceTransaction.create({
          _id: pendingTopUpId,
          userId: new mongoose.Types.ObjectId(userId),
          type: "top_up",
          amount,
          balanceBefore: balanceSnapshot.available,
          balanceAfter: balanceSnapshot.available + amount,
          status: "pending",
          note: `Top-up initiated: £${amount.toFixed(2)}`,
          idempotencyKey: topUpIdempotencyKey,
        });
      } catch (err: unknown) {
        if (
          idempotencyKey &&
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code: number }).code === 11000
        ) {
          const existing = await BalanceTransaction.findOne({
            idempotencyKey,
            userId: new mongoose.Types.ObjectId(userId),
          }).lean();
          if (existing) {
            return success(c, { transaction: existing });
          }
        }
        throw err;
      }

      const session = await createLocalBalanceTopUpSession({
        amount,
        userId,
        userEmail: profile.email,
        transactionId: transaction._id.toString(),
        frontendUrl,
      });

      return success(c, {
        sessionId: session.sessionId,
        redirectUrl: session.redirectUrl,
        transactionId: transaction._id.toString(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create top-up session";
      console.error("Top-up error:", message);
      return error(c, ErrorCodes.TOP_UP_ERROR, message, 500);
    }
  }
);

app.post(
  "/withdraw",
  async (c, next) => validateBody(c, next, balanceWithdrawSchema),
  async (c) => {
    try {
      const userId = c.get("userId")!;
      await dbConnect();

      const body = c.get("body") as BalanceWithdrawInput;
      const { amount, reference } = body;

      await reconcileSelfExclusionOnRead(userId);
      const profile = await Profile.findById(userId).lean();
      if (!profile) {
        return error(c, ErrorCodes.NOT_FOUND, "Profile not found", 404);
      }
      const settings = await getComplianceSettings();
      try {
        assertNotEffectivelySelfExcluded(profile, settings);
      } catch {
        return error(
          c,
          ErrorCodes.ACCOUNT_SELF_EXCLUDED,
          "Withdrawals are not available while self-exclusion is active",
          403
        );
      }

      const authUser = c.get("user");
      if (authUser && authUser.emailVerified === false) {
        return error(
          c,
          ErrorCodes.FORBIDDEN,
          "Verify your email before requesting a withdrawal",
          403
        );
      }

      const redis = await getRedis();
      if (redis) {
        const dayKey = new Date().toISOString().slice(0, 10);
        const withdrawKey = `wallet:withdraw:${userId}:${dayKey}`;
        const count = await redis.incr(withdrawKey);
        if (count === 1) await redis.expire(withdrawKey, 86_400);
        const maxPerDay = getEnv("NODE_ENV") === "production" ? 5 : 50;
        if (count > maxPerDay) {
          return error(
            c,
            ErrorCodes.RATE_LIMITED,
            "Daily withdrawal request limit reached. Try again tomorrow.",
            429
          );
        }
      }

      const updated = await Balance.findOneAndUpdate(
        { userId: new mongoose.Types.ObjectId(userId), available: { $gte: amount } },
        { $inc: { available: -amount } },
        { returnDocument: "after" }
      );
      if (!updated) {
        return error(c, ErrorCodes.INSUFFICIENT_BALANCE, "Insufficient available balance", 400);
      }

      const withdrawTxId = new mongoose.Types.ObjectId();
      const transaction = await BalanceTransaction.create({
        _id: withdrawTxId,
        userId: new mongoose.Types.ObjectId(userId),
        type: "withdraw",
        amount,
        balanceBefore: updated.available + amount,
        balanceAfter: updated.available,
        status: "pending",
        withdrawReference: reference,
        note: `Withdrawal requested: £${amount.toFixed(2)}`,
        idempotencyKey: `withdraw-pending:${withdrawTxId.toString()}`,
      });

      await ComplianceAuditLog.create({
        actorId: userId,
        targetUserId: userId,
        action: "withdrawal_requested",
        reason: reference ?? "Withdrawal requested by user",
        before: { available: updated.available + amount },
        after: { available: updated.available },
        source: "user",
      });

      return success(c, {
        transactionId: transaction._id.toString(),
        amount,
        status: "pending",
        message: "Withdrawal request submitted",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to process withdrawal";
      console.error("Withdrawal error:", message);
      return error(c, ErrorCodes.WITHDRAW_ERROR, message, 500);
    }
  }
);

export default app;
