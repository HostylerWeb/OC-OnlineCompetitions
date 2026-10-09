import { AlertTriangle } from "@oc/icons";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { PageActionButtons } from "@/components/layout/PageActionButtons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuthError } from "@/hooks/useAuthError";
import { type TranslationKey, useTranslation } from "@/lib/i18n";

const KIND_HINTS: Partial<Record<string, TranslationKey>> = {
  email_verification: "auth.error.hints.emailVerification",
  password_reset: "auth.error.hints.passwordReset",
  rate_limited: "auth.error.hints.rateLimited",
  oauth_retry: "auth.error.hints.oauthRetry",
};

export default function AuthErrorPage() {
  const { t } = useTranslation();
  const { title, message, errorCode, kind, returnTo, actions, showTechnicalCode } = useAuthError();
  const hint = KIND_HINTS[kind];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex flex-1 flex-col pt-14">
        <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="mb-6 inline-flex size-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="size-8 text-destructive" aria-hidden />
            </div>
            <h1 className="mb-4 text-4xl font-bold text-foreground sm:text-5xl">{title}</h1>
            <p className="mx-auto max-w-lg text-lg leading-relaxed text-muted-foreground">
              {message}
            </p>

            {hint ? (
              <Alert variant="default" className="mx-auto mt-6 max-w-lg text-left">
                <AlertDescription>{t(hint)}</AlertDescription>
              </Alert>
            ) : null}

            {returnTo ? (
              <p className="mt-4 text-sm text-muted-foreground/80">
                {t("auth.error.returnToHint")}
              </p>
            ) : null}

            {showTechnicalCode && errorCode ? (
              <p className="mt-4 font-mono text-xs text-muted-foreground/50">
                {t("auth.error.referenceCode", { errorCode })}
              </p>
            ) : null}
          </div>

          <PageActionButtons actions={actions} />
        </div>
      </main>

      <Footer />
    </div>
  );
}
