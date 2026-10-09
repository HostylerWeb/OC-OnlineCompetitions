import { createLogger } from "@oc/api-logger";
import type { CheckoutLineItem } from "@oc/api-tickets/load-cart";

export interface WalletTicketAllocation {
  competitionId: string;
  quantity: number;
}

export interface CheckoutItemWithWallet extends CheckoutLineItem {
  walletQty: number;
  paidQty: number;
}

export function mergeWalletIntoCheckoutItems(
  items: CheckoutLineItem[],
  walletTickets: WalletTicketAllocation[]
): CheckoutItemWithWallet[] {
  const walletByComp = new Map(walletTickets.map((w) => [w.competitionId, w.quantity]));
  const walletTicketsTotal = walletTickets.reduce((sum, w) => sum + w.quantity, 0);
  log.debug("[wallet.merge.enter]", {
    itemsCount: items.length,
    walletTicketsCount: walletTickets.length,
    walletTicketsTotal,
    walletBalance: walletByComp.size,
  });

  const result = items.map((item) => {
    const walletQty = Math.min(
      item.quantity,
      Math.max(0, walletByComp.get(item.competitionId) ?? 0)
    );
    log.debug("[wallet.merge.item]", {
      competitionId: item.competitionId,
      quantity: item.quantity,
      walletQty,
      paidQty: item.quantity - walletQty,
    });
    return {
      ...item,
      walletQty,
      paidQty: item.quantity - walletQty,
    };
  });

  log.debug("[wallet.merge.exit]", { outputItemsCount: result.length });
  return result;
}

export function totalWalletTickets(items: CheckoutItemWithWallet[]): number {
  return items.reduce((sum, i) => sum + i.walletQty, 0);
}

export async function computeMonetarySubtotal(
  items: CheckoutItemWithWallet[],
  priceByCompetitionId: Map<string, number>
): Promise<number> {
  let subtotal = 0;
  for (const item of items) {
    const price = priceByCompetitionId.get(item.competitionId);
    if (price == null) {
      throw new Error(`Competition ${item.competitionId} not found`);
    }
    subtotal += price * item.paidQty;
  }
  return subtotal;
}

const log = createLogger("wallet");
