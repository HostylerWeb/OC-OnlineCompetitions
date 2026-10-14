import { Balance, BalanceTransaction } from "@oc/api-db/models";
import { isDuplicateKeyError } from "@oc/api-infra/mongo-errors";
import { type ClientSession, Types } from "mongoose";

export async function creditSiteCreditForPrizeWin(params: {
  userId: Types.ObjectId | string;
  amount: number;
  idempotencyKey: string;
  note: string;
  session?: ClientSession;
}): Promise<{ credited: boolean; balanceAfter: number }> {
  const amount = params.amount;
  if (amount <= 0) {
    return { credited: false, balanceAfter: 0 };
  }

  const userOid =
    params.userId instanceof Types.ObjectId
      ? params.userId
      : new Types.ObjectId(params.userId);
  const sessionOpts = params.session ? { session: params.session } : {};

  let existingQuery = BalanceTransaction.findOne({
    userId: userOid,
    idempotencyKey: params.idempotencyKey,
    status: "completed",
  });
  if (params.session) existingQuery = existingQuery.session(params.session);
  const existing = await existingQuery.lean();
  if (existing) {
    return { credited: false, balanceAfter: existing.balanceAfter };
  }

  let balanceQuery = Balance.findOne({ userId: userOid });
  if (params.session) balanceQuery = balanceQuery.session(params.session);
  let balance = await balanceQuery;
  if (!balance) {
    const created = await Balance.create(
      [
        {
          userId: userOid,
          available: 0,
          pending: 0,
          currency: "GBP",
        },
      ],
      sessionOpts
    );
    balance = created[0] ?? null;
  }
  if (!balance) {
    throw new Error("SITE_CREDIT_BALANCE_INIT_FAILED");
  }

  const balanceBefore = balance.available;
  const balanceAfter = balanceBefore + amount;

  const updated = await Balance.findOneAndUpdate(
    { userId: userOid },
    { $inc: { available: amount } },
    { returnDocument: "after", ...sessionOpts }
  );
  if (!updated) {
    throw new Error("SITE_CREDIT_CREDIT_FAILED");
  }

  try {
    await BalanceTransaction.create(
      [
        {
          userId: userOid,
          type: "prize_credit",
          amount,
          balanceBefore,
          balanceAfter: updated.available,
          status: "completed",
          note: params.note,
          idempotencyKey: params.idempotencyKey,
        },
      ],
      sessionOpts
    );
  } catch (err: unknown) {
    if (isDuplicateKeyError(err)) {
      const dup = await BalanceTransaction.findOne({
        userId: userOid,
        idempotencyKey: params.idempotencyKey,
      }).lean();
      if (dup) {
        return { credited: false, balanceAfter: dup.balanceAfter };
      }
    }
    await Balance.findOneAndUpdate(
      { userId: userOid },
      { $inc: { available: -amount } },
      sessionOpts
    );
    throw err;
  }

  return { credited: true, balanceAfter: updated.available };
}
