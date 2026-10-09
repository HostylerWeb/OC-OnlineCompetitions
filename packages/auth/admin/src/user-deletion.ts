import { dbConnect } from "@oc/api-db";
import {
  Balance,
  BalanceTransaction,
  Cart,
  ComplianceAuditLog,
  InstantPrizeWin,
  Notification,
  Order,
  OrderItem,
  PaymentAttempt,
  Profile,
  PushSubscription,
  ReferralPurchase,
  SelfExclusionOverrideRequest,
  ShopCart,
  ShopOrder,
  Ticket,
  Winner,
} from "@oc/api-db/models";
import { CH, invalidateByChannelSafe, invalidateUser } from "@oc/api-infra/cache";
import { getAdminAuth } from "@oc/auth-admin/admin-auth";
import { getMongoDb } from "@oc/auth-admin/auth-mongo";
import mongoose, { Types } from "mongoose";

export async function deleteUserAccount(userId: string, headers?: Headers): Promise<void> {
  await dbConnect();

  const profile = await Profile.findById(userId);
  if (!profile) {
    throw new Error("Profile not found");
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const auth = await getAdminAuth();
    await auth.api.removeUser({
      body: { userId },
      headers,
    });

    await Cart.deleteOne({ userId: new Types.ObjectId(userId) }).session(session);

    const db = getMongoDb();
    await db.collection("session").deleteMany({ userId }, { session });
    await db.collection("account").deleteMany({ userId }, { session });

    const userOrders = await Order.find({ userId }).session(session).select("_id").lean();
    const userOrderIds = userOrders.map((o) => o._id);

    const cleanupOps: Promise<unknown>[] = [
      Order.updateMany(
        { userId },
        { $set: { deletedAt: new Date(), deletedBy: "account-deletion" } }
      ).session(session),
      OrderItem.updateMany(
        { orderId: { $in: userOrderIds } },
        { $set: { deletedAt: new Date() } }
      ).session(session),
      Ticket.updateMany(
        { ownerId: userId },
        { $set: { status: "released", ownerId: null } }
      ).session(session),
      Balance.deleteOne({ userId }).session(session),
      BalanceTransaction.updateMany({ userId }, { $set: { status: "cancelled" } }).session(session),
      Winner.updateMany(
        { userId },
        {
          $set: {
            displayName: "Deleted User",
            testimonial: "",
            location: "",
            winnerPhotoUrl: "",
            deletedAt: new Date(),
          },
        }
      ).session(session),
      ReferralPurchase.updateMany(
        { referredUserId: userId },
        { $set: { referredUserId: null, referredEmail: "deleted@deleted.local" } }
      ).session(session),
      ReferralPurchase.updateMany(
        { referrerId: userId },
        { $set: { referrerEmail: "deleted@deleted.local", referredEmail: "deleted@deleted.local" } }
      ).session(session),
      ComplianceAuditLog.updateMany(
        { targetUserId: userId },
        { $set: { targetUserId: null } }
      ).session(session),
      ComplianceAuditLog.updateMany({ actorId: userId }, { $set: { actorId: null } }).session(
        session
      ),
      InstantPrizeWin.updateMany({ userId }, { $set: { userId: null } }).session(session),
      PushSubscription.deleteMany({ userId }).session(session),
      SelfExclusionOverrideRequest.deleteMany({ userId }).session(session),
      (
        PaymentAttempt as {
          updateMany: (
            filter: Record<string, unknown>,
            update: Record<string, unknown>
          ) => { session: (s: typeof session) => Promise<unknown> };
        }
      )
        .updateMany({ userId }, { $set: { userId: null } })
        .session(session),
      Notification.deleteMany({
        $or: [{ createdBy: userId }, { "targetFilter.userIds": userId }],
      }).session(session),
      ShopCart.deleteMany({ userId }).session(session),
      ShopOrder.updateMany(
        { userId },
        { $set: { deletedAt: new Date(), deletedBy: "account-deletion" } }
      ).session(session),
    ];

    for (const op of cleanupOps) {
      await op;
    }

    profile.email = `deleted-${userId.slice(0, 8)}@deleted.local`;
    profile.firstName = "Deleted";
    profile.lastName = "User";
    profile.phone = undefined;
    profile.dateOfBirth = undefined;
    profile.addressLine1 = undefined;
    profile.addressLine2 = undefined;
    profile.city = undefined;
    profile.postcode = undefined;
    profile.avatarUrl = undefined;
    profile.instagram = undefined;
    profile.facebook = undefined;
    profile.twitter = undefined;
    profile.tiktok = undefined;
    profile.youtube = undefined;
    profile.websiteUrl = undefined;
    profile.isAdmin = false;
    profile.isVerified = false;
    profile.marketingConsent = false;
    profile.referralCode = undefined;
    profile.referredBy = undefined;
    profile.referredByCode = undefined;
    profile.referredBySignup = undefined;
    profile.referredBySignupCode = undefined;
    await profile.save({ session });

    await Profile.updateOne(
      { _id: userId },
      {
        $unset: {
          selfExcluded: "",
          monthlySpendLimit: "",
          isAgeVerified: "",
          referralTierAwardedTickets: "",
          referralCount: "",
          referralMultiplier: "",
          totalSpent: "",
          totalEntries: "",
          reservedSpend: "",
        },
      }
    ).session(session);

    await session.commitTransaction();

    void invalidateUser(userId).catch(() => {});
    void invalidateByChannelSafe(
      CH.competitionAvailability,
      CH.competitionsAvailabilityBatch,
      CH.competitionBuyingPower,
      CH.competitionsBuyingPowerBatch,
      CH.competitions,
      CH.competitionDetail,
      CH.competitionFeatured,
      CH.winners,
      CH.winnersByCompetition,
      CH.entries,
      CH.stats
    ).catch(() => {});
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }
}
