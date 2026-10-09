"use client";

import { Calendar, List, MapPin, Ticket, Trophy } from "@oc/icons";
import type { Winner } from "@oc/types";
import { cn, formatDate, getDisplayName, withAssetCacheVersion } from "@oc/utils";
import { Button } from "@/components/ui/button";
import { formatNumber, useTranslation } from "@/lib/i18n";

export function getCompetitionIdObject(winner: Winner) {
  return typeof winner.competitionId === "object" && winner.competitionId !== null
    ? winner.competitionId
    : null;
}

export function getCompetitionTitle(winner: Winner): string {
  const comp = getCompetitionIdObject(winner);
  if (comp?.title) return comp.title;
  return winner.competitionTitle ?? winner.competition?.title ?? "";
}

export function getWinnerCompetitionId(winner: Winner): string | null {
  if (typeof winner.competitionId === "string" && winner.competitionId.trim()) {
    return winner.competitionId.trim();
  }
  const comp = getCompetitionIdObject(winner);
  if (comp?._id) return comp._id;
  return null;
}

export type PopulatedWinnerUser = {
  firstName?: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string;
};

export function getPopulatedWinnerUser(winner: Winner): PopulatedWinnerUser | null {
  const userId = winner.userId as string | PopulatedWinnerUser;
  if (typeof userId === "object" && userId !== null) {
    return userId;
  }
  return null;
}

export function getCompetitionImageForWinner(winner: Winner): string | undefined {
  const comp = getCompetitionIdObject(winner);
  return (
    winner.prizeImageUrl?.trim() ||
    comp?.prizeImageUrl?.trim() ||
    comp?.imageUrl?.trim() ||
    winner.competition?.prizeImageUrl?.trim() ||
    winner.competition?.imageUrl?.trim() ||
    undefined
  );
}

export function getWinnerSpotlightImageUrl(winner: Winner): string | undefined {
  const userObj = getPopulatedWinnerUser(winner);
  const profileRaw = winner.avatarUrl?.trim() || userObj?.avatarUrl?.trim();
  const competitionRaw = getCompetitionImageForWinner(winner);
  const raw = competitionRaw || profileRaw;
  return raw ? withAssetCacheVersion(raw) : undefined;
}

export function getWinnerDisplayName(winner: Winner, anonymousLabel: string): string {
  const userObj = getPopulatedWinnerUser(winner);
  return (
    winner.displayName ||
    getDisplayName(
      {
        firstName: userObj?.firstName ?? undefined,
        lastName: userObj?.lastName ?? undefined,
      },
      userObj?.email ?? ""
    ) ||
    anonymousLabel
  );
}

function WinnerAvatar({ winner, className }: { winner: Winner; className?: string }) {
  const userObj = getPopulatedWinnerUser(winner);
  const profileRaw = winner.avatarUrl?.trim() || userObj?.avatarUrl?.trim();
  const competitionRaw = getCompetitionImageForWinner(winner);

  const src = profileRaw
    ? withAssetCacheVersion(profileRaw)
    : competitionRaw
      ? withAssetCacheVersion(competitionRaw)
      : undefined;

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/20 to-gold/5",
        className
      )}
    >
      {src ? (
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <Trophy className="h-6 w-6 text-gold/50 sm:h-7 sm:w-7" />
      )}
    </div>
  );
}

export function WinnerCard({
  winner,
  featured = false,
  onSeeEntries,
}: {
  winner: Winner;
  featured?: boolean;
  onSeeEntries?: () => void;
}) {
  const { t, locale } = useTranslation();
  const displayName = getWinnerDisplayName(winner, t("staticPages.winners.anonymousWinner"));
  const competitionTitle = getCompetitionTitle(winner);
  const drawnDate = formatDate(winner.drawnAt);
  const competitionId = getWinnerCompetitionId(winner);
  const showEntriesButton = Boolean(competitionId && onSeeEntries);

  return (
    <article className="group relative overflow-hidden rounded-[1.5rem] transition-transform duration-300 hover:-translate-y-0.5">
      <div
        className={cn(
          "rounded-[1.5rem] p-1.5 ring-1 transition-colors duration-500",
          featured ? "bg-gold/10 ring-gold/25" : "bg-white/5 ring-white/10 hover:ring-gold/25"
        )}
      >
        <div className="overflow-hidden rounded-[calc(1.5rem-0.375rem)] bg-card">
          <div className="flex flex-col p-4 sm:p-5 lg:p-6">
            <div className="mb-4 flex items-center gap-3">
              <WinnerAvatar winner={winner} className="h-12 w-12 sm:h-14 sm:w-14" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold text-foreground sm:text-xl md:text-2xl">
                  {displayName}
                </p>
                {winner.location ? (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground sm:text-sm">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{winner.location}</span>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-gold/10 bg-gradient-to-br from-gold/5 to-transparent p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("staticPages.winners.prizeWon")}
                </p>
                <p className="mt-1 text-base font-semibold leading-snug text-foreground sm:text-lg">
                  {winner.prizeTitle || competitionTitle || t("staticPages.winners.luxuryPrize")}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground sm:text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-gold/80" />
                  {drawnDate}
                </span>
                {winner.ticketNumber > 0 ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Ticket className="h-3.5 w-3.5 shrink-0 text-gold/80" />
                    {t("staticPages.winners.ticketNumber")}
                    {formatNumber(winner.ticketNumber, locale)}
                  </span>
                ) : null}
              </div>
            </div>

            {winner.testimonial ? (
              <blockquote className="mt-4 border-l-2 border-gold/30 pl-4 text-sm italic leading-relaxed text-muted-foreground sm:text-base">
                &ldquo;{winner.testimonial}&rdquo;
              </blockquote>
            ) : null}

            {showEntriesButton ? (
              <div className="mt-4">
                <Button
                  type="button"
                  variant="gold"
                  size="sm"
                  className="w-full"
                  onClick={onSeeEntries}
                  data-umami-event="winners:see-entries"
                  data-umami-event-competition={competitionId ?? undefined}
                >
                  <List className="mr-2 h-4 w-4" />
                  {t("staticPages.winners.seeEntries")}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
