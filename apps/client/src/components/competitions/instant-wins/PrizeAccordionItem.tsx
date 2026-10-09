"use client";

import type { CompetitionInstantPrizePublicDTO } from "@oc/api-client";
import { Gift } from "@oc/icons";
import { cn } from "@oc/utils";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDownIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { BrandDialog } from "@/components/brand-dialog";
import {
  collapsibleContentClass,
  collapsibleItemClass,
  collapsiblePanelClass,
  collapsibleThumbnailClass,
} from "@/components/shared/collapsibleShellStyles";
import {
  getLinkedCompetitionPath,
  LinkedCompetitionLink,
} from "@/components/shared/LinkedCompetitionLink";
import {
  getCappedTicketListHeight,
  PRIZE_TICKET_ROW_HEIGHT_WITH_GAP,
  TICKET_LIST_CONTAINER_CLASS,
  TICKET_LIST_SCROLL_CLASS,
  usePrizeTicketCardWidth,
} from "@/components/shared/ticketCardShared";
import { useTicketListViewportHeight } from "@/components/shared/useTicketListViewportHeight";
import { AccordionContent, AccordionItem } from "@/components/ui/accordion";
import { VirtualList } from "@/components/VirtualList";
import { formatNumber, useTranslation } from "@/lib/i18n";
import { TicketRow } from "./index";
import type { TicketRowProps } from "./types";

interface PrizeAccordionItemProps {
  prize: CompetitionInstantPrizePublicDTO;
  fetchNextPage?: () => void;
  hasMore?: boolean;
  isFetchingNextPage?: boolean;
}

function PrizeTypeBadge({ isArchived, className }: { isArchived: boolean; className?: string }) {
  const { t } = useTranslation();
  if (isArchived) {
    return (
      <span
        className={cn(
          "rounded-full border border-muted-foreground/25 bg-muted/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
          className
        )}
      >
        {t("competitions.instantWins.ended")}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold",
        className
      )}
    >
      {t("competitions.instantWins.instantWin")}
    </span>
  );
}

