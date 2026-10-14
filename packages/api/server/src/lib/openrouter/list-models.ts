import type { OpenRouterModelListItem, OpenRouterModelPricingTier } from "@oc/types";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

export type OpenRouterApiModel = {
  id: string;
  name?: string;
  context_length?: number;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
  pricing?: {
    prompt?: string;
    completion?: string;
  };
};

type OpenRouterModelsResponse = {
  data?: OpenRouterApiModel[];
  links?: { next?: string | null };
};

export function parseOpenRouterPrice(value: string | undefined): number {
  if (value === undefined || value === "") return 0;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function isOpenRouterFreeModel(model: OpenRouterApiModel): boolean {
  if (model.id.endsWith(":free")) return true;
  const prompt = parseOpenRouterPrice(model.pricing?.prompt);
  const completion = parseOpenRouterPrice(model.pricing?.completion);
  return prompt === 0 && completion === 0;
}

function isTextChatModel(model: OpenRouterApiModel): boolean {
  const arch = model.architecture;
  if (!arch?.output_modalities?.length) return true;
  if (!arch.output_modalities.includes("text")) return false;
  if (!arch.input_modalities?.length) return true;
  return arch.input_modalities.includes("text");
}

export function openRouterApiModelToListItem(model: OpenRouterApiModel): OpenRouterModelListItem {
  return {
    id: model.id,
    name: model.name?.trim() || model.id,
    isFree: isOpenRouterFreeModel(model),
    promptPricePerToken: parseOpenRouterPrice(model.pricing?.prompt),
    completionPricePerToken: parseOpenRouterPrice(model.pricing?.completion),
    contextLength: model.context_length ?? null,
  };
}

function modelTotalPricePerToken(item: OpenRouterModelListItem): number {
  return item.promptPricePerToken + item.completionPricePerToken;
}

/** Paid tier: most expensive (input + output) first; free tier: alphabetical by name. */
export function compareOpenRouterModelsForDisplay(
  tier: OpenRouterModelPricingTier,
  a: OpenRouterModelListItem,
  b: OpenRouterModelListItem
): number {
  if (tier === "free") {
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  }

  const costA = modelTotalPricePerToken(a);
  const costB = modelTotalPricePerToken(b);
  if (costB !== costA) return costB - costA;
  if (b.completionPricePerToken !== a.completionPricePerToken) {
    return b.completionPricePerToken - a.completionPricePerToken;
  }
  if (b.promptPricePerToken !== a.promptPricePerToken) {
    return b.promptPricePerToken - a.promptPricePerToken;
  }
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

async function fetchOpenRouterModelsPage(
  apiKey: string,
  url: string
): Promise<OpenRouterModelsResponse> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (res.status === 401 || res.status === 403) {
    throw new OpenRouterModelsError("INVALID_API_KEY", "OpenRouter rejected the API key.");
  }

  if (!res.ok) {
    throw new OpenRouterModelsError(
      "UPSTREAM_ERROR",
      `OpenRouter returned ${res.status} while listing models.`
    );
  }

  return (await res.json()) as OpenRouterModelsResponse;
}

export class OpenRouterModelsError extends Error {
  constructor(
    readonly code: "INVALID_API_KEY" | "UPSTREAM_ERROR" | "MISSING_API_KEY",
    message: string
  ) {
    super(message);
    this.name = "OpenRouterModelsError";
  }
}

export async function listOpenRouterModelsForTier(
  apiKey: string,
  tier: OpenRouterModelPricingTier
): Promise<OpenRouterModelListItem[]> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new OpenRouterModelsError("MISSING_API_KEY", "OpenRouter API key is required.");
  }

  const collected: OpenRouterApiModel[] = [];
  let nextUrl: string | null = `${OPENROUTER_MODELS_URL}?output_modalities=text&limit=1000`;

  while (nextUrl) {
    const page = await fetchOpenRouterModelsPage(trimmed, nextUrl);
    if (Array.isArray(page.data)) {
      collected.push(...page.data);
    }
    const next = page.links?.next;
    if (!next) {
      nextUrl = null;
    } else if (next.startsWith("http")) {
      nextUrl = next;
    } else {
      nextUrl = `https://openrouter.ai/api/v1${next.startsWith("/") ? next : `/${next}`}`;
    }
  }

  const filtered = collected
    .filter(isTextChatModel)
    .filter((m) => (tier === "free" ? isOpenRouterFreeModel(m) : !isOpenRouterFreeModel(m)))
    .map(openRouterApiModelToListItem)
    .sort((a, b) => compareOpenRouterModelsForDisplay(tier, a, b));

  return filtered;
}
