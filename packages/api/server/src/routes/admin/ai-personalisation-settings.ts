import {
  AiPersonalisationSettings,
  DEFAULT_AI_PERSONALISATION_SETTINGS,
  PersonalisationPlannerRun,
  type IAiPersonalisationSettings,
} from "@oc/api-db/models";
import { resolveCompetitionImagePromptTemplate } from "@oc/types";
import dbConnect from "@oc/api-infra/db";
import { ErrorCodes } from "@oc/api-infra/error-codes";
import { error, success } from "@oc/api-infra/response";
import { captureRouteError } from "@oc/api-infra/sentry";
import { runPersonalisationPlanner } from "@oc/api-server/lib/jobs/run-personalisation-planner";
import { buildCompetitionImagePrompt } from "@oc/api-server/lib/openrouter/build-competition-image-prompt";
import { enhanceCompetitionDescriptionViaOpenRouter } from "@oc/api-server/lib/openrouter/enhance-competition-description";
import { generateCompetitionImageViaOpenRouter } from "@oc/api-server/lib/openrouter/generate-competition-image";
import {
  fetchOpenRouterBalance,
  OpenRouterBalanceError,
} from "@oc/api-server/lib/openrouter/get-openrouter-balance";
import { listOpenRouterImageModels } from "@oc/api-server/lib/openrouter/list-image-models";
import {
  listOpenRouterModelsForTier,
  OpenRouterModelsError,
} from "@oc/api-server/lib/openrouter/list-models";
import { requireAdmin } from "@oc/api-server/middleware/auth";
import {
  adminAiPersonalisationSettingsUpdateSchema,
  competitionAiEnhanceDescriptionSchema,
  competitionAiGenerateImageSchema,
  openRouterModelsScanSchema,
} from "@oc/api-validation";
import { Hono } from "hono";

const app = new Hono();

app.use("*", requireAdmin);

const SETTINGS_UPDATE_KEYS = [
  "addonEnabled",
  "openRouterApiKey",
  "model",
  "tone",
  "upsellPopup",
  "upsellPopupCooldownHours",
  "competitionHighlight",
  "competitionHighlightCooldownHours",
  "ticketBundleSuggestion",
  "ticketBundleSuggestionCooldownHours",
  "respectSpendLimits",
  "maxPromptsPerSession",
  "brandInstructions",
  "plannerEnabled",
  "plannerIntervalHours",
  "audienceMode",
  "audienceOrdersWithinDays",
  "audienceActivityWithinDays",
  "requireMarketingConsent",
  "maxUsersPerRun",
  "maxLlmBatchesPerRun",
  "usersPerLlmBatch",
  "maxOutputTokensPerBatch",
  "plannerModel",
  "dryRunPlanner",
  "imageGenerationEnabled",
  "imageGenerationModel",
  "imageGenerationPromptTemplate",
  "imageGenerationBrandColors",
  "imageGenerationReferenceImageUrl",
  "imageGenerationAspectRatio",
  "descriptionEnhancementModel",
] as const;

function mergeSettings(raw: IAiPersonalisationSettings | null): IAiPersonalisationSettings {
  if (!raw) return DEFAULT_AI_PERSONALISATION_SETTINGS;
  return {
    ...DEFAULT_AI_PERSONALISATION_SETTINGS,
    ...raw,
    imageGenerationPromptTemplate: resolveCompetitionImagePromptTemplate(
      raw.imageGenerationPromptTemplate
    ),
  };
}

function adminSettingsResponse(raw: IAiPersonalisationSettings | null) {
  const merged = mergeSettings(raw);
  const configured = Boolean(merged.openRouterApiKey?.trim());
  return {
    ...merged,
    openRouterApiKeyConfigured: configured,
  };
}

app.get("/", async (c) => {
  try {
    await dbConnect();
    const settings = await AiPersonalisationSettings.findById("ai_personalisation_settings").lean();
    return success(c, adminSettingsResponse(settings as IAiPersonalisationSettings | null));
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.aiPersonalisationSettings.get",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.get("/openrouter/balance", async (c) => {
  try {
    await dbConnect();
    const settings = await AiPersonalisationSettings.findById("ai_personalisation_settings")
      .select("openRouterApiKey")
      .lean();
    const apiKey = settings?.openRouterApiKey?.trim() ?? "";
    const snapshot = await fetchOpenRouterBalance(apiKey);
    return success(c, snapshot);
  } catch (err: unknown) {
    if (err instanceof OpenRouterBalanceError) {
      const status =
        err.code === "INVALID_API_KEY" ? 401 : err.code === "MISSING_API_KEY" ? 400 : 502;
      return error(c, ErrorCodes.VALIDATION_ERROR, err.message, status);
    }
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.aiPersonalisationSettings.openRouterBalance",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Failed to load OpenRouter balance", 500);
  }
});

