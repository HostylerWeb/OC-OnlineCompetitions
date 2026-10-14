export function buildCompetitionImagePrompt(
  template: string,
  input: {
    title: string;
    description: string;
    brandColors: string;
    referenceImageUrl: string;
  }
): string {
  const reference = input.referenceImageUrl.trim() || "none";
  const colors = input.brandColors.trim() || "brand defaults";
  return template
    .replace(/\[Name\]/gi, input.title)
    .replace(/\[Description\]/gi, input.description)
    .replace(/\[Brand colors\]/gi, colors)
    .replace(/\[Reference image\]/gi, reference);
}
