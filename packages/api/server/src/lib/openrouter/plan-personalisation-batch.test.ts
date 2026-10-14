import { DEFAULT_AI_PERSONALISATION_SETTINGS } from "@oc/types";
import { afterEach, describe, expect, test, vi } from "vitest";
import { planPersonalisationBatch } from "./plan-personalisation-batch";

describe("planPersonalisationBatch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("parses batch JSON from OpenRouter", async () => {
    globalThis.fetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  plans: [
                    {
                      userId: "u1",
                      action: "none",
                    },
                  ],
                }),
              },
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 50 },
        }),
      })) as typeof fetch;

    const result = await planPersonalisationBatch({
      apiKey: "sk-test",
      settings: DEFAULT_AI_PERSONALISATION_SETTINGS,
      catalogue: [{ id: "c1", title: "Car", ticketPrice: 1, ticketsRemainingPct: 50 }],
      users: [
        {
          userId: "u1",
          totalSpent: 10,
          totalEntries: 2,
          topCategorySlugs: ["cars"],
          walletBalanceBand: "low",
          referralBand: "none",
          marketingConsent: true,
          selfExcluded: false,
          hasActiveSpendLimit: false,
          isGuestCheckout: false,
          eligibleForLlm: true,
        },
      ],
    });

    expect(result.plans).toHaveLength(1);
    expect(result.plans[0]?.userId).toBe("u1");
    expect(result.tokensIn).toBe(100);
  });

  test("uses reasoning field when content is null", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: null,
              reasoning: 'Thoughts...\n{"plans":[{"userId":"u1","action":"none"}]}',
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    })) as typeof fetch;

    const result = await planPersonalisationBatch({
      apiKey: "sk-test",
      settings: DEFAULT_AI_PERSONALISATION_SETTINGS,
      catalogue: [],
      users: [
        {
          userId: "u1",
          totalSpent: 0,
          totalEntries: 0,
          topCategorySlugs: [],
          walletBalanceBand: "zero",
          referralBand: "none",
          marketingConsent: true,
          selfExcluded: false,
          hasActiveSpendLimit: false,
          isGuestCheckout: false,
          eligibleForLlm: true,
        },
      ],
    });

    expect(result.plans[0]?.action).toBe("none");
  });
});
