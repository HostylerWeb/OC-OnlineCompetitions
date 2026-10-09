import { fireConversion, getAffiliateContext } from "@oc/api-affiliate";
import { dbConnect } from "@oc/api-db";
import { Cart, Order, Profile, ReferralPurchase, Ticket } from "@oc/api-db/models";
import { CH, invalidateByChannelSafe, invalidateUser } from "@oc/api-infra/cache";
import { Types } from "mongoose";
import { maybeSyncAvatarFromAuthUser } from "./avatar-sync";
import {
  computeProfileStats,
  computeWinCounts,
  transferProfileData,
} from "./transfer-profile-data";

const GUEST_EMAIL_SUFFIX = "@guest.onlinecompetitions.local";

export function isGuestProfileEmail(email?: string | null): boolean {
  return Boolean(email?.endsWith(GUEST_EMAIL_SUFFIX));
}

export function canonicalizeEmail(email: string): string {
  const parts = email.toLowerCase().split("@");
  const local = parts[0]!;
  const domain = parts[1];
  if (!domain) return email;
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return `${local.replace(/\./g, "").split("+")[0]}@gmail.com`;
  }
  return `${local.split("+")[0]}@${domain}`;
}

export type HookAuthUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: boolean;
  isAnonymous?: boolean | null;
  role?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export async function createOnlineCompetitionsProfile(user: HookAuthUser): Promise<void> {
  if (user.isAnonymous) return;

  await dbConnect();

  const existing = await Profile.findById(user.id).lean();
  if (existing) return;

  // Before creating the profile, consolidate any guest checkout profile that
  // already holds this email. Without this step, the unique sparse index on
  // email throws E11000 and the verified profile is never created.
  let guestFields: Record<string, unknown> | undefined;
  if (!isGuestProfileEmail(user.email)) {
    const guestProfile = await Profile.findOne({
      email: canonicalizeEmail(user.email),
      isGuestCheckout: true,
      _id: { $ne: new Types.ObjectId(user.id) },
    }).lean();

    if (guestProfile) {
      const guestId = guestProfile._id.toString();

      // Transfer all ownership-based data from guest to verified user
      const { transferredCounts } = await transferProfileData(guestId, user.id);
      console.log("[createOnlineCompetitionsProfile] Transferred data from guest", {
        guestId,
        userId: user.id,
        ...transferredCounts,
      });

      // Compute win counters from source collections and $set on the new profile
      const winCounts = await computeWinCounts(user.id);
      // Recompute entries/spend from ground truth — the guest's denormalized
      // counters are stale for the post-transfer ownership snapshot.
      const profileStats = await computeProfileStats(user.id);
      const captured: Record<string, unknown> = {
        ...winCounts,
        totalEntries: profileStats.totalEntries,
        totalSpent: profileStats.totalSpent,
      };
      if (guestProfile.phone) captured.phone = guestProfile.phone;
      if (guestProfile.addressLine1) captured.addressLine1 = guestProfile.addressLine1;
      if (guestProfile.addressLine2) captured.addressLine2 = guestProfile.addressLine2;
      if (guestProfile.city) captured.city = guestProfile.city;
      if (guestProfile.postcode) captured.postcode = guestProfile.postcode;
      if (guestProfile.dateOfBirth) captured.dateOfBirth = guestProfile.dateOfBirth;
      if (guestProfile.referredBy) {
        captured.referredBy = guestProfile.referredBy;
        captured.referredByCode = guestProfile.referredByCode;
        captured.referredBySignup = guestProfile.referredBySignup;
        captured.referredBySignupCode = guestProfile.referredBySignupCode;
      }

      await Profile.deleteOne({ _id: guestProfile._id });
      void invalidateUser(guestId).catch(() => {});

      guestFields = captured;
    }
  }

  const firstName = user.firstName ?? user.name?.split(" ")[0];
  const lastName =
    user.lastName ??
    (user.name?.includes(" ") ? user.name.split(" ").slice(1).join(" ") : undefined);

  const affiliateContext = getAffiliateContext();
  const affiliateClickId = affiliateContext.clickId;
  const affiliateSource = affiliateContext.source;

  await Profile.create({
    _id: user.id,
    email: user.email,
    firstName,
    lastName,
    country: "GB",
    isVerified: user.emailVerified ?? false,
    role: (user.role === "admin" || user.role === "manager" ? user.role : "user") as
      | "user"
      | "manager"
      | "admin",
    isAdmin: user.role === "admin" || user.role === "manager",
    ...(affiliateClickId
      ? {
          affiliate: {
            clickId: affiliateClickId,
            source: affiliateSource ?? undefined,
            landedAt: new Date(),
          },
        }
      : {}),
  });
  void invalidateUser(user.id).catch(() => {});

  // Apply captured guest fields now that the verified profile exists
  if (guestFields && Object.keys(guestFields).length > 0) {
    await Profile.findByIdAndUpdate(user.id, { $set: guestFields });
  }

  void maybeSyncAvatarFromAuthUser(user.id, user.image).catch(() => {});

  void fireConversion("signup", {
    clickId: affiliateClickId,
    source: affiliateSource ?? undefined,
    userId: user.id,
    email: user.email,
  });

  try {
    await reassignGuestOrdersByEmail(user.email, user.id);
  } catch (err) {
    console.error("[createOnlineCompetitionsProfile] Failed to reassign guest orders:", err);
  }
}

