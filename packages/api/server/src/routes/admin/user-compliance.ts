import {
  applySelfExclusion,
  applySpendLimit,
  buildAdminUserComplianceState,
  cancelPendingSpendIncrease,
  liftSelfExclusion,
  setAgeVerified,
} from "@oc/api-compliance/compliance-user-service";
import { ComplianceAuditLog, Profile } from "@oc/api-db/models";
import { ComplianceError } from "@oc/api-errors";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { sendPushNotification } from "@oc/api-server/lib/push";
import { getRequiredUserId, requireAdmin } from "@oc/api-server/middleware/auth";
import type { AdminComplianceOverrideInput } from "@oc/api-validation";
import {
  adminComplianceAuditQuerySchema,
  adminComplianceOverrideSchema,
} from "@oc/api-validation";
import { getBool } from "@oc/env/server";
import { Hono } from "hono";

const app = new Hono();

app.use("*", requireAdmin);

function canTargetUser(actorId: string, targetUserId: string): boolean {
  if (actorId !== targetUserId) return true;
  return getBool("ADMIN_COMPLIANCE_SELF_OVERRIDE", false);
}

app.get("/:id/compliance", async (c) => {
  try {
    const targetUserId = c.req.param("id");
    await dbConnect();

    const profile = await Profile.findById(targetUserId).select("_id").lean();
    if (!profile) {
      return error(c, ErrorCodes.NOT_FOUND, "Profile not found", 404);
    }

    const state = await buildAdminUserComplianceState(targetUserId);
    return success(c, state);
  } catch (err: unknown) {
    if (err instanceof ComplianceError) {
      return error(c, err.code, err.message, err.status);
    }
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.userCompliance.get",
    });
    console.error("Error fetching user compliance:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.patch("/:id/compliance", async (c) => {
  try {
    const targetUserId = c.req.param("id");
    const actorId = getRequiredUserId(c);
    const body = await c.req.json();
    await dbConnect();

    const parsed = adminComplianceOverrideSchema.safeParse(body);
    if (!parsed.success) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid compliance override request", 400);
    }

    if (!canTargetUser(actorId, targetUserId)) {
      return error(c, ErrorCodes.FORBIDDEN, "Cannot override your own compliance settings", 403);
    }

    const profile = await Profile.findById(targetUserId).select("_id").lean();
    if (!profile) {
      return error(c, ErrorCodes.NOT_FOUND, "Profile not found", 404);
    }

    const input: AdminComplianceOverrideInput = parsed.data;

    switch (input.action) {
      case "set_spend_limit":
        await applySpendLimit(targetUserId, input.monthlySpendLimit, {
          bypassCooldown: input.bypassCooldown,
          reason: input.reason,
          actorId,
          source: "admin",
        });
        break;
      case "clear_pending_spend_limit":
        await cancelPendingSpendIncrease(targetUserId, {
          reason: input.reason,
          actorId,
        });
        break;
      case "impose_self_exclusion":
        await applySelfExclusion(targetUserId, input.duration, {
          reason: input.reason,
          actorId,
          source: "admin",
        });
        break;
      case "lift_self_exclusion":
        await liftSelfExclusion(targetUserId, {
          reason: input.reason,
          actorId,
          source: "admin",
          acknowledgePermanent: input.acknowledgePermanent,
          onLifted: (uid) => {
            void sendPushNotification(
              {
                title: "Self-exclusion lifted",
                body: "Your self-exclusion has been lifted by an admin.",
                type: "system",
                url: "/dashboard",
                tag: `self-exclusion-${uid}`,
              },
              { userId: uid }
            ).catch(() => {});
          },
        });
        break;
      case "set_age_verified":
        await setAgeVerified(targetUserId, input.isAgeVerified, {
          actorId,
          reason: input.reason,
        });
        break;
    }

    const state = await buildAdminUserComplianceState(targetUserId);
    return success(c, state);
  } catch (err: unknown) {
    if (err instanceof ComplianceError) {
      return error(c, err.code, err.message, err.status);
    }
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.userCompliance.update",
    });
    console.error("Error updating user compliance:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/:id/compliance/audit", async (c) => {
  try {
    const targetUserId = c.req.param("id");
    const queryParsed = adminComplianceAuditQuerySchema.safeParse(c.req.query());
    if (!queryParsed.success) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid query parameters", 400);
    }

    await dbConnect();

    const profile = await Profile.findById(targetUserId).select("_id").lean();
    if (!profile) {
      return error(c, ErrorCodes.NOT_FOUND, "Profile not found", 404);
    }

    const { limit } = queryParsed.data;
    const entries = await ComplianceAuditLog.find({ targetUserId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return success(
      c,
      entries.map((entry) => ({
        _id: entry._id.toString(),
        actorId: entry.actorId,
        targetUserId: entry.targetUserId,
        action: entry.action,
        reason: entry.reason,
        before: entry.before,
        after: entry.after,
        source: entry.source,
        createdAt: entry.createdAt.toISOString(),
      }))
    );
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.userCompliance.audit",
    });
    console.error("Error fetching compliance audit log:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
