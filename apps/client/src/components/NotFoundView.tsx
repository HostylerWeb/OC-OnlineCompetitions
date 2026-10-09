"use client";

import { Home, Search, Trophy } from "@oc/icons";
import { FeaturedCompetitionsSection } from "@/components/home/FeaturedCompetitionsSection";
import { PageActionButtons } from "@/components/layout/PageActionButtons";
import { useTranslation } from "@/lib/i18n";

interface NotFoundViewProps {
  showFeatured?: boolean;
}

export function NotFoundView({ showFeatured = true }: NotFoundViewProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-gold/[0.07] via-transparent to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-24 top-0 size-72 rounded-full bg-primary/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative mx-auto w-full max-w-2xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
          <p
            className="mb-2 text-[clamp(3.5rem,14vw,7rem)] font-bold leading-none tracking-tighter text-gold/20"
            aria-hidden="true"
          >
            {t("notFound.code")}
          </p>

          <div className="mb-6 inline-flex size-16 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10 shadow-sm">
            <Search className="size-8 text-gold" aria-hidden="true" />
          </div>

          <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground text-balance sm:text-4xl lg:text-5xl">
            {t("notFound.heading")}
          </h1>
          <p className="mx-auto max-w-md text-lg text-muted-foreground text-pretty">
            {t("notFound.description")}
          </p>

          <div className="mt-10">
            <PageActionButtons
              actions={[
                {
                  label: t("notFound.goBack"),
                  onClick: () => window.history.back(),
                  variant: "outline",
                  "data-umami-event": "not-found:go-back",
                },
                {
                  label: t("notFound.browseCompetitions"),
                  href: "/competitions",
                  variant: "outline",
                  icon: Trophy,
                  "data-umami-event": "not-found:competitions",
                },
                {
                  label: t("notFound.backToHome"),
                  href: "/",
                  variant: "gold",
                  icon: Home,
                  "data-umami-event": "not-found:go-home",
                },
              ]}
            />
          </div>
        </div>
      </div>

      {showFeatured ? (
        <FeaturedCompetitionsSection
          className="border-t border-border/40 pt-4"
          limit={4}
          fillToLimit
        />
      ) : null}
    </div>
  );
}
