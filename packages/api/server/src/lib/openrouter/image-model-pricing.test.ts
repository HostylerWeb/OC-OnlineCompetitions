import { describe, expect, test } from "vitest";
import {
  EST_IMAGE_OUTPUT_TOKENS,
  mergeEndpointPricingSummaries,
  summarizeImageEndpointPricing,
} from "./image-model-pricing";

describe("summarizeImageEndpointPricing", () => {
  test("per-image output", () => {
    const s = summarizeImageEndpointPricing([
      { billable: "output_image", unit: "image", cost_usd: 0.04 },
    ]);
    expect(s.pricingLabel).toContain("0.04");
    expect(s.pricingLabel).toContain("/image");
    expect(s.estimatedUsdPerImage).toBe(0.04);
    expect(s.isFree).toBe(false);
  });

  test("token-billed image output includes estimate", () => {
    const rate = 0.00003;
    const s = summarizeImageEndpointPricing([
      { billable: "output_image", unit: "token", cost_usd: rate },
    ]);
    expect(s.estimatedUsdPerImage).toBe(rate * EST_IMAGE_OUTPUT_TOKENS);
    expect(s.pricingLabel).toContain("/image");
    expect(s.pricingLabel).toContain("image out tokens");
  });
});

describe("mergeEndpointPricingSummaries", () => {
  test("picks cheapest provider", () => {
    const merged = mergeEndpointPricingSummaries([
      summarizeImageEndpointPricing([
        { billable: "output_image", unit: "image", cost_usd: 0.05 },
      ]),
      summarizeImageEndpointPricing([
        { billable: "output_image", unit: "image", cost_usd: 0.04 },
      ]),
    ]);
    expect(merged.estimatedUsdPerImage).toBe(0.04);
  });
});
