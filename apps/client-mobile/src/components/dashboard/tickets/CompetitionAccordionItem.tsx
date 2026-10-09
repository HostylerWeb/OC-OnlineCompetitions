"use client";

import { Ticket } from "@oc/icons";
import { cn } from "@oc/utils";
import { useEffect, useRef } from "react";
import { TicketNumberPill } from "@/components/shared/TicketNumberPill";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useTranslation } from "@/lib/i18n";
import {
  collapsibleContentClass,
  collapsibleItemClass,
  collapsiblePanelClass,
  collapsibleThumbnailClass,
  collapsibleTriggerClass,
} from "../../shared/collapsibleShellStyles";
import {
  getLinkedCompetitionPath,
  LinkedCompetitionLink,
} from "../../shared/LinkedCompetitionLink";
import { dashboardListShellClass } from "../dashboard-list-styles";
import { EntryTicketRow } from "./EntryTicketRow";
import type { CompetitionGroup } from "./ticketGrouping";
import { ORPHANED_COMPETITION_ID } from "./ticketGrouping";

interface CompetitionAccordionItemProps {
  group: CompetitionGroup;
  totalCount: number;
  prizeWinsCount: number;
  isInfinite?: boolean;
  fetchNextPage?: () => void;
  hasMore?: boolean;
  isFetchingNextPage?: boolean;
}

type CompetitionStatus = "active" | "ended" | "drawn";

const TEASER_COUNT = 3;

function CompetitionStatusBadge({
  status,
  className,
}: {
  status: CompetitionStatus;
  className?: string;
}) {
  const { t } = useTranslation();
  const config = {
    active: {
      labelKey: "dashboard.tickets.competitionStatuses.active",
      className: "border-success/25 bg-success/10 text-success",
    },
    ended: {
      labelKey: "dashboard.tickets.competitionStatuses.ended",
      className: "border-muted-foreground/25 bg-muted/50 text-muted-foreground",
    },
    drawn: {
      labelKey: "dashboard.tickets.competitionStatuses.drawn",
      className: "border-gold/25 bg-gold/10 text-gold",
    },
  } as const;

  const { labelKey, className: statusClassName } = config[status];

  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        statusClassName,
        className
      )}
    >
      {t(labelKey)}
    </span>
  );
}

function InfiniteScrollSentinel({
  onIntersect,
  enabled,
}: {
  onIntersect: () => void;
  enabled: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) onIntersect();
      },
      { rootMargin: "120px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, onIntersect]);

  return <div ref={ref} aria-hidden="true" className="h-1 w-full" />;
}

