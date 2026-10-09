import {
  BonusAwardWin,
  InstantPrizeWin,
  Order,
  Profile,
  PromoCode,
  Winner,
} from "@oc/api-db/models";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { requireAdmin } from "@oc/api-server/middleware/auth";
import { deleteUserAccount } from "@oc/auth-admin/user-deletion";
import { Hono } from "hono";

const app = new Hono();

app.use("*", requireAdmin);

const VALID_USER_ACTIONS = ["verify", "unverify", "grant-admin", "revoke-admin", "delete"] as const;
const VALID_ORDER_ACTIONS = ["delete"] as const;
const VALID_WINNER_ACTIONS = ["claim", "unclaim", "delete"] as const;
const VALID_INSTANT_PRIZE_WIN_ACTIONS = ["claim", "unclaim", "delete"] as const;
const VALID_PROMO_ACTIONS = ["activate", "deactivate", "delete"] as const;
const VALID_BONUS_AWARD_WIN_ACTIONS = ["delete"] as const;

function validateBulkBody(body: unknown): { ids: string[]; action: string } | null {
  if (typeof body !== "object" || body === null) return null;
  const { ids, action } = body as Record<string, unknown>;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    !ids.every((id): id is string => typeof id === "string" && id.length > 0)
  )
    return null;
  if (typeof action !== "string" || action.length === 0) return null;
  return { ids, action };
}

app.post("/users", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = validateBulkBody(body);
    if (!parsed || !(VALID_USER_ACTIONS as readonly string[]).includes(parsed.action)) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        "Invalid ids or action. Allowed: verify, unverify, grant-admin, revoke-admin, delete",
        400
      );
    }

    await dbConnect();

    if (parsed.action === "delete") {
      const results = await Promise.allSettled(
        parsed.ids.map((id) => deleteUserAccount(id, c.req.raw.headers))
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;
      const errors = results
        .filter((r): r is PromiseRejectedResult => r.status === "rejected")
        .map((r) => r.reason?.message ?? "Unknown error");
      return success(c, { count: succeeded, failed, errors });
    } else {
      const update =
        parsed.action === "verify"
          ? { isVerified: true }
          : parsed.action === "unverify"
            ? { isVerified: false }
            : parsed.action === "grant-admin"
              ? { isAdmin: true, role: "admin" }
              : { isAdmin: false, role: "user" };
      const r = await Profile.updateMany({ _id: { $in: parsed.ids } }, update);

      if (parsed.action === "grant-admin" || parsed.action === "revoke-admin") {
        const { getMongoDb } = await import("@oc/auth-admin/auth-mongo");
        const { updateManyAuthUserFields } = await import("@oc/api-server/lib/auth-user-sync");
        await updateManyAuthUserFields(getMongoDb(), parsed.ids, {
          role: parsed.action === "grant-admin" ? "admin" : "user",
        });
      }

      return success(c, { count: r.modifiedCount });
    }
  } catch (err: unknown) {
    console.error("Error in bulk users action:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.bulk.users",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/orders", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = validateBulkBody(body);
    if (!parsed || !(VALID_ORDER_ACTIONS as readonly string[]).includes(parsed.action)) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid ids or action. Allowed: delete", 400);
    }

    await dbConnect();

    const userId = c.get("userId") as string | undefined;
    const results = await Promise.allSettled(parsed.ids.map((id) => Order.softDelete(id, userId)));
    const count = results.filter((r) => r.status === "fulfilled").length;

    return success(c, { count });
  } catch (err: unknown) {
    console.error("Error in bulk orders action:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.bulk.orders",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/winners", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = validateBulkBody(body);
    if (!parsed || !(VALID_WINNER_ACTIONS as readonly string[]).includes(parsed.action)) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        "Invalid ids or action. Allowed: claim, unclaim, delete",
        400
      );
    }

    await dbConnect();

    let count: number;
    if (parsed.action === "delete") {
      const userId = c.get("userId") as string | undefined;
      const winners = await Winner.find({ _id: { $in: parsed.ids } })
        .select("claimed _id")
        .lean();
      const claimableIds = winners.filter((w) => !w.claimed).map((w) => w._id.toString());
      const results = await Promise.allSettled(
        claimableIds.map((id) => Winner.softDelete(id, userId))
      );
      count = results.filter((r) => r.status === "fulfilled").length;
    } else {
      const r = await Winner.updateMany(
        { _id: { $in: parsed.ids }, deletedAt: null },
        { claimed: parsed.action === "claim" }
      );
      count = r.modifiedCount;
    }

    return success(c, { count });
  } catch (err: unknown) {
    console.error("Error in bulk winners action:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.bulk.winners",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/instant-prize-wins", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = validateBulkBody(body);
    if (
      !parsed ||
      !(VALID_INSTANT_PRIZE_WIN_ACTIONS as readonly string[]).includes(parsed.action)
    ) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        "Invalid ids or action. Allowed: claim, unclaim, delete",
        400
      );
    }

    await dbConnect();

    let count: number;
    if (parsed.action === "delete") {
      const userId = c.get("userId") as string | undefined;
      const wins = await InstantPrizeWin.find({ _id: { $in: parsed.ids } })
        .select("claimed _id")
        .lean();
      const claimableIds = wins.filter((w) => !w.claimed).map((w) => w._id.toString());
      const results = await Promise.allSettled(
        claimableIds.map((id) => InstantPrizeWin.softDelete(id, userId))
      );
      count = results.filter((r) => r.status === "fulfilled").length;
    } else {
      const r = await InstantPrizeWin.updateMany(
        { _id: { $in: parsed.ids }, deletedAt: null },
        { claimed: parsed.action === "claim" }
      );
      count = r.modifiedCount;
    }

    return success(c, { count });
  } catch (err: unknown) {
    console.error("Error in bulk instant-prize-wins action:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.bulk.instantPrizeWins",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/bonus-award-wins", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = validateBulkBody(body);
    if (!parsed || !(VALID_BONUS_AWARD_WIN_ACTIONS as readonly string[]).includes(parsed.action)) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid ids or action. Allowed: delete", 400);
    }

    await dbConnect();

    const result = await BonusAwardWin.updateMany(
      { _id: { $in: parsed.ids }, claimed: false, deletedAt: null },
      { $set: { deletedAt: new Date() } }
    );

    await invalidateByChannelSafe(CH.bonusAwardWins, CH.bonusAwardTemplates);

    return success(c, { count: result.modifiedCount });
  } catch (err: unknown) {
    console.error("Error in bulk bonus-award-wins action:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.bulk.bonusAwardWins",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/promo-codes", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = validateBulkBody(body);
    if (!parsed || !(VALID_PROMO_ACTIONS as readonly string[]).includes(parsed.action)) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        "Invalid ids or action. Allowed: activate, deactivate, delete",
        400
      );
    }

    await dbConnect();

    let count: number;
    if (parsed.action === "delete") {
      const userId = c.get("userId") as string | undefined;
      const results = await Promise.allSettled(
        parsed.ids.map((id) => PromoCode.softDelete(id, userId))
      );
      count = results.filter((r) => r.status === "fulfilled").length;
    } else {
      const r = await PromoCode.updateMany(
        { _id: { $in: parsed.ids }, deletedAt: null },
        { isActive: parsed.action === "activate" }
      );
      count = r.modifiedCount;
    }

    return success(c, { count });
  } catch (err: unknown) {
    console.error("Error in bulk promo-codes action:", err);
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.bulk.promoCodes",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
