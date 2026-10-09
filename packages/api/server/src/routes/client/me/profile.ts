import { buildDateOfBirthProfileUpdate } from "@oc/api-compliance/age-verification";
import {
  BonusAwardWin,
  InstantPrizeWin,
  Order,
  Profile,
  Ticket,
  Winner,
} from "@oc/api-db/models";
import type { IProfile } from "@oc/api-db/models/Profile";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { defaultCountMaxTimeMS } from "@oc/api-infra/mongo-query-options";
import { parsePagination } from "@oc/api-infra/pagination";
import { error, paginated, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { requireSession } from "@oc/api-server/middleware/auth";
import { createOnlineCompetitionsProfile, reassignGuestOrdersByEmail } from "@oc/auth-admin/auth-hooks";
import { Hono } from "hono";
import mongoose from "mongoose";

const app = new Hono();

app.use("*", requireSession);

app.get("/", async (c) => {
  try {
    const userId = c.get("userId")!;
    const user = c.get("user")!;
    await dbConnect();

    let profile = await Profile.findById(userId).lean();
    if (!profile && !user.isAnonymous) {
      await createOnlineCompetitionsProfile(user);
      profile = await Profile.findById(userId).lean();
    }

    if (!profile) {
      return success(c, {
        _id: userId,
        email: user.email,
        referredByCode: null,
        country: "GB",
        isVerified: user.emailVerified ?? false,
        isAdmin: user.role === "admin",
        completedOrderCount: 0,
      });
    }

    void reassignGuestOrdersByEmail(user.email, userId).catch(() => {});

    const completedOrderCount = await Order.countDocuments({
      userId,
      status: "completed",
    }).maxTimeMS(defaultCountMaxTimeMS());

    return success(c, {
      ...profile,
      isAdmin: user.role === "admin",
      isVerified: user.emailVerified ?? profile.isVerified,
      completedOrderCount,
    });
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "me.profile.get",
    });
    console.error("Error fetching profile:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.put("/", async (c) => {
  try {
    const userId = c.get("userId")!;
    const body = await c.req.json();
    await dbConnect();

    const allowedFields = [
      "firstName",
      "lastName",
      "phone",
      "dateOfBirth",
      "addressLine1",
      "addressLine2",
      "city",
      "postcode",
      "country",
      "marketingConsent",
      "instagram",
      "facebook",
      "twitter",
      "tiktok",
      "youtube",
      "websiteUrl",
      "showLastName",
      "showLocation",
      "showSocials",
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (updateData.dateOfBirth) {
      const dobFields = await buildDateOfBirthProfileUpdate(String(updateData.dateOfBirth));
      if (dobFields) {
        updateData.dateOfBirth = dobFields.dateOfBirth;
        if (dobFields.isAgeVerified !== undefined)
          updateData.isAgeVerified = dobFields.isAgeVerified;
        if (dobFields.ageVerifiedAt !== undefined)
          updateData.ageVerifiedAt = dobFields.ageVerifiedAt;
        if (dobFields.ageVerificationMethod !== undefined) {
          updateData.ageVerificationMethod = dobFields.ageVerificationMethod;
        }
      } else {
        delete updateData.dateOfBirth;
      }
    }

    const profile = await Profile.findByIdAndUpdate(userId, updateData as Partial<IProfile>, {
      returnDocument: "after",
      runValidators: true,
    }).lean();

    if (!profile) {
      return error(c, ErrorCodes.NOT_FOUND, "Profile not found", 404);
    }

    if (updateData.firstName || updateData.lastName) {
      try {
        const name = [updateData.firstName, updateData.lastName].filter(Boolean).join(" ").trim();
        if (name && mongoose.connection.db) {
          const { updateAuthUserFields } = await import("@oc/api-server/lib/auth-user-sync");
          await updateAuthUserFields(mongoose.connection.db, userId, {
            firstName: updateData.firstName,
            lastName: updateData.lastName,
            name,
          });
        }
      } catch (err) {
        console.warn("[profile] Failed to sync Better Auth user:", err);
      }
    }

    return success(c, profile);
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "me.profile.update",
    });
    console.error("Error updating profile:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/wins", async (c) => {
  try {
    const { limit, page, skip } = parsePagination(c);
    const userId = c.get("userId")!;
    await dbConnect();

    const [wins, total] = await Promise.all([
      Winner.find({ userId: new mongoose.Types.ObjectId(userId) })
        .populate("competitionId", "title slug prizeImageUrl drawDate")
        .sort({ drawnAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Winner.countDocuments({ userId: new mongoose.Types.ObjectId(userId) }).maxTimeMS(5000),
    ]);

    return paginated(c, wins, total, page, limit);
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "me.profile.wins",
    });
    console.error("Error fetching wins:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});
app.get("/stats", async (c) => {
  try {
    const userId = c.get("userId")!;
    await dbConnect();

    const profile = await Profile.findById(userId).lean();
    if (!profile) {
      return error(c, ErrorCodes.NOT_FOUND, "Profile not found", 404);
    }

    const oid = new mongoose.Types.ObjectId(userId);
    const [entriesCount, compWins, instWins, bonusWins] = await Promise.all([
      Ticket.countDocuments({ ownerId: oid, status: "sold" }).maxTimeMS(5000),
      Winner.countDocuments({ userId: oid }).maxTimeMS(5000),
      InstantPrizeWin.countDocuments({ userId: oid }).maxTimeMS(5000),
      BonusAwardWin.countDocuments({ userId: oid }).maxTimeMS(5000),
    ]);

    return success(c, {
      activeEntries: entriesCount,
      totalWins: compWins + instWins + bonusWins,
      competitionWins: compWins,
      instantWins: instWins,
      bonusWins: bonusWins,
      totalSpent: profile.totalSpent || 0,
      totalEntries: profile.totalEntries || 0,
    });
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "me.profile.stats",
    });
    console.error("Error fetching stats:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
