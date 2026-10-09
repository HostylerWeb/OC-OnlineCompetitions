"use client";

import type { AdminCompetition } from "@oc/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DrawCompetitionCardProps {
  competition: AdminCompetition;
  isSelected: boolean;
  onSelect: () => void;
}

const statusBadgeVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  pending_draw: "secondary",
  drawn: "outline",
  ended: "outline",
  cancelled: "destructive",
  draft: "outline",
};

function DrawCompetitionCard({ competition, isSelected, onSelect }: DrawCompetitionCardProps) {
  const badgeVariant = statusBadgeVariant[competition.status] ?? "outline";

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:border-primary/50",
        isSelected && "border-primary ring-1 ring-primary/30"
      )}
      onClick={onSelect}
      data-umami-event="livestream-studio:competition-card-click"
    >
      <CardHeader className="flex flex-row items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-sm font-medium">{competition.title}</span>
          <span className="text-xs text-muted-foreground">
            {competition.prizeValue > 0 ? `£${competition.prizeValue.toLocaleString()} · ` : ""}
            {competition.ticketsSold}/{competition.maxTickets} tickets
          </span>
        </div>
        <Badge variant={badgeVariant} className="shrink-0 text-[10px]">
          {competition.status.replace(/_/g, " ")}
        </Badge>
      </CardHeader>
    </Card>
  );
}

export { DrawCompetitionCard };
