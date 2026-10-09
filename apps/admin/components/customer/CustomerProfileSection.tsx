"use client";

import { Award, BadgeCheck, DollarSign, Shield, Ticket, User } from "@oc/icons";
import type { Profile } from "@oc/types";
import { formatDate, getDisplayName } from "@oc/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CustomerProfileSectionProps {
  customer: Profile;
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

export function CustomerProfileSection({ customer }: CustomerProfileSectionProps) {
  const displayName = getDisplayName(
    {
      firstName: customer.firstName ?? undefined,
      lastName: customer.lastName ?? undefined,
    },
    customer.email ?? ""
  );

  return (
    <section
      aria-label="Profile summary"
      className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/10 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-gold/10 ring-2 ring-gold/25">
          <User className="size-8 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <h3 className="min-w-0 break-words text-lg font-bold leading-tight">{displayName}</h3>
            {customer.isVerified ? (
              <BadgeCheck className="size-4 shrink-0 text-gold" aria-label="Verified" />
            ) : null}
            {customer.isAdmin ? (
              <Badge variant="outline" className="border-gold/30 text-gold">
                <Shield data-icon="inline-start" />
                Admin
              </Badge>
            ) : null}
            {customer.isAgeVerified ? <Badge variant="secondary">Age verified</Badge> : null}
          </div>
          <p className="mt-1.5 break-all text-sm text-muted-foreground">{customer.email}</p>

          <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 min-[420px]:grid-cols-2 sm:grid-cols-3">
            <DetailItem label="Phone" value={customer.phone} />
            <DetailItem
              label="Date of birth"
              value={customer.dateOfBirth ? formatDate(customer.dateOfBirth) : null}
            />
            <DetailItem label="Country" value={customer.country} />
            <DetailItem label="Joined" value={formatDate((customer as any).createdAt)} />
          </dl>

          {/* Address */}
          {customer.addressLine1 || customer.city ? (
            <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 min-[420px]:grid-cols-2 sm:grid-cols-3">
              <DetailItem label="Address" value={customer.addressLine1} />
              <DetailItem label="City" value={customer.city} />
              <DetailItem label="Postcode" value={customer.postcode} />
            </dl>
          ) : null}

          {/* Social links */}
          {customer.instagram || customer.facebook || customer.twitter || customer.tiktok ? (
            <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 min-[420px]:grid-cols-2 sm:grid-cols-3">
              <DetailItem label="Instagram" value={customer.instagram} />
              <DetailItem label="Facebook" value={customer.facebook} />
              <DetailItem label="Twitter" value={customer.twitter} />
              <DetailItem label="TikTok" value={customer.tiktok} />
            </dl>
          ) : null}

          {/* Subscription */}
          {customer.subscriptionStatus && customer.subscriptionStatus !== "none" ? (
            <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 min-[420px]:grid-cols-2 sm:grid-cols-3">
              <DetailItem label="Subscription" value={customer.subscriptionStatus} />
              <DetailItem label="Tier" value={customer.subscriptionTier} />
            </dl>
          ) : null}
        </div>
      </div>

      <div className="grid auto-rows-fr grid-cols-1 gap-2 min-[420px]:grid-cols-3">
        <StatCard icon={Ticket} value={customer.totalEntries.toLocaleString()} label="Entries" />
        <StatCard
          icon={DollarSign}
          value={`£${customer.totalSpent.toLocaleString()}`}
          label="Spent"
        />
        <StatCard
          icon={Award}
          value={(customer.competitionWinsCount ?? customer.winsCount ?? 0).toLocaleString()}
          label="Wins"
        />
      </div>
    </section>
  );
}
