"use client";

import { Cookie, Settings } from "@oc/icons";
import { useEffect, useState } from "react";
import { GoldButton, GoldOutlineButton } from "@/components/buttons";
import { Link } from "@/components/Link";
import { type TranslationKey, useTranslation } from "@/lib/i18n";

type ConsentPreferences = {
  necessary: true;
  functional: boolean;
  analytics: boolean;
  performance: boolean;
  advertisement: boolean;
};

const STORAGE_KEY = "oc-cookie-consent";

function getStoredConsent(): ConsentPreferences | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
    return null;
  } catch {
    return null;
  }
}

function saveConsent(consent: ConsentPreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
}

export function CookieConsentBanner() {
  const { t } = useTranslation();
  const [show, setShow] = useState(true);
  const [customising, setCustomising] = useState(false);

  useEffect(() => {
    setShow(!getStoredConsent());
  }, []);
  const [prefs, setPrefs] = useState<ConsentPreferences>({
    necessary: true,
    functional: false,
    analytics: false,
    performance: false,
    advertisement: false,
  });

  function acceptAll() {
    const consent: ConsentPreferences = {
      necessary: true,
      functional: true,
      analytics: true,
      performance: true,
      advertisement: true,
    };
    saveConsent(consent);
    setShow(false);
  }

  function saveCustom() {
    saveConsent(prefs);
    setShow(false);
    setCustomising(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-none">
      <div className="pointer-events-auto">
        <div className="relative overflow-hidden rounded-[2rem] w-full max-w-lg">
          <div className="p-1.5 rounded-[2rem] bg-card ring-1 ring-white/10">
            <div className="rounded-[calc(2rem-0.375rem)] bg-card p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gold/20 flex items-center justify-center flex-shrink-0">
                  <Cookie className="w-6 h-6 text-gold" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    {t("cookieConsent.heading")}
                  </h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    {t("cookieConsent.subtitle")}
                  </p>
                </div>
              </div>

              {!customising ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {t("cookieConsent.acceptAllDesc")}{" "}
                    <Link href="/cookie-policy" className="text-gold hover:underline">
                      {t("cookieConsent.cookiePolicy")}
                    </Link>
                    .
                  </p>
                  <div className="flex gap-3">
                    <GoldButton
                      onClick={acceptAll}
                      className="flex-1"
                      data-umami-event="cookie-consent:accept-all"
                    >
                      {t("cookieConsent.acceptAll")}
                    </GoldButton>
                    <GoldOutlineButton
                      onClick={() => setCustomising(true)}
                      className="flex-1"
                      data-umami-event="cookie-consent:customise-open"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      {t("cookieConsent.customise")}
                    </GoldOutlineButton>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {t("cookieConsent.customisationDesc")}
                  </p>
                  <div className="space-y-3">
                    {(["functional", "analytics", "performance", "advertisement"] as const).map(
                      (key) => (
                        <label
                          key={key}
                          className="flex items-start gap-3 p-3 rounded-xl border border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                          data-umami-event="cookie-consent:toggle"
                          data-umami-event-cookie={key}
                        >
                          <input
                            type="checkbox"
                            checked={prefs[key]}
                            onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))}
                            className="mt-0.5 accent-gold"
                          />
                          <div>
                            <span className="font-medium text-foreground text-sm">
                              {t(`cookieConsent.categories.${key}` as TranslationKey)}
                            </span>
                            <p className="text-xs text-muted-foreground">
                              {t(`cookieConsent.categories.${key}Desc` as TranslationKey)}
                            </p>
                          </div>
                        </label>
                      )
                    )}
                    <div className="flex items-start gap-3 p-3 rounded-xl border border-white/5 bg-muted/20">
                      <input
                        type="checkbox"
                        checked={true}
                        disabled
                        className="mt-0.5 accent-gold"
                      />
                      <div>
                        <span className="font-medium text-foreground text-sm">
                          {t("cookieConsent.categories.necessary")}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {t("cookieConsent.categories.necessaryDesc")}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <GoldButton
                      onClick={saveCustom}
                      className="flex-1"
                      data-umami-event="cookie-consent:save-preferences"
                    >
                      {t("cookieConsent.savePreferences")}
                    </GoldButton>
                    <GoldOutlineButton
                      onClick={() => setCustomising(false)}
                      data-umami-event="cookie-consent:back"
                    >
                      {t("cookieConsent.back")}
                    </GoldOutlineButton>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
