"use client";

import { useInfiniteEntries } from "@oc/api-client";
import { List, Trophy } from "@oc/icons";
import { formatTicketNumber } from "@oc/utils";
import { CompetitionEntryList } from "@/components/competitions/CompetitionEntryList";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatNumber, useTranslation } from "@/lib/i18n";

export type CompetitionEntryListDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competitionId: string;
  competitionTitle: string;
  highlightTicketNumbers?: number[];
  winnerDisplayName?: string;
};

export function CompetitionEntryListDialog({
  open,
  onOpenChange,
  competitionId,
  competitionTitle,
  highlightTicketNumbers = [],
  winnerDisplayName,
}: CompetitionEntryListDialogProps) {
  const { t, locale } = useTranslation();

  const { data: entriesData } = useInfiniteEntries(open && competitionId ? competitionId : "");
  const entriesTotal = open ? entriesData?.pages[0]?.meta?.total : undefined;

  const winnerSummary =
    winnerDisplayName && highlightTicketNumbers.length > 0
      ? `${winnerDisplayName} · #${formatTicketNumber(highlightTicketNumbers[0] ?? 0)}`
      : winnerDisplayName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(90vh,52rem)] w-[calc(100%-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
      >
        <DialogHeader className="border-b border-border/60 bg-gradient-to-br from-gold/10 to-transparent px-5 py-4 text-left sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <List className="h-5 w-5 text-gold" />
            {t("staticPages.winners.entryListTitle")}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1 pt-1">
              <p className="text-sm font-medium text-foreground line-clamp-2">{competitionTitle}</p>
              {winnerSummary ? (
                <p className="flex items-center gap-1.5 text-xs text-gold sm:text-sm">
                  <Trophy className="h-3.5 w-3.5 shrink-0" />
                  {winnerSummary}
                </p>
              ) : null}
              {entriesTotal != null ? (
                <p className="text-xs text-muted-foreground">
                  {formatNumber(entriesTotal, locale)} {t("staticPages.entries.totalEntries")}
                </p>
              ) : null}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col px-5 py-4 sm:px-6">
          <CompetitionEntryList
            competitionId={competitionId}
            highlightTicketNumbers={highlightTicketNumbers}
            enabled={open}
            searchUmamiEvent="winners:entries-search"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
