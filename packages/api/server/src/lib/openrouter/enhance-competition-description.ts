const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function enhanceCompetitionDescriptionViaOpenRouter(input: {
  apiKey: string;
  model: string;
  title: string;
  description: string;
}): Promise<string> {
  const model = input.model.trim();
  if (!model) throw new Error("Description enhancement model is not configured.");

  const userContent = [
    `Competition name: ${input.title}`,
    `Current description:\n${input.description || "(empty)"}`,
    "",
    "Rewrite the description for a UK online raffle/competition site.",
    "Keep facts accurate; improve clarity, excitement, and compliance (no guaranteed wins).",
    "Return only the enhanced description text, no markdown fences.",
  ].join("\n");

  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content:
            "You are a copy editor for a UK prize competition website. Output plain text only.",
        },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter chat failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenRouter returned empty description");
  return content;
}
