"use client";

import {
  useAuth,
  useCartOrchestrator,
  useCartWallet,
  useIsApplyingCartMutation,
} from "@oc/api-client";
import { Minus, Plus, Ticket } from "@oc/icons";
import type { CartWalletTicket } from "@oc/types";
import { cn } from "@oc/utils";
import { useCallback, useMemo } from "react";
import { GoldOutlineButton } from "@/components/buttons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, useTranslation } from "@/lib/i18n";

interface WalletLineItem {
  competitionId: string;
  competitionTitle: string;
  quantity: number;
  maxPerLine: number;
}

function getWalletQty(allocations: CartWalletTicket[], competitionId: string): number {
  return allocations.find((entry) => entry.competitionId === competitionId)?.quantity ?? 0;
}

function buildAllocations(
  current: CartWalletTicket[],
  competitionId: string,
  quantity: number
): CartWalletTicket[] {
  const next = current.filter((entry) => entry.competitionId !== competitionId);
  if (quantity > 0) {
    next.push({ competitionId, quantity });
  }
  return next;
}

interface WalletLineStepperProps {
  applied: number;
  maxForLine: number;
  competitionTitle: string;
  isBusy: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
}

function WalletLineStepper({
  applied,
  maxForLine,
  isBusy,
  onDecrement,
  onIncrement,
}: WalletLineStepperProps) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg border px-1 py-1",
        applied > 0 ? "border-gold/30 bg-gold/5" : "border-border/60 bg-background/60"
      )}
      role="group"
    >
      <GoldOutlineButton
        size="icon"
        className="h-8 w-8 shrink-0 rounded-full"
        disabled={isBusy || applied <= 0}
        onClick={onDecrement}
      >
        <Minus className="size-3.5" />
      </GoldOutlineButton>

      <div className="flex min-w-[3.5rem] flex-1 flex-col items-center justify-center px-1 py-0.5">
        <span className="text-base font-semibold tabular-nums leading-none">{applied}</span>
        <span className="mt-0.5 text-[10px] leading-none text-muted-foreground">
          {t("checkout.walletOf", { n: maxForLine })}
        </span>
      </div>

      <GoldOutlineButton
        size="icon"
        className="h-8 w-8 shrink-0 rounded-full"
        disabled={isBusy || applied >= maxForLine}
        onClick={onIncrement}
      >
        <Plus className="size-3.5" />
      </GoldOutlineButton>
    </div>
  );
}

export interface ReferralWalletTicketControlsProps {
  items: WalletLineItem[];
}

export function ReferralWalletTicketControls({ items }: ReferralWalletTicketControlsProps) {
  const { t } = useTranslation();
  const { user, isAnonymous } = useAuth();
  const { data: wallet } = useCartWallet({ enabled: !!user });
  const walletTicketsByCompetition = wallet?.allocations ?? [];
  const cartLoading = useIsApplyingCartMutation();
  const { applyWalletAllocations, isProcessing: orchestratorProcessing } = useCartOrchestrator();

  const walletBalance = wallet?.balance ?? 0;

  const totalApplied = useMemo(
    () => walletTicketsByCompetition.reduce((sum, entry) => sum + entry.quantity, 0),
    [walletTicketsByCompetition]
  );

  const remainingBalance = Math.max(0, walletBalance - totalApplied);

  const applyAllocation = useCallback(
    (nextAllocations: CartWalletTicket[]) => {
      applyWalletAllocations(nextAllocations);
    },
    [applyWalletAllocations]
  );

  if (!user || isAnonymous) return null;
  if (!wallet) return null;
  if (walletBalance <= 0 && totalApplied <= 0) return null;

  const isBusy = cartLoading || orchestratorProcessing;

  return (
    <Card className="border-gold/20 shadow-none">
      <CardHeader className="space-y-3 pb-3">
        <div className="space-y-1.5">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base leading-snug">
            <Ticket className="size-4 shrink-0 text-gold" aria-hidden="true" />
            <span className="whitespace-nowrap">{t("checkout.referralTicketsWallet")}</span>
          </CardTitle>
          <Badge
            variant="outline"
            className="w-fit border-gold/30 bg-gold/5 px-2 py-0.5 text-[11px] font-semibold text-gold"
          >
            {t("checkout.walletAvailable", { n: formatNumber(walletBalance) })}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-border/60 bg-muted/20 px-2.5 py-2">
            <p className="text-[11px] text-muted-foreground">{t("checkout.walletRemaining")}</p>
            <p className="text-lg font-semibold tabular-nums leading-tight">
              {formatNumber(remainingBalance)}
            </p>
          </div>
          <div className="rounded-md border border-border/60 bg-muted/20 px-2.5 py-2">
            <p className="text-[11px] text-muted-foreground">{t("checkout.walletAppliedHere")}</p>
            <p
              className={cn(
                "text-lg font-semibold tabular-nums leading-tight",
                totalApplied > 0 ? "text-green-400" : "text-foreground"
              )}
            >
              {formatNumber(totalApplied)}
            </p>
          </div>
        </div>

        <CardDescription className="text-xs leading-relaxed">
          {t("checkout.walletDescription")}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {items.map((item) => {
          const applied = getWalletQty(walletTicketsByCompetition, item.competitionId);
          const maxForLine = Math.min(item.quantity, item.maxPerLine, applied + remainingBalance);

          return (
            <div
              key={item.competitionId}
              className="space-y-2.5 rounded-lg border border-border/60 bg-muted/10 p-3"
            >
              <div className="space-y-1.5">
                <p className="text-sm font-medium leading-snug break-words [overflow-wrap:anywhere] line-clamp-3">
                  {item.competitionTitle}
                </p>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {t("checkout.walletHint", {
                    n: formatNumber(maxForLine),
                  })}
                </p>
              </div>

              <WalletLineStepper
                applied={applied}
                maxForLine={maxForLine}
                competitionTitle={item.competitionTitle}
                isBusy={isBusy}
                onDecrement={() =>
                  applyAllocation(
                    buildAllocations(walletTicketsByCompetition, item.competitionId, applied - 1)
                  )
                }
                onIncrement={() =>
                  applyAllocation(
                    buildAllocations(walletTicketsByCompetition, item.competitionId, applied + 1)
                  )
                }
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
