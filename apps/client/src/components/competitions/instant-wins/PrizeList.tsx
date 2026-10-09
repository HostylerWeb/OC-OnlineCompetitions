"use client";

import type { CompetitionInstantPrizePublicDTO } from "@oc/api-client";
import { cn } from "@oc/utils";
import { Accordion } from "@/components/ui/accordion";
import { PrizeAccordionItem } from "./index";

interface PrizeListProps {
  prizes: CompetitionInstantPrizePublicDTO[];
  openItems: string[];
  onOpenItemsChange: (items: string[]) => void;
  isLoading: boolean;
  hasMore?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
}

export function PrizeList({
  prizes,
  openItems,
  onOpenItemsChange,
  isLoading,
  hasMore,
  isFetchingNextPage,
  onLoadMore,
}: PrizeListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className={cn("rounded-xl border border-border/70 bg-card/80 p-4", "skeleton-shimmer")}
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="size-12 shrink-0 rounded-xl bg-current opacity-10 sm:size-14" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-current opacity-10" />
                <div className="h-3 w-1/2 rounded bg-current opacity-10" />
              </div>
              <div className="h-5 w-16 shrink-0 rounded-full bg-current opacity-10" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const lastPrizeId = prizes.at(-1)?.id;

  return (
    <Accordion
      type="multiple"
      value={openItems}
      onValueChange={onOpenItemsChange}
      className="space-y-3"
    >
      {prizes.map((prize) => (
        <PrizeAccordionItem
          key={prize.id}
          prize={prize}
          fetchNextPage={onLoadMore}
          hasMore={prize.id === lastPrizeId ? hasMore : false}
          isFetchingNextPage={isFetchingNextPage}
        />
      ))}
    </Accordion>
  );
}
