import { redirect } from "vike/abort";
import type { PageContextServer } from "vike/types";
import { skipIfVerified } from "@/lib/guard";

function localeHref(path: string, pageContext: PageContextServer): string {
  const locale = (pageContext.locale as string) ?? "en";
  return `/${locale}${path.startsWith("/") ? path : `/${path}`}`;
}

export const guard = (pageContext: PageContextServer) => {
  skipIfVerified(pageContext);

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
  throw redirect(localeHref(qs ? `/auth/login?${qs}` : "/auth/login?mode=sign-up", pageContext));
};