export function PrizeAccordionItem({
  prize,
  fetchNextPage,
  hasMore,
  isFetchingNextPage,
}: PrizeAccordionItemProps) {
  const { t, locale } = useTranslation();
  const remaining = prize.quantity - prize.claimedCount;
  const invalidCount = prize.winningEntryNumbers?.filter(
    (n: number | null) => n === null || n === undefined
  )?.length;

  const prizeType = prize.instantPrize.type ?? "prize";
  const isCompetitionTicket = prizeType === "competition_ticket";
  const isArchived = prize.isArchived ?? false;
  const viewportHeight = useTicketListViewportHeight();
  const listHeight = getCappedTicketListHeight(
    prize.quantity,
    PRIZE_TICKET_ROW_HEIGHT_WITH_GAP,
    4,
    viewportHeight
  );
  const isSoldOut = !isArchived && remaining <= 0;

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const ticketCardWidth = usePrizeTicketCardWidth();

  const lightboxImages = useMemo(() => {
    const prizeImages = prize.instantPrize.images ?? [];
    if (isCompetitionTicket && prize.instantPrize.linkedCompetition?.imageUrl) {
      return [...new Set([...prizeImages, prize.instantPrize.linkedCompetition.imageUrl])];
    }
    return prizeImages;
  }, [
    prize.instantPrize.images,
    prize.instantPrize.linkedCompetition?.imageUrl,
    isCompetitionTicket,
  ]);

  const thumbnail = prize.instantPrize.images[0] ? (
    <img
      src={prize.instantPrize.images[0]}
      alt={prize.instantPrize.title}
      className="object-cover"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
    />
  ) : isCompetitionTicket && prize.instantPrize.linkedCompetition?.imageUrl ? (
    <img
      src={prize.instantPrize.linkedCompetition.imageUrl}
      alt={prize.instantPrize.linkedCompetition.title}
      className="object-cover"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
    />
  ) : (
    <div className="flex size-full items-center justify-center bg-gold/10">
      <Gift className="size-5 text-gold/50 sm:size-6" />
    </div>
  );

  return (
    <AccordionItem value={prize.id} className={collapsibleItemClass}>
      <div className="flex items-start gap-3 px-3 py-3 sm:gap-4 sm:px-5 sm:py-4">
        <div
          className={cn(collapsibleThumbnailClass, "cursor-pointer")}
          onClick={() => {
            setLightboxIndex(0);
            setLightboxOpen(true);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setLightboxIndex(0);
              setLightboxOpen(true);
            }
          }}
        >
          {thumbnail}
          {isSoldOut ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-[1px]">
              <span className="text-[9px] font-bold uppercase tracking-wider text-white/90">
                {t("competitions.instantWins.gone")}
              </span>
            </div>
          ) : null}
        </div>

        <AccordionPrimitive.Trigger className="flex min-w-0 flex-1 items-start gap-3 rounded-md text-left [&[data-state=open]] [data-slot=chevron]:rotate-180 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          <div className="flex-1">
            <p
              className="line-clamp-2 text-base font-semibold leading-snug text-foreground sm:truncate sm:text-lg"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {prize.instantPrize.title}
            </p>

            <div className="mt-2">
              <span className="text-xs font-semibold text-gold tabular-nums sm:text-sm">
                {t("competitions.instantWins.won", {
                  won: formatNumber(prize.claimedCount, locale),
                  total: formatNumber(prize.quantity, locale),
                })}
              </span>
            </div>

            {isCompetitionTicket &&
            prize.instantPrize.linkedCompetition?.title &&
            getLinkedCompetitionPath(
              prize.instantPrize.linkedCompetition.slug,
              prize.instantPrize.linkedCompetitionId ?? prize.instantPrize.linkedCompetition.id
            ) ? (
              <LinkedCompetitionLink
                title={prize.instantPrize.linkedCompetition.title}
                slug={prize.instantPrize.linkedCompetition.slug}
                id={
                  prize.instantPrize.linkedCompetitionId ?? prize.instantPrize.linkedCompetition.id
                }
                className="mt-1 block text-[11px]"
                onClick={(event) => event.stopPropagation()}
              />
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <PrizeTypeBadge isArchived={isArchived} />
            <ChevronDownIcon
              data-slot="chevron"
              className="size-4 text-muted-foreground transition-transform duration-200"
            />
          </div>
        </AccordionPrimitive.Trigger>
      </div>

      <AccordionContent className={collapsibleContentClass}>
        <div className={collapsiblePanelClass}>
          <div className="flex shrink-0 flex-col gap-2 border-b border-border/40 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-3.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="text-xs font-medium text-foreground">
                {t("competitions.instantWins.totalTickets", {
                  count: formatNumber(prize.quantity, locale),
                })}
              </span>
              {invalidCount > 0 && (
                <span className="text-xs font-medium text-red-400">
                  (
                  {t("competitions.instantWins.invalid", {
                    count: formatNumber(invalidCount, locale),
                  })}
                  )
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {invalidCount > 0 && (
                <div className="flex items-center gap-1">
                  <div className="size-2 rounded-full bg-destructive" />
                  <span className="text-xs text-muted-foreground">
                    {t("competitions.instantWins.invalid", {
                      count: formatNumber(invalidCount, locale),
                    })}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <div className="size-2 rounded-full bg-gold" />
                <span className="text-xs font-medium text-gold">
                  {t("competitions.instantWins.available", {
                    count: formatNumber(remaining, locale),
                  })}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="size-2 rounded-full bg-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {t("competitions.instantWins.prizeWon", {
                    count: formatNumber(prize.claimedCount, locale),
                  })}
                </span>
              </div>
            </div>
          </div>

          <div className={cn("min-h-0 p-2.5 sm:p-3", TICKET_LIST_CONTAINER_CLASS)}>
            <VirtualList<TicketRowProps>
              rowHeight={PRIZE_TICKET_ROW_HEIGHT_WITH_GAP}
              height={listHeight}
              rowComponent={TicketRow}
              rowProps={{ prize }}
              className={TICKET_LIST_SCROLL_CLASS}
              ticketWidth={ticketCardWidth}
              totalCount={prize.quantity}
              isInfinite={Boolean(hasMore && fetchNextPage)}
              fetchNextPage={fetchNextPage}
              hasMore={hasMore}
              isFetchingNextPage={isFetchingNextPage}
            />
          </div>
        </div>
      </AccordionContent>

      <BrandDialog
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        mode="fullscreen"
        images={lightboxImages}
        currentIndex={lightboxIndex}
        onIndexChange={setLightboxIndex}
      />
    </AccordionItem>
  );
}
