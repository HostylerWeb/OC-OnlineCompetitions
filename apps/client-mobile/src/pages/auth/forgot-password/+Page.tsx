import { ForgotPasswordForm } from "@oc/api-client";
import { useTranslation } from "@/lib/i18n";

const getEnv = (key: string) => import.meta.env[`VITE_${key}`] || "";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  return (
    <div className="h-full overflow-y-auto flex flex-col justify-center px-4">
      <h1 className="text-2xl font-bold text-foreground mb-1">
        {t("auth.forgotPassword.heading")}
      </h1>
      <p className="text-muted-foreground mb-6">{t("auth.forgotPassword.subtitle")}</p>
      <ForgotPasswordForm
        turnstileSiteKey={getEnv("TURNSTILE_SITE_KEY") || undefined}
        localize={t as (key: string, params?: Record<string, string | number>) => string}
      />
    </div>
  );
}
