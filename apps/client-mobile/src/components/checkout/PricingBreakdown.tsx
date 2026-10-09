"use client";

import { Tag } from "@oc/icons";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatNumber, useTranslation } from "@/lib/i18n";

export interface PricingBreakdownItem {
  competitionId: string;
  competitionTitle: string;
  quantity: number;
  price: number;
}

export interface PricingBreakdownProps {
  items: PricingBreakdownItem[];
  subtotal: number;
  total: number;
  promoCode?: string | null;
  promoDiscountAmount?: number | null;
  discountType?: "percentage" | "fixed" | null;
  discountRequiresAuth?: boolean;
  promoDiscountPercent?: number | null;
  referralCode?: string | null;
  referralDiscountPercent?: number | null;
  walletTicketsTotal?: number | null;
  walletDiscountAmount?: number | null;
  showLineItems?: boolean;
  showShipping?: boolean;
}

function formatPercentFromAmount(amount: number, subtotal: number): number {
  if (subtotal <= 0) return 0;
  return Math.round((amount / subtotal) * 100);
}

function buildDiscountRows(
  props: PricingBreakdownProps & { t: ReturnType<typeof useTranslation>["t"] }
) {
  const {
    subtotal,
    promoCode,
    promoDiscountAmount,
    discountType,
    referralCode,
    referralDiscountPercent,
    t,
  } = props;

  const savings = promoDiscountAmount ?? 0;
  if (savings <= 0) return [];

  if (promoCode) {
    const percent = props.promoDiscountPercent;
    const label =
      discountType === "percentage" && percent != null
        ? t("cart.promoApplied", { code: `-${percent}% ${promoCode}` })
        : t("cart.promoApplied", { code: promoCode });
    return [{ key: "promo", label, amount: savings }];
  }

  if (referralCode) {
    const percent =
      referralDiscountPercent ?? (subtotal > 0 ? formatPercentFromAmount(savings, subtotal) : 0);
    return [
      {
        key: "referral",
        label: `Referral ${referralCode} (-${percent}%)`,
        amount: savings,
      },
    ];
  }

  return [];
}

export function PricingBreakdown({
  items,
  subtotal,
  total,
  showLineItems = true,
  showShipping = true,
  walletTicketsTotal,
  walletDiscountAmount,
  discountRequiresAuth,
  ...discountProps
}: PricingBreakdownProps) {
  const { t, locale } = useTranslation();
  const discountRows = buildDiscountRows({ items, subtotal, total, t, ...discountProps });
  const walletTickets = walletTicketsTotal ?? 0;
  const walletSavings = walletDiscountAmount ?? 0;

  return (
    <>
      {showLineItems && items.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <div
                key={item.competitionId}
                className="flex justify-between items-start gap-3 py-2 border-b border-gold/10 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm leading-snug">{item.competitionTitle}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {item.quantity.toLocaleString("en-GB")} × {(() => {
                      const op = (item as any).originalPrice;
                      return op != null && op > item.price ? (
                        <>
                          <span className="line-through text-muted-foreground mr-1">
                            {formatCurrency(op, locale)}
                          </span>
                          <span className="mr-1">&nbsp;</span>
                          {formatCurrency(item.price, locale)}
                        </>
                      ) : (
                        formatCurrency(item.price, locale)
                      );
                    })()}
                  </p>
                </div>
                <p className="font-semibold tabular-nums shrink-0">
                  {formatCurrency(item.price * item.quantity, locale)}
                </p>
              </div>
            ))}
          </div>
          <Separator />
        </>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("checkout.subtotal")}</span>
          <span className="tabular-nums">{formatCurrency(subtotal, locale)}</span>
        </div>

        {discountRows.length > 0 ? (
          discountRows.map((row) => (
            <div
              key={row.key}
              className={`flex justify-between text-sm gap-3 ${discountRequiresAuth ? "text-muted-foreground line-through opacity-50" : "text-green-400"}`}
            >
              <span className="flex items-center gap-1 min-w-0">
                <Tag className="size-3 shrink-0" />
                <span className="truncate">{row.label}</span>
              </span>
              <span className="tabular-nums shrink-0">-{formatCurrency(row.amount, locale)}</span>
            </div>
          ))
        ) : walletTickets <= 0 ? (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("checkout.discount")}</span>
            <span className="text-muted-foreground tabular-nums"> - </span>
          </div>
        ) : null}

        {walletTickets > 0 && walletSavings > 0 ? (
          <div className="flex justify-between text-sm text-green-400 gap-3">
            <span className="flex items-center gap-1 min-w-0">
              <Tag className="size-3 shrink-0" />
              <span className="truncate">
                {t("checkout.referralTicketsWallet")} ({formatNumber(walletTickets, locale)})
              </span>
            </span>
            <span className="tabular-nums shrink-0">-{formatCurrency(walletSavings, locale)}</span>
          </div>
        ) : null}

        {showShipping && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("checkout.shipping")}</span>
            <span>{t("checkout.free")}</span>
          </div>
        )}
      </div>

      <Separator />

      <div className="flex justify-between font-semibold text-lg">
        <span>{t("checkout.total")}</span>
        <span className="text-gold tabular-nums">{formatCurrency(total, locale)}</span>
      </div>
    </>
  );
}
