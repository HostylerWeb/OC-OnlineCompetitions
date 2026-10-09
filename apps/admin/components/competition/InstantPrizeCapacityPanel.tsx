import type { InstantPrizeCapacityResponse } from "@oc/types";
import { Progress } from "@/components/ui/progress";

export function InstantPrizeCapacityPanel({
  capacity,
  isLoading,
}: {
  capacity?: InstantPrizeCapacityResponse | null;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3 rounded-lg border border-gold/20 bg-gold/5 p-4">
        <div className="h-4 w-20 animate-pulse rounded bg-gold/10" />
        <div className="space-y-1">
          <div className="flex justify-between">
            <div className="h-4 w-48 animate-pulse rounded bg-muted-foreground/20" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted-foreground/20" />
          </div>
          <div className="h-1.5 w-full animate-pulse rounded-full bg-muted-foreground/20" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted-foreground/20" />
        </div>
        <div className="h-4 w-56 animate-pulse rounded bg-muted-foreground/20" />
        <div className="h-5 w-44 animate-pulse rounded bg-muted-foreground/20" />
        <div className="rounded-md border border-border/50 bg-background/50 p-2">
          <div className="h-4 w-32 animate-pulse rounded bg-muted-foreground/20" />
          <div className="mt-1 h-4 w-48 animate-pulse rounded bg-muted-foreground/20" />
        </div>
      </div>
    );
  }

  if (!capacity) return null;

  const slotPct =
    capacity.maxTickets > 0 ? Math.round((capacity.assignedSlots / capacity.maxTickets) * 100) : 0;

  return (
    <div className="space-y-3 rounded-lg border border-gold/20 bg-gold/5 p-4">
      <p className="text-xs font-medium text-foreground">How many wins can you add?</p>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Instant wins on this competition</span>
          <span>
            {capacity.assignedSlots} / {capacity.maxTickets}
          </span>
        </div>
        <Progress value={Math.min(slotPct, 100)} className="h-1.5" />
        <p className="text-xs text-muted-foreground">
          {capacity.remainingSlots} win{capacity.remainingSlots === 1 ? "" : "s"} still available
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{capacity.availableTickets}</span> unsold
        ticket numbers can be used for new winning numbers
      </p>

      <p className="text-sm">
        Maximum right now:{" "}
        <span className="font-semibold text-gold">{capacity.maxAssignableQty}</span> win
        {capacity.maxAssignableQty === 1 ? "" : "s"}
      </p>

      {capacity.linkedCompetition && (
        <div className="rounded-md border border-border/50 bg-background/50 p-2 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{capacity.linkedCompetition.title}</p>
          <p>
            {capacity.linkedCompetition.availableTickets} free tickets left in that competition ·{" "}
            {capacity.linkedCompetition.ticketsPerSlot} ticket
            {capacity.linkedCompetition.ticketsPerSlot === 1 ? "" : "s"} awarded per win here
          </p>
        </div>
      )}
    </div>
  );
}
