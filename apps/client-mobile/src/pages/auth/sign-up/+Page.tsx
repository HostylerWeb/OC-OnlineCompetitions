import { buildLoginUrl, buildVerifyRequiredPath, SignUpForm } from "@oc/api-client";
import { DatePicker } from "@/components/DatePicker";
import { localeHref, useTranslation } from "@/lib/i18n";

const getEnv = (key: string) => import.meta.env[`VITE_${key}`] || "";

export default function SignUpPage() {
  const { t, locale } = useTranslation();
  const compliance = null;
  const referralSettings = null;
  const refCode = null;
  const referrerName = null;
  const googleSignUpError = null;

  function handleAlreadyVerified() {
    window.location.replace(localeHref(buildLoginUrl({ existingAccount: true }), locale));
  }

  function handleSuccess(email: string) {
    window.location.replace(localeHref(buildVerifyRequiredPath({ email }), locale));
  }

  return (
    <div className="h-full overflow-y-auto flex flex-col justify-center px-4">
      <h1 className="text-2xl font-bold text-foreground mb-1">{t("auth.signUp.heading")}</h1>
      <p className="text-muted-foreground mb-6">{t("auth.signUp.subtitle")}</p>
      <SignUpForm
        compliance={compliance ?? undefined}
        referralDiscountPercent={
          ((
            (referralSettings as unknown as Record<string, unknown>)?.refereeReward as
              | Record<string, unknown>
              | undefined
          )?.discountPercent as number) ?? null
        }
        onAlreadyVerified={handleAlreadyVerified}
        onSuccess={handleSuccess}
        turnstileSiteKey={getEnv("TURNSTILE_SITE_KEY") || undefined}
        refCode={refCode}
        referrerName={referrerName}
        googleSignUpError={googleSignUpError ?? undefined}
        renderDateOfBirthField={({ id, value, onChange, minAge }) => (
          <DatePicker
            id={id}
            value={value}
            onChange={onChange}
            minAge={minAge}
            defaultToMinAge
            placeholder={t("auth.signUp.dobPlaceholder")}
            className="h-10"
          />
        )}
        localize={t as (key: string, params?: Record<string, string | number>) => string}
      />
    </div>
  );
}
