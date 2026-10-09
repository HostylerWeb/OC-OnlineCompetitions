"use client";

import {
  useCompetitionCategories,
  useCompetitionStream,
  useCompetitions,
  useCompetitionsFilterStore,
} from "@oc/api-client";
import { useEffect, useMemo, useState } from "react";
import { CompetitionCard } from "@/components/home/CompetitionCard";
import { CompetitionsSearch } from "@/components/home/CompetitionsSearch";
import { useTranslation } from "@/lib/i18n";

export default function Page() {
  const { t } = useTranslation();
  const searchObj =
    typeof window !== "undefined"
      ? (Object.fromEntries(new URLSearchParams(window.location.search).entries()) as Record<
          string,
          string
        >)
      : ({} as Record<string, string>);
  const [ready, setReady] = useState(false);

  const storeCategory = useCompetitionsFilterStore((s) => s.category);
  const storeStatus = useCompetitionsFilterStore((s) => s.status);
  const storeSearch = useCompetitionsFilterStore((s) => s.search);
  const initFromUrl = useCompetitionsFilterStore((s) => s.initFromUrl);

  useEffect(() => {
    initFromUrl();
    setReady(true);
    const onPop = () => initFromUrl();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [initFromUrl]);

  const category = ready ? storeCategory : (searchObj.category ?? null);
  const status = ready ? storeStatus : (searchObj.status ?? null);
  const search = ready ? storeSearch : (searchObj.search ?? "");

  const {
    data: competitionsResponse,
    isError,
    refetch,
  } = useCompetitions({ category: category ?? undefined, status: status ?? undefined });
  const competitions = competitionsResponse?.data ?? [];
  const competitionIds = competitions.map((c: any) => c._id || c.id).filter(Boolean);
  useCompetitionStream(competitionIds);

  const filteredCompetitions = useMemo(() => {
    let result = competitions;
    if (category) {
      result = result.filter((c) => c.category === category);
    }
    if (search) {
      result = result.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));
    }
    return result;
  }, [competitions, category, search]);

  const { data: categoriesResponse } = useCompetitionCategories();
  const categories = categoriesResponse?.data ?? [];

  return (
    <>
      <section className="py-6 lg:py-12 border-b border-gold/10">
        <div className="oc-container-wide">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-2 lg:mb-4 text-balance">
            <span className="text-gold">{t("competitions.listing.heading")}</span>
          </h1>
          <p className="text-sm lg:text-base text-muted-foreground max-w-2xl">
            {t("competitions.listing.description")}
          </p>
        </div>
      </section>

      <section className="sticky top-0 z-30 bg-background/95 backdrop-blur-2xl border-b border-gold/10">
        <div className="oc-container-wide py-4 lg:py-6">
          <CompetitionsSearch
            categories={categories as unknown as Array<{ slug: string; label: string }>}
          />
        </div>
      </section>

      <section className="py-5 lg:py-8 min-h-[50vh]">
        <div className="oc-container-wide">
          {isError ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg mb-2">
                {t("competitions.listing.failedToLoad")}
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                {t("competitions.listing.failedToLoadDesc")}
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="text-xs text-gold hover:underline"
                data-umami-event="competitions:refetch"
              >
                {t("competitions.listing.tryAgain")}
              </button>
            </div>
          ) : filteredCompetitions.length > 0 ? (
            <div className="grid onlinecompetitions-grid-competitions animate-fade-in-stagger">
              {filteredCompetitions.map((competition, index) => (
                <CompetitionCard
                  key={competition.id || competition._id}
                  competition={competition}
                  variant="compact"
                  categories={categories}
                  priority={index === 0}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg mb-2">
                {t("competitions.listing.noCompetitions")}
              </p>
              <p className="text-muted-foreground text-sm">
                {t("competitions.listing.noCompetitionsDesc")}
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
