import type { Locale } from "./locales";
import { localeDefault, SUPPORTED_LOCALES } from "./locales";

export type { Locale } from "./locales";

export { localeDefault, SUPPORTED_LOCALES } from "./locales";

export function parseAcceptLanguage(header: string | undefined): Locale | null {
  if (!header) return null;

  const entries = header
    .split(",")
    .map((entry) => {
      const parts = entry.trim().split(";");
      const tag = parts[0]?.trim().split("-")[0] ?? "";
      const quality = parseFloat(
        parts.find((p) => p.trim().startsWith("q="))?.split("=")[1] ?? "1"
      );
      return { tag, quality: Number.isFinite(quality) ? quality : 1 };
    })
    .filter((e): e is { tag: Locale; quality: number } =>
      SUPPORTED_LOCALES.includes(e.tag as Locale)
    );

  entries.sort((a, b) => b.quality - a.quality);
  return entries[0]?.tag ?? null;
}

export function readCookie(name: string, cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return trimmed.slice(name.length + 1);
    }
  }
  return null;
}

export function detectLocale(
  cookieHeader: string | undefined,
  acceptLanguageHeader: string | undefined
): Locale {
  const cookieLocale = readCookie("onlinecompetitions-locale", cookieHeader);
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale;
  }
  const acceptLocale = parseAcceptLanguage(acceptLanguageHeader);
  if (acceptLocale) return acceptLocale;
  return localeDefault;
}

export function extractLocale(pathname: string): { locale: Locale | null; rest: string } {
  for (const loc of SUPPORTED_LOCALES) {
    if (pathname === `/${loc}` || pathname.startsWith(`/${loc}/`)) {
      const rest = pathname.slice(loc.length + 1) || "/";
      return { locale: loc, rest };
    }
  }
  return { locale: null, rest: pathname };
}
