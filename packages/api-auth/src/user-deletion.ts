import { CH, invalidateByChannelSafe, invalidateUser } from "@oc/api-infra/cache";
import { getAdminAuth } from "@oc/api-auth/admin-auth";
import { getMongoDb } from "@oc/api-auth/auth-mongo";
import { dbConnect } from "@oc/api-db";
import {
  Balance,
  BalanceTransaction,
  Cart,
  ComplianceAuditLog,
  InstantPrizeWin,
  Order,
  Profile,
  ReferralPurchase,
  Ticket,
  Winner,
} from "@oc/api-db/models";
import { Types } from "mongoose";

export async function deleteUserAccount(userId: string, headers?: Headers): Promise<void> {
  await dbConnect();

  const profile = await Profile.findById(userId);
  if (!profile) {
    throw new Error("Profile not found");
  }

  await Cart.deleteOne({ userId: new Types.ObjectId(userId) });

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
  await profile.save();

  await Profile.updateOne(
    { _id: userId },
    {
      $unset: {
        selfExcluded: "",
        monthlySpendLimit: "",
        isAgeVerified: "",
      },
    }
  );

  const db = getMongoDb();
  await db.collection("session").deleteMany({ userId });
  await db.collection("account").deleteMany({ userId });

  const cleanupOps: Promise<unknown>[] = [
    Order.updateMany({ userId }, { $set: { deletedAt: new Date(), deletedBy: "account-deletion" } }),
    Ticket.updateMany({ ownerId: userId }, { $set: { status: "released", ownerId: null } }),
    Balance.deleteOne({ userId }),
    BalanceTransaction.updateMany({ userId }, { $set: { status: "cancelled" } }),
    Winner.updateMany({ userId }, { $set: { deletedAt: new Date() } }),
    ReferralPurchase.updateMany({ referredUserId: userId }, { $set: { referredUserId: null } }),
    ComplianceAuditLog.updateMany({ targetUserId: userId }, { $set: { targetUserId: null } }),
    InstantPrizeWin.updateMany({ userId }, { $set: { userId: null } }),
  ];

  for (const op of cleanupOps) {
    try {
      await op;
    } catch (err) {
      if (err instanceof Error) {
        console.error(`[user-deletion] cleanup error:`, err.message);
      }
    }
  }

  const auth = await getAdminAuth();
  await auth.api.removeUser({
    body: { userId },
    headers,
  });

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
}