export async function createGuestCheckoutProfile(
  userId: string,
  opts: { guestEmail?: string; firstName?: string; lastName?: string; dob?: string; phone?: string }
): Promise<{ orderUserId?: string }> {
  await dbConnect();

  const email = opts.guestEmail
    ? canonicalizeEmail(opts.guestEmail)
    : `guest-${userId}@guest.onlinecompetitions.local`;

  if (!email.endsWith("@guest.onlinecompetitions.local")) {
    const existingVerified = await Profile.findOne({
      email,
      isVerified: true,
      _id: { $ne: new Types.ObjectId(userId) },
    }).lean();
    if (existingVerified) {
      // The order lands on the verified account, but the checkout email must
      // also be visible to the anonymous session that paid (email-based order
      // inheritance on the read paths).
      await Profile.findByIdAndUpdate(userId, { $set: { email } });
      void invalidateUser(userId).catch(() => {});
      return { orderUserId: existingVerified._id.toString() };
    }

    const existingByEmail = await Profile.findOne({
      email,
      isGuestCheckout: true,
      _id: { $ne: new Types.ObjectId(userId) },
    }).lean();
    if (existingByEmail) {
      await Ticket.updateMany(
        { ownerId: existingByEmail._id },
        { $set: { ownerId: new Types.ObjectId(userId) } }
      );
      await Order.updateMany(
        { userId: existingByEmail._id },
        { $set: { userId: new Types.ObjectId(userId) } }
      );
      await Profile.deleteOne({ _id: existingByEmail._id });
    }
  }

  const existing = await Profile.findById(userId).lean();
  if (existing) {
    const update: Record<string, unknown> = {};
    if (email) update.email = email;
    if (opts.firstName) update.firstName = opts.firstName;
    if (opts.lastName) update.lastName = opts.lastName;
    if (opts.phone) update.phone = opts.phone;
    if (opts.dob) {
      const { buildDateOfBirthProfileUpdate } = await import(
        "@oc/api-compliance/age-verification"
      );
      const dobFields = await buildDateOfBirthProfileUpdate(opts.dob);
      if (dobFields) Object.assign(update, dobFields);
    }
    await Profile.findByIdAndUpdate(userId, update);
    void invalidateUser(userId).catch(() => {});
    return {};
  }

  const affiliateContext = getAffiliateContext();
  const affiliateClickId = affiliateContext.clickId;
  const affiliateSource = affiliateContext.source;

  await Profile.create({
    _id: userId,
    email,
    firstName: opts.firstName ?? "",
    lastName: opts.lastName ?? "",
    phone: opts.phone ?? "",
    country: "GB",
    isVerified: false,
    isGuestCheckout: true,
    ...(affiliateClickId
      ? {
          affiliate: {
            clickId: affiliateClickId,
            source: affiliateSource ?? undefined,
            landedAt: new Date(),
          },
        }
      : {}),
  });
  void invalidateUser(userId).catch(() => {});

  if (opts.dob) {
    const { buildDateOfBirthProfileUpdate } = await import(
      "@oc/api-compliance/age-verification"
    );
    const dobFields = await buildDateOfBirthProfileUpdate(opts.dob);
    if (dobFields) {
      await Profile.findByIdAndUpdate(userId, dobFields);
    }
  }

  return {};
}

