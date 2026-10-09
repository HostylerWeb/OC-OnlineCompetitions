"use client";

import { useAdminOrder } from "@oc/api-admin";
import type { AdminOrder } from "@oc/types";
import { ArrowRight, Calendar, Crosshair, Crown, Loader2, Mail, Ticket, X } from "lucide-react";
import { useState } from "react";
import { OrderDetailDialog } from "@/components/admin/OrderDetailDialog";
import { OrderSummaryCard } from "@/components/admin/OrderSummaryCard";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { type EdgeContext, edgeBadgeLabel, formatEdgeWindowLabel } from "./edge-context";

interface EdgeDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ctx: EdgeContext | null;
  onFocusUser: (userId: string) => void;
}

export function EdgeDetailDrawer({ open, onOpenChange, ctx, onFocusUser }: EdgeDetailDrawerProps) {
  const [fullDialogOpen, setFullDialogOpen] = useState(false);

  const orderId = ctx?.orderId ?? null;
  const { data: orderRes, isLoading: orderLoading } = useAdminOrder(orderId ?? "");
  const order = (orderRes?.data as AdminOrder | undefined) ?? null;

  if (!ctx) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full max-w-sm flex-col gap-0 overflow-hidden p-0 sm:max-w-sm"
          showCloseButton={false}
        >
          <div className="flex items-center justify-between border-b bg-muted/30 px-6 py-4">
            <SheetTitle className="text-sm">Connection</SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="px-6 py-8 text-center text-xs text-muted-foreground">
            Pick a connection on the graph to inspect.
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const badge = edgeBadgeLabel(ctx);
  const windowLabel = formatEdgeWindowLabel(ctx);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full max-w-sm flex-col gap-0 overflow-hidden p-0 sm:max-w-sm"
          showCloseButton={false}
        >
          <div className="flex items-start justify-between border-b bg-muted/30 px-6 py-4">
            <div className="min-w-0 flex-1">
              <SheetTitle className="flex items-center gap-1.5 text-sm">
                <Crown className="h-3.5 w-3.5 text-amber-500" />
                Connection
                <EdgeBadge tone={badge.tone} label={badge.label} />
              </SheetTitle>
              <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {ctx.kind === "referral_purchase" ? "Referral purchase" : "Signup attribution"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="flex flex-col gap-4">
              <PartyRow ctx={ctx} onFocusUser={onFocusUser} />

              {ctx.kind === "referral_purchase" && (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <StatCell
                      label="Tickets"
                      value={ctx.ticketsAwarded > 0 ? `+${ctx.ticketsAwarded}` : "0"}
                      tone={ctx.ticketsAwarded > 0 ? "amber" : "muted"}
                    />
                    <StatCell
                      label="Active"
                      value={ctx.isActive ? "Yes" : "No"}
                      tone={ctx.isActive ? "emerald" : "muted"}
                    />
                    <StatCell label="Window" value={`${ctx.activityWindowDays}d`} tone="muted" />
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{windowLabel}</span>
                  </div>

                  {orderLoading ? (
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Loading order…
                    </div>
                  ) : order ? (
                    <OrderSummaryCard
                      orderId={order._id}
                      orderNumber={order.orderNumber}
                      status={order.status}
                      total={order.total}
                      subtotal={order.subtotal}
                      discount={order.discountAmount}
                      purchasedAt={order.paidAt ?? order.createdAt}
                      customerEmail={order.userEmail ?? undefined}
                      provider={(order as unknown as { provider?: string }).provider ?? null}
                      providerSessionId={order.providerSessionId ?? null}
                      paymentCode={
                        ((order as unknown as { metadata?: Record<string, unknown> }).metadata
                          ?.orderId as string | undefined) ?? null
                      }
                      referralCode={
                        (order as unknown as { referralCode?: string }).referralCode ?? null
                      }
                      promoCode={order.promoCodeId ?? null}
                      isGuest={
                        (order as unknown as { isGuestCheckout?: boolean }).isGuestCheckout ?? null
                      }
                      ticketsAwarded={ctx.ticketsAwarded}
                      tier={ctx.edge.tierAtAward ?? null}
                      onOpenFull={() => setFullDialogOpen(true)}
                    />
                  ) : ctx.orderId ? (
                    <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      Order #{ctx.orderNumber ?? "—"} details unavailable.
                    </div>
                  ) : null}
                </>
              )}

              {ctx.kind === "signup_only" && (
                <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-xs">
                  <p className="font-medium text-foreground">Signup attribution</p>
                  <p className="mt-1 text-muted-foreground">
                    {ctx.referrer.displayName} referred {ctx.referee.displayName} via signup code.
                    No order has been attributed to this connection yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <OrderDetailDialog
        open={fullDialogOpen}
        onOpenChange={setFullDialogOpen}
        orderId={ctx.kind === "referral_purchase" ? ctx.orderId : null}
      />
    </>
  );
}

function EdgeBadge({ tone, label }: { tone: "active" | "inactive" | "signup"; label: string }) {
  const cls =
    tone === "active"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : tone === "inactive"
        ? "bg-muted text-muted-foreground"
        : "bg-sky-500/15 text-sky-700 dark:text-sky-400";
  return (
    <span
      className={cn(
        "ml-1 inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
        cls
      )}
    >
      {label}
    </span>
  );
}

function StatCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "amber" | "emerald" | "muted";
}) {
  const valueCls =
    tone === "amber"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "emerald"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-foreground";
  return (
    <div className="rounded-md border bg-background px-2 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("font-mono text-sm font-semibold", valueCls)}>{value}</p>
    </div>
  );
}

function PartyRow({ ctx, onFocusUser }: { ctx: EdgeContext; onFocusUser: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-xs">
      <PartyCell
        roleLabel="Referrer"
        name={ctx.referrer.displayName}
        email={ctx.referrer.email}
        onFocus={() => onFocusUser(ctx.referrer.id)}
      />
      <div className="flex items-center justify-center text-muted-foreground">
        <ArrowRight className="h-3 w-3" />
      </div>
      <PartyCell
        roleLabel={ctx.kind === "signup_only" ? "Referee" : "Referee (buyer)"}
        name={ctx.referee.displayName}
        email={ctx.referee.email}
        onFocus={() => onFocusUser(ctx.referee.id)}
      />
      {ctx.ticketsAwarded > 0 && ctx.kind === "referral_purchase" && (
        <div className="mt-1 flex items-center justify-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
          <Ticket className="h-3 w-3" />+{ctx.ticketsAwarded} tickets awarded
        </div>
      )}
    </div>
  );
}

function PartyCell({
  roleLabel,
  name,
  email,
  onFocus,
}: {
  roleLabel: string;
  name: string;
  email: string;
  onFocus: () => void;
}) {
  const [emailCopied, setEmailCopied] = useState(false);
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {roleLabel}
        </span>
        <button
          type="button"
          onClick={onFocus}
          className="truncate text-left font-mono text-sm font-semibold text-foreground transition-colors hover:text-primary"
          title="Focus on this user in the graph"
        >
          {name}
        </button>
        {email && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(email).then(() => {
                setEmailCopied(true);
                setTimeout(() => setEmailCopied(false), 1400);
              });
            }}
            className="flex max-w-full items-center gap-1 truncate text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            title="Copy email"
          >
            <Mail className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{emailCopied ? "Copied!" : email}</span>
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onFocus}
        className="inline-flex shrink-0 items-center gap-1 self-start rounded-md border bg-background px-1.5 py-0.5 text-[10px] font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
        title="Focus on this user in the graph"
      >
        <Crosshair className="h-2.5 w-2.5" />
        Focus
      </button>
    </div>
  );
}
