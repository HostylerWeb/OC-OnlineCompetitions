import { partitionOpenRouterImageModels, type OpenRouterModelListItem } from "@oc/types";
import { OpenRouterModelsError } from "./list-models";
import {
  mergeEndpointPricingSummaries,
  type OpenRouterImagePricingLine,
  summarizeImageEndpointPricing,
} from "./image-model-pricing";

const OPENROUTER_IMAGES_MODELS_URL = "https://openrouter.ai/api/v1/images/models";

type OpenRouterImageModelApi = {
  id: string;
  name?: string;
  endpoints?: string;
};

type OpenRouterImagesModelsResponse = {
  data?: OpenRouterImageModelApi[];
};

type OpenRouterImageEndpointsResponse = {
  id: string;
  endpoints?: Array<{
    pricing?: OpenRouterImagePricingLine[];
  }>;
};

async function fetchJson<T>(url: string, apiKey: string): Promise<T> {
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
      `OpenRouter returned ${res.status} while loading image models.`
    );
  }

  return (await res.json()) as T;
}

function endpointsUrl(model: OpenRouterImageModelApi): string {
  const path = model.endpoints?.trim();
  if (path?.startsWith("http")) return path;
  if (path?.startsWith("/")) return `https://openrouter.ai${path}`;
  const id = model.id.trim();
  return `https://openrouter.ai/api/v1/images/models/${id}/endpoints`;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]!);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function loadImageModelListItem(
  apiKey: string,
  model: OpenRouterImageModelApi
): Promise<OpenRouterModelListItem> {
  let pricingLabel = "Pricing unavailable";
  let estimatedUsdPerImage: number | null = null;
  let isFree = false;

  try {
    const endpoints = await fetchJson<OpenRouterImageEndpointsResponse>(endpointsUrl(model), apiKey);
    const summaries = (endpoints.endpoints ?? [])
      .map((ep) => summarizeImageEndpointPricing(ep.pricing ?? []))
      .filter((s) => s.pricingLabel !== "Pricing unavailable");
    const merged = mergeEndpointPricingSummaries(summaries);
    pricingLabel = merged.pricingLabel;
    estimatedUsdPerImage = merged.estimatedUsdPerImage;
    isFree = merged.isFree;
  } catch {
    pricingLabel = "Could not load pricing";
  }

  return {
    id: model.id,
    name: model.name?.trim() || model.id,
    isFree,
    promptPricePerToken: 0,
    completionPricePerToken: 0,
    contextLength: null,
    imagePricingLabel: pricingLabel,
    estimatedUsdPerImage,
  };
}

export async function listOpenRouterImageModels(apiKey: string): Promise<OpenRouterModelListItem[]> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new OpenRouterModelsError("MISSING_API_KEY", "OpenRouter API key is required.");
  }

  const page = await fetchJson<OpenRouterImagesModelsResponse>(OPENROUTER_IMAGES_MODELS_URL, trimmed);
  const models = page.data ?? [];
  if (models.length === 0) return [];

  const items = await mapWithConcurrency(models, 8, (m) => loadImageModelListItem(trimmed, m));

  const byPrice = items.sort((a, b) => {
    const costA = a.estimatedUsdPerImage ?? Number.POSITIVE_INFINITY;
    const costB = b.estimatedUsdPerImage ?? Number.POSITIVE_INFINITY;
    if (costA !== costB) return costA - costB;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  const { recommended, other } = partitionOpenRouterImageModels(byPrice);
  return [...recommended, ...other];
}
