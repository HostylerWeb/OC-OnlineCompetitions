"use client";

import {
  useMyReferrals,
  useMyReferralTickets,
  usePublicReferralSettings,
} from "@oc/api-client";
import { Check, Copy, Share2, Ticket, Trophy, Users } from "@oc/icons";
import type { ApiResponse, ReferralTier, ReferralWalletResponse } from "@oc/types";
import { useMemo, useState } from "react";
import { useData } from "vike-react/useData";
import {
  DashboardPageHeader,
  DashboardSection,
  dashboardCardClass,
  dashboardCardContentClass,
  dashboardCardHeaderClass,
  ReferralTicketRedeemCard,
} from "@/components/dashboard";
import { EmptyState } from "@/components/EmptyState";
import { ShareDialog } from "@/components/share-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import type { Data } from "./+data";

const DEFAULT_TIERS: ReferralTier[] = [
  { threshold: 5, tickets: 2 },
  { threshold: 10, tickets: 5 },
  { threshold: 15, tickets: 10 },
];

function getCurrentTier(activeCount: number, tiers: ReferralTier[]) {
  return tiers.filter((tier) => activeCount >= tier.threshold).at(-1) ?? null;
}

function ReferralTicketsWalletCard({
  walletBalance,
  lifetimeEarned,
  isLoading,
  t,
}: {
  walletBalance: number;
  lifetimeEarned?: number;
  isLoading: boolean;
  t: (key: string, params?: any) => string;
}) {
  if (isLoading) {
    return (
      <Card className={dashboardCardClass()}>
        <CardHeader className={dashboardCardHeaderClass}>
          <Skeleton className="h-5 w-40" shimmer />
        </CardHeader>
        <CardContent className={dashboardCardContentClass}>
          <Skeleton className="h-16 w-full" shimmer />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={dashboardCardClass()}>
      <CardHeader className={dashboardCardHeaderClass}>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Ticket className="size-4 text-muted-foreground" aria-hidden="true" />
          {t("dashboard.referrals.ticketsWallet")}
        </CardTitle>
        <CardDescription className="text-sm">{t("dashboard.referrals.walletDesc")}</CardDescription>
      </CardHeader>
      <CardContent className={`${dashboardCardContentClass} grid grid-cols-2 gap-3 sm:grid-cols-3`}>
        <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-3">
          <p className="text-sm text-muted-foreground">{t("dashboard.referrals.available")}</p>
          <p className="text-3xl font-semibold tabular-nums">{walletBalance}</p>
        </div>
        {lifetimeEarned != null ? (
          <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-3 col-span-2 sm:col-span-1">
            <p className="text-sm text-muted-foreground">
              {t("dashboard.referrals.lifetimeEarned")}
            </p>
            <p className="text-3xl font-semibold tabular-nums">{lifetimeEarned}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function DashboardReferralsView() {
  const { t } = useTranslation();
  const data = useData<Data>();
  const {
    data: referralResponse,
    isLoading,
    isError,
    refetch,
  } = useMyReferrals({
    initialData: data?.referrals ? { data: data.referrals } : undefined,
  });
  const {
    data: walletResponse,
    isLoading: walletLoading,
    refetch: refetchWallet,
  } = useMyReferralTickets({
    initialData: data?.tickets
      ? ({ data: data.tickets } as ApiResponse<ReferralWalletResponse>)
      : undefined,
  });
  const { data: settingsResponse } = usePublicReferralSettings({
    initialData: data?.settings ? { data: data.settings } : undefined,
  });
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const settings = settingsResponse?.data as Record<string, unknown> | undefined;
  const tiers =
    (settings?.tiers as Array<{ threshold: number; tickets: number }> | undefined) ?? DEFAULT_TIERS;
  const refereeReward = settings?.refereeReward as
    | { enabled?: boolean; discountPercent?: number; minOrderValue?: number }
    | undefined;
  const discountPercent = refereeReward?.discountPercent ?? 0;
  const refereeRewardEnabled = refereeReward?.enabled ?? true;
  const minFirstOrderSpend = (settings?.minFirstOrderSpend as number) ?? 1;
  const activityWindowMode = (settings?.activityWindowMode as string | undefined) ?? "rolling";
  const distributionMode =
    ((settings?.distribution as Record<string, unknown> | undefined)?.mode as string) ?? "wallet";

  const referralData = referralResponse?.data ?? {
    referralCode: null as string | null,
    activeReferralCount: 0,
    pendingReferralCount: 0,
    tierTickets: 0,
    referralsToNextTier: 0,
    totalAwardedTickets: 0,
    totalReferralCount: 0,
    referralMultiplier: 1,
    recentReferrals: [],
    leaderboard: [],
  };

  const shareUrl = referralData.referralCode
    ? `${window.location.origin}/?ref=${referralData.referralCode}`
    : "";

  const maxThreshold = tiers[tiers.length - 1]?.threshold ?? 15;
  const tierProgress = Math.min(100, (referralData.activeReferralCount / maxThreshold) * 100);
  const currentTier = useMemo(
    () => getCurrentTier(referralData.activeReferralCount, tiers),
    [referralData.activeReferralCount, tiers]
  );
  const nextTier = tiers.find((tier) => referralData.activeReferralCount < tier.threshold);

  const activeList = useMemo(
    () => (referralData.recentReferrals ?? []).filter((r) => r.hasCompletedPurchase),
    [referralData.recentReferrals]
  );
  const inactiveList = useMemo(
    () => (referralData.recentReferrals ?? []).filter((r) => !r.hasCompletedPurchase),
    [referralData.recentReferrals]
  );

  const hasActiveMultiplier = referralData.referralMultiplier > 1;

  const walletBalance = walletResponse?.data?.walletBalance ?? 0;

  const handleWalletRefresh = () => {
    void refetch();
    void refetchWallet();
  };

  const handleCopyCode = async () => {
    if (!referralData.referralCode) return;
    try {
      await navigator.clipboard.writeText(referralData.referralCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {}
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-10 w-64" shimmer />
        <Skeleton className="h-48 w-full rounded-xl" shimmer />
        <Skeleton className="h-80 w-full rounded-xl" shimmer />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        title={t("dashboard.referrals.failedToLoad")}
        description={t("dashboard.referrals.failedToLoadDesc")}
        umamiEvent="referrals:retry"
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title={t("dashboard.referrals.heading")}
        subtitle={t("dashboard.referrals.subtitle")}
      />

      {distributionMode === "wallet" ? (
        <ReferralTicketsWalletCard
          walletBalance={walletBalance}
          lifetimeEarned={walletResponse?.data.lifetimeEarned}
          isLoading={walletLoading}
          t={(key: string, p?: any) => t(key as any, p)}
        />
      ) : null}

      <Card className={dashboardCardClass()}>
        <CardHeader className={dashboardCardHeaderClass}>
          <CardTitle className="text-xl">{t("dashboard.referrals.shareYourCode")}</CardTitle>
        </CardHeader>
        <CardContent className={`${dashboardCardContentClass} flex flex-col gap-4`}>
          <FieldGroup className="gap-3">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="referral-code" className="text-sm">
                {t("dashboard.referrals.referralCode")}
                {refereeRewardEnabled && discountPercent > 0
                  ? ` — ${discountPercent}% DISCOUNT`
                  : ""}
              </FieldLabel>
              {referralData.referralCode ? (
                <InputGroup className="h-10">
                  <InputGroupInput
                    id="referral-code"
                    readOnly
                    value={referralData.referralCode}
                    className="font-mono text-base font-semibold tracking-wider"
                    aria-label={t("dashboard.referrals.yourCodeAria")}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      type="button"
                      size="icon-sm"
                      onClick={handleCopyCode}
                      aria-label={copiedCode ? t("share.codeCopied") : t("share.copyReferralCode")}
                      data-umami-event="referrals:copy-code"
                    >
                      {copiedCode ? <Check /> : <Copy />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("dashboard.referrals.generatingCode")}
                </p>
              )}
            </Field>

            {shareUrl ? (
              <Field className="gap-1.5">
                <FieldLabel htmlFor="referral-link" className="text-sm">
                  {t("dashboard.referrals.signUpLink")}
                </FieldLabel>
                <InputGroup className="h-10">
                  <InputGroupInput
                    id="referral-link"
                    readOnly
                    value={shareUrl}
                    className="text-sm"
                    aria-label={t("dashboard.referrals.signUpLinkAria")}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      type="button"
                      size="icon-sm"
                      onClick={handleCopyLink}
                      aria-label={copiedLink ? t("share.linkCopied") : t("share.copyShareLink")}
                      data-umami-event="referrals:copy-link"
                    >
                      {copiedLink ? <Check /> : <Copy />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            ) : null}
          </FieldGroup>

          <Button
            type="button"
            size="sm"
            className="w-fit"
            onClick={() => setShareOpen(true)}
            disabled={!referralData.referralCode}
            data-umami-event="referrals:share-link"
          >
            <Share2 data-icon="inline-start" />
            {t("dashboard.referrals.shareLink")}
          </Button>
          <ShareDialog
            open={shareOpen}
            onOpenChange={setShareOpen}
            shareConfig={{
              url: shareUrl,
              text: t("dashboard.referrals.shareText", { code: referralData.referralCode ?? "" }),
              referralCode: referralData.referralCode ?? undefined,
            }}
            title={t("dashboard.referrals.shareReferral")}
          />
        </CardContent>
      </Card>

      <Card className={dashboardCardClass()}>
        <CardHeader className={dashboardCardHeaderClass}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <CardTitle className="text-xl">{t("dashboard.referrals.yourReferrals")}</CardTitle>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-sm font-normal">
                {t("dashboard.referrals.shareBadge")}
              </Badge>
              <Badge variant="outline" className="text-sm font-normal">
                {t("dashboard.referrals.qualifyingPurchase", { minSpend: minFirstOrderSpend })}
              </Badge>
              {activityWindowMode === "fixed_day_of_month" ? (
                <Badge variant="outline" className="text-sm font-normal">
                  {t("dashboard.referrals.renewsMonthly")}
                </Badge>
              ) : null}
              <Badge variant="outline" className="text-sm font-normal">
                {t("dashboard.referrals.ticketsCredited")}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className={`${dashboardCardContentClass} flex flex-col gap-5`}>
          <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {t("dashboard.referrals.tierProgress")}
                {currentTier ? (
                  <>
                    {" "}
                    ·{" "}
                    <span className="font-medium text-foreground">
                      {referralData.tierTickets} {t("dashboard.referrals.tickets")}
                    </span>
                    {hasActiveMultiplier ? (
                      <Badge variant="secondary" className="text-sm font-normal">
                        {referralData.referralMultiplier}x bonus
                      </Badge>
                    ) : null}
                  </>
                ) : null}
              </span>
              <span className="font-mono tabular-nums">
                {referralData.activeReferralCount}/{maxThreshold}
              </span>
            </div>
            <Progress value={tierProgress} className="h-1.5" />
            <div className="grid grid-cols-2 gap-3">
              {tiers.map((tier) => {
                const isAchieved = referralData.activeReferralCount >= tier.threshold;
                const isCurrent = currentTier?.threshold === tier.threshold;
                return (
                  <div
                    key={tier.threshold}
                    className="flex flex-col items-center gap-1.5 rounded-md border border-border/70 px-4 py-3 text-center"
                  >
                    <Badge variant={isAchieved ? "default" : "outline"} className="text-sm">
                      {Math.round(tier.tickets * referralData.referralMultiplier)}{" "}
                      {t("dashboard.referrals.tickets")}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      {tier.threshold} {t("dashboard.referrals.active")}
                    </p>
                    {hasActiveMultiplier && !isCurrent ? (
                      <p className="text-xs leading-tight text-muted-foreground">
                        {t("dashboard.referrals.base")} {tier.tickets}
                      </p>
                    ) : null}
                    {isCurrent ? (
                      <p className="text-sm font-medium text-foreground">
                        {t("dashboard.referrals.current")}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {referralData.referralsToNextTier > 0 && nextTier ? (
              <p className="text-sm text-muted-foreground">
                {referralData.referralsToNextTier} more active referral
                {referralData.referralsToNextTier !== 1 ? "s" : ""}{" "}
                {t("dashboard.referrals.untilNextTier")}.
              </p>
            ) : referralData.activeReferralCount >= maxThreshold ? (
              <p className="text-sm text-muted-foreground">
                {t("dashboard.referrals.maxTierReached")}
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {t("dashboard.referrals.autoDistributeNote")}
            </p>
          </div>

          <h3 className="text-base font-medium text-foreground">Referrals:</h3>

          {activeList.length === 0 && inactiveList.length === 0 ? (
            <Empty className="border-0 p-0">
              <EmptyHeader className="gap-2">
                <EmptyMedia variant="icon" className="size-8">
                  <Users className="size-4" aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle className="text-base">
                  {t("dashboard.referrals.noReferrals")}
                </EmptyTitle>
                <EmptyDescription className="text-sm">
                  {t("dashboard.referrals.noReferralsDesc")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-6">
              {activeList.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <h4 className="text-base font-medium text-foreground">
                    {t("dashboard.referrals.activeSection")} (
                    <span className="tabular-nums">{activeList.length}</span>)
                  </h4>
                  <div className="max-h-[19rem] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("dashboard.referrals.nameHeader")}</TableHead>
                          <TableHead>{t("dashboard.referrals.joinedHeader")}</TableHead>
                          <TableHead className="text-right">
                            {t("dashboard.referrals.statusHeader")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeList.map((referral) => (
                          <TableRow key={referral.id}>
                            <TableCell>
                              <div className="flex items-center gap-2.5">
                                <Avatar className="size-7">
                                  <AvatarFallback className="text-xs">
                                    {referral.name
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")
                                      .slice(0, 2)
                                      .toUpperCase() || "?"}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium">{referral.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(referral.joinedAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className="border-success/30 text-success">
                                {t("dashboard.referrals.activeBadge")}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : null}
              {inactiveList.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <h4 className="text-base font-medium text-muted-foreground">
                    {t("dashboard.referrals.inactiveSection")} (
                    <span className="tabular-nums">{inactiveList.length}</span>)
                  </h4>
                  <div className="max-h-[19rem] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("dashboard.referrals.nameHeader")}</TableHead>
                          <TableHead>{t("dashboard.referrals.joinedHeader")}</TableHead>
                          <TableHead className="text-right">
                            {t("dashboard.referrals.statusHeader")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inactiveList.map((referral) => (
                          <TableRow key={referral.id}>
                            <TableCell>
                              <div className="flex items-center gap-2.5">
                                <Avatar className="size-7 grayscale">
                                  <AvatarFallback className="text-xs">
                                    {referral.name
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")
                                      .slice(0, 2)
                                      .toUpperCase() || "?"}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium">{referral.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(referral.joinedAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">
                                {t("dashboard.referrals.pendingBadge")}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {distributionMode === "wallet" ? (
        <ReferralTicketRedeemCard awardedTickets={walletBalance} onRedeemed={handleWalletRefresh} />
      ) : null}

      {referralData.leaderboard.length > 0 ? (
        <DashboardSection title={t("dashboard.referrals.topReferrers")} icon={Trophy}>
          <Card className={dashboardCardClass()}>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">{t("dashboard.referrals.rankHeader")}</TableHead>
                    <TableHead>{t("dashboard.referrals.nameHeader")}</TableHead>
                    <TableHead className="text-right">
                      {t("dashboard.referrals.referralsHeader")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referralData.leaderboard.map((entry) => (
                    <TableRow key={entry.rank}>
                      <TableCell>
                        <Badge
                          variant={entry.rank <= 3 ? "default" : "outline"}
                          className="font-mono tabular-nums"
                        >
                          #{entry.rank}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{entry.name}</TableCell>
                      <TableCell className="text-right font-mono font-semibold tabular-nums">
                        {entry.count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </DashboardSection>
      ) : null}
    </div>
  );
}
