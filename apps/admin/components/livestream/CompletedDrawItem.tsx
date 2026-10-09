"use client";

import { Trophy } from "@oc/icons";
import { formatDate, formatDateTime } from "@oc/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { RecentWinner } from "./types";

interface CompletedDrawItemProps {
  winner: RecentWinner;
}

function CompletedDrawItem({ winner }: CompletedDrawItemProps) {
  return (
    <Card className="transition-all hover:border-primary/30">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold">
          <Trophy className="size-5" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{winner.winner.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {winner.competitionTitle} &middot; Ticket #{winner.winner.ticketNumber}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant="outline" className="text-[10px]">
            {formatDate(winner.drawnAt)}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {formatDateTime(winner.drawnAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export { CompletedDrawItem };
