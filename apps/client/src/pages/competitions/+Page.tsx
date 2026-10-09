"use client";

import {
  useCompetitionCategories,
  useCompetitionStream,
  useCompetitions,
  useCompetitionsFilterStore,
} from "@oc/api-client";
import { useEffect, useMemo, useState } from "react";
import { prefetch } from "vike/client/router";
import { useConfig } from "vike-react/useConfig";
import { useData } from "vike-react/useData";
import { usePageContext } from "vike-react/usePageContext";
import { brandLogoUrl } from "@oc/utils";
import { CompetitionCard } from "@/components/home/CompetitionCard";
import { CompetitionsSearch } from "@/components/home/CompetitionsSearch";
import { useTranslation } from "@/lib/i18n";
import type { Data } from "./+data";

export default function Page() {
  const { t } = useTranslation();
  const pageContext = usePageContext();
  const urlParsed = pageContext.urlParsed;
  const searchObj = urlParsed.search as Record<string, string>;
  const serverData = useData<Data>();
  const [ready, setReady] = useState(false);

  const config = useConfig();
  const baseUrl =
    (typeof window !== "undefined" ? window.location.origin : "") || "https://onlinecompetitions.co.uk";
  const heading = t("competitions.listing.heading");
  const description = t("competitions.listing.description");
  const hasRef = urlParsed?.searchAll?.ref !== undefined || urlParsed?.search?.ref !== undefined;
  const globalRefOg = (pageContext as any).referralOgImageUrl as string | null | undefined;
  const ogSrc = hasRef && globalRefOg ? globalRefOg : brandLogoUrl(baseUrl);
  const ogUrl = ogSrc.startsWith("/") ? `${baseUrl}${ogSrc}` : ogSrc;
  config({
    title: `${heading}  -  Online Competitions`,
    Head: (
      <>
        <meta property="og:title" content={`${heading}  -  Online Competitions`} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={`${baseUrl}/competitions`} />
        <meta property="og:image" content={ogUrl} />
        <meta property="og:image:secure_url" content={ogUrl} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Online Competitions" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={ogUrl} />
      </>
    ),
  });

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

  const initialComps = serverData ? { data: serverData.competitions } : undefined;
  const initialCats = serverData ? { data: serverData.categories } : undefined;
  const useInitialCompetitions = !category && !status;

  const {
    data: competitionsResponse,
    isError,
    refetch,
  } = useCompetitions(
    { category: category ?? undefined, status: status ?? undefined, limit: 100 },
    { initialData: useInitialCompetitions ? initialComps : undefined }
  );
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

  useEffect(() => {
    if (!filteredCompetitions.length) return;
    const toPrefetch = filteredCompetitions.slice(0, 3);
    toPrefetch.forEach((comp, i) => {
      const slug = comp.slug ?? (comp as { id?: string }).id;
      if (slug) {
        setTimeout(() => {
          void prefetch(`/competitions/${slug}`);
        }, i * 50);
      }
    });
  }, [filteredCompetitions]);

  const { data: categoriesResponse } = useCompetitionCategories({ initialData: initialCats });
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

      <section className="py-4 lg:py-6 border-b border-gold/10">
        <div className="oc-container-wide">
          <CompetitionsSearch
            categories={categories as unknown as Array<{ slug: string; label: string }>}
          />
        </div>
      </section>

      <section className="py-5 lg:py-8">
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
