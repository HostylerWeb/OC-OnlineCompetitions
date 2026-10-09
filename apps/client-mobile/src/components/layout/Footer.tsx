"use client";

import {
  CARD_BRAND_COMPONENT,
  CARD_BRANDS,
  ChevronDown,
  Smartphone,
  SocialLinksIconButtons,
} from "@oc/icons";
import { cn, getFooterCopyright } from "@oc/utils";
import { useEffect, useState } from "react";
import { Link } from "@/components/Link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type TranslationKey, useTranslation } from "@/lib/i18n";

const DISMISS_KEY = "pwa-install-dismissed-v2";
const RESHOW_EVENT = "pwa-install-reshow";
const RESHOW_MS = 30 * 24 * 60 * 60 * 1000;

function readDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const parsed: { at?: number } = JSON.parse(raw);
    if (typeof parsed?.at !== "number") return false;
    return Date.now() - parsed.at < RESHOW_MS;
  } catch {
    return false;
  }
}

function getQuickLinks(
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
) {
  return [
    {
      href: "/competitions",
      label: t("header.nav.competitions"),
      umami: "footer:competitions-click",
    },
    { href: "/entries", label: t("header.nav.entries"), umami: "footer:entries-click" },
    { href: "/winners", label: t("header.nav.winners"), umami: "footer:winners-click" },
    {
      href: "/how-it-works",
      label: t("header.nav.howItWorks"),
      umami: "footer:how-it-works-click",
    },
    { href: "/about", label: t("footer.aboutUs"), umami: "footer:about-click" },
  ] as const;
}

function getSupportLinks(
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
) {
  return [
    { href: "/faq", label: t("footer.faq"), umami: "footer:faq-click" },
    { href: "/contact", label: t("footer.contactUs"), umami: "footer:contact-click" },
  ] as const;
}

function getLegalLinks(
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
) {
  return [
    { href: "/terms", label: t("footer.termsOfService"), umami: "footer:terms-click" },
    { href: "/privacy", label: t("footer.privacyPolicy"), umami: "footer:privacy-click" },
    {
      href: "/cookie-policy",
      label: t("footer.cookiePolicy"),
      umami: "footer:cookie-policy-click",
    },
    {
      href: "/free-postal-entry",
      label: t("footer.freePostalEntry"),
      umami: "footer:free-postal-entry-click",
    },
  ] as const;
}

function FooterColumn({
  heading,
  links,
}: {
  heading: string;
  links: ReadonlyArray<{ href: string; label: string; umami: string }>;
}) {
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-foreground mb-4 tracking-wide">{heading}</h3>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-muted-foreground hover:text-gold transition-colors"
              data-umami-event={link.umami}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PaymentLogos() {
  const { t } = useTranslation();
  return (
    <div
      className="flex items-center justify-center gap-2"
      role="img"
      aria-label={t("footer.acceptedPayments")}
    >
      {CARD_BRANDS.map((brand) => {
        const Icon = CARD_BRAND_COMPONENT[brand];
        const isTall = brand === "google-pay" || brand === "apple-pay";
        return <Icon key={brand} className={isTall ? "h-10" : "h-6"} />;
      })}
    </div>
  );
}

export function Footer() {
  const { t, locale, setLocale } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setDismissed(readDismissed());
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    const reshowHandler = () => setDismissed(readDismissed());
    const dismissHandler = () => setDismissed(readDismissed());
    const installedHandler = () => setInstalled(true);
    window.addEventListener(RESHOW_EVENT, reshowHandler);
    window.addEventListener("pwa-install-dismiss", dismissHandler);
    window.addEventListener("pwa-installed", installedHandler);
    return () => {
      window.removeEventListener(RESHOW_EVENT, reshowHandler);
      window.removeEventListener("pwa-install-dismiss", dismissHandler);
      window.removeEventListener("pwa-installed", installedHandler);
    };
  }, []);

  function reEnablePrompt() {
    localStorage.removeItem(DISMISS_KEY);
    window.dispatchEvent(new CustomEvent(RESHOW_EVENT));
  }

  const year = new Date().getFullYear();
  const QUICK_LINKS = getQuickLinks(t);
  const SUPPORT_LINKS = getSupportLinks(t);
  const LEGAL_LINKS = getLegalLinks(t);

  return (
    <footer
      className={cn(
        "mt-auto border-t border-border bg-card/40 backdrop-blur-sm",
        "text-foreground"
      )}
    >
      <div className="oc-container-wide py-10 sm:py-14">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div className="min-w-0 space-y-4 sm:col-span-2 lg:col-span-1">
            <Link
              href="/"
              className="inline-flex items-center text-xl font-bold text-gold hover:brightness-110 transition-all"
              data-umami-event="footer:logo-click"
            >
              Online Competitions
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              {t("footer.companyDescription")}
            </p>
            <SocialLinksIconButtons
              buttonClassName="size-8 rounded-md"
              umamiEvent="footer:social-click"
            />
            <div className="flex items-center gap-2">
              {dismissed && !installed && (
                <button
                  type="button"
                  onClick={reEnablePrompt}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/50 px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
                  data-umami-event="footer:install-app-click"
                >
                  <Smartphone className="size-3.5" />
                  {t("footer.installApp")}
                </button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-gold gap-1 rounded-md"
                    aria-label={t("header.language")}
                  >
                    {locale === "en" ? "EN" : "RO"}
                    <ChevronDown className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-28">
                  <DropdownMenuLabel className="text-xs">{t("header.language")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setLocale("en")}
                    className={locale === "en" ? "text-gold font-medium" : ""}
                  >
                    English
                    {locale === "en" ? (
                      <span className="ml-auto size-1.5 rounded-full bg-gold" aria-hidden="true" />
                    ) : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setLocale("ro")}
                    className={locale === "ro" ? "text-gold font-medium" : ""}
                  >
                    Română
                    {locale === "ro" ? (
                      <span className="ml-auto size-1.5 rounded-full bg-gold" aria-hidden="true" />
                    ) : null}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <FooterColumn heading={t("footer.quickLinks")} links={QUICK_LINKS} />
          <FooterColumn heading={t("footer.support")} links={SUPPORT_LINKS} />
          <FooterColumn heading={t("footer.legal")} links={LEGAL_LINKS} />
        </div>

        <div className="mt-10 flex flex-col items-center gap-5 border-t border-border/60 pt-6">
          <PaymentLogos />
          <p className="text-center text-xs text-muted-foreground">
            {getFooterCopyright(year)}
          </p>
        </div>
      </div>
    </footer>
  );
}
