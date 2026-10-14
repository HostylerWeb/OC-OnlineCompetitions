import { randomBytes } from "node:crypto";
import { buildAssetUrl, uploadFile } from "@oc/api-storage/s3";

const OPENROUTER_IMAGES_URL = "https://openrouter.ai/api/v1/images";

export type GenerateCompetitionImageResult = {
  publicUrl: string;
  key: string;
};

type OpenRouterImageResponse = {
  data?: Array<{ b64_json?: string; url?: string }>;
  error?: { message?: string };
};

export async function generateCompetitionImageViaOpenRouter(input: {
  apiKey: string;
  model: string;
  prompt: string;
  referenceImageUrl?: string;
  uploadKeyPrefix?: string;
}): Promise<GenerateCompetitionImageResult> {
  const model = input.model.trim();
  if (!model) throw new Error("Image generation model is not configured.");

  const body: Record<string, unknown> = {
    model,
    prompt: input.prompt,
    aspect_ratio: "1:1",
    n: 1,
    output_format: "png",
  };

  const ref = input.referenceImageUrl?.trim();
  if (ref) {
    body.input_references = [ref];
  }

  const res = await fetch(OPENROUTER_IMAGES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(180_000),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter image generation failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const json = (await res.json()) as OpenRouterImageResponse;
  const item = json.data?.[0];
  if (!item) {
    throw new Error(json.error?.message ?? "OpenRouter returned no image data");
  }

  let bytes: Buffer;
  if (item.b64_json) {
    bytes = Buffer.from(item.b64_json, "base64");
  } else if (item.url) {
    const imgRes = await fetch(item.url, { signal: AbortSignal.timeout(60_000) });
    if (!imgRes.ok) throw new Error("Failed to download generated image from provider URL");
    bytes = Buffer.from(await imgRes.arrayBuffer());
  } else {
    throw new Error("OpenRouter image response missing b64_json and url");
  }

  const slugPart = (input.uploadKeyPrefix ?? "competition")
    .replace(/[^a-z0-9-]/gi, "-")
    .slice(0, 80);
  const key = `uploads/ai/${slugPart}-${randomBytes(8).toString("hex")}.png`;
  await uploadFile(key, bytes, "image/png");

  return { key, publicUrl: buildAssetUrl(key) };
}
