import type { Category, Competition } from "@oc/types";
import type { ResolvedHomepageSection } from "@oc/utils";
import { useTranslation } from "@/lib/i18n";
import { CategorySection } from "../CategorySection";
import { NextLiveDrawBanner } from "../NextLiveDrawBanner";

export function CompetitionsSection({
  sections,
  categories,
  competitionsByCategory,
  endingSoon,
  allCompetitions,
}: {
  sections: ResolvedHomepageSection[];
  categories: Category[];
  competitionsByCategory: Record<string, Competition[]>;
  endingSoon: Competition[];
  allCompetitions: Competition[];
}) {
  const { t } = useTranslation();
  const contentSections = sections.filter(
    (s): s is typeof s & ({ type: "ending_soon" } | { type: "category" }) =>
      s.type === "ending_soon" || s.type === "category"
  );

  if (contentSections.length === 0) return null;

  const firstCategorySlug = contentSections.find((s) => s.type === "category")?.category.slug;

  return (
    <>
      {contentSections.map((section) => {
        if (section.type === "ending_soon") {
          return (
            <CategorySection
              key="ending-soon"
              title={t("home.competitions.endingSoon")}
              description={t("home.competitions.endingSoonDesc")}
              competitions={endingSoon}
              categorySlug="ending-soon"
              viewAllText={t("home.competitions.viewAll")}
              categories={categories}
            />
          );
        }

        const showNextDrawBanner = section.category.slug === firstCategorySlug;

        return (
          <div key={section.category.slug}>
            {showNextDrawBanner ? <NextLiveDrawBanner competitions={allCompetitions} /> : null}
            <CategorySection
              title={section.category.label}
              competitions={competitionsByCategory[section.category.slug] ?? []}
              categorySlug={section.category.slug}
              viewAllText={t("home.competitions.viewAll")}
              categories={categories}
            />
          </div>
        );
      })}
    </>
  );
}
