"use client";

import {
  api,
  clearPendingReferralRef,
  getPendingReferralRef,
  useCompetitionStream,
  useDashboardData,
  useMyReferralTickets,
} from "@oc/api-client";
import {
  ArrowRight,
  Gift,
  Package,
  Sparkles,
  Ticket,
  Trophy,
  User,
  Users,
  Zap,
} from "@oc/icons";
import type { Entry, MeOrderDto } from "@oc/types";
import { formatDate, getDisplayName, OrderNumberCell } from "@oc/utils";
import { useEffect, useState } from "react";
import { ActivityTable } from "@/components/ActivityTable";
import { DashboardStatCard } from "@/components/DashboardStatCard";
import {
  CompetitionGridRow,
  CompetitionListRow,
  DashboardEmptyCard,
  DashboardListSkeleton,
  DashboardListToolbar,
  type DashboardListViewMode,
  DashboardListViewModeToggle,
  DashboardPageHeader,
  DashboardQuickLinkCard,
  DashboardSection,
  DashboardVirtualList,
  dashboardCardClass,
  dashboardCardFooterClass,
  dashboardCardHeaderClass,
  getDashboardCardRowHeightWithGap,
  getDashboardCompactRowHeightWithGap,
} from "@/components/dashboard";
import { Link } from "@/components/Link";
import { StatusBadge } from "@/components/StatusBadge";
import { TicketNumberCell } from "@/components/shared/TicketNumberCell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser } from "@/hooks/useUser";
import { formatCurrency, useTranslation } from "@/lib/i18n";

const QUICK_LINKS = [
  { href: "/competitions", labelKey: "dashboard.quickLinks.browse", icon: Zap },
  { href: "/dashboard/orders", labelKey: "dashboard.quickLinks.orders", icon: Package },
  { href: "/dashboard/tickets", labelKey: "dashboard.quickLinks.tickets", icon: Ticket },
  { href: "/dashboard/wins", labelKey: "dashboard.quickLinks.wins", icon: Trophy },
  { href: "/dashboard/referrals", labelKey: "dashboard.quickLinks.referrals", icon: Gift },
  { href: "/dashboard/profile", labelKey: "dashboard.quickLinks.profile", icon: User },
] as const;

