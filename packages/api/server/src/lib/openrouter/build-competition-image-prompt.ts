import { DEFAULT_IMAGE_GENERATION_ASPECT_RATIO } from "@oc/types";

export function buildCompetitionImagePrompt(
  template: string,
  input: {
    title: string;
    description: string;
    brandColors: string;
    referenceImageUrl: string;
    aspectRatio?: string;
  }
): string {
  const colors = input.brandColors.trim() || "cohesive premium palette fitting a UK raffle brand";
  const aspect = input.aspectRatio?.trim() || DEFAULT_IMAGE_GENERATION_ASPECT_RATIO;
  const reference = input.referenceImageUrl.trim()
    ? "A reference image is attached — match its styling, lighting, mood, and product treatment."
    : "No reference image — follow the brand colours and brief only.";

  return template
    .replace(/\[Name\]/gi, input.title)
    .replace(/\[Description\]/gi, input.description)
    .replace(/\[Brand colors\]/gi, colors)
    .replace(/\[Brand colours\]/gi, colors)
    .replace(/\[Aspect ratio\]/gi, aspect)
    .replace(/\[Reference image\]/gi, reference);
}
