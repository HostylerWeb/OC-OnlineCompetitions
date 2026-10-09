import { useCompetitionCategories, useCompetitions, useFeaturedCompetitions } from "@oc/api-client";
import { ArrowRight } from "@oc/icons";
import type { ApiResponse, Category, Competition } from "@oc/types";
import { cn } from "@oc/utils";
import { useMemo } from "react";
import { GoldButton } from "@/components/buttons";
import { Link } from "@/components/Link";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/lib/i18n";
import { CompetitionCard } from "./CompetitionCard";

interface FeaturedCompetitionsSectionProps {
  title?: string;
  limit?: number;
  /** When featured count is below `limit`, pad with other active competitions. */
  fillToLimit?: boolean;
  className?: string;
  initialFeatured?: ApiResponse<Competition[]>;
  initialCategories?: ApiResponse<Category[]>;
}

function competitionId(comp: Competition): string {
  return comp._id ?? comp.id ?? "";
}

export function FeaturedCompetitionsSection({
  title,
  limit = 4,
  fillToLimit = false,
  className,
  initialFeatured,
  initialCategories,
}: FeaturedCompetitionsSectionProps) {
  const { t } = useTranslation();
  const { data: featuredResponse, isLoading: featuredLoading } = useFeaturedCompetitions({
    initialData: initialFeatured,
  });
  const featured = featuredResponse?.data ?? [];

  const needActiveFill = fillToLimit && !featuredLoading && featured.length < limit;
  const { data: activeResponse, isLoading: activeLoading } = useCompetitions(
    { status: "active", limit: limit + 12 },
    { enabled: needActiveFill }
  );

  const competitions = useMemo(() => {
    const seen = new Set<string>();
    const merged: Competition[] = [];
    for (const comp of featured) {
      const id = competitionId(comp);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(comp);
    }
    if (fillToLimit && activeResponse?.data) {
      for (const comp of activeResponse.data) {
        if (merged.length >= limit) break;
        const id = competitionId(comp);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        merged.push(comp);
      }
    }
    return merged.slice(0, limit);
  }, [activeResponse?.data, featured, fillToLimit, limit]);

  const isLoading = featuredLoading || (needActiveFill && activeLoading);

  const { data: categoriesResponse } = useCompetitionCategories({
    initialData: initialCategories,
  });
  const categories = categoriesResponse?.data ?? [];

  if (!isLoading && competitions.length === 0) return null;

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
          : competitions.map((comp, index) => (
              <CompetitionCard
                key={competitionId(comp) || comp.slug}
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
