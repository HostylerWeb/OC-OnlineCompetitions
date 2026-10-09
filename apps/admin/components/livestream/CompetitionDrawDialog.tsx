"use client";

import { Ban, Clock, ExternalLink, Loader2, Table2, Trophy } from "@oc/icons";
import type { AdminCompetition } from "@oc/types";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { SheetInfo } from "./types";

const statusBadgeVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  pending_draw: "secondary",
  drawn: "outline",
  ended: "outline",
  cancelled: "destructive",
  draft: "outline",
};

interface StatCardProps {
  label: string;
  value: string | number;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "outline" | "destructive";
}

function StatCard({ label, value, badge, badgeVariant = "outline" }: StatCardProps) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg border bg-card py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {badge ? (
        <Badge variant={badgeVariant} className="text-xs font-bold">
          {badge}
        </Badge>
      ) : (
        <span className="font-mono text-lg font-bold tabular-nums">{value}</span>
      )}
    </div>
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return "1 hour ago";
  return `${hours} hours ago`;
}

function getDiffBadge(
  diff: number
): { text: string; variant: "default" | "secondary" | "outline" | "destructive" } | null {
  if (diff === 0) return { text: "In sync", variant: "default" };
  if (diff > 0) return { text: `↑ ${diff} behind`, variant: "secondary" };
  return { text: `↓ ${-diff} ahead`, variant: "secondary" };
}

interface CompetitionDrawDialogProps {
  competition: AdminCompetition | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDrawWinner: (competitionId: string) => void;
  onEndCompetition: (competitionId: string) => void;
  isEndingCompetition?: boolean;
  onOpenSheet: (competitionId: string) => Promise<string | null>;
  onConnectGoogle?: () => Promise<void>;
  needsReauth?: boolean;
  sheetInfo: SheetInfo | null;
  isSheetLoading: boolean;
  showSheetTools?: boolean;
}

export function CompetitionDrawDialog({
  competition,
  open,
  onOpenChange,
  onDrawWinner,
  onEndCompetition,
  isEndingCompetition = false,
  onOpenSheet,
  onConnectGoogle,
  needsReauth,
  sheetInfo,
  isSheetLoading,
  showSheetTools = true,
}: CompetitionDrawDialogProps) {
  const [isOpeningSheet, setIsOpeningSheet] = useState(false);

  if (!competition) return null;

  const c = competition;
  const badgeVariant = statusBadgeVariant[c.status] ?? "outline";
  const diffBadge = sheetInfo ? getDiffBadge(sheetInfo.diff) : null;

  async function handleOpenSheet() {
    setIsOpeningSheet(true);
    try {
      const url = await onOpenSheet(c._id);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } finally {
      setIsOpeningSheet(false);
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="sm" showCloseButton={false}>
          <DialogHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold">
                  <Trophy className="size-5" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-base">{c.title}</DialogTitle>
                  <p className="text-xs text-muted-foreground">
                    {new Intl.NumberFormat("en-GB", {
                      style: "currency",
                      currency: "GBP",
                      maximumFractionDigits: 0,
                    }).format(c.prizeValue)}{" "}
                    · {c.ticketsSold}/{c.maxTickets} tickets
                    {c.drawDate && (
                      <>
                        {" · "}
                        Draw: {new Date(c.drawDate).toLocaleDateString("en-GB")}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <Badge variant={badgeVariant} className="shrink-0 mt-0.5">
                {c.status.replace(/_/g, " ")}
              </Badge>
            </div>
          </DialogHeader>

          {showSheetTools && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Spreadsheet
                </span>
                {sheetInfo && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="size-3" />
                    {formatTimeAgo(sheetInfo.lastSyncedAt)}
                  </span>
                )}
              </div>
              {needsReauth && (
                <p className="mb-2 text-xs text-muted-foreground">
                  Connect your Google account to create and manage draw spreadsheets.
                </p>
              )}
              <div className="grid grid-cols-3 gap-2">
                <StatCard label="DB Entries" value={sheetInfo?.dbEntryCount ?? c.ticketsSold} />
                <StatCard label="Sheet Rows" value={sheetInfo?.sheetRowCount ?? "—"} />
                <StatCard
                  label="Diff"
                  value=""
                  badge={diffBadge?.text ?? "—"}
                  badgeVariant={diffBadge?.variant ?? "outline"}
                />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <StatCard label="Sold" value={c.ticketsSold} />
                <StatCard label="Capacity" value={c.maxTickets} />
                <StatCard
                  label="Fill"
                  value={
                    c.maxTickets > 0 ? `${Math.round((c.ticketsSold / c.maxTickets) * 100)}%` : "—"
                  }
                />
              </div>
            </div>
          )}

          {c.status === "active" ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full border-destructive/40 text-destructive hover:!border-destructive/60 hover:!bg-destructive/10 hover:!text-destructive"
                onClick={() => onEndCompetition(c._id)}
                disabled={isEndingCompetition}
                data-umami-event="livestream-studio:dialog-end-competition"
              >
                {isEndingCompetition ? (
                  <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                ) : (
                  <Ban data-icon="inline-start" />
                )}
                {isEndingCompetition ? "Ending..." : "End Competition"}
              </Button>
              <Button
                variant="default"
                size="sm"
                className="w-full"
                onClick={() => onDrawWinner(c._id)}
                data-umami-event="livestream-studio:dialog-draw-winner"
              >
                <Trophy data-icon="inline-start" />
                Draw Winner
              </Button>
            </div>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="w-full"
              onClick={() => onDrawWinner(c._id)}
              disabled={c.status === "drawn"}
              data-umami-event="livestream-studio:dialog-draw-winner"
            >
              <Trophy data-icon="inline-start" />
              {c.status === "drawn" ? "Already Drawn" : "Draw Winner"}
            </Button>
          )}

          <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {showSheetTools && needsReauth ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={onConnectGoogle}
                data-umami-event="livestream-studio:connect-google"
              >
                Connect Google
              </Button>
            ) : showSheetTools ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleOpenSheet}
                      disabled={isSheetLoading || isOpeningSheet}
                      data-umami-event="livestream-studio:dialog-open-sheet"
                    >
                      {isSheetLoading || isOpeningSheet ? (
                        <>
                          <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                          {isSheetLoading ? "Syncing..." : "Opening..."}
                        </>
                      ) : (
                        <>
                          <Table2 data-icon="inline-start" />
                          Open Spreadsheet
                        </>
                      )}
                      {sheetInfo && !isSheetLoading && !isOpeningSheet && (
                        <ExternalLink data-icon="inline-end" className="size-3" />
                      )}
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  Creates a Google Sheet with all sold entries. Anyone with the link can view.
                  Whitelisted editors can modify. The sheet is refreshed each time you press the
                  button.
                </TooltipContent>
              </Tooltip>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
