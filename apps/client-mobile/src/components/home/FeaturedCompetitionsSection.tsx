import { useCompetitionCategories, useFeaturedCompetitions } from "@oc/api-client";
import { ArrowRight } from "@oc/icons";
import type { ApiResponse, Category, Competition } from "@oc/types";
import { cn } from "@oc/utils";
import { GoldButton } from "@/components/buttons";
import { Link } from "@/components/Link";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/lib/i18n";
import { CompetitionCard } from "./CompetitionCard";

interface FeaturedCompetitionsSectionProps {
  title?: string;
  limit?: number;
  className?: string;
  initialFeatured?: ApiResponse<Competition[]>;
  initialCategories?: ApiResponse<Category[]>;
}

export function FeaturedCompetitionsSection({
  title,
  limit = 4,
  className,
  initialFeatured,
  initialCategories,
}: FeaturedCompetitionsSectionProps) {
  const { t } = useTranslation();
  const { data: featuredResponse, isLoading } = useFeaturedCompetitions({
    initialData: initialFeatured,
  });
  const featured = featuredResponse?.data ?? [];

  const { data: categoriesResponse } = useCompetitionCategories({
    initialData: initialCategories,
  });
  const categories = categoriesResponse?.data ?? [];

  if (!isLoading && featured.length === 0) return null;

  return (
    <section className={cn("w-full oc-container-wide pb-12 lg:pb-16", className)}>
      <h2 className="mb-6 text-center text-2xl font-bold text-foreground">
        {title ?? t("home.youMightAlsoLike")}
      </h2>
      <div className="grid onlinecompetitions-grid-competitions">
        {isLoading
          ? Array.from({ length: limit }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-gold/10 bg-card">
                <Skeleton className="aspect-[4/3] w-full rounded-none" shimmer />
                <div className="space-y-2 p-3">
                  <Skeleton className="h-5 w-3/4" shimmer />
                  <Skeleton className="h-4 w-1/2" shimmer />
                  <Skeleton className="h-1.5 w-full" shimmer />
                  <Skeleton className="h-3 w-2/5" shimmer />
                </div>
              </div>
            ))
          : featured
              .slice(0, limit)
              .map((comp, index) => (
                <CompetitionCard
                  key={comp._id}
                  competition={comp}
                  variant="compact"
                  categories={categories}
                  priority={index === 0}
                />
              ))}
      </div>

      {!isLoading ? (
        <div className="mt-8 text-center">
          <GoldButton size="lg" asChild>
            <Link href="/competitions">
              {t("home.browseAllCompetitions")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </GoldButton>
        </div>
      ) : null}
    </section>
  );
}
