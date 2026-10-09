import type { Category } from "@oc/types";
import {
  DEFAULT_HOMEPAGE_SECTIONS,
  type HomepageLayoutSettings,
  type HomepageSectionId,
} from "@oc/types";

export type ResolvedHomepageSection =
  | { type: "hero" }
  | { type: "ending_soon"; sectionId: "ending-soon" }
  | { type: "category"; category: Category; sectionId: string }
  | { type: "winners" }
  | { type: "built_different" }
  | { type: "cta" };

export type NavHomepageSection = Extract<
  ResolvedHomepageSection,
  { type: "ending_soon" } | { type: "category" }
>;

export interface ResolveHomepageSectionsContext {
  hasEndingSoon: boolean;
  categoriesWithComps: Category[];
}

export function resolveHomepageSections(
  layout: HomepageLayoutSettings | null | undefined,
  context: ResolveHomepageSectionsContext
): ResolvedHomepageSection[] {
  const sections = layout?.sections?.length ? layout.sections : DEFAULT_HOMEPAGE_SECTIONS;
  const resolved: ResolvedHomepageSection[] = [];

  for (const section of sections) {
    if (!section.enabled) continue;

    switch (section.id) {
      case "hero":
        resolved.push({ type: "hero" });
        break;
      case "ending_soon":
        if (context.hasEndingSoon) {
          resolved.push({ type: "ending_soon", sectionId: "ending-soon" });
        }
        break;
      case "categories": {
        const sortedCategories = [...context.categoriesWithComps].sort(
          (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
        );
        for (const category of sortedCategories) {
          resolved.push({ type: "category", category, sectionId: category.slug });
        }
        break;
      }
      case "winners":
        resolved.push({ type: "winners" });
        break;
      case "built_different":
        resolved.push({ type: "built_different" });
        break;
      case "cta":
        resolved.push({ type: "cta" });
        break;
    }
  }

  return resolved;
}

export function resolveHomepageNavSections(
  layout: HomepageLayoutSettings | null | undefined,
  context: ResolveHomepageSectionsContext
): NavHomepageSection[] {
  return resolveHomepageSections(layout, context).filter(
    (section): section is NavHomepageSection =>
      section.type === "ending_soon" || section.type === "category"
  );
}

export const HOMEPAGE_SECTION_LABELS: Record<
  HomepageSectionId,
  { title: string; description: string }
> = {
  hero: {
    title: "Hero slider",
    description: "Featured competitions carousel at the top of the homepage.",
  },
  ending_soon: {
    title: "Ending Soon",
    description: "Uses Competition Settings thresholds — configure in Competitions → Settings.",
  },
  categories: {
    title: "Categories",
    description:
      "One section per active category with competitions — order managed in Categories admin.",
  },
  winners: {
    title: "Winners showcase",
    description: "Recent winners carousel and social proof.",
  },
  built_different: {
    title: "Built Different",
    description: "Marketing feature grid from static site content.",
  },
  cta: {
    title: "Call to action",
    description: "Browse competitions and sign-up prompts at the bottom.",
  },
};
