import { flushSentry, initSentry } from "@oc/api-infra/sentry";
import { shopApiApp, type ShopApiApp } from "@/lib/shop-api-app";
import { handle } from "hono/vercel";

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  flushSentry(2_000).finally(() => process.exit(1));
});

initSentry();

export type AppType = ShopApiApp;

const h = handle(shopApiApp);
export const GET = h;
export const POST = h;
export const PUT = h;
export const DELETE = h;
export const PATCH = h;
export const HEAD = h;
export const OPTIONS = h;
