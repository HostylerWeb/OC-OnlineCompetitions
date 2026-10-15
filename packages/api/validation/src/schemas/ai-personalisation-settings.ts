import { z } from "zod";

/** Keep in sync with IMAGE_GENERATION_ASPECT_RATIOS in @oc/types (validation must not import @oc/types for Vite client bundles). */
const imageGenerationAspectRatioValues = [
  "1:1",
  "4:3",
  "3:4",
  "16:9",
  "9:16",
  "3:2",
  "2:3",
  "4:5",
  "5:4",
  "2:1",
  "1:2",
] as const;

const imageGenerationAspectRatioSchema = z.enum(imageGenerationAspectRatioValues);

export const adminAiPersonalisationSettingsUpdateSchema = z.object({
  addonEnabled: z.boolean().optional(),
  openRouterApiKey: z.string().max(500).optional(),
  model: z.string().min(1).max(200).optional(),
  tone: z.enum(["professional", "friendly", "enthusiastic"]).optional(),
  upsellPopup: z.boolean().optional(),
  upsellPopupCooldownHours: z.number().int().min(1).max(168).optional(),
  competitionHighlight: z.boolean().optional(),
  competitionHighlightCooldownHours: z.number().int().min(1).max(168).optional(),
  ticketBundleSuggestion: z.boolean().optional(),
  ticketBundleSuggestionCooldownHours: z.number().int().min(1).max(168).optional(),
  respectSpendLimits: z.boolean().optional(),
  maxPromptsPerSession: z.number().int().min(1).max(20).optional(),
  brandInstructions: z.string().max(8000).optional(),
  plannerEnabled: z.boolean().optional(),
  plannerIntervalHours: z.number().int().min(1).max(168).optional(),
  audienceMode: z
    .enum(["paid_orders_window", "verified_accounts", "orders_or_activity"])
    .optional(),
  audienceOrdersWithinDays: z.number().int().min(1).max(365).optional(),
  audienceActivityWithinDays: z.number().int().min(1).max(365).optional(),
  requireMarketingConsent: z.boolean().optional(),
  maxUsersPerRun: z.number().int().min(1).max(100_000).optional(),
  maxLlmBatchesPerRun: z.number().int().min(1).max(10_000).optional(),
  usersPerLlmBatch: z.number().int().min(1).max(50).optional(),
  maxOutputTokensPerBatch: z.number().int().min(256).max(16_000).optional(),
  plannerModel: z.string().max(200).optional(),
  dryRunPlanner: z.boolean().optional(),
  imageGenerationEnabled: z.boolean().optional(),
  imageGenerationModel: z.string().max(200).optional(),
  imageGenerationPromptTemplate: z.string().max(8000).optional(),
  imageGenerationBrandColors: z.string().max(500).optional(),
  imageGenerationReferenceImageUrl: z.string().max(2000).optional(),
  imageGenerationAspectRatio: imageGenerationAspectRatioSchema.optional(),
  descriptionEnhancementModel: z.string().max(200).optional(),
});

export const competitionAiGenerateImageSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().min(1).max(20_000),
  slug: z.string().max(200).optional(),
  /** When set, sent to OpenRouter instead of building from the saved template. */
  prompt: z.string().min(1).max(20_000).optional(),
});

export const competitionAiEnhanceDescriptionSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(20_000),
});

export type AdminAiPersonalisationSettingsUpdateInput = z.infer<
  typeof adminAiPersonalisationSettingsUpdateSchema
>;

export const openRouterModelsScanSchema = z.object({
  tier: z.enum(["free", "paid"]),
  openRouterApiKey: z.string().max(500).optional(),
});

export type OpenRouterModelsScanInput = z.infer<typeof openRouterModelsScanSchema>;
