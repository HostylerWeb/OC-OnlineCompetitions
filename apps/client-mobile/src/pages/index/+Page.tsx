import { useCompetitionStream } from "@oc/api-client";
import type { Competition } from "@oc/types";
import {
  filterEndingSoonCompetitions,
  resolveHomepageNavSections,
  resolveHomepageSections,
} from "@oc/utils";
import { useMemo } from "react";
import { BuiltDifferentSection } from "@/components/home/BuiltDifferentSection";
import { CtaSection } from "@/components/home/CtaSection";
import { CategoryNavSection } from "@/components/home/sections/category-nav-section";
import { CompetitionsSection } from "@/components/home/sections/competitions-section";
import { HeroSection } from "@/components/home/sections/hero-section";
import { WinnersSection } from "@/components/home/sections/winners-section";

export default function Page() {
  const data = useMemo(() => ({}) as any, []);
  const {
    featuredCompetitions = [],
    layoutSettings = null,
    categories = [],
    competitions = [],
    allCompetitions = [],
    endingSoonSettings = null,
    winners = [],
  } = data ?? {};

  const competitionsByCategory: Record<string, typeof competitions> = {};
  for (const cat of categories) {
    competitionsByCategory[cat.slug] = [];
  }
  for (const comp of competitions) {
    const slug = comp.category;
    if (slug && competitionsByCategory[slug]) {
      competitionsByCategory[slug].push(comp);
    }
  }

  const categoriesWithComps = categories.filter(
    (cat: any) => cat.isActive !== false && (competitionsByCategory[cat.slug]?.length ?? 0) > 0
  );

  const endingSoon = filterEndingSoonCompetitions(
    allCompetitions,
    endingSoonSettings
  ) as unknown as Competition[];
  const allIds = [
    ...(featuredCompetitions?.map((c: any) => c._id || c.id) ?? []),
    ...(competitions?.map((c: any) => c._id || c.id) ?? []),
    ...(allCompetitions?.map((c: any) => c._id || c.id) ?? []),
  ].filter(Boolean);
  useCompetitionStream([...new Set(allIds)]);

  const hasEndingSoon = endingSoon.length > 0;
  const sectionContext = { hasEndingSoon, categoriesWithComps };

  const sections = resolveHomepageSections(layoutSettings, sectionContext);
  const navSections = resolveHomepageNavSections(layoutSettings, sectionContext);
  const defaultActiveSection = navSections[0]?.sectionId ?? "";

  return (
    <>
      <CategoryNavSection navSections={navSections} defaultActiveSection={defaultActiveSection} />
      <HeroSection competitions={featuredCompetitions} />
      <CompetitionsSection
        sections={sections}
        categories={categories}
        competitionsByCategory={competitionsByCategory}
        endingSoon={endingSoon}
      />
      <WinnersSection winners={winners} />
      <BuiltDifferentSection />
      <CtaSection />
    </>
  );
}
