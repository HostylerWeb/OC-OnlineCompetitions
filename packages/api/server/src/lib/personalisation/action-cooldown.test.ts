import { DEFAULT_AI_PERSONALISATION_SETTINGS } from "@oc/types";
import { describe, expect, test } from "vitest";
import { getActionCooldownHours } from "./action-cooldown";

describe("getActionCooldownHours", () => {
  test("returns per-action settings", () => {
    const settings = {
      ...DEFAULT_AI_PERSONALISATION_SETTINGS,
      upsellPopupCooldownHours: 12,
      competitionHighlightCooldownHours: 48,
      ticketBundleSuggestionCooldownHours: 6,
    };
    expect(getActionCooldownHours(settings, "upsell_popup")).toBe(12);
    expect(getActionCooldownHours(settings, "competition_highlight")).toBe(48);
    expect(getActionCooldownHours(settings, "ticket_bundle_suggestion")).toBe(6);
  });
});
