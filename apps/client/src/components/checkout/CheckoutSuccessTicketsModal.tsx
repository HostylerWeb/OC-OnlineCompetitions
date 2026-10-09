"use client";

import { Ticket, X } from "@oc/icons";
import type { MeOrderItemDto } from "@oc/types";
import { TicketNumberPill } from "@/components/shared/TicketNumberPill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";

export interface CheckoutSuccessTicketLine {
  item: MeOrderItemDto;
  title: string;
  imageUrl?: string;
  ticketNumbers: number[];
}

interface CheckoutSuccessTicketsModalProps {
  line: CheckoutSuccessTicketLine | null;
  open: boolean;
  onClose: () => void;
}

export function CheckoutSuccessTicketsModal({
  line,
  open,
  onClose,
}: CheckoutSuccessTicketsModalProps) {
  const { t } = useTranslation();

  if (!line) return null;

  const count = line.ticketNumbers.length || line.item.quantity;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="max-w-md gap-0 overflow-hidden border-gold/25 bg-card p-0"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{line.title}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("checkout.success.ticketsPurchased", { count })}
        </DialogDescription>

        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted/40">
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
              <Ticket className="size-10 text-muted-foreground/50" aria-hidden />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <DialogClose
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
            aria-label={t("common.close")}
          >
            <X className="size-4" />
          </DialogClose>
          <div className="absolute bottom-0 left-0 right-0 p-4 text-left">
            <p className="font-semibold text-base text-white text-balance sm:text-lg">{line.title}</p>
            <p className="mt-1 text-xs text-white/80">
              {t("checkout.success.ticketsPurchased", { count })}
            </p>
          </div>
        </div>

        <div className="p-5">
          {line.ticketNumbers.length > 0 ? (
            <div
              className="flex flex-wrap justify-center gap-2"
              role="list"
              aria-label={t("checkout.success.yourTickets")}
            >
              {line.ticketNumbers.map((num) => (
                <span key={num} role="listitem">
                  <TicketNumberPill value={num} className="text-sm" />
                </span>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              {t("checkout.success.ticketsProcessing")}
            </p>
          )}

          <Button
            type="button"
            variant="gold"
            className="mt-5 w-full rounded-xl"
            onClick={onClose}
          >
            {t("common.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
