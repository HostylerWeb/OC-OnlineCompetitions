import { Schema } from "mongoose";
import {
  DEFAULT_AI_PERSONALISATION_SETTINGS,
  type AiPersonalisationSettings,
} from "@oc/types";
import { m } from "../db";

const AiPersonalisationSettingsSchema = new Schema(
  {
    _id: { type: String, required: true, enum: ["ai_personalisation_settings"] },
    addonEnabled: { type: Boolean, default: false },
    openRouterApiKey: { type: String, default: "" },
    model: { type: String, default: DEFAULT_AI_PERSONALISATION_SETTINGS.model },
    tone: {
      type: String,
      enum: ["professional", "friendly", "enthusiastic"],
      default: DEFAULT_AI_PERSONALISATION_SETTINGS.tone,
    },
    upsellPopup: { type: Boolean, default: true },
    upsellPopupCooldownHours: { type: Number, default: 24, min: 1, max: 168 },
    competitionHighlight: { type: Boolean, default: true },
    competitionHighlightCooldownHours: { type: Number, default: 24, min: 1, max: 168 },
    ticketBundleSuggestion: { type: Boolean, default: false },
    ticketBundleSuggestionCooldownHours: { type: Number, default: 24, min: 1, max: 168 },
    respectSpendLimits: { type: Boolean, default: true },
    maxPromptsPerSession: { type: Number, default: 3, min: 1, max: 20 },
    brandInstructions: {
      type: String,
      default: DEFAULT_AI_PERSONALISATION_SETTINGS.brandInstructions,
    },
    plannerEnabled: { type: Boolean, default: false },
    plannerIntervalHours: { type: Number, default: 24, min: 1, max: 168 },
    audienceMode: {
      type: String,
      enum: ["paid_orders_window", "verified_accounts", "orders_or_activity"],
      default: "paid_orders_window",
    },
    audienceOrdersWithinDays: { type: Number, default: 90, min: 1, max: 365 },
    audienceActivityWithinDays: { type: Number, default: 30, min: 1, max: 365 },
    requireMarketingConsent: { type: Boolean, default: true },
    maxUsersPerRun: { type: Number, default: 5000, min: 1, max: 100_000 },
    maxLlmBatchesPerRun: { type: Number, default: 250, min: 1, max: 10_000 },
    usersPerLlmBatch: { type: Number, default: 20, min: 1, max: 50 },
    maxOutputTokensPerBatch: { type: Number, default: 2000, min: 256, max: 16_000 },
    plannerModel: { type: String, default: "" },
    dryRunPlanner: { type: Boolean, default: false },
    imageGenerationEnabled: { type: Boolean, default: false },
    imageGenerationModel: { type: String, default: "" },
    imageGenerationPromptTemplate: {
      type: String,
      default: DEFAULT_AI_PERSONALISATION_SETTINGS.imageGenerationPromptTemplate,
    },
    imageGenerationBrandColors: { type: String, default: "" },
    imageGenerationReferenceImageUrl: { type: String, default: "" },
    descriptionEnhancementModel: { type: String, default: "" },
  },
  { timestamps: true, _id: false }
);

export type IAiPersonalisationSettings = AiPersonalisationSettings;

export { DEFAULT_AI_PERSONALISATION_SETTINGS };

export const AiPersonalisationSettings = m<IAiPersonalisationSettings>(
  "AiPersonalisationSettings",
  AiPersonalisationSettingsSchema
);
