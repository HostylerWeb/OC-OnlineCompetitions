import {
  ensureFreshVerificationOtp,
  ensureFreshVerificationOtpAfterFailure,
  getPostVerificationPath,
  sendVerificationOtp,
  useReturnToSearchParam,
  VerifyEmailForm,
} from "@oc/api-client";
import { CheckCircle } from "@oc/icons";
import { useEffect, useState } from "react";
import { navigate } from "vike/client/router";
import { useData } from "vike-react/useData";
import { Link } from "@/components/Link";
import { localeHref, useTranslation } from "@/lib/i18n";
import type { Data } from "./+data";

export default function VerifyPage() {
  const { t, locale } = useTranslation();
  const { email, code, verifyFailed } = useData<Data>();
  const { returnTo } = useReturnToSearchParam();
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);

  // Ensure an OTP is sent on mount. Two paths:
  // - verifyFailed: user was redirected here after an expired/failed email-link
  //   attempt — force-send a fresh code (no dedup).
  // - normal load: ensure a code has been dispatched (sessionStorage dedup
  //   prevents duplicate sends within the session).
  useEffect(() => {
    if (!email || code) return;
    if (verifyFailed) {
      void sendVerificationOtp(email);
      setRecoveryMessage(t("auth.verify.linkExpired"));
      return;
    }
    void ensureFreshVerificationOtp({ email });
  }, [email, code, verifyFailed]);

  function handleVerified() {
    setVerifiedSuccess(true);
    window.setTimeout(() => {
      navigate(localeHref(getPostVerificationPath(returnTo), locale), {
        overwriteLastHistoryEntry: true,
      });
    }, 2000);
  }

  async function handleAutoVerifyFailed(error: { code?: string; message?: string }) {
    if (!email) return false;
    const result = await ensureFreshVerificationOtpAfterFailure({ email, error });
    if (!result.sent) return false;
    setRecoveryMessage(t("auth.verify.linkExpiredAlt"));
    return true;
  }

  if (!email) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <main className="pt-14 flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md py-5 lg:py-12">
            <div className="w-full bg-card rounded-xl border border-border p-8 text-center">
              <p className="text-muted-foreground">
                {t("auth.verify.missingEmail")}{" "}
                <Link
                  href="/auth/sign-up"
                  className="text-gold hover:underline"
                  data-umami-event="auth:sign-up-again"
                >
                  {t("auth.verify.signUpAgain")}
                </Link>
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (verifiedSuccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <main className="pt-14 flex-1 flex items-center justify-center px-4">
          <div className="text-center animate-fade-in-up" role="status">
            <CheckCircle className="mx-auto mb-4 size-12 text-success" />
            <p className="text-lg font-medium text-foreground">{t("auth.verify.successHeading")}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t("auth.verify.redirecting")}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="pt-14 flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md py-5 lg:py-12">
          <div className="w-full bg-card rounded-xl border border-border p-6 sm:p-8 animate-fade-in-up">
            <h1 className="text-2xl font-bold text-foreground mb-2">{t("auth.verify.heading")}</h1>
            <p className="text-muted-foreground mb-2">
              {t("auth.verify.instructions", { email: email ?? "" })}
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              {code ? t("auth.verify.verifyingFromLink") : t("auth.verify.otpInstructions")}
            </p>
            <VerifyEmailForm
              email={email}
              initialCode={code ?? ""}
              onVerified={handleVerified}
              onAutoVerifyFailed={handleAutoVerifyFailed}
              recoveryMessage={recoveryMessage}
              localize={t as (key: string, params?: Record<string, string | number>) => string}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
