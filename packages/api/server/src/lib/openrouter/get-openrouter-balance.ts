const OPENROUTER_KEY_URL = "https://openrouter.ai/api/v1/key";
const OPENROUTER_CREDITS_URL = "https://openrouter.ai/api/v1/credits";

export type OpenRouterKeyBalance = {
  usageUsd: number;
  usageDailyUsd: number;
  usageMonthlyUsd: number;
  limitUsd: number | null;
  limitRemainingUsd: number | null;
  limitReset: string | null;
  isFreeTier: boolean;
  label: string | null;
};

export type OpenRouterAccountCredits = {
  totalCreditsUsd: number;
  totalUsageUsd: number;
  remainingUsd: number;
};

export type OpenRouterBalanceSnapshot = {
  fetchedAt: string;
  key: OpenRouterKeyBalance;
  accountCredits: OpenRouterAccountCredits | null;
  accountCreditsUnavailableReason?: string;
};

export class OpenRouterBalanceError extends Error {
  constructor(
    message: string,
    readonly code: "MISSING_API_KEY" | "INVALID_API_KEY" | "UPSTREAM_ERROR"
  ) {
    super(message);
    this.name = "OpenRouterBalanceError";
  }
}

async function openRouterGet<T>(url: string, apiKey: string): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status === 401) {
    throw new OpenRouterBalanceError("Invalid OpenRouter API key.", "INVALID_API_KEY");
  }

  const json = (await res.json().catch(() => ({}))) as {
    data?: Record<string, unknown>;
    error?: { message?: string };
  };

  if (!res.ok) {
    const msg = json.error?.message ?? `OpenRouter returned ${res.status}`;
    throw new OpenRouterBalanceError(msg, "UPSTREAM_ERROR");
  }

  return json as T;
}

type KeyResponse = {
  data: {
    usage?: number;
    usage_daily?: number;
    usage_monthly?: number;
    limit?: number | null;
    limit_remaining?: number | null;
    limit_reset?: string | null;
    is_free_tier?: boolean;
    label?: string | null;
  };
};

type CreditsResponse = {
  data: {
    total_credits?: number;
    total_usage?: number;
  };
};

export async function fetchOpenRouterBalance(apiKey: string): Promise<OpenRouterBalanceSnapshot> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new OpenRouterBalanceError("OpenRouter API key is not configured.", "MISSING_API_KEY");
  }

  const keyJson = await openRouterGet<KeyResponse>(OPENROUTER_KEY_URL, trimmed);
  const d = keyJson.data ?? {};

  const key: OpenRouterKeyBalance = {
    usageUsd: Number(d.usage ?? 0),
    usageDailyUsd: Number(d.usage_daily ?? 0),
    usageMonthlyUsd: Number(d.usage_monthly ?? 0),
    limitUsd: d.limit == null ? null : Number(d.limit),
    limitRemainingUsd: d.limit_remaining == null ? null : Number(d.limit_remaining),
    limitReset: d.limit_reset ?? null,
    isFreeTier: Boolean(d.is_free_tier),
    label: d.label ?? null,
  };

  let accountCredits: OpenRouterAccountCredits | null = null;
  let accountCreditsUnavailableReason: string | undefined;

  try {
    const res = await fetch(OPENROUTER_CREDITS_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${trimmed}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as CreditsResponse & {
      error?: { message?: string };
    };
    if (res.status === 403) {
      accountCreditsUnavailableReason =
        "Account-wide balance requires an OpenRouter management key. This key shows per-key usage and limits only.";
    } else if (!res.ok) {
      accountCreditsUnavailableReason =
        json.error?.message ?? `Could not load account credits (${res.status})`;
    } else {
      const c = json.data ?? {};
      const totalCreditsUsd = Number(c.total_credits ?? 0);
      const totalUsageUsd = Number(c.total_usage ?? 0);
      accountCredits = {
        totalCreditsUsd,
        totalUsageUsd,
        remainingUsd: totalCreditsUsd - totalUsageUsd,
      };
    }
  } catch (err) {
    accountCreditsUnavailableReason =
      err instanceof Error ? err.message : "Could not load account credits";
  }

  return {
    fetchedAt: new Date().toISOString(),
    key,
    accountCredits,
    accountCreditsUnavailableReason,
  };
}
