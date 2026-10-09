import { liftSelfExclusion } from "@oc/api-compliance/compliance-user-service";
import { Profile, SelfExclusionOverrideRequest } from "@oc/api-db/models";
import { sendEmail } from "@oc/api-email";
import { getEmailConfig } from "@oc/api-email/config";
import { SelfExclusionOverrideActionEmail } from "@oc/api-email/templates/self-exclusion-override-action";
import { ComplianceError } from "@oc/api-errors";
import dbConnect from "@oc/api-infra/db";
import { getCurrentContext } from "@oc/api-infra/env";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { sendPushNotification } from "@oc/api-server/lib/push";
import { requireAdmin } from "@oc/api-server/middleware/auth";
import { processOverrideRequestSchema, adminLiftSelfExclusionSchema } from "@oc/api-validation";
import { getEnv } from "@oc/env/server";
import { render } from "@react-email/render";
import { Hono } from "hono";

const app = new Hono();

app.use("*", requireAdmin);

async function sendSelfExclusionLiftEmail(
  profile: { email: string; firstName?: string | null; lastName?: string | null },
  action: "approved" | "rejected",
  adminNote?: string
): Promise<{ emailSent: boolean; emailError?: string }> {
  const clientUrl = getEnv("CLIENT_APP_URL")?.trim() || getCurrentContext().frontendUrl;
  const userEmail = profile.email;
  if (!userEmail) {
    return { emailSent: false, emailError: "User has no email address" };
  }
  const userName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "there";
  try {
    const emailSettings = await getEmailConfig();
    const emailHtml = await render(
      SelfExclusionOverrideActionEmail({
        userName,
        action,
        adminNote: adminNote ?? undefined,
        settings: emailSettings,
        frontendUrl: clientUrl,
      })
    );
    const result = await sendEmail({
      to: userEmail,
      subject:
        action === "approved"
          ? "Your self-exclusion has been lifted — Online Competitions"
          : "Your override request has been reviewed — Online Competitions",
      html: emailHtml,
    });
    if (!result.success) {
      console.error(
        `Failed to send self-exclusion ${action} email to ${userEmail}:`,
        result.error
      );
      return { emailSent: false, emailError: result.error || "Email send failed" };
    }
    return { emailSent: true };
  } catch (emailErr) {
    console.error(`Failed to send self-exclusion ${action} email:`, emailErr);
    return {
      emailSent: false,
      emailError: emailErr instanceof Error ? emailErr.message : "Email send error",
    };
  }
}

