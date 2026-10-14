import { redirect } from "vike/abort";
import type { PageContextServer } from "vike/types";

function localeHref(path: string, pageContext: PageContextServer): string {
  const locale = (pageContext.locale as string) ?? "en";
  return `/${locale}${path.startsWith("/") ? path : `/${path}`}`;
}

function buildLoginRedirect(pageContext: PageContextServer): string {
  const search = new URLSearchParams();
  const raw = pageContext.urlParsed.search;
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const v of value) search.append(key, String(v));
    } else {
      search.set(key, String(value));
    }
  }
  if (!search.has("mode")) {
    search.set("mode", "sign-up");
  }
  const qs = search.toString();
  return qs ? `/auth/login?${qs}` : "/auth/login?mode=sign-up";
}

export async function data(pageContext: PageContextServer) {
  throw redirect(localeHref(buildLoginRedirect(pageContext), pageContext));
}

export type Data = never;
