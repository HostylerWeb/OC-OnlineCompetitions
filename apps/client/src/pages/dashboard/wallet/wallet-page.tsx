"use client";

import { useBalance, useInfiniteMyBalanceTransactions } from "@oc/api-client";
import { Wallet } from "@oc/icons";
import type { BalanceTransaction } from "@oc/types";
import { useMemo } from "react";
import { useData } from "vike-react/useData";
import {
  DashboardPageHeader,
  DashboardSection,
  dashboardCardClass,
  dashboardCardContentClass,
  dashboardCardHeaderClass,
} from "@/components/dashboard";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, useTranslation } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import type { Data } from "./+data";

const CREDIT_TYPES: BalanceTransaction["type"][] = [
  "top_up",
  "purchase_refund",
  "admin_credit",
  "withdraw_reversed",
];

function isCreditType(type: BalanceTransaction["type"]) {
  return CREDIT_TYPES.includes(type);
}

function transactionAmountDisplay(
  tx: BalanceTransaction,
  format: (amount: number) => string
): { text: string; className: string } {
  const credit = isCreditType(tx.type);
  const prefix = credit ? "+" : "−";
  return {
    text: `${prefix}${format(tx.amount)}`,
    className: credit ? "text-emerald-500" : "text-foreground",
  };
}

export default function DashboardWalletView() {
  const { t, locale } = useTranslation();
  const data = useData<Data>();

  const transactionsInitial =
    data?.transactionsPage1?.data?.length != null
      ? {
          pages: [data.transactionsPage1],
          pageParams: [1],
        }
      : undefined;

  const { data: balanceRes, isLoading: balanceLoading } = useBalance(
    data?.balance ? { initialData: { data: data.balance } } : undefined
  );
  const balance = balanceRes?.data ?? data?.balance ?? null;
  const currency = balance?.currency ?? "GBP";

  const {
    data: txPages,
    isLoading: txLoading,
    isError: txError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteMyBalanceTransactions(20, { initialData: transactionsInitial });

  const transactions = useMemo(
    () => (txPages?.pages ?? []).flatMap((p) => p.data ?? []),
    [txPages]
  );

  const formatAmount = (amount: number) => formatCurrency(amount, locale, currency);

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHeader
        title={t("dashboard.wallet.heading")}
        subtitle={t("dashboard.wallet.subtitle")}
      />

      <Card className={dashboardCardClass()}>
        <CardHeader className={dashboardCardHeaderClass}>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Wallet className="size-4 text-muted-foreground" aria-hidden="true" />
            {t("dashboard.wallet.siteCreditWallet")}
          </CardTitle>
          <CardDescription className="text-sm">{t("dashboard.wallet.walletDesc")}</CardDescription>
        </CardHeader>
        <CardContent className={`${dashboardCardContentClass} grid gap-3 sm:grid-cols-2`}>
          {balanceLoading && !balance ? (
            <>
              <Skeleton className="h-[76px] w-full" shimmer />
              <Skeleton className="h-[76px] w-full" shimmer />
            </>
          ) : (
            <>
              <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-3">
                <p className="text-sm text-muted-foreground">{t("dashboard.wallet.available")}</p>
                <p className="text-3xl font-semibold tabular-nums">
                  {formatAmount(balance?.available ?? 0)}
                </p>
              </div>
              {(balance?.pending ?? 0) > 0 ? (
                <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-3">
                  <p className="text-sm text-muted-foreground">{t("dashboard.wallet.pending")}</p>
                  <p className="text-3xl font-semibold tabular-nums">
                    {formatAmount(balance?.pending ?? 0)}
                  </p>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <DashboardSection title={t("dashboard.wallet.historyTitle")}>
        {txLoading && transactions.length === 0 ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" shimmer />
            <Skeleton className="h-10 w-full" shimmer />
            <Skeleton className="h-10 w-full" shimmer />
          </div>
        ) : txError ? (
          <Card className={dashboardCardClass()}>
            <CardContent className={`${dashboardCardContentClass} flex flex-col items-center gap-3 py-10`}>
              <p className="text-sm font-medium">{t("dashboard.wallet.failedToLoad")}</p>
              <p className="text-sm text-muted-foreground">{t("dashboard.wallet.failedToLoadDesc")}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
                {t("dashboard.wallet.retry")}
              </Button>
            </CardContent>
          </Card>
        ) : transactions.length === 0 ? (
          <Empty className="border border-dashed border-border/70 bg-muted/10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Wallet className="size-5" aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t("dashboard.wallet.noTransactions")}</EmptyTitle>
              <EmptyDescription>{t("dashboard.wallet.noTransactionsDesc")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("dashboard.wallet.dateHeader")}</TableHead>
                    <TableHead>{t("dashboard.wallet.typeHeader")}</TableHead>
                    <TableHead>{t("dashboard.wallet.statusHeader")}</TableHead>
                    <TableHead className="text-right">{t("dashboard.wallet.amountHeader")}</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      {t("dashboard.wallet.balanceAfterHeader")}
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      {t("dashboard.wallet.noteHeader")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => {
                    const amount = transactionAmountDisplay(tx, formatAmount);
                    return (
                      <TableRow key={tx._id}>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatDate(tx.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {t(`dashboard.wallet.transactionTypes.${tx.type}`)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {t(`dashboard.wallet.statusLabels.${tx.status}`)}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`text-right text-sm font-medium tabular-nums ${amount.className}`}
                        >
                          {amount.text}
                        </TableCell>
                        <TableCell className="hidden text-right text-sm tabular-nums sm:table-cell">
                          {formatAmount(tx.balanceAfter)}
                        </TableCell>
                        <TableCell className="hidden max-w-[200px] truncate text-sm text-muted-foreground md:table-cell">
                          {tx.note?.trim() || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {hasNextPage ? (
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isFetchingNextPage}
                  onClick={() => void fetchNextPage()}
                >
                  {isFetchingNextPage
                    ? t("dashboard.wallet.loadingMore")
                    : t("dashboard.wallet.loadMore")}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </DashboardSection>
    </div>
  );
}
