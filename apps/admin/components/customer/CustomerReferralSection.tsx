"use client";

import { DollarSign, RefreshCw, Ticket, TrendingUp } from "@oc/icons";
import type { AdminReferralStats, Profile } from "@oc/types";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CustomerReferralSectionProps {
  customer: Profile;
  referralStats?: AdminReferralStats | null;
  onReassignReferral?: (userId: string) => void;
}

function DetailItem({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null | number;
  mono?: boolean;
}) {
  if (value == null || value === "") return null;
  return (
    <div className="min-w-0 flex flex-col gap-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "break-words text-sm font-medium text-foreground",
          mono && "overflow-x-auto font-mono text-xs"
        )}
      >
        {String(value)}
      </dd>
    </div>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ElementType;
  value: string | number;
  label: string;
}) {
  return (
    <Card className="h-full border-border/60 bg-muted/20 py-0 ring-0">
      <CardContent className="flex h-full min-h-[5.25rem] flex-col items-center justify-center gap-1.5 px-3 py-3 text-center">
        <Icon className="size-4 shrink-0 text-gold" aria-hidden="true" />
        <p className="text-base font-bold tabular-nums leading-none">{value}</p>
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </CardContent>
    </Card>
  );
}

function getReferredByDisplay(customer: Profile): { checkout: string; signup: string | null } {
  function profileEmail(
    p: { email?: string; firstName?: string | null; lastName?: string | null } | null | undefined
  ) {
    if (!p) return "None";
    const name = [p.firstName, p.lastName].filter(Boolean).join(" ");
    if (name) return name;
    return p.email ?? "None";
  }

  const checkoutReferrer = customer.referredByProfile
    ? profileEmail(customer.referredByProfile)
    : (customer.referredByEmail ??
      (customer.referredBy && /^[a-f\d]{24}$/i.test(customer.referredBy)
        ? "None"
        : (customer.referredBy ?? "None")));

  const signupReferrer =
    customer.referredBySignupCode && customer.referredBySignupCode !== customer.referredByCode
      ? customer.referredBySignupCode
      : null;

  return { checkout: checkoutReferrer, signup: signupReferrer };
}

export function CustomerReferralSection({
  customer,
  referralStats,
  onReassignReferral,
}: CustomerReferralSectionProps) {
  return (
    <section aria-label="Referrals">
      <Card className="bg-muted/20">
        <CardContent className="flex flex-col gap-4 px-5 py-5">
          <dl className="grid gap-3 sm:grid-cols-2">
            <DetailItem label="Referral code" value={customer.referralCode} mono />
            <DetailItem
              label="Referred by (checkout)"
              value={getReferredByDisplay(customer).checkout}
            />
            {(() => {
              const { signup } = getReferredByDisplay(customer);
              return signup ? <DetailItem label="Referred by (signup)" value={signup} /> : null;
            })()}
            <DetailItem
              label="Referral multiplier"
              value={`${customer.referralMultiplier ?? 1}x`}
            />
          </dl>

          {referralStats ? (
            <div className="flex flex-col gap-3">
              {referralStats.recentReferralUsers?.length > 0 ? (
                <AvatarGroup>
                  {referralStats.recentReferralUsers.slice(0, 5).map((u) => (
                    <Avatar
                      key={u.id}
                      className={cn("size-7 ring-2 ring-gold/40", !u.isActive && "grayscale")}
                    >
                      {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt={u.name} /> : null}
                      <AvatarFallback className="text-[10px]">
                        {u.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {referralStats.recentReferralUsers.length > 5 ? (
                    <AvatarGroupCount>
                      +{referralStats.recentReferralUsers.length - 5}
                    </AvatarGroupCount>
                  ) : null}
                </AvatarGroup>
              ) : null}

              <div className="grid auto-rows-fr grid-cols-1 gap-2 min-[420px]:grid-cols-3">
                <StatCard
                  icon={TrendingUp}
                  value={referralStats.activeReferralCount}
                  label="Active referrals"
                />
                <StatCard
                  icon={Ticket}
                  value={referralStats.totalTicketsEarned.toLocaleString()}
                  label="Tickets"
                />
                <StatCard
                  icon={DollarSign}
                  value={`£${referralStats.totalTicketValueGBP.toLocaleString()}`}
                  label="Value"
                />
              </div>

              <div className="grid auto-rows-fr grid-cols-1 gap-2 text-center min-[420px]:grid-cols-3">
                {[
                  { label: "Active", value: referralStats.activeReferralCount },
                  { label: "Pending", value: referralStats.pendingReferralCount },
                  {
                    label: "Referred spend",
                    value: `£${referralStats.totalReferralSpendGBP.toLocaleString()}`,
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex h-full min-h-[3.5rem] flex-col items-center justify-center rounded-lg border border-border/50 bg-muted/20 px-2 py-2"
                  >
                    <p className="break-words text-sm font-bold tabular-nums leading-none">
                      {value}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-gold/20 bg-gold/5 px-3 py-2.5">
                <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium text-muted-foreground">Tier progress</span>
                  <Badge variant="secondary" className="w-fit">
                    {referralStats.tierTickets} tickets
                  </Badge>
                </div>
                {referralStats.referralsToNextTier > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {referralStats.referralsToNextTier} more active referral
                    {referralStats.referralsToNextTier !== 1 ? "s" : ""} for{" "}
                    {referralStats.nextTierTickets} tickets per active competition
                  </p>
                ) : (
                  <p className="mt-1 text-xs font-medium text-gold">Highest tier reached</p>
                )}
              </div>
            </div>
          ) : (
            <dl className="grid gap-3 sm:grid-cols-2">
              {customer.referralCount > 0 ? (
                <DetailItem label="Referral count" value={customer.referralCount} />
              ) : null}
              {customer.referralTierAwardedTickets > 0 ? (
                <DetailItem
                  label="Tier awarded tickets"
                  value={customer.referralTierAwardedTickets}
                />
              ) : null}
              {customer.referralTierLastUpdated ? (
                <DetailItem
                  label="Last updated"
                  value={new Date(customer.referralTierLastUpdated).toLocaleDateString()}
                />
              ) : null}
            </dl>
          )}
          {customer._id && onReassignReferral && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReassignReferral(customer._id!)}
              className="w-full"
            >
              <RefreshCw className="mr-2 size-3.5" />
              Reassign referral
            </Button>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
