import { getRedis } from "@oc/api-infra/cache";
import type { AiPersonalisationSettings, PersonalisationAction } from "@oc/types";

const COOLDOWN_KEY_PREFIX = "personalisation:cooldown:";

export function getActionCooldownHours(
  settings: AiPersonalisationSettings,
  action: PersonalisationAction
): number {
  if (action === "none") return 24;
  if (action === "upsell_popup") return settings.upsellPopupCooldownHours;
  if (action === "competition_highlight") return settings.competitionHighlightCooldownHours;
  if (action === "ticket_bundle_suggestion") return settings.ticketBundleSuggestionCooldownHours;
  return 24;
}

function cooldownKey(userId: string, action: PersonalisationAction): string {
  return `${COOLDOWN_KEY_PREFIX}${userId}:${action}`;
}

export async function isPersonalisationActionOnCooldown(
  userId: string,
  action: PersonalisationAction
): Promise<boolean> {
  if (action === "none") return true;
  const redis = await getRedis();
  if (!redis) return false;
  const value = await redis.get(cooldownKey(userId, action));
  return value !== null;
}

export async function recordPersonalisationActionCooldown(
  userId: string,
  action: PersonalisationAction,
  cooldownHours: number
): Promise<void> {
  if (action === "none") return;
  const redis = await getRedis();
  if (!redis) return;
  const ttlSeconds = Math.max(3600, Math.min(cooldownHours * 3600, 365 * 24 * 3600));
  await redis.set(cooldownKey(userId, action), "1", { EX: ttlSeconds });
}
