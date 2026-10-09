"use client";

import { useAdminDashboardStats } from "@oc/api-admin";
import { Award, CreditCard, PoundSterling, ShoppingBag, Trophy, Users } from "@oc/icons";
import { OrderNumberCell } from "@oc/utils";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import type { ElementType } from "react";
import { PriceCell } from "@/components/admin/PriceCell";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { DataTable } from "@/components/DataTable";
import { PageShell } from "@/components/PageShell";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

interface QuickAction {
  href: string;
  icon: ElementType;
  label: string;
  description: string;
}

function QuickActionLink({ href, icon: Icon, label, description }: QuickAction) {
  const umamiEvent = `dashboard:quick-action-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <Button
      variant="outline"
      asChild
      data-umami-event={umamiEvent}
      className="h-auto w-full justify-start gap-3 border-border bg-card p-4 shadow-none hover:border-primary/40 hover:bg-accent"
    >
      <Link href={href}>
        <Icon className="size-4 shrink-0 text-primary" />
        <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="text-xs font-normal text-muted-foreground">{description}</span>
        </span>
      </Link>
    </Button>
  );
}

interface OrderRow {
  orderNumber: number;
  email: string;
  total: number;
  status: string;
}

interface WinnerRow {
  email: string;
  displayName?: string;
  competitionTitle: string;
  prizeValue: number;
  drawnAt: string;
}

export default function AdminDashboardPage() {
  const { data: statsResponse, isLoading } = useAdminDashboardStats();
  const stats = statsResponse?.data;

  const fmt = (n: number | undefined) =>
    isLoading ? "—" : (n ?? 0).toLocaleString("en-GB", { maximumFractionDigits: 0 });
  const fmtGBPKpi = (n: number | undefined) =>
    isLoading
      ? "—"
      : `£${(n ?? 0).toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;

  const quickActions: QuickAction[] = [
    {
      href: "/competitions?create=1",
      icon: Award,
      label: "New Competition",
      description: "Create prize draw",
    },
    {
      href: "/orders",
      icon: ShoppingBag,
      label: "Orders",
      description: "Track all orders",
    },
    {
      href: "/users",
      icon: Users,
      label: "Users",
      description: "Manage accounts",
    },
    {
      href: "/promo-codes",
      icon: Award,
      label: "Promo Codes",
      description: "Discount offers",
    },
    {
      href: "/livestream/draws",
      icon: Trophy,
      label: "Livestream",
      description: "Run draws",
    },
  ];

  const orderColumns: ColumnDef<OrderRow>[] = [
    {
      accessorKey: "orderNumber",
      header: "Order #",
      cell: ({ row }) => <OrderNumberCell value={row.original.orderNumber} />,
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => <span className="truncate">{row.original.email}</span>,
    },
    {
      accessorKey: "total",
      header: "Total",
      cell: ({ row }) => <PriceCell value={row.original.total} size="sm" />,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const variant =
          row.original.status === "completed" || row.original.status === "paid"
            ? "success"
            : row.original.status === "failed" || row.original.status === "refunded"
              ? "error"
              : row.original.status === "pending" || row.original.status === "processing"
                ? "warning"
                : "draft";
        return (
          <StatusBadge variant={variant} showIcon={false}>
            {row.original.status}
          </StatusBadge>
        );
      },
    },
  ];

  const winnerColumns: ColumnDef<WinnerRow>[] = [
    {
      accessorKey: "competitionTitle",
      header: "Competition",
      cell: ({ row }) => <span className="truncate">{row.original.competitionTitle}</span>,
    },
    {
      accessorKey: "displayName",
      header: "Winner",
      cell: ({ row }) => (
        <span className="truncate font-medium">
          {row.original.displayName || row.original.email}
        </span>
      ),
    },
    {
      accessorKey: "prizeValue",
      header: "Prize",
      cell: ({ row }) => <PriceCell value={row.original.prizeValue} size="sm" />,
    },
  ];

  return (
    <PageShell
      title="Command Center"
      description="Welcome back — here's your platform at a glance."
    >
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Revenue (30d)"
          value={fmtGBPKpi(stats?.totalRevenue)}
          description="Last 30 days"
          icon={PoundSterling}
          accent="primary"
        />
        <StatCard
          label="Monthly Revenue"
          value={fmtGBPKpi(stats?.monthlyRevenue)}
          description="This month"
          icon={CreditCard}
          accent="success"
        />
        <StatCard
          label="Total Prize Pool"
          value={fmtGBPKpi(stats?.totalPrizeValue)}
          description="All competitions"
          icon={Award}
        />
        <StatCard
          label="New Users"
          value={fmt(stats?.newUsersThisMonth)}
          description={`${fmt(stats?.totalUsers)} total`}
          icon={Users}
        />
        <StatCard
          label="Competitions"
          value={fmt(stats?.totalCompetitions)}
          description={`${fmt(stats?.activeCompetitions)} active`}
          icon={Trophy}
        />
        <StatCard
          label="Orders"
          value={fmt(stats?.totalOrders)}
          description={`${fmt(stats?.ticketsSold)} tickets sold`}
          icon={ShoppingBag}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-sm font-semibold text-foreground">Recent Orders</h2>
              <p className="text-xs text-muted-foreground">Latest customer orders</p>
            </div>
            <Button variant="ghost" size="sm" asChild data-umami-event="dashboard:view-all-orders">
              <Link href="/orders">View all</Link>
            </Button>
          </div>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col gap-3 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-5 w-16" shimmer />
                    <Skeleton className="h-5 w-32" shimmer />
                    <Skeleton className="h-5 w-16" shimmer />
                    <Skeleton className="h-5 w-20" shimmer />
                  </div>
                ))}
              </div>
            ) : (
              <DataTable<OrderRow>
                columns={orderColumns}
                data={(stats?.recentOrders ?? []) as OrderRow[]}
                isLoading={isLoading}
                searchPlaceholder=""
                emptyTitle="No recent orders"
                emptyDescription="Latest customer orders will appear here."
                enableColumnVisibility={false}
              />
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-5">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-sm font-semibold text-foreground">Recent Winners</h2>
              <p className="text-xs text-muted-foreground">Latest prize claimants</p>
            </div>
            <Button variant="ghost" size="sm" asChild data-umami-event="dashboard:view-all-winners">
              <Link href="/winners">View all</Link>
            </Button>
          </div>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col gap-3 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-5 w-24" shimmer />
                    <Skeleton className="h-5 w-28" shimmer />
                    <Skeleton className="h-5 w-16" shimmer />
                  </div>
                ))}
              </div>
            ) : (stats?.recentWinners?.length ?? 0) > 0 ? (
              <DataTable<WinnerRow>
                columns={winnerColumns}
                data={(stats?.recentWinners ?? []) as WinnerRow[]}
                isLoading={isLoading}
                searchPlaceholder=""
                emptyTitle="No winners yet"
                emptyDescription="Latest prize claimants will appear here."
                enableColumnVisibility={false}
              />
            ) : (
              <Empty className="border-0 py-8">
                <EmptyHeader>
                  <EmptyTitle>No winners yet</EmptyTitle>
                  <EmptyDescription>Latest prize claimants will appear here.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Quick Actions</h2>
          <p className="text-xs text-muted-foreground">Jump to common admin tasks</p>
        </div>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {quickActions.map((action) => (
              <QuickActionLink key={action.href} {...action} />
            ))}
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
