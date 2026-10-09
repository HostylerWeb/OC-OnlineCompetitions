"use client";

import { format as dateFnsFormat } from "date-fns";
import { enGB, ro } from "date-fns/locale";
import { createContext, useCallback, useContext, useMemo } from "react";
import enData from "./en.json";
import type { Locale } from "./locales";
import { localeDefault, SUPPORTED_LOCALES } from "./locales";
import roData from "./ro.json";

type TranslationMap = typeof enData;
type NestedKeyOf<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends Record<string, unknown>
      ? NestedKeyOf<T[K], `${Prefix}${K}.`>
      : never;
}[keyof T & string];
export type TranslationKey = NestedKeyOf<TranslationMap>;

const localeMap: Record<string, Record<string, unknown>> = {
  en: enData as unknown as Record<string, unknown>,
  ro: roData as unknown as Record<string, unknown>,
};

// --- Romanian pluralization ---
//
// Romanian marks plural with word-specific forms (not a single suffix), so the
// "one" / "other" form for every word that precedes `{plural}` in ro.json is
// listed explicitly. Few/other always share the same form for these nouns, so a
// one-vs-other split is grammatically correct.

const RO_PLURAL_FORMS: Record<string, { one: string; other: string }> = {
  articol: { one: "articol", other: "articole" },
  actualizat: { one: "actualizat", other: "actualizate" },
  bilet: { one: "bilet", other: "bilete" },
  disponibil: { one: "disponibil", other: "disponibile" },
  premiu: { one: "premiu", other: "premii" },
  cumpărat: { one: "cumpărat", other: "cumpărate" },
  câștig: { one: "câștig", other: "câștiguri" },
  etapă: { one: "etapă", other: "etape" },
  extragere: { one: "extragere", other: "extrageri" },
  atinsă: { one: "atinsă", other: "atinse" },
  acordat: { one: "acordat", other: "acordate" },
  configurată: { one: "configurată", other: "configurate" },
  activ: { one: "activ", other: "active" },
  răscumpărabil: { one: "răscumpărabil", other: "răscumpărabili" },
  răscumpărat: { one: "răscumpărat", other: "răscumpărate" },
  rămas: { one: "rămas", other: "rămase" },
};

function getTranslationsSync(locale: string): Record<string, unknown> {
  return localeMap[locale] ?? localeMap.en ?? {};
}

function resolveKey(obj: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

/**
 * Coerce a plural-driving value to a number, tolerating locale-formatted
 * strings. `Number("1,000")` is NaN and `Number("1.000")` is 1 (ro-RO grouping
 * separator), both of which break `Intl.PluralRules.select()`. Grouping
 * separators are stripped per locale before parsing.
 */
function toPluralNumber(value: string | number | undefined, locale?: string): number {
  if (value === undefined) return NaN;
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const str = String(value).trim();
  if (!str) return NaN;
  const normalized =
    locale === "ro" ? str.replace(/\./g, "").replace(/,/g, ".") : str.replace(/,/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function interpolate(
  template: string,
  params?: Record<string, string | number>,
  locale?: string
): string {
  if (!params) return template;

  const loc = locale ?? "en";

  // Resolve {plural} with locale-aware plural rules
  const hasPluralDriver = params.count !== undefined || params.n !== undefined;
  const count = toPluralNumber(params.count !== undefined ? params.count : params.n, loc);

  if (hasPluralDriver && Number.isFinite(count)) {
    const rules = new Intl.PluralRules(loc);
    const category = rules.select(count);

    if (loc === "ro") {
      // Romanian: word-specific plural forms
      template = template.replace(/([^\s{]+)\{plural\}/g, (_match, word: string) => {
        const forms = RO_PLURAL_FORMS[String(word).toLowerCase()];
        if (!forms) return word;
        return category === "one" ? forms.one : forms.other;
      });
    } else {
      // English and other locales: simple "s" suffix
      template = template.replace(/\{plural\}/g, category === "one" ? "" : "s");
    }
  }

  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

export function translate(
  key: TranslationKey,
  params?: Record<string, string | number>,
  locale?: string
): string {
  const loc = locale ?? "en";
  const dict = getTranslationsSync(loc);
  const value = resolveKey(dict, key);

  if (typeof value === "string") return interpolate(value, params, loc);
  if (value !== undefined) return value as unknown as string;

  const enDict = getTranslationsSync("en");
  const fallback = resolveKey(enDict, key);
  if (typeof fallback === "string") return interpolate(fallback, params, loc);
  if (fallback !== undefined) return fallback as unknown as string;

  return key;
}

interface LocaleContextValue {
  locale: string;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  setLocale: (locale: string) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  t: (key) => key,
  setLocale: () => {},
});

export function setLocaleCookie(locale: string): void {
  document.cookie = `onlinecompetitions-locale=${locale};path=/;max-age=${365 * 24 * 60 * 60};SameSite=Lax`;
}

export function getLocaleCookie(): string | null {
  if (typeof window === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)onlinecompetitions-locale=([^;]*)/);
  return match ? (match[1] ?? null) : null;
}

/**
 * Resolve the initial locale for the app: persisted cookie first, then the
 * browser language, then the default.
 */
export function resolveInitialLocale(): Locale {
  const cookieLocale = getLocaleCookie();
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale;
  }
  if (typeof navigator !== "undefined") {
    const navLang = (navigator.language ?? "").split("-")[0];
    if (navLang && SUPPORTED_LOCALES.includes(navLang as Locale)) {
      return navLang as Locale;
    }
  }
  return localeDefault;
}

export function LocaleProvider({
  locale: initialLocale = "en",
  children,
}: {
  locale?: string;
  children: React.ReactNode;
}) {
  const locale = initialLocale;

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) =>
      translate(key, params, locale),
    [locale]
  );

  const setLocale = useCallback((newLocale: string) => {
    if (!SUPPORTED_LOCALES.includes(newLocale as Locale)) return;
    setLocaleCookie(newLocale);
    window.location.reload();
  }, []);

  const value = useMemo(() => ({ locale, t, setLocale }), [locale, t, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useTranslation() {
  return useContext(LocaleContext);
}

export function localeHref(path: string, _locale?: string): string {
  return path;
}

export function useLogicalPathname(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname;
}

const currencyConfig = {
  en: { locale: "en-GB", currency: "GBP" },
  ro: { locale: "en-GB", currency: "GBP" },
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
  const localeStr = loc === "ro" ? "ro-RO" : "en-GB";
  return value.toLocaleString(localeStr);
}

const dateLocaleModules = { en: enGB, ro };

export function formatDate(date: Date | string, pattern?: string, locale?: string): string {
  const loc = (locale ?? "en") as keyof typeof dateLocaleModules;
  const d = typeof date === "string" ? new Date(date) : date;
  const fmt = pattern ?? "EEE, d MMM yyyy";
  const localeModule = dateLocaleModules[loc] ?? enGB;
  return dateFnsFormat(d, fmt, { locale: localeModule });
}
