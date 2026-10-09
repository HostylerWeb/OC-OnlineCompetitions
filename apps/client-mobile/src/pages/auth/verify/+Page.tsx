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
import { Link } from "@/components/Link";
import { localeHref, useTranslation } from "@/lib/i18n";

export default function VerifyPage() {
  const { t, locale } = useTranslation();
  const searchParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  const email = searchParams.get("email") || "";
  const code = searchParams.get("code") || "";
  const verifyFailed = searchParams.get("verifyFailed") === "true";
  const { returnTo } = useReturnToSearchParam();
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);

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
      window.location.replace(localeHref(getPostVerificationPath(returnTo), locale));
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
      <div className="h-full overflow-y-auto flex flex-col justify-center px-4">
        <p className="text-muted-foreground">
          {t("auth.verify.missingEmail")}{" "}
          <Link href="/auth/sign-up" className="text-gold hover:underline">
            {t("auth.verify.signUpAgain")}
          </Link>
        </p>
      </div>
    );
  }

  if (verifiedSuccess) {
    return (
      <div
        className="h-full overflow-y-auto flex flex-col justify-center px-4 text-center"
        role="status"
      >
        <CheckCircle className="mx-auto mb-4 size-12 text-success" />
        <p className="text-lg font-medium text-foreground">{t("auth.verify.successHeading")}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t("auth.verify.redirecting")}</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 pt-4">
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
  );
}
