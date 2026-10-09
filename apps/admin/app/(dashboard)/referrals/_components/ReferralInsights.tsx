"use client";

import {
  useAdminReferralDistribution,
  useAdminReferralSettings,
  useAdminReferralSummary,
  useAdminTopReferrers,
} from "@oc/api-admin";
import { Info, Trophy, Users, Wallet, Zap } from "@oc/icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function Stat({
  label,
  value,
  suffix,
  tooltip,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  tooltip?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        {label}
        {tooltip ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`What ${label} means`}
                className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <Info className="size-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-72 text-xs">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </p>
      <p className="text-xl font-bold tabular-nums">
        {value}
        {suffix && (
          <span className="text-xs text-muted-foreground font-normal ml-0.5">{suffix}</span>
        )}
      </p>
    </div>
  );
}

export function ReferralSummaryCards() {
  const { data, isLoading } = useAdminReferralSummary();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  const s = data?.data;
  if (!s) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between">
            <Stat
              label="Active referrers"
              value={s.totalReferrers}
              tooltip="Distinct users who currently have at least one active referral (live count from ReferralPurchase, matches the user dashboard leaderboard)."
            />
            <Users className="size-5 text-muted-foreground/60" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between">
            <Stat
              label="Tickets minted"
              value={s.ticketsMinted}
              tooltip="Sum of tickets awarded across all non-deleted referral purchases."
            />
            <Wallet className="size-5 text-muted-foreground/60" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between">
            <Stat
              label="Burn rate"
              value={s.burnRate}
              suffix="%"
              tooltip="Percentage of minted tickets that have been redeemed (minted − in-wallets)."
            />
            <Zap className="size-5 text-muted-foreground/60" />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {s.ticketsRedeemed} of {s.ticketsMinted} tickets used
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between">
            <Stat
              label="Users with wallet"
              value={s.usersWithWalletBalance}
              tooltip="Distinct profiles whose referral wallet balance is greater than zero."
            />
            <Trophy className="size-5 text-muted-foreground/60" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function TierDistributionWidget() {
  const { data, isLoading } = useAdminReferralDistribution();

  if (isLoading) return <Skeleton className="h-40 rounded-lg" />;

  const dist = data?.data;
  if (!dist) return null;

  const _total = dist.buckets.reduce((s, b) => s + b.count, 0) || 1;
  const sortedBuckets = [...dist.buckets].sort((a, b) => a._id - b._id);
  const maxCount = Math.max(...sortedBuckets.map((b) => b.count), 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Tier distribution</CardTitle>
        <CardDescription className="text-xs">
          How many referrers sit in each bracket
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sortedBuckets.map((b) => {
            const pct = Math.round((b.count / maxCount) * 100);
            return (
              <div key={b._id} className="space-y-0.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    {b._id === 0
                      ? "0"
                      : `${dist.tiers[dist.tiers.indexOf(b._id) - 1] ?? 0}–${b._id - 1}`}{" "}
                    referrals
                  </span>
                  <span className="tabular-nums font-medium">{b.count}</span>
                </div>
                <Progress value={pct} className="h-2" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function TopReferrersWidget() {
  const { data, isLoading } = useAdminTopReferrers(10);
  const { data: settingsResponse } = useAdminReferralSettings();
  const settings = settingsResponse?.data as
    | { activityWindowDays?: number; minFirstOrderSpend?: number }
    | undefined;
  const windowDays = settings?.activityWindowDays ?? 30;
  const minSpend = settings?.minFirstOrderSpend ?? 1;

  if (isLoading) return <Skeleton className="h-48 rounded-lg" />;

  const referrers = data?.data;
  if (!referrers || referrers.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Top referrers</CardTitle>
        <CardDescription className="text-xs">
          Unique active referrals within {windowDays}-day window (≥£{minSpend} spend).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {referrers.slice(0, 10).map((r) => {
            const isTop3 = r.rank <= 3;
            return (
              <div
                key={r.referrerId}
                className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-muted/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`tabular-nums w-4 text-right ${
                      isTop3 ? "text-amber-500 font-medium" : "text-muted-foreground"
                    }`}
                  >
                    #{r.rank}
                  </span>
                  <span className="truncate font-medium" title={r.email}>
                    {r.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground tabular-nums shrink-0">
                  <span title="Unique active referrals">{r.count}</span>
                  <span title="Tickets awarded">{r.ticketsAwarded} tk</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