export default function DashboardHomeView() {
  const { t, locale } = useTranslation();
  const [hotCompsViewMode, setHotCompsViewMode] = useState<DashboardListViewMode>("compact");
  const user = useUser();

  useEffect(() => {
    const refCode = getPendingReferralRef();
    if (!refCode) return;

    api
      .post<{ applied: boolean; referredByCode?: string | null }>("/api/referral-code/claim", {
        code: refCode,
      })
      .then((res) => {
        if (res.data.applied || res.data.referredByCode) {
          clearPendingReferralRef();
        }
      })
      .catch(() => {});
  }, []);
  const { data: dashboardResponse, isLoading: dashboardLoading } = useDashboardData();
  const { data: walletResponse, isLoading: walletLoading } = useMyReferralTickets();
  const walletBalance = walletResponse?.data?.walletBalance ?? 0;

  const dashboard = dashboardResponse?.data;
  const entries = dashboard?.entries ?? [];
  const orders = dashboard?.orders ?? [];
  const allComps = dashboard?.activeCompetitions ?? [];
  const competitionIds = allComps.map((c: any) => c._id || c.id).filter(Boolean);
  useCompetitionStream(competitionIds);
  const referralData = dashboard?.referrals;
  const profile = dashboard?.profile;

  const stats = dashboard?.stats ?? {
    activeEntries: 0,
    totalWins: 0,
    competitionWins: 0,
    instantWins: 0,
    bonusWins: 0,
    totalEntries: 0,
  };

  const isLoading = dashboardLoading || walletLoading;
  const entriesLoading = isLoading && !dashboard;
  const ordersLoading = isLoading && !dashboard;
  const compsLoading = isLoading && !dashboard;

  const displayName = getDisplayName(
    { firstName: user?.firstName, lastName: user?.lastName },
    user?.email ?? ""
  );

  const getCompetitionId = (id: Entry["competitionId"] | null | undefined): string | null => {
    if (!id) return null;
    return typeof id === "string" ? id : (id._id ?? null);
  };
  const enteredIds = new Set<string>(
    entries.map((e) => getCompetitionId(e.competitionId)).filter((id): id is string => Boolean(id))
  );
  const hotComps = allComps.filter((c) => c._id && !enteredIds.has(c._id)).slice(0, 4);
  const hotCompsListViewMode = hotCompsViewMode === "grid" ? "card" : hotCompsViewMode;
  const activeEntries = entries.filter((e) => e.answerCorrect === undefined);

  const recentOrders = orders.slice(0, 5);
  const recentEntries = [...entries]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const orderColumns = [
    {
      id: "order",
      header: t("dashboard.activityTable.order"),
      cell: (order: MeOrderDto) => <OrderNumberCell value={order.orderNumber} />,
    },
    {
      id: "date",
      header: t("dashboard.activityTable.date"),
      cell: (order: MeOrderDto) => <span className="text-sm">{formatDate(order.createdAt)}</span>,
    },
    {
      id: "status",
      header: t("dashboard.activityTable.status"),
      cell: (order: MeOrderDto) => (
        <StatusBadge variant={order.status as "paid" | "pending" | "failed" | "refunded"}>
          {order.status}
        </StatusBadge>
      ),
    },
    {
      id: "total",
      header: t("dashboard.activityTable.total"),
      cell: (order: MeOrderDto) => (
        <span className="font-mono text-sm font-semibold">
          {formatCurrency(order.total, locale)}
        </span>
      ),
    },
  ];

  const entryColumns = [
    {
      id: "competition",
      header: t("dashboard.activityTable.competition"),
      cell: (entry: Entry) => {
        const comp = entry.competitionId;
        const title =
          typeof comp === "object" && comp ? comp.title : t("dashboard.activityTable.competition");
        return (
          <span className="text-sm font-medium">
            {title ?? t("dashboard.activityTable.competition")}
          </span>
        );
      },
    },
    {
      id: "ticket",
      header: t("dashboard.activityTable.ticket"),
      cell: (entry: Entry) => {
        const displayNumber = entry.ticketNumber ?? entry.entryNumber;
        if (displayNumber == null) {
          return (
            <span className="text-sm text-muted-foreground">{t("dashboard.statFallback")}</span>
          );
        }
        return <TicketNumberCell value={displayNumber} prefix={false} />;
      },
    },
    {
      id: "qty",
      header: t("dashboard.activityTable.qty"),
      cell: (entry: Entry) => <span className="text-sm">{entry.quantity ?? 1}</span>,
    },
    {
      id: "date",
      header: t("dashboard.activityTable.date"),
      cell: (entry: Entry) => <span className="text-sm">{formatDate(entry.createdAt)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title={t("dashboard.home.welcomeBack", { name: displayName })}
        subtitle={t("dashboard.home.subtitle")}
      />

      {stats.totalWins > 0 && (
        <Alert className="border-border/70 bg-card">
          <Trophy />
          <AlertTitle>{t("dashboard.home.youHaveWins", { count: stats.totalWins })}</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {[
                stats.competitionWins > 0 &&
                  t("dashboard.home.competitionWins", { count: stats.competitionWins }),
                stats.instantWins > 0 &&
                  t("dashboard.home.instantWins", { count: stats.instantWins }),
                stats.bonusWins > 0 && t("dashboard.home.bonusAwards", { count: stats.bonusWins }),
              ]
                .filter(Boolean)
                .join(", ")}
            </span>
            <Link
              href="/dashboard/wins"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
            >
              {t("dashboard.home.viewWins")}
              <ArrowRight data-icon="inline-end" />
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-2.5">
        <DashboardStatCard
          title={t("dashboard.home.activeEntries")}
          value={stats.activeEntries.toLocaleString()}
          icon={Ticket}
          variant="gold"
          isLoading={isLoading}
        />
        {stats.competitionWins > 0 && (
          <DashboardStatCard
            title={t("dashboard.home.competitionWins")}
            value={stats.competitionWins}
            icon={Trophy}
            variant="emerald"
            isLoading={isLoading}
          />
        )}
        {stats.instantWins > 0 && (
          <DashboardStatCard
            title={t("dashboard.home.instantWins")}
            value={stats.instantWins}
            icon={Zap}
            variant="gold"
            isLoading={isLoading}
          />
        )}
        {stats.bonusWins > 0 && (
          <DashboardStatCard
            title={t("dashboard.home.bonusAwards")}
            value={stats.bonusWins}
            icon={Gift}
            variant="purple"
            isLoading={isLoading}
          />
        )}
        <DashboardStatCard
          title={t("dashboard.home.totalEntries")}
          value={stats.totalEntries.toLocaleString()}
          icon={Sparkles}
          variant="gold"
          isLoading={isLoading}
        />
        {walletBalance > 0 ? (
          <DashboardStatCard
            title={t("dashboard.home.ticketWallet")}
            value={walletBalance.toLocaleString()}
            icon={Ticket}
            variant="purple"
            isLoading={isLoading}
            subtitle={t("dashboard.home.spendAtCheckout")}
          />
        ) : null}
        {referralData ? (
          <>
            <DashboardStatCard
              title={t("dashboard.home.activeReferrals")}
              value={referralData.activeReferralCount}
              icon={Users}
              variant="gold"
              isLoading={isLoading}
            />
            <DashboardStatCard
              title={t("dashboard.home.pendingReferrals")}
              value={referralData.pendingReferralCount}
              icon={Users}
              variant="purple"
              isLoading={isLoading}
            />
            <DashboardStatCard
              title={t("dashboard.home.totalReferrals")}
              value={referralData.totalReferralCount}
              icon={Users}
              variant="emerald"
              isLoading={isLoading}
            />
          </>
        ) : null}
      </div>

      <DashboardSection title={t("dashboard.home.quickLinks")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {QUICK_LINKS.map((link) => (
            <DashboardQuickLinkCard
              key={link.href}
              href={link.href}
              label={t(link.labelKey)}
              icon={link.icon}
            />
          ))}
        </div>
      </DashboardSection>

      <DashboardSection title={t("dashboard.home.recentActivity")}>
        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders">{t("dashboard.home.ordersTab")}</TabsTrigger>
            <TabsTrigger value="entries">{t("dashboard.home.entriesTab")}</TabsTrigger>
          </TabsList>
          <TabsContent value="orders" className="mt-2.5">
            <ActivityTable
              title={t("dashboard.home.recentOrders")}
              viewAllHref="/dashboard/orders"
              columns={orderColumns}
              data={recentOrders}
              isLoading={ordersLoading}
              emptyMessage={t("dashboard.home.noOrdersYet")}
              rowKey={(order) => order._id}
            />
          </TabsContent>
          <TabsContent value="entries" className="mt-2.5">
            <ActivityTable
              title={t("dashboard.home.recentEntries")}
              viewAllHref="/dashboard/tickets"
              columns={entryColumns}
              data={recentEntries}
              isLoading={entriesLoading}
              emptyMessage={t("dashboard.home.noEntriesYet")}
              rowKey={(entry) => entry._id}
            />
          </TabsContent>
        </Tabs>
      </DashboardSection>

      {(hotComps.length > 0 || compsLoading) && (
        <DashboardSection
          title={t("dashboard.home.hotRightNow")}
          icon={Zap}
          count={hotComps.length > 0 ? hotComps.length : undefined}
          toolbar={
            <DashboardListToolbar
              filters={
                <p className="px-1 text-xs text-muted-foreground">
                  {t("dashboard.home.hotDescription")}
                </p>
              }
              actions={
                <DashboardListViewModeToggle
                  value={hotCompsViewMode}
                  onChange={setHotCompsViewMode}
                  ariaLabel={t("dashboard.home.hotLayoutAria")}
                />
              }
            />
          }
        >
          {compsLoading ? (
            <DashboardListSkeleton viewMode={hotCompsViewMode} count={4} entity="competition" />
          ) : (
            <DashboardVirtualList
              viewMode={hotCompsViewMode}
              itemCount={hotComps.length}
              listRowComponent={CompetitionListRow}
              gridRowComponent={CompetitionGridRow}
              listRowProps={{ competitions: hotComps, viewMode: hotCompsListViewMode }}
              gridRowProps={{ competitions: hotComps }}
              compactRowHeight={getDashboardCompactRowHeightWithGap("competition")}
              cardRowHeight={getDashboardCardRowHeightWithGap("competition")}
            />
          )}
        </DashboardSection>
      )}

      {activeEntries.length === 0 && hotComps.length === 0 && !isLoading && (
        <DashboardEmptyCard
          icon={Zap}
          title={t("dashboard.home.readyToPlay")}
          description={t("dashboard.home.readyToPlayDesc")}
          action={{ label: t("dashboard.home.browseCompetitions"), href: "/competitions" }}
        />
      )}

      {referralData?.referralCode && (
        <Card className={dashboardCardClass()}>
          <CardHeader
            className={`${dashboardCardHeaderClass} flex flex-col gap-4 pb-5 sm:flex-row sm:items-start sm:pb-5`}
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-transparent">
              <Gift className="text-primary" aria-hidden="true" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <CardTitle className="text-sm">{t("dashboard.home.referFriends")}</CardTitle>
              <CardDescription>
                {t("dashboard.home.yourCode")}{" "}
                <span className="font-mono font-medium text-foreground">
                  {referralData.referralCode}
                </span>
                {profile?.referralMultiplier && profile.referralMultiplier > 1
                  ? ` · ${profile.referralMultiplier}× bonus`
                  : ""}
              </CardDescription>
            </div>
            <CardAction className="static self-start sm:ml-auto">
              <Link
                href="/dashboard/referrals"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
              >
                {t("dashboard.home.learnMore")}
              </Link>
            </CardAction>
          </CardHeader>
          <CardFooter className={`${dashboardCardFooterClass} border-border/50 pt-4 pb-5`}>
            <p className="text-xs text-muted-foreground">{t("dashboard.home.referFooter")}</p>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