export async function applyReferralToProfile(
  userId: string,
  refCode?: string | null
): Promise<{
  applied: boolean;
  referredByCode?: string;
  referredBySignupCode?: string;
  overwritten?: boolean;
}> {
  const code = refCode?.trim().toUpperCase();
  if (!code) return { applied: false };

  await dbConnect();

  const referrer = await Profile.findOne({ referralCode: code }).lean();
  if (!referrer || referrer._id.toString() === userId) return { applied: false };

  let profile = await Profile.findById(userId);

  if (profile?.referredBy) {
    const existingCode = profile.referredByCode?.toUpperCase();
    if (existingCode === code) {
      return { applied: false, referredByCode: profile.referredByCode ?? undefined };
    }

    if (profile.referredBySignup) {
      return { applied: false, referredByCode: profile.referredByCode ?? undefined };
    }

    profile.referredBy = referrer._id;
    profile.referredByCode = code;
    await profile.save();
    void invalidateUser(userId).catch(() => {});
    return {
      applied: true,
      referredByCode: code,
      referredBySignupCode: profile.referredBySignupCode,
      overwritten: true,
    };
  }

  if (!profile) {
    profile = await Profile.create({
      _id: userId,
      email: `guest-${userId}@guest.onlinecompetitions.local`,
      country: "GB",
      referredBy: referrer._id,
      referredByCode: code,
      referredBySignup: referrer._id,
      referredBySignupCode: code,
    });
    void invalidateUser(userId).catch(() => {});
    return { applied: true, referredByCode: code, referredBySignupCode: code };
  }

  profile.referredBy = referrer._id;
  profile.referredByCode = code;
  profile.referredBySignup = referrer._id;
  profile.referredBySignupCode = code;
  await profile.save();
  void invalidateUser(userId).catch(() => {});
  return { applied: true, referredByCode: code, referredBySignupCode: code };
}