app.get("/planner-runs/latest", async (c) => {
  try {
    await dbConnect();
    const run = await PersonalisationPlannerRun.findOne().sort({ startedAt: -1 }).lean();
    return success(c, run ?? null);
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.aiPersonalisationSettings.plannerRunsLatest",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

app.post("/planner/run", async (c) => {
  try {
    await dbConnect();
    const summary = await runPersonalisationPlanner();
    return success(c, summary);
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.aiPersonalisationSettings.plannerRun",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Planner run failed", 500);
  }
});

app.post("/models/scan-images", async (c) => {
  try {
    await dbConnect();
    const settings = await AiPersonalisationSettings.findById("ai_personalisation_settings")
      .select("openRouterApiKey")
      .lean();
    const apiKey = settings?.openRouterApiKey?.trim() ?? "";
    const models = await listOpenRouterImageModels(apiKey);
    return success(c, { models, scannedAt: new Date().toISOString() });
  } catch (err: unknown) {
    if (err instanceof OpenRouterModelsError) {
      const status =
        err.code === "INVALID_API_KEY" ? 401 : err.code === "MISSING_API_KEY" ? 400 : 502;
      return error(c, ErrorCodes.VALIDATION_ERROR, err.message, status);
    }
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.aiPersonalisationSettings.scanImageModels",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Failed to scan image models", 500);
  }
});

app.post("/competition/generate-image", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = competitionAiGenerateImageSchema.safeParse(body);
    if (!parsed.success) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid generate image request", 400);
    }

    await dbConnect();
    const settingsDoc = await AiPersonalisationSettings.findById("ai_personalisation_settings").lean();
    const settings = mergeSettings(settingsDoc as IAiPersonalisationSettings | null);

    if (!settings.imageGenerationEnabled) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Image generation is disabled", 400);
    }
    const apiKey = settings.openRouterApiKey?.trim();
    if (!apiKey) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "OpenRouter API key is required", 400);
    }

    const prompt =
      parsed.data.prompt?.trim() ||
      buildCompetitionImagePrompt(settings.imageGenerationPromptTemplate, {
        title: parsed.data.title,
        description: parsed.data.description,
        brandColors: settings.imageGenerationBrandColors,
        referenceImageUrl: settings.imageGenerationReferenceImageUrl,
        aspectRatio: settings.imageGenerationAspectRatio,
      });

    const result = await generateCompetitionImageViaOpenRouter({
      apiKey,
      model: settings.imageGenerationModel,
      prompt,
      aspectRatio: settings.imageGenerationAspectRatio,
      referenceImageUrl: settings.imageGenerationReferenceImageUrl,
      uploadKeyPrefix: parsed.data.slug ?? parsed.data.title,
    });

    return success(c, { publicUrl: result.publicUrl, promptUsed: prompt });
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.aiPersonalisationSettings.competitionGenerateImage",
    });
    const message = err instanceof Error ? err.message : "Image generation failed";
    return error(c, ErrorCodes.INTERNAL_ERROR, message, 500);
  }
});

app.post("/competition/enhance-description", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = competitionAiEnhanceDescriptionSchema.safeParse(body);
    if (!parsed.success) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid enhance description request", 400);
    }

    await dbConnect();
    const settingsDoc = await AiPersonalisationSettings.findById("ai_personalisation_settings").lean();
    const settings = mergeSettings(settingsDoc as IAiPersonalisationSettings | null);

    const apiKey = settings.openRouterApiKey?.trim();
    if (!apiKey) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "OpenRouter API key is required", 400);
    }

    const model =
      settings.descriptionEnhancementModel?.trim() ||
      settings.model?.trim() ||
      "openrouter/free";

    const enhanced = await enhanceCompetitionDescriptionViaOpenRouter({
      apiKey,
      model,
      title: parsed.data.title,
      description: parsed.data.description,
    });

    return success(c, { description: enhanced });
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.aiPersonalisationSettings.competitionEnhanceDescription",
    });
    const message = err instanceof Error ? err.message : "Description enhancement failed";
    return error(c, ErrorCodes.INTERNAL_ERROR, message, 500);
  }
});

app.post("/models/scan", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = openRouterModelsScanSchema.safeParse(body);
    if (!parsed.success) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid model scan request", 400);
    }

    await dbConnect();

    let apiKey = parsed.data.openRouterApiKey?.trim() ?? "";
    if (!apiKey) {
      const settings = await AiPersonalisationSettings.findById("ai_personalisation_settings")
        .select("openRouterApiKey")
        .lean();
      apiKey = settings?.openRouterApiKey?.trim() ?? "";
    }

    const models = await listOpenRouterModelsForTier(apiKey, parsed.data.tier);
    return success(c, { tier: parsed.data.tier, models, scannedAt: new Date().toISOString() });
  } catch (err: unknown) {
    if (err instanceof OpenRouterModelsError) {
      const status =
        err.code === "INVALID_API_KEY" ? 401 : err.code === "MISSING_API_KEY" ? 400 : 502;
      return error(c, ErrorCodes.VALIDATION_ERROR, err.message, status);
    }
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.aiPersonalisationSettings.scanModels",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Failed to scan OpenRouter models", 500);
  }
});

app.put("/", async (c) => {
  try {
    const body = await c.req.json();
    await dbConnect();

    const parsed = adminAiPersonalisationSettingsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return error(c, ErrorCodes.VALIDATION_ERROR, "Invalid AI personalisation settings", 400);
    }

    const updates: Record<string, unknown> = {};
    const data = parsed.data;
    for (const key of SETTINGS_UPDATE_KEYS) {
      const value = data[key];
      if (value === undefined) continue;
      if (key === "openRouterApiKey" && typeof value === "string" && !value.trim()) continue;
      updates[key] = value;
    }

    await AiPersonalisationSettings.findByIdAndUpdate(
      "ai_personalisation_settings",
      { $set: updates, $setOnInsert: { _id: "ai_personalisation_settings" } },
      { upsert: true }
    );

    const settings = await AiPersonalisationSettings.findById("ai_personalisation_settings").lean<
      IAiPersonalisationSettings
    >();

    return success(c, adminSettingsResponse(settings ?? null));
  } catch (err: unknown) {
    captureRouteError(err, {
      requestId: c.get("requestId"),
      path: c.req.path,
      userId: c.get("userId") ?? null,
      operation: "admin.aiPersonalisationSettings.put",
    });
    return error(c, ErrorCodes.INTERNAL_ERROR, "Internal server error", 500);
  }
});

export default app;
