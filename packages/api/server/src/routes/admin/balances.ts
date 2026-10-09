import { Balance, BalanceTransaction, ComplianceAuditLog, Profile } from "@oc/api-db/models";
import { CH, invalidateByChannelSafe, invalidateUser } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { escapeRegex } from "@oc/api-infra/fuzzy-search";
import { parsePagination, parseSort } from "@oc/api-infra/pagination";
import { error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { requireAdmin } from "@oc/api-server/middleware/auth";
import { ADMIN_BALANCE_TABLE } from "@oc/types";
import { Hono } from "hono";
import mongoose from "mongoose";

const app = new Hono();

app.use("*", requireAdmin);

app.get("/users", async (c) => {
  try {
    const { limit, page, skip } = parsePagination(c);
    const search = c.req.query("search") ?? "";
    const { sortObj, sortableFields } = parseSort(c, {
      fields: [...ADMIN_BALANCE_TABLE.sortableFields],
      defaultSort: { createdAt: -1 },
    });

    await dbConnect();

    const searchStages = search
      ? [
          {
            $match: {
              $or: [
                { "profile.email": { $regex: escapeRegex(search), $options: "i" } },
                { "profile.firstName": { $regex: escapeRegex(search), $options: "i" } },
                { currency: { $regex: escapeRegex(search), $options: "i" } },
              ],
            },
          },
        ]
      : [];

    const baseLookup = [
      {
        $lookup: {
          from: "profiles",
          localField: "userId",
          foreignField: "_id",
          as: "profile",
        },
      },
      { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },
    ];

    const [balances, total] = await Promise.all([
      Balance.aggregate([
        ...baseLookup,
        ...searchStages,
        { $sort: sortObj },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            _id: 1,
            userId: 1,
            available: 1,
            pending: 1,
            currency: 1,
            createdAt: 1,
            updatedAt: 1,
            profile: {
              _id: 1,
              email: 1,
              firstName: 1,
              lastName: 1,
              avatarUrl: 1,
            },
          },
        },
      ]),
      Balance.aggregate([...baseLookup, ...searchStages, { $count: "total" }]).then(
        (r) => r[0]?.total ?? 0
      ),
    ]);

    return paginated(c, balances, total, page, limit, { sortableFields });
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.balances.list",
    });
    console.error("Error fetching balances:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid user ID", 400);
    }

    await dbConnect();

    const profile = await Profile.findById(userId).lean();
    if (!profile) {
      return error(c, ErrorCodes.NOT_FOUND, "User not found", 404);
    }

    let balance = await Balance.findOne({ userId: new mongoose.Types.ObjectId(userId) });
    if (!balance) {
      balance = await Balance.create({
        userId: new mongoose.Types.ObjectId(userId),
        available: 0,
        pending: 0,
        currency: "GBP",
      });
      void invalidateUser(userId).catch(() => {});
      void invalidateByChannelSafe(
        CH.competitionBuyingPower,
        CH.competitionsBuyingPowerBatch
      ).catch(() => {});
    }

    return success(c, {
      _id: balance._id,
      userId: balance.userId,
      available: balance.available,
      pending: balance.pending,
      currency: balance.currency,
      createdAt: balance.createdAt,
      updatedAt: balance.updatedAt,
    });
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.balances.getOne",
    });
    console.error("Error fetching user balance:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/adjust", async (c) => {
  try {
    await dbConnect();

    const body = await c.req.json();
    const { userId, amount, note } = body as { userId: string; amount: number; note?: string };

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid user ID", 400);
    }

    if (typeof amount !== "number" || amount === 0) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Amount must be a non-zero number", 400);
    }

    if (!note || typeof note !== "string" || note.trim().length === 0) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        "A note explaining the adjustment is required",
        400
      );
    }

    const profile = await Profile.findById(userId).lean();
    if (!profile) {
      return error(c, ErrorCodes.NOT_FOUND, "User not found", 404);
    }

    let balance = await Balance.findOne({ userId: new mongoose.Types.ObjectId(userId) });
    if (!balance) {
      balance = await Balance.create({
        userId: new mongoose.Types.ObjectId(userId),
        available: 0,
        pending: 0,
        currency: "GBP",
      });
    }

    const balanceBefore = balance.available;
    const balanceUserId = userId;
    const balanceAfter = balance.available + amount;

    if (balanceAfter < 0) {
      return error(
        c,
        ErrorCodes.INSUFFICIENT_BALANCE,
        "Adjustment would result in negative balance",
        400
      );
    }

    const transactionType = amount > 0 ? "admin_credit" : "admin_debit";

    const transactionId = new mongoose.Types.ObjectId();
    const transaction = await BalanceTransaction.create({
      _id: transactionId,
      userId: new mongoose.Types.ObjectId(userId),
      type: transactionType,
      amount: Math.abs(amount),
      balanceBefore,
      balanceAfter,
      status: "completed",
      note: note.trim(),
      idempotencyKey: `admin-adjust:${transactionId.toString()}`,
    });
    void invalidateUser(balanceUserId).catch(() => {});
    void invalidateByChannelSafe(CH.competitionBuyingPower, CH.competitionsBuyingPowerBatch).catch(
      () => {}
    );

    balance.available = balanceAfter;
    await balance.save();
    void invalidateUser(balanceUserId).catch(() => {});
    void invalidateByChannelSafe(CH.competitionBuyingPower, CH.competitionsBuyingPowerBatch).catch(
      () => {}
    );

    await ComplianceAuditLog.create({
      actorId: c.get("userId") as string | null,
      targetUserId: body.userId,
      action: "balance_adjustment",
      reason: body.note,
      before: { available: balanceBefore },
      after: { available: balanceAfter },
      source: "admin",
    });

    return success(c, {
      balance: {
        _id: balance._id,
        userId: balance.userId,
        available: balance.available,
        pending: balance.pending,
        currency: balance.currency,
        createdAt: balance.createdAt,
        updatedAt: balance.updatedAt,
      },
      transaction: {
        _id: transaction._id,
        type: transaction.type,
        amount: transaction.amount,
        balanceBefore: transaction.balanceBefore,
        balanceAfter: transaction.balanceAfter,
        status: transaction.status,
        note: transaction.note,
        createdAt: transaction.createdAt,
      },
    });
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.balances.adjust",
    });
    console.error("Error adjusting balance:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
