import { Order, Profile } from "@oc/api-db/models";
import { invalidateUser } from "@oc/api-infra/cache";
import { Types } from "mongoose";

/** Orders created for wallet ledger only — exclude from spend / competition analytics (P4-L6). */
export const LEDGER_ORDER_METADATA_TYPES = ["balance_top_up"] as const;

export function isCompetitionOrderMatchExtra(): Record<string, unknown> {
  return {
    "metadata.type": { $nin: [...LEDGER_ORDER_METADATA_TYPES] },
  };
}

function getCalendarMonthRange(referenceDate = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), 1));
  const end =
    referenceDate.getMonth() === 11
      ? new Date(Date.UTC(referenceDate.getFullYear() + 1, 0, 1))
      : new Date(Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1));
  return { start, end };
}

export async function getUserCreditCardSpendThisMonth(userId: string): Promise<number> {
  const { start, end } = getCalendarMonthRange();

  const [result] = await Order.aggregate([
    {
      $match: {
        userId,
        status: "completed",
        createdAt: { $gte: start, $lt: end },
        $or: [
          { "metadata.cardFundingType": "credit" },
          { "metadata.dnaCardFundingType": "credit" },
        ],
        deletedAt: null,
        ...isCompetitionOrderMatchExtra(),
      },
    },
    { $group: { _id: null, total: { $sum: "$total" } } },
  ]).option({ maxTimeMS: 5000 });

  return result?.total ?? 0;
}

export async function getUserMonthlySpendAllMethods(userId: string): Promise<number> {
  const { start, end } = getCalendarMonthRange();

  const [result] = await Order.aggregate([
    {
      $match: {
        userId,
        status: "completed",
        createdAt: { $gte: start, $lt: end },
        deletedAt: null,
        ...isCompetitionOrderMatchExtra(),
      },
    },
    { $group: { _id: null, total: { $sum: "$total" } } },
  ]).option({ maxTimeMS: 5000 });

  return result?.total ?? 0;
}

export async function getUserCompletedOrderCount(userId: string): Promise<number> {
  return Order.countDocuments({
    userId,
    status: "completed",
    ...isCompetitionOrderMatchExtra(),
  }).maxTimeMS(5000);
}

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function reserveSpendAllowance(
  userId: string,
  amount: number,
  currentMonthSpend: number
): Promise<boolean> {
  // Reset reservedSpend if the calendar month has rolled over
  const currentMonth = getCurrentMonthKey();
  const profile = await Profile.findById(userId)
    .select("reservedSpendMonth reservedSpend monthlySpendLimit")
    .lean();
  if (profile && profile.reservedSpendMonth !== currentMonth) {
    await Profile.findByIdAndUpdate(userId, {
      $set: { reservedSpend: 0, reservedSpendMonth: currentMonth },
    });
    void invalidateUser(userId).catch(() => {});
  }

  const result = await Profile.findOneAndUpdate(
    {
      _id: userId,
      $expr: {
        $gte: [
          { $ifNull: ["$monthlySpendLimit", 0] },
          { $add: [{ $ifNull: ["$reservedSpend", 0] }, currentMonthSpend, amount] },
        ],
      },
    },
    { $inc: { reservedSpend: amount } },
    { new: true }
  );
  void invalidateUser(userId).catch(() => {});
  return result !== null;
}

export async function getMonthlySpendByEmail(email: string): Promise<number> {
  const { start, end } = getCalendarMonthRange();

  const profiles = await Profile.find({ email }).select("_id").lean();
  if (profiles.length === 0) return 0;
  const userIds = profiles.map((p) => p._id);

  const [result] = await Order.aggregate([
    {
      $match: {
        userId: { $in: userIds.map((id) => new Types.ObjectId(id.toString())) },
        status: "completed",
        createdAt: { $gte: start, $lt: end },
        deletedAt: null,
        ...isCompetitionOrderMatchExtra(),
      },
    },
    { $group: { _id: null, total: { $sum: "$total" } } },
  ]).option({ maxTimeMS: 5000 });

  return result?.total ?? 0;
}

export async function releaseReservedSpend(userId: string, amount: number): Promise<boolean> {
  const result = await Profile.findOneAndUpdate(
    { _id: userId, reservedSpend: { $gte: amount } },
    { $inc: { reservedSpend: -amount } }
  );
  void invalidateUser(userId).catch(() => {});
  if (!result) {
    console.warn(
      `[spend-tracking] releaseReservedSpend: no-op for userId=${userId} amount=${amount} — reservedSpend lower than expected`
    );
  }
  return result !== null;
}
