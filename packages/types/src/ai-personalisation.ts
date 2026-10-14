export type AiPersonalisationTone = "professional" | "friendly" | "enthusiastic";

export type OpenRouterModelPricingTier = "free" | "paid";

export type PersonalisationAudienceMode =
  | "paid_orders_window"
  | "verified_accounts"
  | "orders_or_activity";

export type PersonalisationAction =
  | "none"
  | "upsell_popup"
  | "competition_highlight"
  | "ticket_bundle_suggestion";

export type PersonalisationSurface = "home" | "competition" | "checkout";

export type PersonalisationPlannerRunStatus = "running" | "completed" | "failed" | "skipped";

export interface PersonalisationPlanPayload {
  competitionId?: string;
  headline?: string;
  body?: string;
  suggestedTicketCount?: number;
  ctaLabel?: string;
}

export interface PersonalisationCatalogueItem {
  id: string;
  title: string;
  category?: string;
  ticketPrice: number;
  ticketsRemainingPct: number;
  endsAt?: string;
}

export interface UserPersonalisationFeatureSnapshot {
  userId: string;
  totalSpent: number;
  totalEntries: number;
  topCategorySlugs: string[];
  lastOrderAt?: string;
  walletBalanceBand: "zero" | "low" | "medium" | "high";
  referralBand: "none" | "active";
  marketingConsent: boolean;
  selfExcluded: boolean;
  selfExcludedUntil?: string | null;
  hasActiveSpendLimit: boolean;
  isGuestCheckout: boolean;
  eligibleForLlm: boolean;
}

export interface OpenRouterModelListItem {
  id: string;
  name: string;
  isFree: boolean;
  promptPricePerToken: number;
  completionPricePerToken: number;
  contextLength: number | null;
  /** Image API scan: human-readable cost (per image, per MP, or estimated from image output tokens). */
  imagePricingLabel?: string;
  /** Image API scan: rough USD for one 1:1 image when estimable. */
  estimatedUsdPerImage?: number | null;
}

export const RECOMMENDED_AI_PERSONALISATION_OPENROUTER_MODEL_IDS = [
  "openai/gpt-4o-mini",
  "anthropic/claude-haiku-5.5",
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-flash",
  "deepseek/deepseek-chat",
  "meta-llama/llama-3.3-70b-instruct",
  "mistralai/mistral-small-3.2-24b-instruct",
  "anthropic/claude-haiku-4.5",
  "mistralai/mistral-small-3.1-24b-instruct",
  "anthropic/claude-sonnet-5",
] as const;

/** Competition / product image generation — prompt + reference fidelity. */
export const RECOMMENDED_OPENROUTER_IMAGE_MODEL_IDS = [
  "bytedance-seed/seedream-5-0-pro",
  "bytedance-seed/seedream-4.5",
  "black-forest-labs/flux-3-image",
  "qwen/qwen-image-3-pro",
  "openai/gpt-image-2",
] as const;

export function partitionOpenRouterImageModels(
  models: OpenRouterModelListItem[]
): { recommended: OpenRouterModelListItem[]; other: OpenRouterModelListItem[] } {
  const byId = new Map(models.map((m) => [m.id, m]));
  const recommended: OpenRouterModelListItem[] = [];
  const recommendedIds = new Set<string>();

  for (const id of RECOMMENDED_OPENROUTER_IMAGE_MODEL_IDS) {
    const match = byId.get(id);
    if (match) {
      recommended.push(match);
      recommendedIds.add(id);
    }
  }

  const other = models.filter((m) => !recommendedIds.has(m.id));
  return { recommended, other };
}

