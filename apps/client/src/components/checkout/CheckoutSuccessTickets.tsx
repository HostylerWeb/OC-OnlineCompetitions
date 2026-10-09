"use client";

import { Ticket } from "@oc/icons";
import type { MeOrderDetailEntryDto, MeOrderItemDto } from "@oc/types";
import { useMemo, useState } from "react";
import {
  CheckoutSuccessTicketsModal,
  type CheckoutSuccessTicketLine,
} from "@/components/checkout/CheckoutSuccessTicketsModal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/lib/i18n";

function competitionRef(item: MeOrderItemDto) {
  return typeof item.competitionId === "object" ? item.competitionId : null;
}

function competitionKey(item: MeOrderItemDto): string {
  const ref = competitionRef(item);
  if (ref?._id) return ref._id;
  if (typeof item.competitionId === "string") return item.competitionId;
  return item._id;
}

function resolveTicketNumbers(
  item: MeOrderItemDto,
  entries: MeOrderDetailEntryDto[]
): number[] {
  if (item.ticketNumbers && item.ticketNumbers.length > 0) {
    return [...item.ticketNumbers].sort((a, b) => a - b);
  }
  const compKey = competitionKey(item);
  return entries
    .filter((e) => {
      const entryComp =
        typeof e.competitionId === "object" ? e.competitionId._id : e.competitionId;
      return String(entryComp) === compKey;
    })
    .map((e) => e.ticketNumber ?? e.entryNumber)
    .filter((n): n is number => typeof n === "number")
    .sort((a, b) => a - b);
}

export function CheckoutSuccessTicketsSkeleton() {
  const { t } = useTranslation();
  return (
    <section
      className="mb-8 text-left"
      aria-busy="true"
      aria-label={t("checkout.success.yourTickets")}
    >
      <Skeleton className="mb-3 h-4 w-28" />
      <div className="rounded-xl border border-gold/15 p-4">
        <div className="flex gap-4">
          <Skeleton className="size-16 shrink-0 rounded-lg sm:size-20" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-full max-w-xs" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      </div>
    </section>
  );
}

interface CheckoutSuccessTicketsProps {
  items: MeOrderItemDto[];
  entries?: MeOrderDetailEntryDto[];
}

export function CheckoutSuccessTickets({ items, entries = [] }: CheckoutSuccessTicketsProps) {
  const { t } = useTranslation();
  const [activeLine, setActiveLine] = useState<CheckoutSuccessTicketLine | null>(null);

  const lines = useMemo(
    () =>
      items.map((item) => {
        const ref = competitionRef(item);
        const ticketNumbers = resolveTicketNumbers(item, entries);
        return {
          item,
          title: ref?.title ?? t("checkout.success.competition"),
          imageUrl: ref?.prizeImageUrl,
          ticketNumbers,
        } satisfies CheckoutSuccessTicketLine;
      }),
    [items, entries, t]
  );

  if (lines.length === 0) return null;

  return (
    <>
      <section className="mb-8 text-left" aria-label={t("checkout.success.yourTickets")}>
        <div className="mb-3 flex items-center gap-2 px-0.5">
          <span className="flex size-7 items-center justify-center rounded-full bg-gold/15">
            <Ticket className="size-3.5 text-gold" aria-hidden />
          </span>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("checkout.success.yourTickets")}
          </h2>
        </div>

        <ul className="space-y-3">
          {lines.map((line) => {
            const count = line.ticketNumbers.length || line.item.quantity;
            const seeLabel =
              count === 1
                ? t("checkout.success.seeTicket")
                : t("checkout.success.seeTickets");

            return (
              <li key={line.item._id}>
                <article
                  className="overflow-hidden rounded-xl border border-gold/20 bg-gradient-to-br from-card via-card/95 to-gold/[0.04] shadow-sm"
                >
                  <div className="flex gap-3 p-4 sm:gap-4">
                    <div
                      className="relative size-[4.25rem] shrink-0 overflow-hidden rounded-lg border border-gold/15 bg-muted/50 sm:size-20"
                    >
                      {line.imageUrl ? (
                        <img
                          src={line.imageUrl}
                          alt=""
                          className="size-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center bg-muted/60">
                          <Ticket className="size-6 text-muted-foreground/50" aria-hidden />
                        </div>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <h3 className="font-semibold text-sm leading-snug text-foreground sm:text-base">
                        {line.title}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("checkout.success.ticketsPurchased", { count: line.item.quantity })}
                      </p>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 w-fit rounded-lg border-gold/35 bg-gold/5 text-gold hover:bg-gold/15 hover:text-gold"
                        onClick={() => setActiveLine(line)}
                        data-umami-event="checkout:success-see-tickets"
                      >
                        {seeLabel}
                      </Button>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </section>

      <CheckoutSuccessTicketsModal
        line={activeLine}
        open={activeLine !== null}
        onClose={() => setActiveLine(null)}
      />
    </>
  );
}
