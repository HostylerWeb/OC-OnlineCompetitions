import { useCompetitionStream } from "@oc/api-client";
import {
  filterEndingSoonCompetitions,
  resolveHomepageNavSections,
  resolveHomepageSections,
  BRAND_LOGO_PATH,
} from "@oc/utils";
import { useConfig } from "vike-react/useConfig";
import { useData } from "vike-react/useData";
import { usePageContext } from "vike-react/usePageContext";
import { BuiltDifferentSection } from "@/components/home/BuiltDifferentSection";
import { CtaSection } from "@/components/home/CtaSection";
import { CategoryNavSection } from "@/components/home/sections/category-nav-section";
import { CompetitionsSection } from "@/components/home/sections/competitions-section";
import { HeroSection } from "@/components/home/sections/hero-section";
import { WinnersSection } from "@/components/home/sections/winners-section";
import type { Data } from "./+data";

export default function Page() {
  const data = useData<Data>();
  const pageContext = usePageContext();
  const config = useConfig();
  const baseUrl =
    (typeof window !== "undefined" ? window.location.origin : "") || "https://onlinecompetitions.co.uk";
  const urlParsed = pageContext.urlParsed as
    | { search?: Record<string, string>; searchAll?: Record<string, string[]> }
    | undefined;
  const hasRef = urlParsed?.searchAll?.ref !== undefined || urlParsed?.search?.ref !== undefined;
  const globalRefOg = (pageContext as any).referralOgImageUrl as string | null | undefined;
  const defaultOg = (pageContext as any).defaultOgImageUrl ?? BRAND_LOGO_PATH;
  const ogCandidate = hasRef && globalRefOg ? globalRefOg : defaultOg;
  const ogImageUrl = ogCandidate.startsWith("/") ? `${baseUrl}${ogCandidate}` : ogCandidate;
  const defaultTitle =
    (pageContext as any).defaultTitle ?? "Online Competitions  -  Win Amazing Prizes & Luxury Experiences";
  const defaultDesc =
    (pageContext as any).defaultDescription ??
    "Enter competitions on Online Competitions to win incredible prizes, from premium electronics and designer fashion to unforgettable luxury experiences.";
  config({
    title: defaultTitle,
    Head: (
      <>
        <meta property="og:title" content={defaultTitle} />
        <meta property="og:description" content={defaultDesc} />
        <meta property="og:url" content={baseUrl} />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:image:secure_url" content={ogImageUrl} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Online Competitions" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={ogImageUrl} />
      </>
    ),
  });

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
    (cat) => cat.isActive !== false && (competitionsByCategory[cat.slug]?.length ?? 0) > 0
  );

  const endingSoon = filterEndingSoonCompetitions(allCompetitions, endingSoonSettings);
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
        allCompetitions={allCompetitions}
      />
      <WinnersSection winners={winners} />
      <BuiltDifferentSection />
      <CtaSection />
    </>
  );
}
