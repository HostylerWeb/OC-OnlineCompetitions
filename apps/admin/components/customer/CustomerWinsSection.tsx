"use client";

import { api } from "@oc/api-admin";
import { Ticket } from "@oc/icons";
import type { ApiResponse } from "@oc/types";
import { formatDate } from "@oc/utils";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface CustomerWinsSectionProps {
  customerId: string | undefined;
}

function WinsSkeleton() {
  return (
    <Card className="bg-muted/20">
      <CardContent className="flex flex-col gap-3 px-5 py-5">
        <Skeleton className="h-5 w-16" />
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </CardContent>
    </Card>
  );
}

export function CustomerWinsSection({ customerId }: CustomerWinsSectionProps) {
  const { data: winnersRes, isLoading: winnersLoading } = useQuery({
    queryKey: ["admin", "customer-winners", customerId],
    queryFn: async () => {
      const p: Record<string, string | number | boolean> = {
        limit: 5,
        sortField: "drawnAt",
        sortDir: "desc",
      };
      if (customerId) p.userId = customerId;
      const res = await api.get("/api/admin/winners", { params: p });
      return res as ApiResponse<any[]>;
    },
    enabled: !!customerId,
  });

  const { data: ipwRes, isLoading: ipwLoading } = useQuery({
    queryKey: ["admin", "customer-ipw", customerId],
    queryFn: async () => {
      const p: Record<string, string | number | boolean> = {
        limit: 5,
        sortField: "wonAt",
        sortDir: "desc",
      };
      if (customerId) p.userId = customerId;
      const res = await api.get("/api/admin/instant-prize-wins", { params: p });
      return res as ApiResponse<any[]>;
    },
    enabled: !!customerId,
  });

  const winners: any[] = winnersRes?.data ?? [];
  const ipWins: any[] = ipwRes?.data ?? [];
  const isLoading = winnersLoading || ipwLoading;

  if (isLoading) return <WinsSkeleton />;
  if (winners.length === 0 && ipWins.length === 0) return null;

  return (
    <section aria-label="Wins">
      <Card className="bg-muted/20">
        <CardContent className="flex flex-col gap-3 px-5 py-5">
          <p className="text-sm font-medium text-muted-foreground">Recent wins</p>

          {winners.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Competition wins ({winners.length})
              </p>
              {winners.slice(0, 5).map((winner: any) => (
                <div
                  key={winner._id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">
                      {winner.competitionTitle || "Competition"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {winner.prizeValue ? `£${Number(winner.prizeValue).toFixed(2)}` : ""}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <Badge
                      className={`text-[10px] ${winner.claimed ? "bg-green-600 text-white" : ""}`}
                      variant={winner.claimed ? "default" : "secondary"}
                    >
                      {winner.claimed ? "Claimed" : "Unclaimed"}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {winner.drawnAt ? formatDate(winner.drawnAt) : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {ipWins.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Instant prize wins ({ipWins.length})
              </p>
              {(ipWins as any[]).slice(0, 5).map((win: any) => (
                <div
                  key={win._id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium">
                      {win.prizeTitle || "Instant prize"}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Ticket className="size-3" aria-hidden="true" />
                      Ticket #{win.ticketNumber}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-[10px] text-muted-foreground">
                      {win.wonAt ? formatDate(win.wonAt) : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
