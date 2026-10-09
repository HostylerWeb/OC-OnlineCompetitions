"use client";

import { PartyPopper, Sparkles, Ticket, Trophy, X } from "@oc/icons";
import { cn, formatTicketNumber, getGrantedTicketIds } from "@oc/utils";
import { useEffect, useRef } from "react";
import { Link } from "@/components/Link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, useTranslation } from "@/lib/i18n";

export interface InstantWinData {
  prizeTitle: string;
  prizeDescription?: string;
  prizeImage?: string;
  prizeValue?: number;
  ticketNumber: number;
  winId?: string;
  prizeType?: "prize" | "competition_ticket";
  linkedCompetitionId?: string;
  linkedCompetitionTitle?: string;
  linkedCompetitionImage?: string;
  linkedCompetitionSlug?: string;
  grantedTicketIds?: string[];
  /** @deprecated use grantedTicketIds */
  grantedEntryIds?: string[];
  /** Server-reported claim status (from MeOrderEntryInstantPrizeWinDto.claimed). */
  claimed?: boolean;
  claimedAt?: string;
}

interface InstantWinModalProps {
  open: boolean;
  onClose: () => void;
  wins: InstantWinData[];
  totalTickets: number;
}

function useConfetti(active: boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const colors = ["#D4AF37", "#FFD700", "#B8860B", "#FFF8DC", "#F4E5A1"];
    type Particle = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      size: number;
      rotation: number;
      rotationSpeed: number;
      alpha: number;
    };
    const particles: Particle[] = Array.from({ length: 120 }, () => ({
      x: Math.random() * rect.width,
      y: -20 - Math.random() * 80,
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)]!,
      size: 3 + Math.random() * 5,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      alpha: 1,
    }));

    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      let alive = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.rotation += p.rotationSpeed;
        p.alpha -= 0.006;
        if (p.alpha <= 0) continue;
        alive = true;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
      if (alive) animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      ctx.clearRect(0, 0, rect.width, rect.height);
    };
  }, [active]);

  return canvasRef;
}

