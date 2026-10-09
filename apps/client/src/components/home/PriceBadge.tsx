import type { Competition } from "@oc/types";
import { getPrizeDisplayLabel } from "@/lib/competition-display";
import { formatCurrency, useTranslation } from "@/lib/i18n";

interface PriceBadgeProps {
  competition: Pick<
    Competition,
    "category" | "isCashOnly" | "ticketPrice" | "prizeValue" | "originalPrice" | "currency"
  >;

  size?: "sm" | "md" | "lg" | "responsive";

  showPerTicket?: boolean;
}

const SIZE = {
  sm: "text-base font-bold",
  md: "text-xl font-bold",
  lg: "text-3xl font-bold",
  responsive: "text-[13px] @sm/card:text-base @lg/card:text-xl font-bold",
} as const;

export function PriceBadge({ competition, size = "md", showPerTicket = true }: PriceBadgeProps) {
  const { t, locale } = useTranslation();
  const ticketPrice = competition.ticketPrice ?? 0;
  const currency = competition.currency ?? "GBP";
  const ticketCurrency = "GBP";

  const perTicketClass =
    size === "responsive"
      ? "text-xs @lg/card:text-sm text-muted-foreground"
      : "text-xs text-muted-foreground";
  const cashEquivClass =
    size === "responsive"
      ? "text-[10px] leading-tight line-clamp-2 @sm/card:text-xs @lg/card:text-sm text-gold font-bold tabular-nums"
      : "text-xs text-gold font-bold tabular-nums";

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline gap-2">
        <span className={SIZE[size]}>
          {ticketPrice > 0 &&
          competition.originalPrice != null &&
          competition.originalPrice > ticketPrice ? (
            <>
              <span className="line-through text-muted-foreground mr-1.5">
                {formatCurrency(competition.originalPrice, locale, ticketCurrency)}
              </span>
              {formatCurrency(ticketPrice, locale, ticketCurrency)}
            </>
          ) : ticketPrice > 0 ? (
            formatCurrency(ticketPrice, locale, ticketCurrency)
          ) : (
            t("home.free")
          )}
        </span>
        {showPerTicket && <span className={perTicketClass}>{t("home.perTicketText")}</span>}
      </div>
      <span className={cashEquivClass}>
        {getPrizeDisplayLabel(competition, {
          t: t as (key: string) => string,
          locale,
          currency,
        }) ?? "\u00A0"}
      </span>
    </div>
  );
}
