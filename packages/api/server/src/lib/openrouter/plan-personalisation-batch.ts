import {
  personalisationBatchResponseSchema,
  type PersonalisationBatchItem,
} from "@oc/api-validation";
import type {
  AiPersonalisationSettings,
  PersonalisationCatalogueItem,
  UserPersonalisationFeatureSnapshot,
} from "@oc/types";
import { PERSONALISATION_PROMPT_VERSION } from "@oc/types";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

export type PlanPersonalisationBatchResult = {
  plans: PersonalisationBatchItem[];
  tokensIn: number;
  tokensOut: number;
  model: string;
};

function allowedActions(settings: AiPersonalisationSettings): string[] {
  const actions = ["none"];
  if (settings.upsellPopup) actions.push("upsell_popup");
  if (settings.competitionHighlight) actions.push("competition_highlight");
  if (settings.ticketBundleSuggestion) actions.push("ticket_bundle_suggestion");
  return actions;
}

function buildSystemPrompt(settings: AiPersonalisationSettings): string {
  return [
    `Prompt version: ${PERSONALISATION_PROMPT_VERSION}`,
    "You plan UK competition website personalisation for multiple users at once.",
    `Tone: ${settings.tone}.`,
    settings.brandInstructions,
    "Rules: never promise wins; stay compliant; use only competition ids from the catalogue.",
    `Allowed actions per user: ${allowedActions(settings).join(", ")}.`,
    "Return JSON only: { \"plans\": [ { \"userId\", \"action\", \"surfaces\", \"payload\" } ] }",
    "One plan per input user, same order. Use action \"none\" when no suitable offer.",
    "surfaces subset of: home, competition, checkout.",
    "payload may include competitionId, headline, body, suggestedTicketCount, ctaLabel.",
  ].join("\n");
}

function extractJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1].trim() : trimmed;
  return JSON.parse(raw);
}

type OpenRouterAssistantMessage = {
  content?: string | null;
  reasoning?: string | null;
};

function extractBalancedJsonObject(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function extractAssistantJsonText(message: OpenRouterAssistantMessage | undefined): string {
  const content = message?.content?.trim();
  if (content) return content;

  const reasoning = message?.reasoning?.trim();
  if (!reasoning) return "";

  const fenced = reasoning.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]?.trim()) return fenced[1].trim();

  const plansIdx = reasoning.indexOf('"plans"');
  if (plansIdx >= 0) {
    const start = reasoning.lastIndexOf("{", plansIdx);
    if (start >= 0) {
      const json = extractBalancedJsonObject(reasoning, start);
      if (json) return json;
    }
  }

  return "";
}

export async function planPersonalisationBatch(input: {
  apiKey: string;
  settings: AiPersonalisationSettings;
  catalogue: PersonalisationCatalogueItem[];
  users: UserPersonalisationFeatureSnapshot[];
}): Promise<PlanPersonalisationBatchResult> {
  const model =
    input.settings.plannerModel?.trim() || input.settings.model?.trim() || "openai/gpt-4o-mini";

  const userMessage = JSON.stringify({
    catalogue: input.catalogue,
    users: input.users.map((u) => ({
      userId: u.userId,
      totalSpent: u.totalSpent,
      totalEntries: u.totalEntries,
      topCategorySlugs: u.topCategorySlugs,
      lastOrderAt: u.lastOrderAt,
      walletBalanceBand: u.walletBalanceBand,
      referralBand: u.referralBand,
    })),
  });

  const maxTokens = Math.min(
    16_000,
    Math.max(input.settings.maxOutputTokensPerBatch, 4096)
  );

  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: buildSystemPrompt(input.settings) },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter chat failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{
      finish_reason?: string;
      message?: OpenRouterAssistantMessage;
    }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const choice = json.choices?.[0];
  const content = extractAssistantJsonText(choice?.message);
  if (!content) {
    const finish = choice?.finish_reason ?? "unknown";
    throw new Error(
      `OpenRouter returned empty JSON content (finish_reason=${finish}). Try openrouter/free or raise max output tokens per batch.`
    );
  }

  const parsed = personalisationBatchResponseSchema.safeParse(extractJsonContent(content));
  if (!parsed.success) {
    throw new Error(`Invalid personalisation batch JSON: ${parsed.error.message}`);
  }

  const catalogueIds = new Set(input.catalogue.map((c) => c.id));
  const plans = parsed.data.plans.map((plan, index) => {
    const expectedUserId = input.users[index]?.userId;
    const userId = plan.userId === expectedUserId ? plan.userId : (expectedUserId ?? plan.userId);
    const competitionId = plan.payload?.competitionId;
    if (competitionId && !catalogueIds.has(competitionId)) {
      return {
        userId,
        action: "none" as const,
        surfaces: plan.surfaces,
        payload: {},
      };
    }
    return { ...plan, userId };
  });

  while (plans.length < input.users.length) {
    const userId = input.users[plans.length]!.userId;
    plans.push({ userId, action: "none" });
  }

  return {
    plans: plans.slice(0, input.users.length),
    tokensIn: json.usage?.prompt_tokens ?? 0,
    tokensOut: json.usage?.completion_tokens ?? 0,
    model,
  };
}
