"use client";

import {
  useApplyCartWallet,
  useAuth,
  useCartItems,
  useCartWallet,
  useIsApplyingCartMutation,
  useMyReferralTickets,
} from "@oc/api-client";
import { Ticket } from "@oc/icons";
import { useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatNumber, useTranslation } from "@/lib/i18n";

export function WalletTicketsPanel() {
  const { t } = useTranslation();
  const { user, isAnonymous } = useAuth();
  const enabled = !!user && !isAnonymous;
  const { data: walletResponse } = useMyReferralTickets({ enabled });
  const walletBalance = walletResponse?.data?.walletBalance ?? 0;

  const dnaSessionActive = false;

  const { data: items = [], isPending: itemsPending } = useCartItems({ enabled });
  const { data: wallet, isPending: walletPending } = useCartWallet({ enabled });
  const walletTicketsByCompetition = wallet?.allocations ?? [];
  const cartWalletBalance = wallet?.balance ?? 0;

  const applyWallet = useApplyCartWallet();
  const isApplyingCartMutation = useIsApplyingCartMutation();

  const [walletError, setWalletError] = useState<string | null>(null);

  const walletByComp = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of walletTicketsByCompetition) {
      map.set(w.competitionId, w.quantity);
    }
    return map;
  }, [walletTicketsByCompetition]);

  const totalApplied = walletTicketsByCompetition.reduce((s, w) => s + w.quantity, 0);
  const available = cartWalletBalance || walletBalance;
  const locked = dnaSessionActive;
  const isWalletLoading = itemsPending || walletPending;

  if (!isWalletLoading && available <= 0) return null;

  const updateAllocation = async (competitionId: string, quantity: number) => {
    if (locked) return;
    setWalletError(null);
    const next = items
      .map((item) => ({
        competitionId: item.competitionId,
        quantity:
          item.competitionId === competitionId
            ? Math.max(0, Math.min(quantity, item.quantity))
            : (walletByComp.get(item.competitionId) ?? 0),
      }))
      .filter((a) => a.quantity > 0);
    try {
      await applyWallet.mutateAsync({ walletTicketsByCompetition: next });
    } catch (err: unknown) {
      setWalletError(err instanceof Error ? err.message : t("checkout.walletUpdateError"));
    }
  };

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 px-4 py-3"
      data-focus="wallet"
    >
      <div className="flex items-center gap-2">
        <Ticket className="size-4 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium">{t("checkout.referralTicketsWallet")}</p>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("checkout.walletAvailable", { n: formatNumber(available) })}
        {locked ? ` · ${t("checkout.walletLocked")}` : ""}
      </p>

      {walletError ? (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-xs">{walletError}</AlertDescription>
        </Alert>
      ) : null}

      {items.map((item) => {
        const applied = walletByComp.get(item.competitionId) ?? 0;
        const max = Math.min(item.quantity, available - totalApplied + applied);
        return (
          <div
            key={item.competitionId}
            className="flex flex-wrap items-center justify-between gap-2 text-sm"
          >
            <span className="min-w-0 truncate text-muted-foreground">{item.competitionTitle}</span>
            <div className="flex items-center gap-2">
              <Label className="sr-only" htmlFor={`wallet-${item.competitionId}`}>
                {t("checkout.walletTicketsFor", { title: item.competitionTitle })}
              </Label>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={isApplyingCartMutation || locked || applied <= 0}
                onClick={() => void updateAllocation(item.competitionId, applied - 1)}
                aria-label={t("checkout.removeOneWalletTicket")}
              >
                −
              </Button>
              <span
                className="w-8 text-center font-mono tabular-nums"
                id={`wallet-${item.competitionId}`}
              >
                {applied}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={isApplyingCartMutation || locked || applied >= max}
                onClick={() => void updateAllocation(item.competitionId, applied + 1)}
                aria-label={t("checkout.addOneWalletTicket")}
              >
                +
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
