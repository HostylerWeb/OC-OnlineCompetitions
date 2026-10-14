import { ErrorCodes } from "@oc/api-infra/error-codes";
import { beforeEach, describe, expect, test, vi } from "vitest";
import aiPersonalisationSettingsApp from "../ai-personalisation-settings";

vi.mock("@oc/api-infra/db", () => ({
  default: vi.fn(async () => {}),
}));

const settingsStore = vi.hoisted(() => ({
  doc: {
    _id: "ai_personalisation_settings" as const,
    addonEnabled: false,
    openRouterApiKey: "",
    model: "anthropic/claude-3.5-sonnet",
    tone: "friendly" as const,
    upsellPopup: true,
    competitionHighlight: true,
    ticketBundleSuggestion: false,
    respectSpendLimits: true,
    maxPromptsPerSession: 3,
    brandInstructions: "Test instructions",
    plannerEnabled: false,
  },
}));

vi.mock("@oc/api-db/models", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@oc/api-db/models")>();
  return {
    ...actual,
    AiPersonalisationSettings: {
      findById: vi.fn(() => ({
        lean: async () => settingsStore.doc,
        select: () => ({
          lean: async () => settingsStore.doc,
        }),
      })),
      findByIdAndUpdate: vi.fn((_id: string, update: { $set: Record<string, unknown> }) => {
        Object.assign(settingsStore.doc, update.$set);
        return Promise.resolve();
      }),
    },
    PersonalisationPlannerRun: {
      findOne: vi.fn(() => ({
        sort: () => ({
          lean: async () => null,
        }),
      })),
    },
  };
});

vi.mock("@oc/api-server/middleware/auth", () => ({
  requireAdmin: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set("userId", "admin-id");
    await next();
  },
}));

describe("admin ai-personalisation-settings", () => {
  beforeEach(() => {
    settingsStore.doc.addonEnabled = false;
    settingsStore.doc.openRouterApiKey = "";
  });

  test("GET returns settings", async () => {
    const res = await aiPersonalisationSettingsApp.request("/");
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { addonEnabled: boolean; openRouterApiKeyConfigured: boolean };
    };
    expect(json.data.addonEnabled).toBe(false);
    expect(json.data.openRouterApiKeyConfigured).toBe(false);
  });

  test("PUT updates addon and API key", async () => {
    const res = await aiPersonalisationSettingsApp.request("/", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        addonEnabled: true,
        openRouterApiKey: "sk-or-test",
      }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { addonEnabled: boolean; openRouterApiKey: string };
    };
    expect(json.data.addonEnabled).toBe(true);
    expect(json.data.openRouterApiKey).toBe("sk-or-test");
  });

  test("PUT persists plannerEnabled", async () => {
    const res = await aiPersonalisationSettingsApp.request("/", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plannerEnabled: true }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { plannerEnabled: boolean } };
    expect(json.data.plannerEnabled).toBe(true);
    expect(settingsStore.doc.plannerEnabled).toBe(true);
  });

  test("PUT persists image generation fields", async () => {
    const res = await aiPersonalisationSettingsApp.request("/", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        imageGenerationBrandColors: "navy, gold, white",
        imageGenerationPromptTemplate: "Custom prompt for [Name]",
        imageGenerationModel: "bytedance-seed/seedream-5-0-pro",
      }),
    });
    expect(res.status).toBe(200);

    const get = await aiPersonalisationSettingsApp.request("/");
    expect(get.status).toBe(200);
    const json = (await get.json()) as {
      data: {
        imageGenerationBrandColors: string;
        imageGenerationPromptTemplate: string;
        imageGenerationModel: string;
      };
    };
    expect(json.data.imageGenerationBrandColors).toBe("navy, gold, white");
    expect(json.data.imageGenerationPromptTemplate).toBe("Custom prompt for [Name]");
    expect(json.data.imageGenerationModel).toBe("bytedance-seed/seedream-5-0-pro");
  });

  test("PUT rejects invalid body", async () => {
    const res = await aiPersonalisationSettingsApp.request("/", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ maxPromptsPerSession: 99 }),
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
  });
});
