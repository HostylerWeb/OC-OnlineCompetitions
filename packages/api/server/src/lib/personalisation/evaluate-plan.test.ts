import { DEFAULT_AI_PERSONALISATION_SETTINGS } from "@oc/types";
import { describe, expect, test, vi } from "vitest";

vi.mock("@oc/api-db/models", () => ({
  UserPersonalisationPlan: {
    findOne: vi.fn(),
  },
  Competition: {
    findOne: vi.fn(),
  },
}));

vi.mock("@oc/api-compliance/compliance-user-service", () => ({
  buildSaferPlayState: vi.fn(async () => ({ effectiveSelfExcluded: false })),
}));

vi.mock("./action-cooldown", () => ({
  isPersonalisationActionOnCooldown: vi.fn(async () => false),
}));

import { Competition, UserPersonalisationPlan } from "@oc/api-db/models";
import { evaluatePersonalisationPlan } from "./evaluate-plan";

describe("evaluatePersonalisationPlan", () => {
  test("returns null when addon disabled", async () => {
    const result = await evaluatePersonalisationPlan({
      userId: "u1",
      surface: "home",
      sessionKey: "s1",
      settings: { ...DEFAULT_AI_PERSONALISATION_SETTINGS, addonEnabled: false },
    });
    expect(result.action).toBeNull();
  });

  test("returns plan when valid", async () => {
    (UserPersonalisationPlan.findOne as ReturnType<typeof vi.fn>).mockReturnValue({
      lean: async () => ({
        userId: "u1",
        action: "upsell_popup",
        surfaces: ["home"],
        payload: { headline: "Hello" },
        validFrom: new Date(Date.now() - 1000),
        validUntil: new Date(Date.now() + 86_400_000),
      }),
    } as never);

    const result = await evaluatePersonalisationPlan({
      userId: "u1",
      surface: "home",
      sessionKey: "s1",
      settings: { ...DEFAULT_AI_PERSONALISATION_SETTINGS, addonEnabled: true },
    });

    expect(result.action).toBe("upsell_popup");
    expect(result.payload?.headline).toBe("Hello");
    expect(Competition.findOne).not.toHaveBeenCalled();
  });
});
