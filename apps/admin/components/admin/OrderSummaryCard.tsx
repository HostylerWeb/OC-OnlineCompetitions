"use client";

import { formatOrderNumber } from "@oc/utils";
import { Copy, ExternalLink, Mail, Ticket } from "lucide-react";
import { useState } from "react";
import { PriceCell } from "@/components/admin/PriceCell";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface OrderSummaryCardProps {
  orderId?: string | null;
  orderNumber?: number | null;
  status?: string | null;
  total?: number | null;
  subtotal?: number | null;
  discount?: number | null;
  purchasedAt?: string | null;
  customerEmail?: string | null;
  provider?: string | null;
  providerSessionId?: string | null;
  paymentCode?: string | null;
  referralCode?: string | null;
  promoCode?: string | null;
  isGuest?: boolean | null;
  ticketsAwarded?: number | null;
  tier?: number | null;
  onOpenFull?: () => void;
  onCopyCode?: (value: string) => void;
  className?: string;
  dense?: boolean;
}

const statusVariantMap: Record<string, "warning" | "success" | "error" | "draft"> = {
  pending: "warning",
  processing: "warning",
  failed: "error",
  refunded: "draft",
  completed: "success",
};

function CopyChip({ value, onCopy }: { value: string; onCopy?: (v: string) => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        });
        onCopy?.(value);
      }}
      className="inline-flex items-center gap-1 rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title="Copy to clipboard"
    >
      <Copy className="h-2.5 w-2.5" />
      {copied ? "Copied" : value.length > 24 ? `${value.slice(0, 22)}…` : value}
    </button>
  );
}

export function OrderSummaryCard({
  orderId,
  orderNumber,
  status,
  total,
  subtotal,
  discount,
  purchasedAt,
  customerEmail,
  provider,
  providerSessionId,
  paymentCode,
  referralCode,
  promoCode,
  isGuest,
  ticketsAwarded,
  tier,
  onOpenFull,
  onCopyCode,
  className,
  dense,
}: OrderSummaryCardProps) {
  const formattedDate = purchasedAt
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(purchasedAt))
    : null;

  return (
    <section
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border bg-muted/20 px-2.5 py-2 text-[11px]",
        className
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold tabular-nums">
            {orderNumber != null ? `Order ${formatOrderNumber(orderNumber)}` : "Order"}
          </span>
          {status && (
            <StatusBadge variant={statusVariantMap[status] ?? "draft"} showIcon={false}>
              {status}
            </StatusBadge>
          )}
          {isGuest && (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              Guest
            </Badge>
          )}
        </div>
        {onOpenFull && orderId && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpenFull}
            className="h-6 gap-1 px-1.5 text-[11px]"
            title="Open full order details"
            aria-label="Open full order details"
          >
            <ExternalLink className="h-3 w-3" />
            <span className="hidden sm:inline">Details</span>
          </Button>
        )}
      </header>

      <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-[11px]">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</span>
          <PriceCell value={total ?? undefined} size="md" />
        </div>
        {subtotal != null && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Subtotal
            </span>
            <PriceCell value={subtotal} size="sm" className="text-foreground" />
          </div>
        )}
        {discount != null && discount > 0 && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Discount
            </span>
            <PriceCell
              value={-discount}
              size="sm"
              className="text-emerald-600 dark:text-emerald-400"
            />
          </div>
        )}
      </div>

      {!dense && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
          {formattedDate && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {status === "refunded"
                  ? "Refunded at"
                  : status === "completed"
                    ? "Paid at"
                    : "Created"}
              </span>
              <span>{formattedDate}</span>
            </div>
          )}
          {customerEmail && (
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Customer
              </span>
              <span className="flex items-center gap-1 truncate">
                <Mail className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{customerEmail}</span>
              </span>
            </div>
          )}
          {provider && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Provider
              </span>
              <span className="capitalize">{provider}</span>
            </div>
          )}
          {referralCode && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Referral code
              </span>
              <span className="font-mono text-[11px]">{referralCode}</span>
            </div>
          )}
          {promoCode && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Promo code
              </span>
              <span className="font-mono text-[11px]">{promoCode}</span>
            </div>
          )}
          {tier != null && tier > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Tier at award
              </span>
              <span className="font-mono text-[11px]">Tier {tier}</span>
            </div>
          )}
          {(providerSessionId || paymentCode) && (
            <div className="col-span-2 flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Payment ref
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {providerSessionId && <CopyChip value={providerSessionId} onCopy={onCopyCode} />}
                {paymentCode && paymentCode !== providerSessionId && (
                  <CopyChip value={paymentCode} onCopy={onCopyCode} />
                )}
              </div>
            </div>
          )}
          {ticketsAwarded != null && ticketsAwarded > 0 && (
            <div className="col-span-2 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-amber-700 dark:text-amber-400">
              <Ticket className="h-3 w-3" />
              <span className="font-mono text-xs font-semibold">
                +{ticketsAwarded} tickets awarded
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
