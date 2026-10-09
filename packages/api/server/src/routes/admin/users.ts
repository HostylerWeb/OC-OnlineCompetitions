import {
  ComplianceAuditLog,
  OrderItem,
  Profile,
  ReferralPurchase,
  ReferralSettings,
} from "@oc/api-db/models";
import { invalidateUser } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { substringRegex } from "@oc/api-infra/fuzzy-search";
import { applyGroupBy, type GroupByFieldConfig } from "@oc/api-infra/group-by";
import {
  buildCursorFilter,
  decodeCursor,
  getNextCursor,
  parseCursorPagination,
  parsePagination,
  parseSort,
} from "@oc/api-infra/pagination";
import { cursorPaginated, error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import {
  type CalculusMethod,
  calculateTierGrant,
  DEFAULT_TIERS,
  findNextTier,
  isQualifyingReferralPurchase,
  type ReferralTier,
} from "@oc/api-referrals/referral-tier-math";
import { requireManager } from "@oc/api-server/middleware/auth";
import { isGuestProfileEmail } from "@oc/auth-admin/auth-hooks";
import { deleteUserAccount } from "@oc/auth-admin/user-deletion";
import { getDisplayName } from "@oc/utils";
import { Hono } from "hono";
import type { PipelineStage } from "mongoose";
import mongoose from "mongoose";

const app = new Hono();

app.use("*", requireManager);

const GUEST_EMAIL_FILTER = { $not: { $regex: /@guest\.onlinecompetitions\.local$/i } };
const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

function buildUserFilter(c: { req: { query: (k: string) => string | undefined } }) {
  const filter: Record<string, unknown> = { email: GUEST_EMAIL_FILTER };
  const isVerified = c.req.query("isVerified");
  const isAdmin = c.req.query("isAdmin");

  if (isVerified === "true") filter.isVerified = true;
  else if (isVerified === "false") filter.isVerified = false;
  if (isAdmin === "true") filter.isAdmin = true;
  else if (isAdmin === "false") filter.isAdmin = false;

  return filter;
}

app.get("/", async (c) => {
  try {
    await dbConnect();

    const showDeleted = c.req.query("showDeleted") === "true";
    const filter = buildUserFilter(c);
    if (!showDeleted) {
      filter.deletedAt = null;
    }
    const search = c.req.query("search");
    if (search) {
      const safe = substringRegex(search);
      filter.$or = [
        { email: { $regex: safe, $options: "i" } },
        { firstName: { $regex: safe, $options: "i" } },
        { lastName: { $regex: safe, $options: "i" } },
        {
          $expr: {
            $regexMatch: { input: { $toString: "$isVerified" }, regex: safe, options: "i" },
          },
        },
        {
          $expr: {
            $regexMatch: { input: { $toString: "$isAdmin" }, regex: safe, options: "i" },
          },
        },
      ];
    }

    if (c.req.query("cursor") !== undefined) {
      const { limit, cursor, sortField, sortDir } = parseCursorPagination(c);
      const cursorData = cursor ? decodeCursor<Record<string, unknown>>(cursor) : null;
      const cursorFilter = buildCursorFilter(sortField, sortDir as 1 | -1, cursorData);

      const query: Record<string, unknown> = { ...filter };
      if (cursorFilter) {
        query.$and = [cursorFilter];
      }

      const profiles = await Profile.find(query)
        .sort({ [sortField]: sortDir as 1 | -1, _id: sortDir as 1 | -1 })
        .limit(limit + 1)
        .lean();

      const hasMore = profiles.length > limit;
      const pageItems = hasMore ? profiles.slice(0, limit) : profiles;
      const nextCursor = getNextCursor(
        pageItems as unknown as Record<string, unknown>[],
        sortField,
        hasMore
      );

      return cursorPaginated(c, pageItems, { limit, hasMore, nextCursor });
    }

    const { limit, page } = parsePagination(c);
    const groupBy = c.req.query("groupBy");
    const { sortObj, sortableFields, sortDir } = parseSort(c, {
      fields: [
        "email",
        "firstName",
        "lastName",
        "isAdmin",
        "isVerified",
        "createdAt",
        "referralMultiplier",
      ],
      defaultSort: { createdAt: -1 },
    });

    const basePipeline: PipelineStage[] = [
      { $match: filter },
      {
        $lookup: {
          from: "profiles",
          localField: "referredBy",
          foreignField: "_id",
          as: "_referredByProfile",
        },
      },
      {
        $addFields: {
          _roleLabel: {
            $switch: {
              branches: [
                { case: { $eq: ["$role", "manager"] }, then: "Manager" },
                { case: { $eq: ["$role", "admin"] }, then: "Admin" },
              ],
              default: "User",
            },
          },
          _verificationLabel: { $cond: [{ $eq: ["$isVerified", true] }, "Verified", "Unverified"] },
          referredByEmail: {
            $ifNull: [{ $arrayElemAt: ["$_referredByProfile.email", 0] }, null],
          },
        },
      },
      { $project: { _referredByProfile: 0 } },
    ];

    const baseCountPipeline: PipelineStage[] = [{ $match: filter }];

    const GROUPING_CONFIG: Record<string, GroupByFieldConfig> = {
      role: { groupKey: "$role", groupLabel: "$_roleLabel" },
      verification: { groupKey: "$isVerified", groupLabel: "$_verificationLabel" },
    };

    const { dataPipeline, countPipeline } = applyGroupBy(
      basePipeline,
      baseCountPipeline,
      groupBy,
      GROUPING_CONFIG,
      page,
      limit,
      sortObj,
      sortDir
    );

    const [profiles, totalResult] = await Promise.all([
      Profile.aggregate(dataPipeline).option({ maxTimeMS: 5000 }).exec(),
      Profile.aggregate(countPipeline).option({ maxTimeMS: 5000 }).exec(),
    ]);

    const total = totalResult.length > 0 ? (totalResult[0] as { total: number }).total : 0;

    return paginated(c, profiles, total, page, limit, { sortableFields });
  } catch (err: unknown) {
    console.error("Error listing profiles:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.users.list",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();

    if (!OBJECT_ID_REGEX.test(id)) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid profile ID format", 400);
    }

    const profile = await Profile.findById(id).lean();

    if (!profile) {
      return error(c, ErrorCodes.NOT_FOUND, "Profile not found", 404);
    }

    let referredByProfile: {
      email: string;
      firstName?: string;
      lastName?: string;
    } | null = null;
    if (profile.referredBy) {
      const referrer = await Profile.findById(profile.referredBy)
        .select("email firstName lastName")
        .lean();
      if (referrer && !isGuestProfileEmail(referrer.email)) {
        referredByProfile = {
          email: referrer.email,
          firstName: referrer.firstName,
          lastName: referrer.lastName,
        };
      }
    }

    return success(c, {
      ...profile,
      referredByEmail: referredByProfile?.email,
      referredByProfile,
    });
  } catch (err: unknown) {
    console.error("Error fetching profile:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.users.getOne",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.put("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    await dbConnect();

    const allowedKeys = ["isVerified", "role", "isAdmin"] as const;
    const bodyKeys = Object.keys(body);

    if (bodyKeys.length === 0) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "No valid fields to update", 400);
    }

    const hasDisallowed = bodyKeys.some(
      (key) => !allowedKeys.includes(key as (typeof allowedKeys)[number])
    );
    if (hasDisallowed) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        "Only isVerified, role, and isAdmin may be updated via this endpoint. Use compliance or profile endpoints for other fields.",
        400
      );
    }

    const nextRole =
      body.role !== undefined
        ? body.role
        : typeof body.isAdmin === "boolean"
          ? body.isAdmin
            ? "admin"
            : "user"
          : undefined;
    const roleChanged = nextRole !== undefined && ["user", "manager", "admin"].includes(nextRole);

    if (typeof body.isVerified === "boolean") {
      await Profile.findByIdAndUpdate(
        id,
        { isVerified: body.isVerified },
        { returnDocument: "after" }
      );
      const { getMongoDb } = await import("@oc/auth-admin/auth-mongo");
      const { updateAuthUserFields } = await import("@oc/api-server/lib/auth-user-sync");
      await updateAuthUserFields(getMongoDb(), id, { emailVerified: body.isVerified });
      void invalidateUser(id).catch(() => {});
    }

    if (roleChanged) {
      if (!body.reason && typeof body.reason !== "string") {
        return error(
          c,
          ErrorCodes.VALIDATION_ERROR,
          "Reason is required when changing admin role",
          400
        );
      }

      const currentAdmin = c.get("user");
      const session = c.get("session") as { createdAt?: Date } | undefined;
      if (
        currentAdmin &&
        session?.createdAt &&
        Date.now() - new Date(session.createdAt).getTime() > 30 * 60 * 1000
      ) {
        return error(
          c,
          ErrorCodes.UNAUTHORIZED,
          "Session is too old for admin role changes. Please re-authenticate.",
          401
        );
      }

      const before = await Profile.findById(id).select("isAdmin role").lean();

      await Profile.findByIdAndUpdate(
        id,
        { role: nextRole, isAdmin: nextRole !== "user" },
        { returnDocument: "after" }
      );
      const { getMongoDb } = await import("@oc/auth-admin/auth-mongo");
      const { updateAuthUserFields } = await import("@oc/api-server/lib/auth-user-sync");
      await updateAuthUserFields(getMongoDb(), id, { role: nextRole });
      void invalidateUser(id).catch(() => {});

      await ComplianceAuditLog.create({
        actorId: c.get("userId"),
        targetUserId: id,
        action: "user_role_change",
        reason: body.reason,
        before: { role: before?.role ?? "user", isAdmin: before?.isAdmin ?? false },
        after: { role: nextRole, isAdmin: nextRole !== "user" },
        source: "admin",
      });
    }

    const profile = await Profile.findById(id).lean();

    if (!profile) {
      return error(c, ErrorCodes.NOT_FOUND, "Profile not found", 404);
    }

    return success(c, profile);
  } catch (err: unknown) {
    console.error("Error updating profile:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.users.update",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.patch("/:id/referral-multiplier", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { referralMultiplier } = body;

    if (typeof referralMultiplier !== "number" || referralMultiplier < 1) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "referralMultiplier must be a number >= 1", 400);
    }

    await dbConnect();

    const before = await Profile.findById(id).select("referralMultiplier").lean();

    const profile = await Profile.findByIdAndUpdate(
      id,
      { referralMultiplier },
      { returnDocument: "after" }
    ).lean();

    void invalidateUser(id).catch(() => {});

    await ComplianceAuditLog.create({
      actorId: c.get("userId"),
      targetUserId: id,
      action: "referral_multiplier_change",
      reason:
        body.reason ?? `Changed from ${before?.referralMultiplier ?? 1} to ${referralMultiplier}`,
      before: { referralMultiplier: before?.referralMultiplier ?? 1 },
      after: { referralMultiplier },
      source: "admin",
    });

    if (!profile) {
      return error(c, ErrorCodes.NOT_FOUND, "Profile not found", 404);
    }

    return success(c, profile);
  } catch (err: unknown) {
    console.error("Error updating referral multiplier:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.users.updateReferralMultiplier",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/:id/referral-stats", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();

    if (!OBJECT_ID_REGEX.test(id)) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid profile ID format", 400);
    }

    const profile = await Profile.findById(id).lean();
    if (!profile) {
      return error(c, ErrorCodes.NOT_FOUND, "Profile not found", 404);
    }

    const settings = await ReferralSettings.findById("referral_settings").lean();
    const activityWindowDays = (settings?.activityWindowDays as number) ?? 30;
    const minSpend = (settings?.minFirstOrderSpend as number) ?? 1;
    const tiers = (settings?.tiers as ReferralTier[]) ?? DEFAULT_TIERS;
    const calculusMethod = (settings?.calculusMethod as CalculusMethod | undefined) ?? "gross";

    const allPurchases = await ReferralPurchase.find({
      referrerId: new mongoose.Types.ObjectId(id),
    })
      .select("orderId purchasedAt referredUserId purchaseAmount")
      .populate<{
        referredUserId: {
          totalSpent: number;
          createdAt: Date;
          avatarUrl?: string;
          firstName?: string;
          lastName?: string;
          email?: string;
        };
      }>("referredUserId", "totalSpent createdAt avatarUrl firstName lastName email")
      .lean();

    const activeReferredUserIds = new Set<string>();
    let totalTicketValueGBP = 0;

    for (const p of allPurchases) {
      const referred = p.referredUserId as unknown as {
        _id?: { toString(): string };
        totalSpent: number;
        createdAt: Date;
      } | null;
      if (
        referred &&
        isQualifyingReferralPurchase(
          p,
          referred._id
            ? {
                _id: referred._id,
                createdAt: referred.createdAt,
                totalSpent: referred.totalSpent,
              }
            : undefined,
          activityWindowDays,
          minSpend
        )
      ) {
        const referredId =
          typeof referred === "object" && referred !== null && "_id" in referred && referred._id
            ? referred._id.toString()
            : String(p.referredUserId);
        activeReferredUserIds.add(referredId);
      }
    }

    if (allPurchases.length > 0) {
      const orderIds = allPurchases.map((p) => p.orderId);
      const orderItems = await OrderItem.find({ orderId: { $in: orderIds } })
        .select("totalPrice")
        .lean();

      for (const item of orderItems) {
        totalTicketValueGBP += item.totalPrice ?? 0;
      }
    }

    const activeReferralCount = activeReferredUserIds.size;
    const totalReferralCount = new Set(
      allPurchases.map((p) =>
        typeof p.referredUserId === "object" && p.referredUserId !== null
          ? p.referredUserId.toString()
          : String(p.referredUserId)
      )
    ).size;
    const pendingReferralCount = totalReferralCount - activeReferralCount;

    const grant = calculateTierGrant({
      validActiveReferees: activeReferralCount,
      tiers,
      profileMultiplier: profile.referralMultiplier ?? 1,
      calculusMethod,
    });
    const tierTickets = grant.tickets;

    const nextTier = findNextTier(activeReferralCount, tiers);
    const nextTierThreshold = nextTier?.threshold ?? 0;
    const referralsToNextTier = nextTierThreshold > 0 ? nextTierThreshold - activeReferralCount : 0;

    let nextTierTickets = 0;
    if (nextTier) {
      const nextGrant = calculateTierGrant({
        validActiveReferees: nextTier.threshold,
        tiers,
        profileMultiplier: profile.referralMultiplier ?? 1,
        calculusMethod,
      });
      nextTierTickets = nextGrant.tickets;
    }

    const seenUserIds = new Set<string>();
    const recentReferralUsers: Array<{
      id: string;
      name: string;
      email: string;
      avatarUrl?: string | null;
      isActive: boolean;
    }> = [];

    for (const p of allPurchases) {
      const referred = p.referredUserId as unknown as {
        _id?: { toString(): string };
        firstName?: string;
        lastName?: string;
        email?: string;
        avatarUrl?: string;
      } | null;
      if (referred?._id) {
        const id = referred._id.toString();
        if (!seenUserIds.has(id)) {
          seenUserIds.add(id);
          recentReferralUsers.push({
            id,
            name:
              referred.email && /@guest\.onlinecompetitions\.local$/i.test(referred.email)
                ? "Unregistered"
                : getDisplayName(
                    {
                      firstName: referred.firstName ?? undefined,
                      lastName: referred.lastName ?? undefined,
                    },
                    referred.email ?? ""
                  ),
            email: referred.email ?? "",
            avatarUrl: referred.avatarUrl,
            isActive: activeReferredUserIds.has(id),
          });
        }
      }
    }

    return success(c, {
      activeReferralCount,
      totalReferralCount,
      pendingReferralCount,
      totalTicketsEarned: profile.referralTierAwardedTickets ?? 0,
      totalTicketValueGBP,
      tierTickets,
      referralsToNextTier,
      nextTierTickets,
      currentMultiplier: profile.referralMultiplier ?? 1,
      totalReferralSpendGBP: allPurchases.reduce((sum, p) => {
        const referred = p.referredUserId as unknown as { totalSpent: number } | null;
        return sum + (referred?.totalSpent ?? 0);
      }, 0),
      recentReferralUsers,
    });
  } catch (err: unknown) {
    console.error("Error fetching referral stats:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.users.referralStats",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/:id/activity-timeline", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();

    if (!OBJECT_ID_REGEX.test(id)) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid profile ID format", 400);
    }

    const limitRaw = Number(c.req.query("limit"));
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 200) : 50;
    const includeDeleted = c.req.query("includeDeleted") === "true";

    const { getUserActivityTimeline } = await import("@oc/api-referrals/timeline");
    const events = await getUserActivityTimeline(id, {
      limit,
      includeDeleted,
    });
    return success(c, { events });
  } catch (err: unknown) {
    console.error("Error fetching user activity timeline:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.users.activityTimeline",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await dbConnect();

    if (!OBJECT_ID_REGEX.test(id)) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid profile ID format", 400);
    }

    const profile = await Profile.findById(id).lean();
    if (!profile) {
      return error(c, ErrorCodes.NOT_FOUND, "Profile not found", 404);
    }

    await deleteUserAccount(id, c.req.raw.headers);

    return success(c, { success: true });
  } catch (err: unknown) {
    console.error("Error deleting user:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.users.delete",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
