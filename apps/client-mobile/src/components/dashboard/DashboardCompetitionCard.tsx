"use client";

import type { Competition } from "@oc/types";
import { cn } from "@oc/utils";
import { CompetitionCard } from "./CompetitionCard";

interface DashboardCompetitionCardProps {
  competition: Competition;
  className?: string;
}

export function DashboardCompetitionCard({
  competition,
  className,
}: DashboardCompetitionCardProps) {
  return (
    <div className={cn(className)}>
      <CompetitionCard competition={competition} variant="grid" />
    </div>
  );
}