export function CompetitionAccordionItem({
  group,
  totalCount,
  prizeWinsCount,
  isInfinite,
  fetchNextPage,
  hasMore,
  isFetchingNextPage,
}: CompetitionAccordionItemProps) {
  const { comp, entries } = group;
  const imageUrl = comp.prizeImageUrl ?? comp.imageUrl;
  const competitionId = comp._id !== ORPHANED_COMPETITION_ID ? comp._id : undefined;

  const status: CompetitionStatus =
    comp.status === "active" ? "active" : comp.status === "ended" ? "ended" : "drawn";

  const winPercent = totalCount > 0 ? Math.min(100, (prizeWinsCount / totalCount) * 100) : 0;

  const { t } = useTranslation();
  const title = comp.title ?? t("dashboard.tickets.unknownCompetition");

  const teaserEntries = entries.slice(0, TEASER_COUNT);
  const teaserRemaining = Math.max(0, entries.length - TEASER_COUNT);

  return (
    <AccordionItem value={comp._id} className={collapsibleItemClass}>
      <AccordionTrigger className={collapsibleTriggerClass}>
        <div className={collapsibleThumbnailClass}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              className="object-cover"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-muted/60">
              <Ticket className="size-5 text-muted-foreground/60 sm:size-6" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 text-left">
          {competitionId ? (
            <LinkedCompetitionLink
              title={title}
              slug={comp.slug}
              id={competitionId}
              label={title}
              className="line-clamp-2 block font-bold leading-snug text-foreground sm:truncate sm:text-base lg:text-lg"
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <p className="line-clamp-2 font-bold leading-snug text-foreground sm:truncate sm:text-base lg:text-lg">
              {title}
            </p>
          )}

          <div className="mt-1.5 flex items-center gap-2">
            <div
              className="h-1 min-w-12 max-w-20 flex-1 overflow-hidden rounded-full bg-muted/80"
              role="progressbar"
              aria-valuenow={prizeWinsCount}
              aria-valuemin={0}
              aria-valuemax={totalCount}
              aria-label={`${prizeWinsCount} of ${totalCount} tickets won via instant prize`}
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500 ease-out",
                  prizeWinsCount > 0
                    ? "bg-gradient-to-r from-gold to-gold-dark"
                    : status === "active"
                      ? "bg-success/50"
                      : "bg-muted-foreground/35"
                )}
                style={{
                  width: `${prizeWinsCount > 0 ? winPercent : status === "active" ? 100 : 40}%`,
                }}
              />
            </div>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              <span className="font-medium text-foreground/80">{totalCount.toLocaleString()}</span>{" "}
              {t("dashboard.tickets.totalTickets").toLowerCase()}
              {prizeWinsCount > 0 ? (
                <span className="font-medium text-gold">
                  {" · "}
                  {prizeWinsCount} {t("dashboard.wins.claimed").toLowerCase()}
                </span>
              ) : null}
            </span>
          </div>

          {teaserEntries.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {teaserEntries.map((entry) => {
                const value = entry.ticketNumber ?? entry.entryNumber;
                if (typeof value !== "number") return null;
                return (
                  <TicketNumberPill
                    key={entry._id ?? value}
                    value={value}
                    className="text-[11px] px-2 py-0.5"
                  />
                );
              })}
              {teaserRemaining > 0 ? (
                <span className="text-[11px] text-muted-foreground">
                  +{teaserRemaining.toLocaleString()} more
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <CompetitionStatusBadge status={status} />
        </div>
      </AccordionTrigger>

      <AccordionContent className={collapsibleContentClass}>
        <div
          className={cn(
            collapsiblePanelClass,
            dashboardListShellClass,
            "border-gold/10 bg-card/60"
          )}
        >
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/40 bg-muted/10 px-3 py-2.5 sm:px-3.5">
            <span className="text-xs font-medium text-muted-foreground">
              {totalCount.toLocaleString()} {t("dashboard.tickets.totalTickets").toLowerCase()}
            </span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {prizeWinsCount > 0 ? (
                <div className="flex items-center gap-1">
                  <div className="size-2 rounded-full bg-gold" />
                  <span className="text-xs text-muted-foreground">
                    {prizeWinsCount} {t("dashboard.tickets.prizeWins").toLowerCase()}
                  </span>
                </div>
              ) : null}
              <div className="flex items-center gap-1">
                <div
                  className={cn(
                    "size-2 rounded-full",
                    status === "active"
                      ? "bg-success"
                      : status === "drawn"
                        ? "bg-gold"
                        : "bg-muted-foreground"
                  )}
                />
                <span className="text-xs capitalize text-muted-foreground">
                  {t(`dashboard.tickets.competitionStatuses.${status}` as any)}
                </span>
              </div>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2.5 sm:p-3">
            <EntryTicketRow entries={entries} />
            {isInfinite && fetchNextPage && hasMore && !isFetchingNextPage ? (
              <InfiniteScrollSentinel onIntersect={fetchNextPage} enabled />
            ) : null}
            {isFetchingNextPage ? (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                {t("dashboard.tickets.loadingMore")}
              </p>
            ) : null}
          </div>
        </div>

        {competitionId ? (
          <div className="mt-3 flex justify-end px-0.5">
            <a
              href={getLinkedCompetitionPath(comp.slug, competitionId) ?? "#"}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 underline-offset-4 hover:underline h-auto p-0 text-xs font-medium tracking-wide text-gold hover:text-gold/80"
            >
              {t("dashboard.tickets.viewCompetition")}
            </a>
          </div>
        ) : null}
      </AccordionContent>
    </AccordionItem>
  );
}
