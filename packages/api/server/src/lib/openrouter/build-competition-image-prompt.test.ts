import {
  LEGACY_COMPETITION_IMAGE_PROMPT_TEMPLATE,
  EXACT_TITLE_HEADLINE_PROMPT_TEMPLATE,
  NO_ON_IMAGE_TEXT_PROMPT_TEMPLATE,
  resolveCompetitionImagePromptTemplate,
} from "@oc/types";
import { describe, expect, it } from "vitest";
import { buildCompetitionImagePrompt } from "./build-competition-image-prompt";

describe("resolveCompetitionImagePromptTemplate", () => {
  it("upgrades the legacy default to the recommended template", () => {
    expect(resolveCompetitionImagePromptTemplate(LEGACY_COMPETITION_IMAGE_PROMPT_TEMPLATE)).toMatch(
      /On-image text/
    );
  });

  it("upgrades the no-text recommended template", () => {
    expect(resolveCompetitionImagePromptTemplate(NO_ON_IMAGE_TEXT_PROMPT_TEMPLATE)).toMatch(
      /at most 4 words/
    );
  });

  it("upgrades the full-title headline template", () => {
    expect(resolveCompetitionImagePromptTemplate(EXACT_TITLE_HEADLINE_PROMPT_TEMPLATE)).toMatch(
      /Never print the full title/
    );
  });
});

describe("buildCompetitionImagePrompt", () => {
  it("substitutes placeholders including aspect ratio and reference instructions", () => {
    const out = buildCompetitionImagePrompt(
      "Title: [Name]\nRatio: [Aspect ratio]\nRef: [Reference image]",
      {
        title: "Win a Car",
        description: "Brand new EV.",
        brandColors: "navy, gold",
        referenceImageUrl: "https://cdn.example/ref.png",
        aspectRatio: "16:9",
      }
    );
    expect(out).toContain("Win a Car");
    expect(out).toContain("16:9");
    expect(out).toContain("reference image is attached");
    expect(out).not.toContain("https://cdn.example");
  });

  it("uses no-reference copy when reference URL is empty", () => {
    const out = buildCompetitionImagePrompt("[Reference image]", {
      title: "T",
      description: "D",
      brandColors: "",
      referenceImageUrl: "",
    });
    expect(out).toContain("No reference image");
  });
});
