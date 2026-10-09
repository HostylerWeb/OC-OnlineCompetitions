"use client";

import { SearchX } from "@oc/icons";
import type { AdminCompetition } from "@oc/types";
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
import { DrawCompetitionCard } from "./DrawCompetitionCard";

interface DrawCompetitionGridProps {
  competitions: AdminCompetition[];
  isLoading: boolean;
  searchQuery: string;
  onSelectCompetition: (competitionId: string) => void;
  selectedCompetitionId: string | null;
}

function DrawCompetitionGrid({
  competitions,
  isLoading,
  searchQuery,
  onSelectCompetition,
  selectedCompetitionId,
}: DrawCompetitionGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="px-4 py-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="mt-1 h-3 w-1/2" />
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <Skeleton className="h-7 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (competitions.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>
            {searchQuery ? "No matching competitions" : "No competitions available"}
          </EmptyTitle>
          <EmptyDescription>
            {searchQuery
              ? "Try adjusting your search or filter criteria"
              : "There are no competitions ready for a draw right now"}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          {competitions.length} competition{competitions.length !== 1 ? "s" : ""}
        </Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {competitions.map((competition) => (
          <DrawCompetitionCard
            key={competition._id}
            competition={competition}
            isSelected={selectedCompetitionId === competition._id}
            onSelect={() => onSelectCompetition(competition._id)}
          />
        ))}
      </div>
    </div>
  );
}

export { DrawCompetitionGrid };
