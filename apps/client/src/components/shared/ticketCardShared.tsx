"use client";

import { cn } from "@oc/utils";
import { CheckIcon, Gift } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import { getLinkedCompetitionPath } from "./LinkedCompetitionLink";

export const CORNER_BADGE_CLASS =
  "absolute top-0 left-0 z-10 w-full rounded-tl-xl rounded-tr-none rounded-br-none rounded-bl-none border-0 h-5 min-h-5 px-2.5 py-0 text-[9px] font-bold uppercase leading-none tracking-wider shadow-sm gap-0.5 [&>svg]:size-2.5 [&>svg]:shrink-0";

export const TICKET_NUMBER_BADGE_CLASS =
  "absolute top-0 right-0 z-10 rounded-tr-xl rounded-tl-none rounded-br-none rounded-bl-none border-0 h-4 min-h-4 px-1.5 py-0 text-[8px] font-bold uppercase leading-none tracking-wider shadow-sm";

export const TICKET_CARD_SHELL_CLASS =
  "relative flex flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border px-2 py-3 transition-all duration-200";

export const TICKET_LIST_SCROLL_CLASS =
  "scrollbar-gutter-stable scrollbar-thin scrollbar-thumb-gold/30 scrollbar-track-transparent";

export const TICKET_STATUS_TEXT_CLASS = "w-full truncate text-center text-xs font-bold";

export type PrizeTicketVisualState =
  | "available"
  | "won-claimed"
  | "won-unclaimed"
  | "non-winning"
  | "invalid";

interface TicketVisualStyles {
  card: string;
  dotRing: string;
  dot: string;
  status: string;
}

interface TicketCardShellProps {
  styles: TicketVisualStyles;
  statusText: string;
  displayName?: string;
  subtitle: string;
  linkedCompetitionTitle?: string;
  linkedCompetitionSlug?: string;
  linkedCompetitionId?: string;
  competitionId?: string;
  metaLine?: string;
  ticketNumberDisplay: string;
  cornerBadges?: ReactNode;
  subtitleClassName?: string;
  displayNameClassName?: string;
  metaClassName?: string;
  explicitHeight?: number;
}

export function getPrizeTicketVisualStyles(state: PrizeTicketVisualState): TicketVisualStyles {
  switch (state) {
    case "invalid":
      return {
        card: "border-destructive/40 bg-destructive/10",
        dotRing: "bg-destructive/20 ring-destructive/50",
        dot: "bg-destructive",
        status: "text-destructive",
      };
    case "won-claimed":
    case "non-winning":
      return {
        card: "border-gray-200/30 bg-gray-200/5",
        dotRing: "bg-gray-200/20 ring-gray-200/40",
        dot: "bg-gray-200",
        status: "text-gray-500",
      };
    case "won-unclaimed":
      return {
        card: "border-[oklch(0.78_0.14_85)]/30 bg-[oklch(0.78_0.14_85)]/5",
        dotRing: "bg-[oklch(0.78_0.14_85)]/20 ring-[oklch(0.78_0.14_85)]/40",
        dot: "bg-[oklch(0.78_0.14_85)]",
        status: "text-[oklch(0.78_0.14_85)]",
      };
    default:
      return {
        card: "border-border bg-card hover:border-muted-foreground/30",
        dotRing: "bg-muted/50 ring-border",
        dot: "bg-muted-foreground/50",
        status: "text-muted-foreground",
      };
  }
}

export function TicketCornerBadges({ state }: { state: PrizeTicketVisualState }) {
  const { t } = useTranslation();
  return (
    <>
      {state === "won-unclaimed" && (
        <Badge className={cn(CORNER_BADGE_CLASS, "bg-[oklch(0.78_0.14_85)] text-gray-900")}>
          <Gift />
          {t("ticketCard.winBadge")}
        </Badge>
      )}

      {state === "won-claimed" && (
        <Badge className={cn(CORNER_BADGE_CLASS, "bg-gray-200 text-gray-900")}>
          <CheckIcon />
          {t("ticketCard.wonBadge")}
        </Badge>
      )}
    </>
  );
}

