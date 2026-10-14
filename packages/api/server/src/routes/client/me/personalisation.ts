import {
  AiPersonalisationSettings,
  DEFAULT_AI_PERSONALISATION_SETTINGS,
  type IAiPersonalisationSettings,
} from "@oc/api-db/models";
import type { AiPersonalisationSettings as AiPersonalisationSettingsType } from "@oc/types";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import {
  getActionCooldownHours,
  recordPersonalisationActionCooldown,
} from "@oc/api-server/lib/personalisation/action-cooldown";
import { evaluatePersonalisationPlan } from "@oc/api-server/lib/personalisation/evaluate-plan";
import { requireSession } from "@oc/api-server/middleware/auth";
import { personalisationAckSchema, personalisationServeQuerySchema } from "@oc/api-validation";
import { Hono } from "hono";

const app = new Hono();

app.use("*", requireSession);

function mergeSettings(raw: IAiPersonalisationSettings | null): AiPersonalisationSettingsType {
  if (!raw) return DEFAULT_AI_PERSONALISATION_SETTINGS;
  return { ...DEFAULT_AI_PERSONALISATION_SETTINGS, ...raw };
}

function sessionKeyFromRequest(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header("x-personalisation-session")?.trim() || "default";
}

app.get("/", async (c) => {
  try {
    const userId = c.get("userId")!;
    const query = personalisationServeQuerySchema.safeParse({
      surface: c.req.query("surface"),
    });
    if (!query.success) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid surface", 400);
    }

    await dbConnect();
    const settingsDoc = await AiPersonalisationSettings.findById("ai_personalisation_settings").lean();
    const settings = mergeSettings(settingsDoc as IAiPersonalisationSettings | null);

    const result = await evaluatePersonalisationPlan({
      userId,
      surface: query.data.surface,
      settings,
      sessionKey: sessionKeyFromRequest(c),
    });

    return success(c, result);
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "me.personalisation.get",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/ack", async (c) => {
  try {
    const userId = c.get("userId")!;
    const body = await c.req.json();
    const parsed = personalisationAckSchema.safeParse(body);
    if (!parsed.success) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid acknowledgement", 400);
    }

    await dbConnect();
    const settingsDoc = await AiPersonalisationSettings.findById("ai_personalisation_settings").lean();
    const settings = mergeSettings(settingsDoc as IAiPersonalisationSettings | null);

    const action = parsed.data.action;
    if (action !== "none") {
      const cooldownHours = getActionCooldownHours(settings, action);
      await recordPersonalisationActionCooldown(userId, action, cooldownHours);
    }

    return success(c, { recorded: true });
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "me.personalisation.ack",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
