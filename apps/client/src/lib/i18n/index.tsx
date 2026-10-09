"use client";

import { format as dateFnsFormat } from "date-fns";
import { enGB } from "date-fns/locale";
import { createContext, useContext } from "react";
import { navigate } from "vike/client/router";
import { usePageContext } from "vike-react/usePageContext";
import enData from "./en.json";
import type { Locale } from "./locales";
import { SUPPORTED_LOCALES } from "./locales";

import { interpolate } from "./interpolate";

// --- Type helpers ---

type TranslationMap = typeof enData;
type NestedKeyOf<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends Record<string, unknown>
      ? NestedKeyOf<T[K], `${Prefix}${K}.`>
      : never;
}[keyof T & string];
export type TranslationKey = NestedKeyOf<TranslationMap>;

// --- Cache ---

const localeMap: Record<string, Record<string, unknown>> = {
  en: enData as unknown as Record<string, unknown>,
};

const localeCache = new Map<string, Record<string, unknown>>();
for (const [key, data] of Object.entries(localeMap)) {
  localeCache.set(key, data);
}

export function setLocaleData(locale: string, data: Record<string, unknown>): void {
  localeMap[locale] = data;
  localeCache.set(locale, data);
}

export async function loadLocaleData(locale: string): Promise<Record<string, unknown>> {
  if (localeCache.has(locale)) return localeCache.get(locale)!;
  const data = await import(`./${locale}.json`);
  localeCache.set(locale, data.default);
  return data.default;
}

function getTranslationsSync(locale: string): Record<string, unknown> {
  return (localeMap[locale] ?? localeMap.en) as Record<string, unknown>;
}

function resolveKey(obj: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

// --- Pure translate function ---

export function translate(
  key: TranslationKey,
  params?: Record<string, string | number>,
  locale?: string
): string {
  const loc = locale ?? "en";
  const dict = getTranslationsSync(loc);
  const value = resolveKey(dict, key);

  if (typeof value === "string") {
    return interpolate(value, params, loc);
  }

  if (value !== undefined) {
    return value as unknown as string;
  }

  const enDict = getTranslationsSync("en");
  const fallback = resolveKey(enDict, key);
  if (typeof fallback === "string") {
    return interpolate(fallback, params, loc);
  }

  if (fallback !== undefined) {
    return fallback as unknown as string;
  }

  return key;
}

// --- React hook ---

export function useTranslation() {
  const pageContext = usePageContext();
  const locale = (pageContext.locale as string) ?? "en";

  const t = (key: TranslationKey, params?: Record<string, string | number>) =>
    translate(key, params, locale);

  const setLocale = (newLocale: string) => {
    if (!SUPPORTED_LOCALES.includes(newLocale as Locale)) return;
    setLocaleCookie(newLocale);
    const currentPath = getLogicalPathname(window.location.pathname, locale);
    void navigate(localeHref(currentPath, newLocale) + window.location.search);
  };

  return { t, locale, setLocale };
}

// --- Cookie ---

export function setLocaleCookie(locale: string): void {
  document.cookie = `onlinecompetitions-locale=${locale};path=/;max-age=${365 * 24 * 60 * 60};SameSite=Lax`;
}

export function getLocaleCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)onlinecompetitions-locale=([^;]*)/);
  return match ? (match[1] ?? null) : null;
}

// --- Context ---

const LocaleContext = createContext<{ locale: string }>({ locale: "en" });

export function LocaleProvider({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={{ locale }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

// --- Pluralization ---

/**
 * Pluralize a word using Intl.PluralRules.
 * @param count The number to pluralize for
 * @param forms Object with `one`, `few` (optional), `other` forms of the word
 * @param locale Locale string (e.g., "en", "ro")
 */
export function pluralize(
  count: number,
  forms: { one: string; few?: string; other: string },
  locale?: string
): string {
  const rules = new Intl.PluralRules(locale ?? "en");
  const category = rules.select(count);
  return forms[category as keyof typeof forms] ?? forms.other;
}

// --- URL helpers ---

/** Prefix a path with locale, stripping any existing locale prefix first. */
export function localeHref(path: string, locale?: string): string {
  const loc = locale ?? "en";
  for (const supported of SUPPORTED_LOCALES) {
    const prefix = `/${supported}`;
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      path = path.slice(prefix.length) || "/";
      break;
    }
  }
  return `/${loc}${path.startsWith("/") ? path : `/${path}`}`;
}

/** @deprecated Use localeHref() which always prefixes. */
export function localePrefix(path: string, locale?: string): string {
  return localeHref(path, locale);
}

/**
 * Return the logical (un-prefixed) pathname, stripping the locale prefix
 * from the raw browser URL if needed.
 */
export function getLogicalPathname(urlPathname: string, locale: string): string {
  const prefix = `/${locale}`;
  if (urlPathname === prefix) return "/";
  if (urlPathname.startsWith(`${prefix}/`)) return urlPathname.slice(prefix.length);
  return urlPathname;
}

/** React hook: returns the logical pathname (locale prefix stripped). */
export function useLogicalPathname(): string {
  const pageContext = usePageContext();
  const urlLogical = (pageContext as any).urlLogical as string | undefined;
  if (urlLogical) return urlLogical;
  const locale = (pageContext.locale as string) ?? "en";
  const urlPathname = pageContext.urlPathname;
  return getLogicalPathname(urlPathname, locale);
}

// --- Formatters ---

const currencyConfig = {
  en: { locale: "en-GB", currency: "GBP" },
};

export function formatCurrency(amount: number, locale?: string, currency?: string): string {
  const loc = (locale ?? "en") as keyof typeof currencyConfig;
  const config = currencyConfig[loc] ?? currencyConfig.en;
  const resolvedCurrency = currency ?? config.currency;
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: resolvedCurrency,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(value: number, locale?: string): string {
  const loc = locale ?? "en";
  return value.toLocaleString("en-GB");
}

const dateLocaleModules = {
  en: enGB,
};

export function formatDate(date: Date | string, pattern?: string, locale?: string): string {
  const loc = (locale ?? "en") as keyof typeof dateLocaleModules;
  const d = typeof date === "string" ? new Date(date) : date;
  const fmt = pattern ?? "EEE, d MMM yyyy";
  const localeModule = dateLocaleModules[loc] ?? enGB;
  return dateFnsFormat(d, fmt, { locale: localeModule });
}
