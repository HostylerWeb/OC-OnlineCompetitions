"use client";

import type { TimelineEvent, TimelineEventType } from "@oc/api-referrals/timeline";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Timeline,
  TimelineContent,
  TimelineDot,
  TimelineItem,
  TimelineTime,
  TimelineTitle,
} from "@/components/ui/timeline";
import { cn } from "@/lib/utils";
import { getTimelineIcon, TimelineEventDetail } from "./timeline-event-details";

type FilterKey = "all" | "orders" | "tickets" | "wallet" | "compliance";

const FILTER_LABELS: Record<FilterKey, string> = {
  all: "All",
  orders: "Orders",
  tickets: "Tickets",
  wallet: "Wallet",
  compliance: "Compliance",
};

const FILTER_MATCH: Record<FilterKey, (type: TimelineEventType) => boolean> = {
  all: () => true,
  orders: (t) => t === "order_placed" || t === "order_paid" || t === "order_refunded",
  tickets: (t) =>
    t === "tickets_awarded" || t === "tier_reached" || t === "referral_purchase_qualified",
  wallet: (t) => t === "wallet_credit" || t === "wallet_debit",
  compliance: (t) => t === "compliance_override",
};

function dayKey(timestamp: string): string {
  return format(new Date(timestamp), "yyyy-MM-dd");
}

function dayLabel(timestamp: string): string {
  return format(new Date(timestamp), "EEEE, MMM d, yyyy");
}

export interface UserActivityTimelineProps {
  events: TimelineEvent[];
  loading?: boolean;
  className?: string;
  defaultFilter?: FilterKey;
}

export function UserActivityTimeline({
  events,
  loading,
  className,
  defaultFilter = "all",
}: UserActivityTimelineProps) {
  const [filter, setFilter] = useState<FilterKey>(defaultFilter);

  const filtered = useMemo(() => {
    if (filter === "all") return events;
    return events.filter((ev) => FILTER_MATCH[filter](ev.type));
  }, [events, filter]);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: events.length,
      orders: 0,
      tickets: 0,
      wallet: 0,
      compliance: 0,
    };
    for (const ev of events) {
      for (const key of Object.keys(FILTER_MATCH) as FilterKey[]) {
        if (key === "all") continue;
        if (FILTER_MATCH[key](ev.type)) c[key]++;
      }
    }
    return c;
  }, [events]);

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const ev of filtered) {
      const key = dayKey(ev.timestamp);
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0));
  }, [filtered]);

  if (loading) {
    return (
      <div className={cn("space-y-2 text-xs text-muted-foreground", className)}>
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
        <div className="h-20 animate-pulse rounded bg-muted/60" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div
        className={cn(
          "rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground",
          className
        )}
      >
        No activity yet.
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Filter</span>
        {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={filter === key ? "default" : "outline"}
            onClick={() => setFilter(key)}
            className="h-6 px-2 text-[10px]"
          >
            {FILTER_LABELS[key]}
            <span className="ml-1 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-foreground/10 px-1 font-mono text-[9px]">
              {counts[key]}
            </span>
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground">
          No events match the current filter.
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([key, dayEvents]) => {
            const sample = dayEvents[0];
            if (!sample) return null;
            return (
              <section key={key}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {dayLabel(sample.timestamp)}
                </h3>
                <Timeline>
                  {dayEvents.map((ev) => (
                    <TimelineItem key={ev.id}>
                      <TimelineDot tone={ev.tone}>
                        {(() => {
                          const Icon = getTimelineIcon(ev.iconKey);
                          return <Icon className="h-3 w-3" aria-hidden="true" />;
                        })()}
                      </TimelineDot>
                      <TimelineContent>
                        <TimelineTime>{format(new Date(ev.timestamp), "HH:mm")}</TimelineTime>
                        <TimelineTitle>{ev.title}</TimelineTitle>
                        {ev.description && (
                          <p className="text-xs text-muted-foreground">{ev.description}</p>
                        )}
                        {ev.ticketCount !== undefined && ev.ticketCount > 0 && (
                          <p className="font-mono text-xs text-amber-600 dark:text-amber-400">
                            +{ev.ticketCount} tickets
                          </p>
                        )}
                        <TimelineEventDetail event={ev} />
                      </TimelineContent>
                    </TimelineItem>
                  ))}
                </Timeline>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Unused helpers kept exported for downstream callers (kept here so the bundle stays in sync with the icon map).
// Re-exports handled via direct imports elsewhere; nothing more to declare here.
