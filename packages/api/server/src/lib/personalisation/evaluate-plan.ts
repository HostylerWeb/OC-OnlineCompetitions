import { Competition, UserPersonalisationPlan } from "@oc/api-db/models";
import { buildSaferPlayState } from "@oc/api-compliance/compliance-user-service";
import type {
  AiPersonalisationSettings,
  PersonalisationAction,
  PersonalisationPlanPayload,
  PersonalisationSurface,
} from "@oc/types";
import {
  getActionCooldownHours,
  isPersonalisationActionOnCooldown,
} from "./action-cooldown";

export type PersonalisationServeResult = {
  action: PersonalisationAction | null;
  payload?: PersonalisationPlanPayload;
};

function isActionAllowed(
  action: PersonalisationAction,
  settings: AiPersonalisationSettings
): boolean {
  if (action === "none") return false;
  if (action === "upsell_popup") return settings.upsellPopup;
  if (action === "competition_highlight") return settings.competitionHighlight;
  if (action === "ticket_bundle_suggestion") return settings.ticketBundleSuggestion;
  return false;
}

export async function evaluatePersonalisationPlan(input: {
  userId: string;
  surface: PersonalisationSurface;
  settings: AiPersonalisationSettings;
  sessionKey: string;
}): Promise<PersonalisationServeResult> {
  const { userId, surface, settings } = input;

  if (!settings.addonEnabled) {
    return { action: null };
  }

  const now = new Date();
  const plan = await UserPersonalisationPlan.findOne({
    userId,
    validFrom: { $lte: now },
    validUntil: { $gt: now },
  }).lean();

  if (!plan || plan.action === "none") {
    return { action: null };
  }

  if (!plan.surfaces?.includes(surface)) {
    return { action: null };
  }

  if (!isActionAllowed(plan.action, settings)) {
    return { action: null };
  }

  if (settings.respectSpendLimits) {
    const safer = await buildSaferPlayState(userId);
    if (safer.effectiveSelfExcluded) {
      return { action: null };
    }
  }

  if (await isPersonalisationActionOnCooldown(userId, plan.action)) {
    return { action: null };
  }

  const competitionId = plan.payload?.competitionId;
  if (competitionId) {
    const live = await Competition.findOne({
      _id: competitionId,
      status: "active",
      drawDate: { $gte: now },
      deletedAt: null,
    })
      .select("_id")
      .lean();
    if (!live) {
      return { action: null };
    }
  }

  return {
    action: plan.action,
    payload: plan.payload ?? {},
  };
}
