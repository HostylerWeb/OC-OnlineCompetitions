import { randomBytes } from "node:crypto";
import { buildAssetUrl, uploadFile } from "@oc/api-storage/s3";
import { DEFAULT_IMAGE_GENERATION_ASPECT_RATIO } from "@oc/types";

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
  aspectRatio?: string;
  referenceImageUrl?: string;
  uploadKeyPrefix?: string;
}): Promise<GenerateCompetitionImageResult> {
  const model = input.model.trim();
  if (!model) throw new Error("Image generation model is not configured.");

  const body: Record<string, unknown> = {
    model,
    prompt: input.prompt,
    aspect_ratio: input.aspectRatio?.trim() || DEFAULT_IMAGE_GENERATION_ASPECT_RATIO,
    n: 1,
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
  let contentTypeHint: string | null = null;
  if (item.b64_json) {
    bytes = Buffer.from(item.b64_json, "base64");
  } else if (item.url) {
    const imgRes = await fetch(item.url, { signal: AbortSignal.timeout(60_000) });
    if (!imgRes.ok) throw new Error("Failed to download generated image from provider URL");
    contentTypeHint = imgRes.headers.get("content-type");
    bytes = Buffer.from(await imgRes.arrayBuffer());
  } else {
    throw new Error("OpenRouter image response missing b64_json and url");
  }

  const { extension, contentType } = sniffImageFormat(bytes, contentTypeHint);
  const slugPart = (input.uploadKeyPrefix ?? "competition")
    .replace(/[^a-z0-9-]/gi, "-")
    .slice(0, 80);
  const key = `uploads/ai/${slugPart}-${randomBytes(8).toString("hex")}.${extension}`;
  await uploadFile(key, bytes, contentType);

  return { key, publicUrl: buildAssetUrl(key) };
}

function sniffImageFormat(
  bytes: Buffer,
  contentTypeHint: string | null
): { extension: string; contentType: string } {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { extension: "png", contentType: "image/png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: "jpg", contentType: "image/jpeg" };
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { extension: "webp", contentType: "image/webp" };
  }
  const hinted = contentTypeHint?.split(";")[0]?.trim().toLowerCase();
  if (hinted === "image/jpeg") return { extension: "jpg", contentType: "image/jpeg" };
  if (hinted === "image/webp") return { extension: "webp", contentType: "image/webp" };
  if (hinted === "image/png") return { extension: "png", contentType: "image/png" };
  return { extension: "png", contentType: "image/png" };
}
