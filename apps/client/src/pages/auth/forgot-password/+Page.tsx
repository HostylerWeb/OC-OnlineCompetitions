import { ForgotPasswordForm } from "@oc/api-client";
import { getEnv } from "@oc/env/vike";
import { useTranslation } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="pt-14 flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md py-5 lg:py-12">
          <div className="w-full bg-card rounded-xl border border-gold/15 p-6 sm:p-8 animate-fade-in-up shadow-[0_0_30px_rgb(212_175_55/0.06)]">
            <h1 className="text-2xl font-bold text-foreground mb-1">
              {t("auth.forgotPassword.heading")}
            </h1>
            <p className="text-gold/70 mb-6">{t("auth.forgotPassword.subtitle")}</p>
            <ForgotPasswordForm
              turnstileSiteKey={getEnv("TURNSTILE_SITE_KEY") || undefined}
              localize={t as (key: string, params?: Record<string, string | number>) => string}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
