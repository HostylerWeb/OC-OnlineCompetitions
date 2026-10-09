"use client";

import type { TimelineEvent } from "@oc/api-referrals/timeline";
import {
  BadgeCheck,
  CreditCard,
  Link,
  Mail,
  MailCheck,
  RotateCcw,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Ticket,
  Trophy,
  UserPlus,
  Wallet,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { PriceCell } from "@/components/admin/PriceCell";
import { cn } from "@/lib/utils";

export const TIMELINE_ICON_MAP = {
  UserPlus,
  Link,
  MailCheck,
  BadgeCheck,
  ShoppingCart,
  CreditCard,
  RotateCcw,
  ShoppingBag,
  Ticket,
  Trophy,
  Wallet,
  Mail,
  Shield,
} as const;

export function getTimelineIcon(key: string): React.ComponentType<{ className?: string }> {
  return TIMELINE_ICON_MAP[key as keyof typeof TIMELINE_ICON_MAP] ?? ShoppingCart;
}

export function getDefaultIconForType(type: TimelineEvent["type"]) {
  switch (type) {
    case "signup":
      return UserPlus;
    case "referral_link_clicked":
      return Link;
    case "email_verified":
      return MailCheck;
    case "age_verified":
      return BadgeCheck;
    case "order_placed":
      return ShoppingCart;
    case "order_paid":
      return CreditCard;
    case "order_refunded":
      return RotateCcw;
    case "referral_purchase_qualified":
      return ShoppingBag;
    case "tickets_awarded":
      return Ticket;
    case "tier_reached":
      return Trophy;
    case "wallet_credit":
    case "wallet_debit":
      return Wallet;
    case "compliance_override":
      return Shield;
    default:
      return ShoppingCart;
  }
}

const gbp = (amount: number | undefined): string =>
  amount == null
    ? "—"
    : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);

const date = (iso: string | undefined): string =>
  iso
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(iso)
      )
    : "—";

interface EventDetailProps {
  event: TimelineEvent;
}

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  if (!children && children !== 0) return null;
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-dashed border-border/60 py-0.5 text-[11px] last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-mono text-foreground">{children}</span>
    </div>
  );
}

function TagRow({
  items,
}: {
  items: Array<{ label: string; tone?: "neutral" | "success" | "warning" }>;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {items.map((it, idx) => (
        <span
          key={`${it.label}-${idx}`}
          className={cn(
            "inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
            it.tone === "success"
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              : it.tone === "warning"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                : "bg-muted text-muted-foreground"
          )}
        >
          {it.label}
        </span>
      ))}
    </div>
  );
}

function SignupDetails({ event }: EventDetailProps) {
  const m = event.meta;
  return (
    <div className="flex flex-col gap-1.5">
      <FieldRow label="Email">{m.orderEmail ?? "—"}</FieldRow>
      {m.referralCode && <FieldRow label="Referred by code">{m.referralCode}</FieldRow>}
      <FieldRow label="Created at">{date(event.timestamp)}</FieldRow>
    </div>
  );
}

function ReferralLinkClickedDetails({ event }: EventDetailProps) {
  const m = event.meta;
  return (
    <div className="flex flex-col gap-1.5">
      {m.referralCode && <FieldRow label="Referral code">{m.referralCode}</FieldRow>}
      {m.referrerEmail && <FieldRow label="Referrer">{m.referrerEmail}</FieldRow>}
      <FieldRow label="When">{date(event.timestamp)}</FieldRow>
    </div>
  );
}

function EmailVerifiedDetails({ event }: EventDetailProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldRow label="Email">{event.meta.orderEmail ?? "—"}</FieldRow>
      <FieldRow label="Verified at">{date(event.timestamp)}</FieldRow>
    </div>
  );
}

function AgeVerifiedDetails({ event }: EventDetailProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldRow label="Email">{event.meta.orderEmail ?? "—"}</FieldRow>
      <FieldRow label="Method">{event.meta.verificationMethod ?? "—"}</FieldRow>
      <FieldRow label="Verified at">{date(event.timestamp)}</FieldRow>
    </div>
  );
}

