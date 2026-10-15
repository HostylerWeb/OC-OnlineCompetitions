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

/** Aspect ratios supported by most OpenRouter image models (passed as `aspect_ratio`). */
export const IMAGE_GENERATION_ASPECT_RATIOS = [
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

export type ImageGenerationAspectRatio = (typeof IMAGE_GENERATION_ASPECT_RATIOS)[number];

export const DEFAULT_IMAGE_GENERATION_ASPECT_RATIO: ImageGenerationAspectRatio = "1:1";

export const IMAGE_GENERATION_ASPECT_RATIO_LABELS: Record<ImageGenerationAspectRatio, string> = {
  "1:1": "Square — cards & primary thumbnails",
  "4:3": "Landscape 4:3 — admin image pool tiles",
  "3:4": "Portrait 3:4",
  "16:9": "Wide — banners & hero",
  "9:16": "Tall — mobile / stories",
  "3:2": "Landscape 3:2",
  "2:3": "Portrait 2:3",
  "4:5": "Portrait 4:5",
  "5:4": "Landscape 5:4",
  "2:1": "Ultra-wide 2:1",
  "1:2": "Ultra-tall 1:2",
};

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
  imageGenerationAspectRatio: ImageGenerationAspectRatio;
  descriptionEnhancementModel: string;
  /** Present on admin GET; true when a key is stored (key may be omitted from the payload). */
  openRouterApiKeyConfigured?: boolean;
}

/** Substituted by buildCompetitionImagePrompt — documented in admin Image generation UI. */
export const COMPETITION_IMAGE_PROMPT_PLACEHOLDERS = [
  "[Name]",
  "[Description]",
  "[Brand colors]",
  "[Aspect ratio]",
  "[Reference image]",
] as const;

export const DEFAULT_COMPETITION_IMAGE_PROMPT_TEMPLATE = `Hero image for a UK online prize competition (raffle) website — polished like leading raffle/competition sites.

Competition title (for on-image headline): [Name]

Brief:
[Description]

Brand colours: [Brand colors]
Aspect ratio: [Aspect ratio]

Visual requirements:
- One clear focal point on the prize (or prize type described in the brief)
- Premium, trustworthy, exciting; photoreal or polished commercial CGI
- Clean layout: prize hero + readable text zone (top or bottom third)
- No fake app UI, browser chrome, or “you have won” / guaranteed-win messaging

On-image text (required — style like major UK raffle sites):
- Headline: a short punchy line of at most 4 words, derived from the competition title [Name]. If the title is already short, use it. If it is long, shorten it (drop filler like “competition”, dates, and ticket wording). Never print the full title when it is longer than about 28 characters.
- One supporting line of at most 5 words (prize type or “Cash Giveaway”) drawn from the brief — not a second copy of the title
- High contrast, legible type; subtle shadow or plate behind text if needed
- Use brand colours for text accents; do not cover the main prize

Avoid:
- Third-party logos or watermarks
- Invented prize details not in the brief
- Tiny unreadable text or wrapping a long sentence across the image

Reference:
[Reference image]`;

/** Earlier default shipped before structured art-direction prompts; upgraded automatically when still unchanged in DB. */
export const LEGACY_COMPETITION_IMAGE_PROMPT_TEMPLATE = `I need you to generate an image for my competition on my raffle website. our main colors are: [Brand colors].
Competition/Raffle name: [Name].
Description: [Description].
Reference image: [Reference image]`;

/** Shipped briefly with “no on-image text”; auto-upgraded to the headline-friendly default. */
export const NO_ON_IMAGE_TEXT_PROMPT_TEMPLATE = `Hero image for a UK online prize competition (raffle) website.

Title: [Name]

Brief:
[Description]

Brand colours: [Brand colors]
Aspect ratio: [Aspect ratio]

Visual requirements:
- One clear focal point on the prize (or prize type described in the brief)
- Premium, trustworthy, exciting; photoreal or polished commercial CGI
- Clean composition with space for cropping; no busy collage
- No on-image text, fake UI, “winner” badges, or guaranteed-win claims
- No third-party logos or watermarks

Reference:
[Reference image]`;

/** Required the full title as the headline; auto-upgraded so long titles are shortened. */
export const EXACT_TITLE_HEADLINE_PROMPT_TEMPLATE = `Hero image for a UK online prize competition (raffle) website — polished like leading raffle/competition sites.

Competition title (for on-image headline): [Name]

Brief:
[Description]

Brand colours: [Brand colors]
Aspect ratio: [Aspect ratio]

Visual requirements:
- One clear focal point on the prize (or prize type described in the brief)
- Premium, trustworthy, exciting; photoreal or polished commercial CGI
- Clean layout: prize hero + readable text zone (top or bottom third)
- No fake app UI, browser chrome, or “you have won” / guaranteed-win messaging

On-image text (required — style like major UK raffle sites):
- Large, bold headline with the competition title exactly: [Name]
- One short supporting line (e.g. “Win This Prize” / “Cash Giveaway” / key prize detail from the brief) — max ~6 words, UK English
- High contrast, legible type; subtle shadow or plate behind text if needed
- Use brand colours for text accents; do not cover the main prize

Avoid:
- Third-party logos or watermarks
- Misspelled title or invented prize details not in the brief

Reference:
[Reference image]`;

const AUTO_UPGRADE_IMAGE_PROMPT_TEMPLATES = [
  LEGACY_COMPETITION_IMAGE_PROMPT_TEMPLATE,
  NO_ON_IMAGE_TEXT_PROMPT_TEMPLATE,
  EXACT_TITLE_HEADLINE_PROMPT_TEMPLATE,
] as const;

export function resolveCompetitionImagePromptTemplate(stored: string | undefined): string {
  const trimmed = stored?.trim() ?? "";
  if (!trimmed) return DEFAULT_COMPETITION_IMAGE_PROMPT_TEMPLATE;
  for (const legacy of AUTO_UPGRADE_IMAGE_PROMPT_TEMPLATES) {
    if (trimmed === legacy.trim()) return DEFAULT_COMPETITION_IMAGE_PROMPT_TEMPLATE;
  }
  return stored!;
}

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
  imageGenerationAspectRatio: DEFAULT_IMAGE_GENERATION_ASPECT_RATIO,
  descriptionEnhancementModel: "",
};

export const PERSONALISATION_PROMPT_VERSION = "personalisation-v1";

export interface PersonalisationServeDto {
  action: PersonalisationAction | null;
  payload?: PersonalisationPlanPayload;
}
