import type { PageContext } from "vike/types";
import { detectLocale, extractLocale, SUPPORTED_LOCALES } from "@/lib/i18n/locale-detection";

export function onBeforeRoute(pageContext: PageContext) {
  const pathname = pageContext.urlParsed.pathname;
  const searchOriginal = pageContext.urlParsed.searchOriginal ?? "";

  if (pathname === "/ro" || pathname.startsWith("/ro/")) {
    const rest = pathname === "/ro" ? "" : pathname.slice(3);
    return {
      pageContext: {
        redirect: `/en${rest || "/"}${searchOriginal}`,
      },
    };
  }

  // Self-healing: detect and fix double-locale URLs (e.g. /en/en/auth/login → /en/auth/login)
  for (const loc of SUPPORTED_LOCALES) {
    const doublePrefix = `/${loc}/${loc}`;
    if (pathname === doublePrefix || pathname.startsWith(`${doublePrefix}/`)) {
      const fixedUrl = `/${loc}${pathname.slice(doublePrefix.length)}${searchOriginal}`;
      return { pageContext: { redirect: fixedUrl } };
    }
  }

  if (pageContext.isClientSide && pageContext.locale) {
    return;
  }

  const { locale, rest } = extractLocale(pathname);

  if (!locale) {
    const targetLocale = detectLocale(
      pageContext.headers?.cookie,
      pageContext.headers?.["accept-language"]
    );
    if (!pageContext.isClientSide) {
      const redirectUrl = `/${targetLocale}${pathname}${searchOriginal}`;
      return {
        pageContext: {
          redirect: redirectUrl,
        },
      };
    }
    return {
      pageContext: {
        locale: targetLocale,
      },
    };
  }

  return {
    pageContext: {
      locale,
      urlLogical: rest + searchOriginal,
    },
  };
}