export async function mergeGuestProfileIntoVerifiedUser(
  email: string,
  verifiedUserId: string
): Promise<{
  merged: boolean;
  guestId?: string;
  firstName?: string;
  lastName?: string;
}> {
  if (isGuestProfileEmail(email)) return { merged: false };

  await dbConnect();

  const guestProfile = await Profile.findOne({
    email: canonicalizeEmail(email),
    isGuestCheckout: true,
  }).lean();
  if (!guestProfile) return { merged: false };

  const guestId = guestProfile._id.toString();

  // Transfer all ownership-based data from guest to verified user
  await transferProfileData(guestId, verifiedUserId);

  // Compute win counters from source collections
  const winCounts = await computeWinCounts(verifiedUserId);

  // Recompute spend/entries from ground truth after the transfer — the
  // guest's denormalized counters are stale and must never overwrite the
  // verified user's accumulated values.
  const profileStats = await computeProfileStats(verifiedUserId);

  // Transfer guest profile fields to verified user profile
  const existing = await Profile.findById(verifiedUserId).lean();
  if (existing) {
    const update: Record<string, unknown> = {
      competitionWinsCount: winCounts.competitionWinsCount,
      instantWinsCount: winCounts.instantWinsCount,
      bonusWinsCount: winCounts.bonusWinsCount,
      totalEntries: profileStats.totalEntries,
      totalSpent: profileStats.totalSpent,
    };
    if (!existing.phone && guestProfile.phone) update.phone = guestProfile.phone;
    if (!existing.addressLine1 && guestProfile.addressLine1)
      update.addressLine1 = guestProfile.addressLine1;
    if (!existing.addressLine2 && guestProfile.addressLine2)
      update.addressLine2 = guestProfile.addressLine2;
    if (!existing.city && guestProfile.city) update.city = guestProfile.city;
    if (!existing.postcode && guestProfile.postcode) update.postcode = guestProfile.postcode;
    if (!existing.dateOfBirth && guestProfile.dateOfBirth)
      update.dateOfBirth = guestProfile.dateOfBirth;
    if (!existing.referredBy && guestProfile.referredBy) {
      update.referredBy = guestProfile.referredBy;
      update.referredByCode = guestProfile.referredByCode;
      update.referredBySignup = guestProfile.referredBySignup;
      update.referredBySignupCode = guestProfile.referredBySignupCode;
    }

    if (Object.keys(update).length > 0) {
      await Profile.findByIdAndUpdate(verifiedUserId, { $set: update });
    }
  }

  // Delete the guest profile
  await Profile.deleteOne({ _id: guestProfile._id });
  void invalidateUser(guestId).catch(() => {});
  void invalidateUser(verifiedUserId).catch(() => {});

  return {
    merged: true,
    guestId,
    firstName: guestProfile.firstName,
    lastName: guestProfile.lastName,
  };
}

export async function reassignGuestOrdersByEmail(
  email: string,
  targetUserId: string
): Promise<{ firstName?: string; lastName?: string } | null> {
  const result = await mergeGuestProfileIntoVerifiedUser(email, targetUserId);
  if (!result.merged) return null;
  return { firstName: result.firstName, lastName: result.lastName };
}

