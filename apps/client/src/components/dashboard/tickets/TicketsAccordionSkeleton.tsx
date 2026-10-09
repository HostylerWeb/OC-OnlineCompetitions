import { cn } from "@oc/utils";
import {
  collapsibleItemClass,
  collapsibleThumbnailClass,
  collapsibleTriggerClass,
} from "../../shared/collapsibleShellStyles";

interface TicketsAccordionSkeletonProps {
  count?: number;
  className?: string;
}

export function TicketsAccordionSkeleton({ count = 3, className }: TicketsAccordionSkeletonProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)} aria-hidden="true">
      {[...Array(count)].map((_, index) => (
        <div key={index} className={cn(collapsibleItemClass, "skeleton-shimmer border-gold/10")}>
          <div className={cn(collapsibleTriggerClass, "pointer-events-none")}>
            <div className={cn(collapsibleThumbnailClass, "shrink-0")} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-current opacity-10" />
              <div className="flex items-center gap-2">
                <div className="h-1 flex-1 max-w-20 rounded-full bg-current opacity-10" />
                <div className="h-3 w-20 shrink-0 rounded bg-current opacity-10" />
              </div>
            </div>
            <div className="h-5 w-14 shrink-0 rounded-full bg-current opacity-10" />
          </div>
        </div>
      ))}
    </div>
  );
}
