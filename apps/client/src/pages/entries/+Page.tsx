"use client";

import { useEntryCompetitions } from "@oc/api-client";

import { ArrowRight, Ticket } from "@oc/icons";
import type { ApiResponse, EntryCompetition } from "@oc/types";
import { useEffect, useRef, useState } from "react";
import { useData } from "vike-react/useData";
import { GoldButton } from "@/components/buttons";
import { CompetitionCard } from "@/components/home/CompetitionCard";
import { Link } from "@/components/Link";
import { Badge } from "@/components/ui/badge";
import { CompetitionEntryListDialog } from "@/components/winners/CompetitionEntryListDialog";
import { useTranslation } from "@/lib/i18n";
import type { Data } from "./+data";

type EntryListDialogState = {
  competitionId: string;
  competitionTitle: string;
};

export default function EntriesPage() {
  const { t } = useTranslation();
  const data = useData<Data>();
  const initialData = (data ?? undefined) as ApiResponse<EntryCompetition[]> | undefined;

  const {
    data: entryCompsResponse,
    isError,
    refetch,
  } = useEntryCompetitions({
    initialData,
  });
  const competitions = entryCompsResponse?.data ?? [];

  const [entryDialog, setEntryDialog] = useState<EntryListDialogState | null>(null);
  const consumedListQuery = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || consumedListQuery.current || competitions.length === 0) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const listId = params.get("list")?.trim();
    if (!listId) {
      consumedListQuery.current = true;
      return;
    }

    consumedListQuery.current = true;
    params.delete("list");
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
    window.history.replaceState({}, "", nextUrl);

    const match = competitions.find((c) => c.id === listId);
    setEntryDialog({
      competitionId: listId,
      competitionTitle: match?.title ?? t("staticPages.entries.heading"),
    });
  }, [competitions, t]);

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
                  ctaLabel={t("staticPages.entries.seeEntryList")}
                  umamiEvent="entries:card-click"
                  onCardClick={() =>
                    setEntryDialog({
                      competitionId: comp.id,
                      competitionTitle: comp.title,
                    })
                  }
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

      <CompetitionEntryListDialog
        open={entryDialog != null}
        onOpenChange={(open) => {
          if (!open) setEntryDialog(null);
        }}
        competitionId={entryDialog?.competitionId ?? ""}
        competitionTitle={entryDialog?.competitionTitle ?? ""}
      />
    </>
  );
}