export async function mergeAnonymousAccount({
  anonymousUser,
  newUser,
}: {
  anonymousUser: HookAuthUser;
  newUser: HookAuthUser;
}): Promise<void> {
  await dbConnect();

  const anonId = anonymousUser.id;
  const newId = newUser.id;

  const anonProfile = await Profile.findById(anonId).lean();
  if (anonProfile?.referredBy) {
    const newProfile = await Profile.findById(newId).lean();
    if (!newProfile?.referredBy) {
      await Profile.findByIdAndUpdate(
        newId,
        {
          referredBy: anonProfile.referredBy,
          referredByCode: anonProfile.referredByCode,
          referredBySignup: anonProfile.referredBySignup,
          referredBySignupCode: anonProfile.referredBySignupCode,
          firstName: newProfile?.firstName,
          lastName: newProfile?.lastName,
        },
        { upsert: true }
      );
      const firstName = newUser.firstName ?? newUser.name?.split(" ")[0];
      const lastName =
        newUser.lastName ??
        (newUser.name?.includes(" ") ? newUser.name.split(" ").slice(1).join(" ") : undefined);
      if (firstName || lastName) {
        await Profile.findByIdAndUpdate(anonId, { firstName, lastName });
      }
    }
  }

  await ReferralPurchase.updateMany(
    { referredUserId: new Types.ObjectId(anonId) },
    { referredUserId: new Types.ObjectId(newId) }
  );

  const anonCart = await Cart.findOne({ userId: new Types.ObjectId(anonId) }).exec();

  if (anonCart) {
    const userCart = await Cart.findOne({ userId: new Types.ObjectId(newId) }).exec();

    if (!userCart) {
      anonCart.userId = new Types.ObjectId(newId);
      const { finalizeCart } = await import("@oc/api-tickets/cart");
      await finalizeCart(newId, anonCart);
      await anonCart.save();
    } else {
      const { mergeCartItem } = await import("@oc/api-tickets/cart");
      for (const item of anonCart.items) {
        userCart.items = mergeCartItem(userCart.items, item);
      }

      if (!userCart.promoCode && anonCart.promoCode) {
        userCart.promoCode = anonCart.promoCode;
        userCart.promoCodeId = anonCart.promoCodeId;
        userCart.discountAmount = anonCart.discountAmount;
        userCart.discountType = anonCart.discountType;
      }

      if (!userCart.referralCode && anonCart.referralCode) {
        userCart.referralCode = anonCart.referralCode;
        userCart.referralDiscountAmount = anonCart.referralDiscountAmount;
        userCart.referralDiscountPercent = anonCart.referralDiscountPercent;
      }

      const { finalizeCart } = await import("@oc/api-tickets/cart");
      await finalizeCart(newId, userCart);
      await userCart.save();
      const deleted = await Cart.findOneAndDelete({
        _id: anonCart._id,
        __v: anonCart.__v,
      });
      if (!deleted) {
        console.warn("[merge] Anonymous cart version mismatch — race detected");
      }
    }
  }

  // Re-assign pending orders from anonymous user to new user
  const { Order } = await import("@oc/api-db/models/Order");
  await Order.updateMany(
    { userId: new Types.ObjectId(anonId), status: { $in: ["pending", "processing"] } },
    { $set: { userId: new Types.ObjectId(newId) } }
  );
  void invalidateByChannelSafe(CH.competitions, CH.competitionDetail, CH.entries).catch(() => {});

  // Re-assign completed orders
  await Order.updateMany(
    { userId: new Types.ObjectId(anonId), status: "completed" },
    { $set: { userId: new Types.ObjectId(newId) } }
  );
  void invalidateByChannelSafe(CH.competitions, CH.competitionDetail, CH.entries).catch(() => {});

  // Transfer shop cart ownership
  const { ShopCart, ShopOrder } = await import("@oc/api-db/models");
  const anonShopCart = await ShopCart.findOne({ userId: new Types.ObjectId(anonId) }).exec();
  if (anonShopCart) {
    const userShopCart = await ShopCart.findOne({ userId: new Types.ObjectId(newId) }).exec();
    if (!userShopCart) {
      anonShopCart.userId = new Types.ObjectId(newId);
      await anonShopCart.save();
    } else {
      for (const item of anonShopCart.items) {
        const existing = userShopCart.items.find(
          (i) => String(i.productId) === String(item.productId)
        );
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          userShopCart.items.push(item);
        }
      }
      await userShopCart.save();
      await ShopCart.deleteOne({ _id: anonShopCart._id });
    }
  }

  // Re-assign shop orders from anonymous user to new user
  await ShopOrder.updateMany(
    {
      userId: new Types.ObjectId(anonId),
      status: { $in: ["pending", "paid", "processing"] },
    },
    { $set: { userId: new Types.ObjectId(newId), isGuestCheckout: false } }
  );

  // Transfer win models and other ownership-based models that the existing
  // merge logic does not cover (Winner, InstantPrizeWin, BonusAwardWin, Ticket,
  // PushSubscription, PaymentAttempt, SelfExclusionOverrideRequest, etc.)
  await transferProfileData(anonId, newId);

  // Compute win counters from source collections and $set on the verified profile
  const winCounts = await computeWinCounts(newId);
  await Profile.findByIdAndUpdate(newId, {
    $set: {
      competitionWinsCount: winCounts.competitionWinsCount,
      instantWinsCount: winCounts.instantWinsCount,
      bonusWinsCount: winCounts.bonusWinsCount,
    },
  });

  if (anonProfile?.email && !isGuestProfileEmail(anonProfile.email)) {
    const siblingGuestProfiles = await Profile.find({
      email: canonicalizeEmail(anonProfile.email),
      isGuestCheckout: true,
      _id: { $ne: anonProfile._id },
    })
      .select("_id")
      .lean();

    if (siblingGuestProfiles.length > 0) {
      const siblingIds = siblingGuestProfiles.map((p) => p._id.toString());
      await Order.updateMany(
        { userId: { $in: siblingIds.map((id) => new Types.ObjectId(id)) } },
        { $set: { userId: new Types.ObjectId(newId) } }
      );
      await Profile.deleteMany({
        _id: { $in: siblingIds.map((id) => new Types.ObjectId(id)) },
      });
    }
  }

  if (anonProfile) {
    // Transfer guest profile data to the new verified user
    const {
      _id,
      __v,
      createdAt,
      updatedAt,
      isGuestCheckout,
      isVerified,
      reservedSpend,
      reservedSpendMonth,
      monthlySpendLimit,
      pendingMonthlySpendLimit,
      monthlySpendLimitEffectiveAt,
      selfExcluded,
      selfExcludedUntil,
      selfExcludedAt,
      marketingConsent,
      ...transferFields
    } = anonProfile;

    const existingNewProfile = await Profile.findById(newId).lean();
    if (!existingNewProfile) {
      await Profile.create({
        _id: newId,
        ...transferFields,
        isGuestCheckout: false,
        isVerified: false,
      });
    }

    // Clean up the old guest profile
    await Profile.deleteOne({ _id: anonId });
  }

  console.log("[Merge] Anonymous account merged", {
    anonId,
    newId,
    anonEmail: anonProfile?.email?.substring(0, 15) ?? null,
    hadReferredBy: Boolean(anonProfile?.referredBy),
  });

  // Revoke all sessions for the anonymous user. This invalidates the old
  // session token so that even if the browser keeps the stale cookie,
  // getSession() returns null instead of the anonymous user, forcing the
  // new Google session to be used.
  try {
    const { getClientAuth } = await import("./client-auth");
    const auth = await getClientAuth();
    await auth.api.revokeUserSessions({ userId: anonId });
    console.log("[Merge] Revoked anonymous sessions", { anonId });
  } catch (revokeErr) {
    console.warn("[Merge] Failed to revoke anonymous sessions (non-fatal):", revokeErr);
  }

  void invalidateUser(anonId).catch(() => {});
  void invalidateUser(newId).catch(() => {});
}

