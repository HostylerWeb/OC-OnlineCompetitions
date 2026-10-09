"use client";

import { useEntryCompetitions } from "@oc/api-client";

import { ArrowRight, Ticket } from "@oc/icons";

import { GoldButton } from "@/components/buttons";
import { CompetitionCard } from "@/components/home/CompetitionCard";
import { Link } from "@/components/Link";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";

export default function EntriesPage() {
  const { t } = useTranslation();

  const { data: entryCompsResponse, isError, refetch } = useEntryCompetitions();
  const competitions = entryCompsResponse?.data ?? [];

  return (
    <>
      <section className="py-8 lg:py-16 border-b border-gold/10">
        <div className="oc-container-wide text-center">
          <Badge
            variant="outline"
            className="text-[10px] border-gold/30 text-gold bg-gold/10 mb-3 lg:mb-4"
          >
            {t("staticPages.entries.fullTransparency")}
          </Badge>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-2 lg:mb-4 text-balance">
            <span className="text-gold">{t("staticPages.entries.heading")}</span>
          </h1>
          <p className="text-sm lg:text-lg text-muted-foreground max-w-xl mx-auto">
            {t("staticPages.entries.subtitle")}
          </p>
        </div>
      </section>

      <section className="py-8">
        <div className="oc-container-wide">
          {isError ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-lg mb-2">
                {t("staticPages.entries.failedToLoad")}
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                {t("staticPages.entries.failedToLoadDesc")}
              </p>
              <GoldButton onClick={() => refetch()} data-umami-event="entries:retry">
                {t("staticPages.entries.retry")}
                <ArrowRight className="w-4 h-4 ml-2" />
              </GoldButton>
            </div>
          ) : competitions.length > 0 ? (
            <div className="grid onlinecompetitions-grid-competitions">
              {competitions.map((comp) => (
                <CompetitionCard
                  key={comp.id}
                  competition={comp}
                  variant="compact"
                  href={`/entries/${comp.id}`}
                  umamiEvent="entries:card-click"
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-4">
                <Ticket className="w-8 h-8 text-gold/30" />
              </div>
              <p className="text-muted-foreground text-lg mb-4">
                {t("staticPages.entries.noEntries")}
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                {t("staticPages.entries.noEntriesDesc")}
              </p>
              <GoldButton asChild>
                <Link href="/competitions" data-umami-event="entries:browse-competitions">
                  {t("staticPages.entries.browseCompetitions")}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </GoldButton>
            </div>
          )}
        </div>
      </section>

      {competitions.length > 0 && (
        <section className="py-6 border-t border-gold/10">
          <div className="oc-container-wide text-center">
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
              <Ticket className="w-4 h-4 text-gold/60" />
              {t("staticPages.entries.footerDisclaimer")}
            </p>
          </div>
        </section>
      )}
    </>
  );
}
