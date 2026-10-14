import { redirect } from "vike/abort";
import type { PageContextServer } from "vike/types";
import { skipIfVerified } from "@/lib/guard";

function localeHref(path: string, pageContext: PageContextServer): string {
  const locale = (pageContext.locale as string) ?? "en";
  return `/${locale}${path.startsWith("/") ? path : `/${path}`}`;
}

export const guard = (pageContext: PageContextServer) => {
  const { urlParsed } = pageContext;
  skipIfVerified(pageContext);
  const email = urlParsed.search?.email;
  if (!email) {
    throw redirect(localeHref("/auth/login?mode=sign-up", pageContext));
  }
};
