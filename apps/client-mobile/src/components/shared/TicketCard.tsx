"use client";

import { formatTicketNumber } from "@oc/utils";
import { useTranslation } from "@/lib/i18n";
import {
  getPrizeTicketVisualStyles,
  type PrizeTicketVisualState,
  TicketCardShell,
  TicketCornerBadges,
} from "./ticketCardShared";

export type PrizeTicketState = PrizeTicketVisualState;

export interface PrizeTicketCardProps {
  variant: "prize";
  ticketNumber: number;
  state: PrizeTicketState;
  winnerName?: string;
  prizeTitle: string;
  linkedCompetitionTitle?: string;
  linkedCompetitionSlug?: string;
  linkedCompetitionId?: string;
  position: number;
  explicitHeight?: number;
  statusText?: string;
}

function PrizeTicketCard({
  ticketNumber,
  state,
  winnerName,
  prizeTitle,
  linkedCompetitionTitle,
  linkedCompetitionSlug,
  linkedCompetitionId,
  position,
  explicitHeight,
  statusText: customStatusText,
}: PrizeTicketCardProps) {
  const { t } = useTranslation();
  const isWinning = state !== "available" && state !== "invalid" && state !== "non-winning";
  const isInvalid = state === "invalid";
  const styles = getPrizeTicketVisualStyles(state);

  const defaultStatusText = isInvalid
    ? t("ticketCard.error")
    : state === "non-winning"
      ? t("ticketCard.noWin")
      : isWinning && state !== "won-claimed"
        ? t("ticketCard.winNow")
        : "";
  const statusText = customStatusText ?? defaultStatusText;

  const ticketNumberDisplay =
    ticketNumber > 0
      ? formatTicketNumber(ticketNumber)
      : t("ticketCard.slotLabel", { position: position + 1 });

  const showBadge = state === "won-unclaimed" || state === "won-claimed";

  return (
    <TicketCardShell
      styles={styles}
      statusText={statusText}
      displayName={state === "won-claimed" ? winnerName : undefined}
      subtitle={prizeTitle}
      linkedCompetitionTitle={linkedCompetitionTitle}
      linkedCompetitionSlug={linkedCompetitionSlug}
      linkedCompetitionId={linkedCompetitionId}
      ticketNumberDisplay={ticketNumberDisplay}
      cornerBadges={showBadge ? <TicketCornerBadges state={state} /> : null}
      explicitHeight={explicitHeight}
    />
  );
}

export function TicketCard(props: PrizeTicketCardProps) {
  return <PrizeTicketCard {...props} />;
}
