import type { Balance, BalanceTransaction } from "@oc/types";
import type { PageContextServer } from "vike/types";
import { serverFetch } from "@/lib/server-fetch";

export async function data(pageContext: PageContextServer) {
  const cookie = pageContext.headers?.cookie ?? "";

  const [balanceRes, transactionsRes] = await Promise.all([
    serverFetch<Balance>("/api/balance", { cookieHeader: cookie }),
    serverFetch<BalanceTransaction[]>("/api/balance/transactions?page=1&limit=20", {
      cookieHeader: cookie,
    }),
  ]);

  return {
    balance: balanceRes?.data ?? null,
    transactionsPage1: transactionsRes ?? null,
  };
}

export type Data = Awaited<ReturnType<typeof data>>;