export async function updateProfileFromSignUp(
  userId: string,
  data: {
    email: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    emailVerified?: boolean;
  }
): Promise<void> {
  await dbConnect();

  const profileUpdate: Record<string, unknown> = {
    email: canonicalizeEmail(data.email),
    isVerified: data.emailVerified ?? false,
  };

  if (data.firstName) profileUpdate.firstName = data.firstName;
  if (data.lastName !== undefined) profileUpdate.lastName = data.lastName || undefined;

  if (data.dateOfBirth) {
    const { buildDateOfBirthProfileUpdate } = await import(
      "@oc/api-compliance/age-verification"
    );
    const dobFields = await buildDateOfBirthProfileUpdate(data.dateOfBirth);
    if (dobFields) Object.assign(profileUpdate, dobFields);
  }

  await Profile.findByIdAndUpdate(
    userId,
    { $set: { ...profileUpdate, isGuestCheckout: false } },
    {
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );
  void invalidateUser(userId).catch(() => {});
}

export async function syncProfileFromAuthUser(user: HookAuthUser): Promise<void> {
  if (user.isAnonymous) return;

  await dbConnect();

  const profileUpdate: Record<string, unknown> = {
    email: canonicalizeEmail(user.email),
    isVerified: user.emailVerified ?? false,
    role: user.role ?? "user",
    isAdmin: user.role === "admin" || user.role === "manager",
  };

  if (user.firstName) profileUpdate.firstName = user.firstName;
  if (user.lastName !== undefined && user.lastName !== null) {
    profileUpdate.lastName = user.lastName;
  } else if (user.name?.includes(" ")) {
    const parts = user.name.split(" ");
    profileUpdate.firstName = profileUpdate.firstName ?? parts[0];
    profileUpdate.lastName = parts.slice(1).join(" ");
  }

  await Profile.findByIdAndUpdate(user.id, profileUpdate, { upsert: false });
  void invalidateUser(user.id).catch(() => {});

  await maybeSyncAvatarFromAuthUser(user.id, user.image);
}
