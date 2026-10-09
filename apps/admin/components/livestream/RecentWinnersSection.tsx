"use client";

import { Users } from "@oc/icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { CompletedDrawItem } from "./CompletedDrawItem";
import type { RecentWinner } from "./types";

interface RecentWinnersSectionProps {
  winners: RecentWinner[];
  isLoading: boolean;
}

function RecentWinnersSection({ winners, isLoading }: RecentWinnersSectionProps) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold">Recent Winners</h2>
        {!isLoading && (
          <Badge variant="secondary" className="text-xs">
            {winners.length}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="px-4 py-3">
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                <Skeleton className="h-3 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : winners.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>No winners yet</EmptyTitle>
            <EmptyDescription>Winners will appear here once draws are completed</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {winners.map((winner) => (
            <CompletedDrawItem key={winner.id} winner={winner} />
          ))}
        </div>
      )}
    </section>
  );
}

export { RecentWinnersSection };