// GET / — list all self-excluded users with their override request (if any)
app.get("/", async (c) => {
  try {
    await dbConnect();

    const selfExcludedProfiles = await Profile.find({
      selfExcluded: true,
    })
      .select("email firstName lastName selfExcludedAt selfExcludedUntil")
      .sort({ selfExcludedAt: -1 })
      .lean();

    const userIds = selfExcludedProfiles.map((p) => p._id);

    const overrideRequests = await SelfExclusionOverrideRequest.find({
      userId: { $in: userIds },
    })
      .sort({ createdAt: -1 })
      .lean();

    const requestMap = new Map<string, (typeof overrideRequests)[0]>();
    for (const req of overrideRequests) {
      const key = req.userId.toString();
      if (!requestMap.has(key)) {
        requestMap.set(key, req);
      }
    }

    const data = selfExcludedProfiles.map((profile) => {
      const req = requestMap.get(profile._id.toString());
      return {
        userId: profile._id.toString(),
        email: profile.email,
        firstName: profile.firstName ?? "",
        lastName: profile.lastName ?? "",
        selfExcludedAt: profile.selfExcludedAt?.toISOString() ?? new Date().toISOString(),
        selfExcludedUntil: profile.selfExcludedUntil?.toISOString() ?? null,
        isPermanent: !profile.selfExcludedUntil,
        overrideRequest: req
          ? {
              _id: req._id.toString(),
              status: req.status as "pending" | "approved" | "rejected",
              userReason: req.userReason,
              createdAt: req.createdAt.toISOString(),
            }
          : null,
      };
    });

    return success(c, data);
  } catch (err: unknown) {
    if (err instanceof ComplianceError) {
      return error(c, err.code, err.message, err.status);
    }
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.selfExclusionOverrides.list",
    });
    console.error("Error listing self-excluded users:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

// PATCH /:userId/process — approve or reject an override request
app.patch("/:userId/process", async (c) => {
  try {
    const targetUserId = c.req.param("userId");
    const actorId = c.get("userId")!;
    const body = await c.req.json();
    await dbConnect();

    const parsed = processOverrideRequestSchema.safeParse(body);
    if (!parsed.success) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        parsed.error.issues.map((e) => e.message).join(", "),
        400
      );
    }

    const { action, adminNote } = parsed.data;

    const request = await SelfExclusionOverrideRequest.findOne({
      userId: targetUserId,
      status: "pending",
    }).lean();

    if (!request) {
      return error(c, ErrorCodes.NOT_FOUND, "No pending override request found", 404);
    }

    const profile = await Profile.findById(targetUserId).select("email firstName lastName").lean();

    if (!profile) {
      return error(c, ErrorCodes.NOT_FOUND, "Profile not found", 404);
    }

    let emailStatus: { emailSent: boolean; emailError?: string } = { emailSent: true };

    if (action === "approve") {
      await liftSelfExclusion(targetUserId, {
        actorId,
        reason: request.userReason,
        source: "admin",
        acknowledgePermanent: true,
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

      await SelfExclusionOverrideRequest.findByIdAndUpdate(request._id, {
        $set: {
          status: "approved",
          processedBy: actorId,
          adminNote: adminNote ?? null,
          processedAt: new Date(),
        },
      });

      emailStatus = await sendSelfExclusionLiftEmail(profile, "approved", adminNote);
    } else {
      await SelfExclusionOverrideRequest.findByIdAndUpdate(request._id, {
        $set: {
          status: "rejected",
          processedBy: actorId,
          adminNote: adminNote ?? null,
          processedAt: new Date(),
        },
      });

      emailStatus = await sendSelfExclusionLiftEmail(profile, "rejected", adminNote);
    }

    return success(c, { processed: true, ...emailStatus });
  } catch (err: unknown) {
    if (err instanceof ComplianceError) {
      return error(c, err.code, err.message, err.status);
    }
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.selfExclusionOverrides.process",
    });
    console.error("Error processing override request:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

// PATCH /:userId/lift — admin removes self-exclusion without a user override request
app.patch("/:userId/lift", async (c) => {
  try {
    const targetUserId = c.req.param("userId");
    const actorId = c.get("userId")!;
    const body = await c.req.json();
    await dbConnect();

    const parsed = adminLiftSelfExclusionSchema.safeParse(body);
    if (!parsed.success) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        parsed.error.issues.map((e) => e.message).join(", "),
        400
      );
    }

    const profile = await Profile.findById(targetUserId)
      .select("email firstName lastName selfExcluded selfExcludedUntil")
      .lean();

    if (!profile) {
      return error(c, ErrorCodes.NOT_FOUND, "Profile not found", 404);
    }

    const isPermanent = profile.selfExcluded && !profile.selfExcludedUntil;
    if (isPermanent && !parsed.data.acknowledgePermanent) {
      return error(
        c,
        ErrorCodes.VALIDATION_ERROR,
        "Permanent self-exclusion requires acknowledgePermanent",
        400
      );
    }

    await liftSelfExclusion(targetUserId, {
      actorId,
      reason: parsed.data.reason,
      source: "admin",
      acknowledgePermanent: isPermanent ? true : undefined,
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

    const emailStatus = await sendSelfExclusionLiftEmail(profile, "approved", parsed.data.reason);

    return success(c, { lifted: true, ...emailStatus });
  } catch (err: unknown) {
    if (err instanceof ComplianceError) {
      return error(c, err.code, err.message, err.status);
    }
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.selfExclusionOverrides.lift",
    });
    console.error("Error lifting self-exclusion:", err);
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