function OrderPlacedDetails({ event }: EventDetailProps) {
  const m = event.meta;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/20 px-2 py-1.5 text-[11px]">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Subtotal</span>
          <PriceCell value={m.orderSubtotal} size="sm" />
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Discount</span>
          <PriceCell
            value={m.orderDiscount && m.orderDiscount > 0 ? -m.orderDiscount : 0}
            size="sm"
            className="text-emerald-600 dark:text-emerald-400"
          />
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Total</span>
          <PriceCell value={m.orderTotal} size="sm" />
        </div>
      </div>
      {m.orderEmail && <FieldRow label="Customer">{m.orderEmail}</FieldRow>}
      {m.orderProvider && <FieldRow label="Provider">{m.orderProvider}</FieldRow>}
      {m.orderReferralCode && <FieldRow label="Referral code">{m.orderReferralCode}</FieldRow>}
      {m.orderPromoCode && <FieldRow label="Promo code">{m.orderPromoCode}</FieldRow>}
      <TagRow
        items={[
          ...(m.orderIsGuest ? [{ label: "Guest" }] : []),
          ...(m.orderProviderSessionId
            ? [{ label: `Pay ref ${m.orderProviderSessionId.slice(0, 12)}…` }]
            : []),
        ]}
      />
      <FieldRow label="Placed at">{date(event.timestamp)}</FieldRow>
    </div>
  );
}

function OrderPaidDetails({ event }: EventDetailProps) {
  const m = event.meta;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/20 px-2 py-1.5 text-[11px]">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Amount</span>
          <PriceCell value={m.orderTotal} size="sm" />
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Status</span>
          <span className="font-mono text-foreground">{m.orderStatus ?? "—"}</span>
        </div>
      </div>
      {m.orderEmail && <FieldRow label="Customer">{m.orderEmail}</FieldRow>}
      {m.orderProvider && <FieldRow label="Provider">{m.orderProvider}</FieldRow>}
      {m.orderPaymentProviderCode && (
        <FieldRow label="Payment ref">{m.orderPaymentProviderCode}</FieldRow>
      )}
      {m.orderProviderSessionId && <FieldRow label="Session">{m.orderProviderSessionId}</FieldRow>}
      <FieldRow label="Paid at">{date(event.timestamp)}</FieldRow>
    </div>
  );
}

function OrderRefundedDetails({ event }: EventDetailProps) {
  const m = event.meta;
  return (
    <div className="flex flex-col gap-1.5">
      <FieldRow label="Refunded amount">{gbp(m.orderTotal)}</FieldRow>
      {m.orderEmail && <FieldRow label="Customer">{m.orderEmail}</FieldRow>}
      {m.orderProvider && <FieldRow label="Provider">{m.orderProvider}</FieldRow>}
      <FieldRow label="Refunded at">{date(event.timestamp)}</FieldRow>
    </div>
  );
}

function ReferralPurchaseQualifiedDetails({ event }: EventDetailProps) {
  const m = event.meta;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/20 px-2 py-1.5 text-[11px]">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Order</span>
          <span className="font-mono text-foreground">
            {m.orderNumber ?? m.orderId?.slice(-6) ?? "—"}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Amount</span>
          <PriceCell value={m.orderTotal} size="sm" />
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Tickets</span>
          <span
            className={cn(
              "font-mono",
              (m.ticketsAwarded ?? 0) > 0
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground"
            )}
          >
            {m.ticketsAwarded ? `+${m.ticketsAwarded}` : "—"}
          </span>
        </div>
      </div>
      {m.referrerEmail && <FieldRow label="Referrer">{m.referrerEmail}</FieldRow>}
      {m.referredEmail && <FieldRow label="Referee">{m.referredEmail}</FieldRow>}
      {m.tier != null && m.tier > 0 && <FieldRow label="Tier at award">Tier {m.tier}</FieldRow>}
      <TagRow
        items={[
          ...(m.isQualifying
            ? [{ label: "Qualifying", tone: "success" as const }]
            : [{ label: "Not qualifying", tone: "warning" as const }]),
        ]}
      />
      <FieldRow label="When">{date(event.timestamp)}</FieldRow>
    </div>
  );
}

