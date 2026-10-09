import { runWithAffiliateContext } from "@oc/api-affiliate";
import type { Context, Next } from "hono";

const CLICK_ID_HEADER = "X-Affiliate-Clickid";
const SOURCE_HEADER = "X-Affiliate-Source";
const CLICK_ID_COOKIE = "_aff_clickid";
const SOURCE_COOKIE = "_aff_source";

function readCookie(c: Context, name: string): string | null {
  return (
    c.req
      .header("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? null
  );
}

export async function affiliateMiddleware(c: Context, next: Next): Promise<void> {
  const clickId = c.req.header(CLICK_ID_HEADER) ?? readCookie(c, CLICK_ID_COOKIE) ?? null;
  const source = c.req.header(SOURCE_HEADER) ?? readCookie(c, SOURCE_COOKIE) ?? null;
  await runWithAffiliateContext({ clickId, source }, next);
}
