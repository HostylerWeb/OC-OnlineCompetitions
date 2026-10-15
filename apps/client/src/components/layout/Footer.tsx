"use client";

import { useComplianceFeatures } from "@oc/api-client";
import {
  CARD_BRAND_COMPONENT,
  CARD_BRANDS,
  Smartphone,
  SocialLinksIconButtons,
} from "@oc/icons";
import { cn, getFooterCopyright } from "@oc/utils";
import { useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { BrandLogo } from "@/components/BrandLogo";
import { Link } from "@/components/Link";
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
    { href: "/winners", label: t("header.nav.winners"), umami: "footer:winners-click" },
    { href: "/entries", label: t("header.nav.entries"), umami: "footer:entries-click" },
    {
      href: "/how-it-works",
      label: t("header.nav.howItWorks"),
      umami: "footer:how-it-works-click",
    },
    { href: "/about", label: t("footer.aboutUs"), umami: "footer:about-click" },
  ] as const;
}

function getSupportLinks(
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
  showResponsiblePlay: boolean
) {
  return [
    { href: "/faq", label: t("footer.faq"), umami: "footer:faq-click" },
    { href: "/contact", label: t("footer.contactUs"), umami: "footer:contact-click" },
    ...(showResponsiblePlay
      ? [
          {
            href: "/responsible-play",
            label: t("header.nav.responsiblePlay"),
            umami: "footer:responsible-play-click",
          },
        ]
      : []),
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
      <div className="mb-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold/90">
          {heading}
        </h3>
        <div className="mt-2 h-px w-8 bg-gradient-to-r from-gold/80 to-gold/10" aria-hidden />
      </div>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
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
    <div className="flex flex-col items-center gap-2 sm:items-end">
      <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">
        {t("footer.acceptedPayments")}
      </span>
      <div
        className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 backdrop-blur-sm sm:justify-end"
        role="img"
        aria-label={t("footer.acceptedPayments")}
      >
        {CARD_BRANDS.map((brand) => {
          const Icon = CARD_BRAND_COMPONENT[brand];
          const isTall = brand === "google-pay" || brand === "apple-pay";
          return <Icon key={brand} className={isTall ? "h-9" : "h-5"} />;
        })}
      </div>
    </div>
  );
}

export function Footer() {
  const { t } = useTranslation();
  const pageContext = usePageContext();
  const complianceData = (pageContext as { complianceFeaturesData?: unknown }).complianceFeaturesData;
  const features = useComplianceFeatures({ initialData: complianceData ?? undefined });
  const showResponsiblePlay = features.publicResponsiblePlayPage;
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
  const SUPPORT_LINKS = useMemo(
    () => getSupportLinks(t, showResponsiblePlay),
    [t, showResponsiblePlay]
  );
  const LEGAL_LINKS = getLegalLinks(t);

  return (
    <footer className="relative mt-auto overflow-hidden border-t border-gold/15 text-foreground">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 -top-32 h-64 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.07),transparent_65%)]"
        aria-hidden
      />

      <div className="relative bg-gradient-to-b from-card/50 via-background/95 to-background">
        <div className="oc-container-wide py-12 sm:py-14 lg:py-16">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10 xl:gap-14">
            <div className="min-w-0 space-y-5 lg:col-span-5 xl:col-span-4">
              <Link
                href="/"
                className="inline-flex transition-opacity hover:opacity-90"
                data-umami-event="footer:logo-click"
              >
                <BrandLogo className="text-gold h-8 w-auto sm:h-9" />
              </Link>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                {t("footer.companyDescription")}
              </p>
              <SocialLinksIconButtons
                buttonClassName="size-9 rounded-lg"
                iconClassName="size-4"
                umamiEvent="footer:social-click"
              />
              {dismissed && !installed && (
                <button
                  type="button"
                  onClick={reEnablePrompt}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gold/25 bg-gold/5 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-gold/10"
                  data-umami-event="footer:install-app-click"
                >
                  <Smartphone className="size-3.5 text-gold" />
                  {t("footer.installApp")}
                </button>
              )}
            </div>

            <div
              className={cn(
                "grid grid-cols-2 gap-8 sm:gap-10",
                "lg:col-span-7 lg:grid-cols-3 xl:col-span-8"
              )}
            >
              <FooterColumn heading={t("footer.quickLinks")} links={QUICK_LINKS} />
              <FooterColumn heading={t("footer.support")} links={SUPPORT_LINKS} />
              <FooterColumn heading={t("footer.legal")} links={LEGAL_LINKS} />
            </div>
          </div>

          <div
            className={cn(
              "mt-12 flex flex-col gap-8 border-t border-white/10 pt-8",
              "sm:flex-row sm:items-end sm:justify-between"
            )}
          >
            <p className="max-w-md text-center text-xs leading-relaxed text-muted-foreground sm:text-left">
              {getFooterCopyright(year)}
            </p>
            <PaymentLogos />
          </div>
        </div>
      </div>
    </footer>
  );
}
