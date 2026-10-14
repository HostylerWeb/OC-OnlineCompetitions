export type OpenRouterImagePricingLine = {
  billable: string;
  unit: "image" | "megapixel" | "token" | string;
  cost_usd: number;
  variant?: string;
};

/** Rough output token count for a single 1:1 image on token-billed models (for sorting + estimates). */
export const EST_IMAGE_OUTPUT_TOKENS = 4096;

function formatUsd(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) return "$0.00";
  if (amount >= 0.01) {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 3,
    maximumFractionDigits: 4,
  }).format(amount);
}

function formatUsdPerMillionTokens(pricePerToken: number): string {
  const perMillion = pricePerToken * 1_000_000;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(perMillion);
}

export type ImageModelPricingSummary = {
  pricingLabel: string;
  estimatedUsdPerImage: number | null;
  isFree: boolean;
};

export function summarizeImageEndpointPricing(
  pricingLines: OpenRouterImagePricingLine[]
): ImageModelPricingSummary {
  const outputImage = pricingLines.filter((p) => p.billable === "output_image");
  if (outputImage.length === 0) {
    return { pricingLabel: "Pricing unavailable", estimatedUsdPerImage: null, isFree: false };
  }

  const perImage = outputImage.filter((p) => p.unit === "image");
  if (perImage.length > 0) {
    const min = Math.min(...perImage.map((p) => p.cost_usd));
    const isFree = min === 0;
    const variantNote =
      perImage.length > 1 && perImage.some((p) => p.variant)
        ? " (tier varies)"
        : "";
    return {
      pricingLabel: isFree ? "Free" : `${formatUsd(min)}/image${variantNote}`,
      estimatedUsdPerImage: isFree ? 0 : min,
      isFree,
    };
  }

  const perMegapixel = outputImage.filter((p) => p.unit === "megapixel");
  if (perMegapixel.length > 0) {
    const min = Math.min(...perMegapixel.map((p) => p.cost_usd));
    const isFree = min === 0;
    return {
      pricingLabel: isFree ? "Free" : `from ${formatUsd(min)}/megapixel`,
      estimatedUsdPerImage: isFree ? 0 : min,
      isFree,
    };
  }

  const perToken = outputImage.filter((p) => p.unit === "token");
  if (perToken.length > 0) {
    const rate = Math.min(...perToken.map((p) => p.cost_usd));
    const estimate = rate * EST_IMAGE_OUTPUT_TOKENS;
    const isFree = rate === 0;
    return {
      pricingLabel: isFree
        ? "Free"
        : `~${formatUsd(estimate)}/image (${formatUsdPerMillionTokens(rate)} image out tokens)`,
      estimatedUsdPerImage: isFree ? 0 : estimate,
      isFree,
    };
  }

  return { pricingLabel: "See OpenRouter", estimatedUsdPerImage: null, isFree: false };
}

export function mergeEndpointPricingSummaries(
  summaries: ImageModelPricingSummary[]
): ImageModelPricingSummary {
  const withEstimate = summaries.filter((s) => s.estimatedUsdPerImage !== null);
  if (withEstimate.length === 0) {
    return summaries[0] ?? { pricingLabel: "Pricing unavailable", estimatedUsdPerImage: null, isFree: false };
  }
  const cheapest = withEstimate.reduce((a, b) =>
    (a.estimatedUsdPerImage ?? Number.POSITIVE_INFINITY) <=
    (b.estimatedUsdPerImage ?? Number.POSITIVE_INFINITY)
      ? a
      : b
  );
  if (summaries.length <= 1) return cheapest;
  const multiProvider = summaries.some(
    (s) => s.pricingLabel !== cheapest.pricingLabel && s.estimatedUsdPerImage !== null
  );
  if (!multiProvider) return cheapest;
  return {
    ...cheapest,
    pricingLabel: `from ${cheapest.pricingLabel.replace(/^from /, "")}`,
  };
}