export function TicketCardShell({
  styles,
  statusText,
  displayName,
  subtitle,
  linkedCompetitionTitle,
  linkedCompetitionSlug,
  linkedCompetitionId,
  competitionId,
  metaLine,
  ticketNumberDisplay,
  cornerBadges,
  subtitleClassName,
  displayNameClassName,
  metaClassName,
  explicitHeight,
}: TicketCardShellProps) {
  const competitionHref = getLinkedCompetitionPath(
    linkedCompetitionSlug,
    linkedCompetitionId ?? competitionId
  );

  return (
    <div
      className={cn(
        TICKET_CARD_SHELL_CLASS,
        styles.card,
        cornerBadges && "pt-7 justify-between gap-0.5"
      )}
      style={explicitHeight ? { height: explicitHeight } : undefined}
    >
      {statusText ? (
        <span
          className={cn(TICKET_STATUS_TEXT_CLASS, styles.status, cornerBadges && "text-[13px]")}
        >
          {statusText}
        </span>
      ) : null}

      {displayName ? (
        <span
          className={cn(
            TICKET_STATUS_TEXT_CLASS,
            styles.status,
            cornerBadges && "text-[13px]",
            displayNameClassName
          )}
        >
          {displayName}
        </span>
      ) : null}

      {competitionHref ? (
        (() => {
          const idx = subtitle.lastIndexOf(" to ");
          const hasSplit = idx > 0;
          const prefix = hasSplit ? subtitle.slice(0, idx) : subtitle;
          const compName = hasSplit ? subtitle.slice(idx + 4) : linkedCompetitionTitle || "";
          if (!compName)
            return (
              <a
                href={competitionHref}
                className={cn(
                  "w-full truncate text-center leading-tight text-muted-foreground hover:underline decoration-gold",
                  cornerBadges ? "text-[12px]" : "text-[10px]",
                  subtitleClassName
                )}
              >
                {subtitle}
              </a>
            );
          return (
            <a
              href={competitionHref}
              className="flex w-full flex-col items-center gap-0 hover:underline decoration-gold"
            >
              <span
                className={cn(
                  "w-full truncate text-center font-bold text-[oklch(0.78_0.14_85)] leading-tight",
                  cornerBadges ? "text-[12px]" : "text-[10px]",
                  subtitleClassName
                )}
              >
                {prefix}
              </span>
              <span className="w-full truncate text-center text-[11px] leading-tight text-gold">
                {compName}
              </span>
            </a>
          );
        })()
      ) : (
        <span
          className={cn(
            "w-full truncate text-center leading-tight text-muted-foreground",
            cornerBadges ? "text-[12px]" : "text-[10px]",
            subtitleClassName
          )}
        >
          {subtitle}
        </span>
      )}

      {metaLine ? (
        <span
          className={cn(
            "w-full shrink-0 truncate text-center text-[9px] leading-tight text-muted-foreground/80",
            metaClassName
          )}
        >
          {metaLine}
        </span>
      ) : null}

      {cornerBadges ? (
        <span className="w-full truncate text-center text-base font-bold leading-tight text-gold">
          {ticketNumberDisplay}
        </span>
      ) : (
        <span className="mt-auto w-full truncate text-center text-base font-bold leading-tight text-gold">
          {ticketNumberDisplay}
        </span>
      )}

      {cornerBadges}
    </div>
  );
}

export const TICKET_LIST_MAX_HEIGHT = 440;
export const TICKET_LIST_VIEWPORT_RATIO = 0.55;

export function getTicketListViewportCap(viewportHeight?: number): number {
  if (viewportHeight == null || viewportHeight <= 0) {
    return TICKET_LIST_MAX_HEIGHT;
  }
  return Math.min(TICKET_LIST_MAX_HEIGHT, Math.round(viewportHeight * TICKET_LIST_VIEWPORT_RATIO));
}

export function getCappedTicketListHeight(
  itemCount: number,
  rowHeightWithGap: number,
  maxTicketsPerRow = 4,
  viewportHeight?: number
): number {
  if (itemCount <= 0) return rowHeightWithGap;
  const rowCount = Math.ceil(itemCount / maxTicketsPerRow);
  const cap = getTicketListViewportCap(viewportHeight);
  return Math.min(rowCount * rowHeightWithGap, cap);
}

export const TICKET_LIST_CONTAINER_CLASS = "min-h-0 overflow-hidden overscroll-contain";

export const TICKET_ROW_GAP = 5;
export const TICKET_COL_GAP = 5;
export const PRIZE_TICKET_CARD_WIDTH = 145;
export const PRIZE_TICKET_ROW_HEIGHT = 116;
export const PRIZE_TICKET_ROW_HEIGHT_WITH_GAP = PRIZE_TICKET_ROW_HEIGHT + TICKET_ROW_GAP;
export const DASHBOARD_TICKET_ROW_HEIGHT = PRIZE_TICKET_ROW_HEIGHT;
export const DASHBOARD_TICKET_ROW_HEIGHT_WITH_GAP = PRIZE_TICKET_ROW_HEIGHT_WITH_GAP;

export function getPrizeTicketCardWidth(viewportWidth: number): number {
  if (viewportWidth < 400) return 125;
  if (viewportWidth < 1024) return 150;
  return 170;
}

export function usePrizeTicketCardWidth(): number {
  const [width, setWidth] = useState(145);
  useEffect(() => {
    setWidth(getPrizeTicketCardWidth(window.innerWidth));
    const onResize = () => setWidth(getPrizeTicketCardWidth(window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
}