export function partitionOpenRouterModelsWithRecommendations(
  models: OpenRouterModelListItem[]
): { recommended: OpenRouterModelListItem[]; other: OpenRouterModelListItem[] } {
  const byId = new Map(models.map((m) => [m.id, m]));
  const recommended: OpenRouterModelListItem[] = [];
  const recommendedIds = new Set<string>();

  for (const id of RECOMMENDED_AI_PERSONALISATION_OPENROUTER_MODEL_IDS) {
    const match = byId.get(id);
    if (match) {
      recommended.push(match);
      recommendedIds.add(id);
    }
  }

  const other = models.filter((m) => !recommendedIds.has(m.id));
  return { recommended, other };
}

export interface AiPersonalisationSettings {
  _id: "ai_personalisation_settings";
  addonEnabled: boolean;
  openRouterApiKey: string;
  model: string;
  tone: AiPersonalisationTone;
  upsellPopup: boolean;
  upsellPopupCooldownHours: number;
  competitionHighlight: boolean;
  competitionHighlightCooldownHours: number;
  ticketBundleSuggestion: boolean;
  ticketBundleSuggestionCooldownHours: number;
  respectSpendLimits: boolean;
  maxPromptsPerSession: number;
  brandInstructions: string;
  plannerEnabled: boolean;
  plannerIntervalHours: number;
  audienceMode: PersonalisationAudienceMode;
  audienceOrdersWithinDays: number;
  audienceActivityWithinDays: number;
  requireMarketingConsent: boolean;
  maxUsersPerRun: number;
  maxLlmBatchesPerRun: number;
  usersPerLlmBatch: number;
  maxOutputTokensPerBatch: number;
  plannerModel: string;
  dryRunPlanner: boolean;
  imageGenerationEnabled: boolean;
  imageGenerationModel: string;
  imageGenerationPromptTemplate: string;
  imageGenerationBrandColors: string;
  imageGenerationReferenceImageUrl: string;
  descriptionEnhancementModel: string;
  /** Present on admin GET; true when a key is stored (key may be omitted from the payload). */
  openRouterApiKeyConfigured?: boolean;
}

export const DEFAULT_COMPETITION_IMAGE_PROMPT_TEMPLATE = `I need you to generate an image for my competition on my raffle website. our main colors are: [Brand colors].
Competition/Raffle name: [Name].
Description: [Description].
Reference image: [Reference image]`;

export const DEFAULT_AI_PERSONALISATION_SETTINGS: AiPersonalisationSettings = {
  _id: "ai_personalisation_settings",
  addonEnabled: false,
  openRouterApiKey: "",
  model: "openai/gpt-4o-mini",
  tone: "friendly",
  upsellPopup: true,
  upsellPopupCooldownHours: 24,
  competitionHighlight: true,
  competitionHighlightCooldownHours: 24,
  ticketBundleSuggestion: false,
  ticketBundleSuggestionCooldownHours: 24,
  respectSpendLimits: true,
  maxPromptsPerSession: 1,
  brandInstructions:
    "Suggest relevant competitions and ticket bundles based on the customer's basket and past entries. Never promise wins. Keep offers within site rules.",
  plannerEnabled: false,
  plannerIntervalHours: 24,
  audienceMode: "paid_orders_window",
  audienceOrdersWithinDays: 90,
  audienceActivityWithinDays: 30,
  requireMarketingConsent: true,
  maxUsersPerRun: 5000,
  maxLlmBatchesPerRun: 250,
  usersPerLlmBatch: 20,
  maxOutputTokensPerBatch: 2000,
  plannerModel: "",
  dryRunPlanner: false,
  imageGenerationEnabled: false,
  imageGenerationModel: "",
  imageGenerationPromptTemplate: DEFAULT_COMPETITION_IMAGE_PROMPT_TEMPLATE,
  imageGenerationBrandColors: "",
  imageGenerationReferenceImageUrl: "",
  descriptionEnhancementModel: "",
};

export const PERSONALISATION_PROMPT_VERSION = "personalisation-v1";

export interface PersonalisationServeDto {
  action: PersonalisationAction | null;
  payload?: PersonalisationPlanPayload;
}