function InstantWinCard({ win }: { win: InstantWinData }) {
  const { t, locale } = useTranslation();
  const isLinked = win.prizeType === "competition_ticket" && !!win.linkedCompetitionId;
  const granted = getGrantedTicketIds(win);
  const imageSrc = win.prizeImage ?? win.linkedCompetitionImage;
  const linkHref = isLinked
    ? `/competitions/${win.linkedCompetitionSlug || win.linkedCompetitionId}`
    : null;

  const card = (
    <div
      role="group"
      aria-label={t("checkout.success.winningTicketAria", {
        title: win.prizeTitle,
        ticket: formatTicketNumber(win.ticketNumber),
      })}
      className="group/prize relative flex h-full flex-col overflow-hidden rounded-2xl border border-gold/15 bg-card shadow-sm transition-colors hover:border-gold/35"
    >
      <div className="relative aspect-[4/3] shrink-0 overflow-hidden bg-gradient-to-br from-gold/20 via-gold/5 to-amber-900/10">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={win.prizeTitle}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
            className="object-cover transition-transform duration-500 group-hover/prize:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Trophy className="size-12 text-gold/50 sm:size-14" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 pb-2.5 pt-6">
          <div className="flex items-center justify-between gap-2 rounded-md bg-black/40 px-2.5 py-1.5 backdrop-blur-sm">
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-white/90">
              <Ticket className="size-3.5 shrink-0 text-gold" />
              <span className="truncate font-medium">{t("checkout.success.winningTicket")}</span>
            </div>
            <span className="font-mono text-xs font-bold tabular-nums text-gold">
              #{formatTicketNumber(win.ticketNumber)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 @lg/card:p-5">
        <h3 className="text-base font-bold leading-snug text-balance text-foreground sm:text-lg">
          {win.prizeTitle}
        </h3>

        {win.prizeDescription ? (
          <p className="line-clamp-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
            {win.prizeDescription}
          </p>
        ) : null}

        {isLinked ? (
          <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold ring-1 ring-gold/20">
            <Ticket className="size-3" />
            {t("checkout.success.ticketsToCompetition", {
              count: granted.length,
              title: win.linkedCompetitionTitle || t("checkout.success.thisCompetition"),
            })}
          </p>
        ) : win.prizeValue ? (
          <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold ring-1 ring-gold/20">
            <Sparkles className="size-3" />
            {t("checkout.success.prizeValue", { value: formatCurrency(win.prizeValue, locale) })}
          </p>
        ) : null}

        <div className="mt-auto flex items-center gap-1.5 text-xs">
          {win.prizeType === "competition_ticket" ? (
            <>
              <Ticket className="size-3.5 text-gold" />
              <span className="font-semibold text-gold">
                {t("checkout.success.ticketsAwarded")}
              </span>
            </>
          ) : (
            <>
              <PartyPopper className="size-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">
                {t("checkout.success.awaitingProcessing")}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (linkHref) {
    return (
      <Link
        href={linkHref}
        className="block h-full"
        data-umami-event="instant-win:card-click"
        data-umami-event-prize={win.prizeTitle}
      >
        {card}
      </Link>
    );
  }

  return card;
}

function InstantWinDialogHeader({
  winCount,
  totalTickets,
}: {
  winCount: number;
  totalTickets: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="relative shrink-0 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-gold/8 via-gold/3 to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gold/15 via-transparent to-transparent"
      />
      <div className="relative flex items-start justify-between gap-3 px-5 pt-5 sm:px-7">
        <div className="flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold/35 to-gold/10 shadow-md ring-1 ring-gold/30">
            <PartyPopper className="size-6 text-gold" />
          </div>
          <div>
            <h2 className="text-xl font-bold leading-tight text-foreground sm:text-2xl">
              <span className="bg-gradient-to-r from-gold-light via-gold to-gold-dark bg-clip-text text-transparent">
                {t("checkout.success.congratulations")}
              </span>
            </h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {t("checkout.success.youWonInstant", {
                count: winCount,
              })}
            </p>
          </div>
        </div>
        <DialogClose
          aria-label={t("common.close")}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          data-umami-event="instant-win:modal-close"
        >
          <X className="size-5" />
        </DialogClose>
      </div>

      <div className="relative flex flex-wrap items-center gap-2 px-5 pt-4 pb-5 text-xs sm:px-7">
        <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2.5 py-1 font-semibold text-gold ring-1 ring-gold/20">
          <Ticket className="size-3" />
          {t("checkout.success.totalTickets", { count: totalTickets })}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
          <PartyPopper className="size-3" />
          {t("checkout.success.winCount", { count: winCount })}
        </span>
      </div>

      <div
        aria-hidden
        className="h-1 w-full bg-gradient-to-r from-gold-light via-gold to-gold-dark"
      />
    </div>
  );
}

function InstantWinDialogGrid({ wins }: { wins: InstantWinData[] }) {
  const gridColsClass =
    wins.length === 1
      ? "grid-cols-1"
      : wins.length === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="relative flex-1 overflow-y-auto px-5 pb-4 pt-4 sm:px-7">
      <div className={cn("grid auto-rows-fr gap-3", gridColsClass)}>
        {wins.map((win, idx) => (
          <InstantWinCard key={`win-${win.winId ?? idx}`} win={win} />
        ))}
      </div>
    </div>
  );
}

function InstantWinDialogFooter({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-border/50 bg-card/80 p-5 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:px-7">
      <Button
        variant="ghost"
        onClick={onClose}
        className="sm:order-1 sm:min-w-32"
        data-umami-event="instant-win:modal-close"
      >
        {t("common.close")}
      </Button>
    </div>
  );
}

export function InstantWinModal({ open, onClose, wins, totalTickets }: InstantWinModalProps) {
  const { t } = useTranslation();
  const canvasRef = useConfetti(open);

  if (wins.length === 0) return null;

  const dialogMaxWidthClass =
    wins.length >= 4
      ? "sm:max-w-4xl"
      : wins.length === 3
        ? "sm:max-w-3xl"
        : wins.length === 2
          ? "sm:max-w-2xl"
          : "sm:max-w-lg";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "w-full gap-0 overflow-hidden border-gold/30 bg-card p-0",
          dialogMaxWidthClass
        )}
        aria-describedby="instant-win-description"
      >
        <DialogTitle className="sr-only">{t("checkout.success.congratulationsYouWon")}</DialogTitle>
        <DialogDescription id="instant-win-description" className="sr-only">
          {t("checkout.success.youWonInstantDesc", {
            count: wins.length,
          })}
        </DialogDescription>

        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

        <div className="relative flex max-h-[90vh] flex-col">
          <InstantWinDialogHeader winCount={wins.length} totalTickets={totalTickets} />

          <InstantWinDialogGrid wins={wins} />

          <InstantWinDialogFooter onClose={onClose} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
