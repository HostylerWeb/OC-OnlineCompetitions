import {
  applyAuthenticatedDestination,
  AuthAccountForm,
  authClient,
  buildLoginUrl,
  buildVerifyRequiredPath,
  isAdminUser,
  resolveAuthenticatedDestination,
  useReturnToSearchParam,
} from "@oc/api-client";
import { getEnv } from "@oc/env/vike";
import { navigate } from "vike/client/router";
import { useData } from "vike-react/useData";
import { DatePicker } from "@/components/DatePicker";
import { localeHref, useTranslation } from "@/lib/i18n";
import type { Data } from "./+data";

export default function LoginPage() {
  const { t, locale } = useTranslation();
  const { returnTo, callbackURL } = useReturnToSearchParam();
  const { compliance, referralSettings, refCode, referrerName, googleSignUpError } =
    useData<Data>();

  async function handleSignInSuccess() {
    const session = await authClient.getSession();
    applyAuthenticatedDestination(
      resolveAuthenticatedDestination({
        returnTo,
        isAdmin: isAdminUser(session.data?.user),
        adminUrl: getEnv("ADMIN_URL"),
      }),
      (path: string) => {
        if (typeof window !== "undefined") window.location.href = path;
      }
    );
  }

  function handleAlreadyVerified() {
    void navigate(localeHref(buildLoginUrl({ existingAccount: true }), locale), {
      overwriteLastHistoryEntry: true,
    });
  }

  function handleSignUpSuccess(email: string) {
    void navigate(localeHref(buildVerifyRequiredPath({ email, returnTo }), locale), {
      overwriteLastHistoryEntry: true,
    });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="pt-14 flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md py-5 lg:py-12">
          <div className="w-full bg-card rounded-xl border border-gold/15 p-6 sm:p-8 animate-fade-in-up shadow-[0_0_30px_rgb(212_175_55/0.06)]">
            <h1 className="text-2xl font-bold text-foreground mb-1">{t("auth.account.heading")}</h1>
            <p className="text-gold/70 mb-6">{t("auth.account.subtitle")}</p>
            <AuthAccountForm
              callbackURL={callbackURL}
              onSignInSuccess={handleSignInSuccess}
              onSignUpSuccess={handleSignUpSuccess}
              onAlreadyVerified={handleAlreadyVerified}
              turnstileSiteKey={getEnv("TURNSTILE_SITE_KEY") || undefined}
              compliance={compliance ?? undefined}
              referralDiscountPercent={
                ((
                  (referralSettings as Record<string, unknown>)?.refereeReward as
                    | Record<string, unknown>
                    | undefined
                )?.discountPercent as number) ?? null
              }
              refCode={refCode}
              referrerName={referrerName}
              googleSignUpError={googleSignUpError}
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
        </div>
      </main>
    </div>
  );
}