function TicketsAwardedDetails({ event }: EventDetailProps) {
  const m = event.meta;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px]">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Tickets
          </span>
          <span className="font-mono text-base font-semibold text-amber-700 dark:text-amber-400">
            +{event.ticketCount ?? m.ticketsAwarded ?? 0}
          </span>
        </div>
        {m.tier != null && (
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Tier
            </span>
            <span className="font-mono text-sm font-semibold text-amber-700 dark:text-amber-400">
              Tier {m.tier}
            </span>
          </div>
        )}
      </div>
      {m.orderNumber && <FieldRow label="Order">#{m.orderNumber}</FieldRow>}
      {m.referredEmail && <FieldRow label="Referred">{m.referredEmail}</FieldRow>}
      <FieldRow label="Awarded at">{date(event.timestamp)}</FieldRow>
    </div>
  );
}

function TierReachedDetails({ event }: EventDetailProps) {
  const m = event.meta;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-400">
        <span className="text-[9px] uppercase tracking-wide">Tier</span>
        <span className="font-mono text-base font-semibold">{m.tier ?? "?"}</span>
        <span className="text-[10px] opacity-80">reached</span>
      </div>
      {m.referredEmail && <FieldRow label="Triggered by">{m.referredEmail}</FieldRow>}
      {m.orderNumber && <FieldRow label="Order">#{m.orderNumber}</FieldRow>}
      <FieldRow label="When">{date(event.timestamp)}</FieldRow>
    </div>
  );
}

function WalletDetails({ event }: EventDetailProps) {
  const m = event.meta;
  const isCredit = event.type === "wallet_credit";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/20 px-2 py-1.5 text-[11px]">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
            {isCredit ? "Credit" : "Debit"}
          </span>
          <PriceCell
            value={event.amount ?? 0}
            size="sm"
            className={isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}
          />
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Type</span>
          <span className="font-mono text-foreground">{m.walletType ?? "—"}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Status</span>
          <span className="font-mono text-foreground">{m.walletStatus ?? "—"}</span>
        </div>
      </div>
      {m.balanceAfter != null && <FieldRow label="Balance after">{gbp(m.balanceAfter)}</FieldRow>}
      {m.balanceBefore != null && (
        <FieldRow label="Balance before">{gbp(m.balanceBefore)}</FieldRow>
      )}
      {m.orderId && <FieldRow label="Order ID">{m.orderId}</FieldRow>}
      {m.paymentProviderTransactionId && (
        <FieldRow label="Provider txn">{m.paymentProviderTransactionId}</FieldRow>
      )}
      {m.walletNote && <FieldRow label="Note">{m.walletNote}</FieldRow>}
      <FieldRow label="When">{date(event.timestamp)}</FieldRow>
    </div>
  );
}

function ComplianceDetails({ event }: EventDetailProps) {
  const m = event.meta;
  return (
    <div className="flex flex-col gap-1.5">
      <FieldRow label="Action">{m.action ?? event.title}</FieldRow>
      {m.actorEmail && <FieldRow label="Actor">{m.actorEmail}</FieldRow>}
      {m.source && <FieldRow label="Source">{m.source}</FieldRow>}
      {event.description && <FieldRow label="Reason">{event.description}</FieldRow>}
      <FieldRow label="When">{date(event.timestamp)}</FieldRow>
    </div>
  );
}

const RENDERERS: Record<TimelineEvent["type"], (props: EventDetailProps) => ReactNode> = {
  signup: SignupDetails,
  referral_link_clicked: ReferralLinkClickedDetails,
  email_verified: EmailVerifiedDetails,
  age_verified: AgeVerifiedDetails,
  order_placed: OrderPlacedDetails,
  order_paid: OrderPaidDetails,
  order_refunded: OrderRefundedDetails,
  referral_purchase_qualified: ReferralPurchaseQualifiedDetails,
  tickets_awarded: TicketsAwardedDetails,
  tier_reached: TierReachedDetails,
  wallet_credit: WalletDetails,
  wallet_debit: WalletDetails,
  compliance_override: ComplianceDetails,
};

export interface TimelineEventDetailProps {
  event: TimelineEvent;
  defaultOpen?: boolean;
  className?: string;
}

export function TimelineEventDetail({
  event,
  defaultOpen = false,
  className,
}: TimelineEventDetailProps) {
  const Renderer = RENDERERS[event.type];
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("rounded-md border bg-muted/20 px-2 py-1.5", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Details
        </span>
        <span className="text-[10px] text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {open && Renderer && (
        <div className="mt-1.5 border-t pt-1.5">
          <Renderer event={event} />
        </div>
      )}
    </div>
  );
}
