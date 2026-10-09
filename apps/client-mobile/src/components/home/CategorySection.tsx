import { ChevronRight } from "@oc/icons";
import type { Category, Competition } from "@oc/types";
import { CompetitionCard } from "@/components/home/CompetitionCard";
import { useTranslation } from "@/lib/i18n";

interface CategorySectionProps {
  title: string;
  description?: string;
  competitions: Competition[];
  categorySlug: string;
  viewAllText?: string;
  categories?: Category[];
}

export function CategorySection({
  title,
  description,
  competitions,
  categorySlug,
  viewAllText,
  categories,
}: CategorySectionProps) {
  const { t } = useTranslation();
  if (competitions.length === 0) return null;

  const showViewAll = categorySlug !== "ending-soon";

  return (
    <section
      data-section-id={categorySlug}
      className="py-12 sm:py-14 md:py-16 relative overflow-hidden scroll-mt-48"
    >
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
      <div className="absolute top-0 right-0 w-48 h-48 sm:w-64 sm:h-64 bg-gold/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-48 h-48 sm:w-64 sm:h-64 bg-gold/5 rounded-full blur-3xl" />

      <div className="oc-container-wide relative z-10">
        <div className="mb-6 sm:mb-8 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-1 sm:mb-2">{title}</h2>
            {description && (
              <p className="text-sm sm:text-base text-muted-foreground text-pretty">
                {description}
              </p>
            )}
          </div>
          {showViewAll && (
            <a
              href={`/competitions?category=${encodeURIComponent(categorySlug)}`}
              className="hidden sm:inline-flex items-center flex-shrink-0 space-x-2 px-4 py-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-colors text-sm font-medium"
            >
              <span>{viewAllText ?? t("home.competitions.viewAll")}</span>
              <ChevronRight className="w-4 h-4" />
            </a>
          )}
        </div>

        <div className="grid onlinecompetitions-grid-competitions">
          {competitions.map((comp, index) => (
            <CompetitionCard
              key={comp.id || comp._id}
              competition={comp}
              variant="compact"
              categories={categories}
              // First card in the category section is the LCP candidate.
              priority={index === 0}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
