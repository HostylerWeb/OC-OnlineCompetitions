import { AlertTriangle } from "@oc/icons";
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
    <div className="h-full overflow-y-auto flex flex-col justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 inline-flex size-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-8 text-destructive" aria-hidden />
        </div>
        <h1 className="mb-4 text-2xl font-bold text-foreground">{title}</h1>
        <p className="mx-auto max-w-lg text-base leading-relaxed text-muted-foreground">
          {message}
        </p>

        {hint ? (
          <Alert variant="default" className="mx-auto mt-6 max-w-lg text-left">
            <AlertDescription>{t(hint)}</AlertDescription>
          </Alert>
        ) : null}

        {returnTo ? (
          <p className="mt-4 text-sm text-muted-foreground/80">{t("auth.error.returnToHint")}</p>
        ) : null}

        {showTechnicalCode && errorCode ? (
          <p className="mt-4 font-mono text-xs text-muted-foreground/50">
            {t("auth.error.referenceCode", { errorCode })}
          </p>
        ) : null}

        <PageActionButtons actions={actions} />
      </div>
    </div>
  );
}
