import { AlertCircle, CheckCircle, LoaderCircle } from "@oc/icons";
import { cn } from "@oc/utils";
import { useEffect, useRef, useState } from "react";
import { useForgotPassword } from "../../hooks/auth";
import { getAuthErrorMessage } from "../actions";
import {
  authErrorAlertClass,
  authInputClass,
  authLabelClass,
  authSubmitButtonClass,
} from "./styles";
import { TurnstileWidget } from "./TurnstileWidget";
import { useTurnstile, useTurnstileStore } from "./turnstile-store";

const turnstileStore = useTurnstileStore;

interface ForgotPasswordFormProps {
  loginPath?: string;
  resetPath?: string;
  showBackLink?: boolean;
  turnstileSiteKey?: string;
  router?: { push: (url: string) => void; replace: (url: string) => void };
  LinkComponent?: React.ComponentType<{
    href: string;
    className?: string;
    children?: React.ReactNode;
    target?: string;
  }>;
  localize?: (key: string, params?: Record<string, string | number>) => string;
}

const defaultLink: React.ComponentType<{
  href: string;
  className?: string;
  children?: React.ReactNode;
  target?: string;
}> = ({ href, className, children, target }) => (
  <a href={href} className={className} target={target}>
    {children}
  </a>
);

export function ForgotPasswordForm({
  loginPath = "/auth/login",
  resetPath = "/auth/reset-password",
  showBackLink = true,
  turnstileSiteKey,
  router,
  LinkComponent,
  localize,
}: ForgotPasswordFormProps) {
  const resolvedRouter = router ?? {
    push: (url: string) => {
      if (typeof window !== "undefined") window.location.href = url;
    },
    replace: (url: string) => {
      if (typeof window !== "undefined") window.location.replace(url);
    },
  };
  const LinkC = LinkComponent ?? defaultLink;
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showEmailSent, setShowEmailSent] = useState(false);
  const mutation = useForgotPassword();
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnstile = useTurnstile();

  useEffect(() => {
    if (!mutation.isSuccess) return;
    setShowEmailSent(true);
    redirectTimeoutRef.current = setTimeout(() => {
      resolvedRouter.replace(`${resetPath}?email=${encodeURIComponent(email)}`);
    }, 2000);
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, [mutation.isSuccess, email, resetPath, resolvedRouter]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({ email, turnstileToken: turnstile.token ?? undefined });
    } catch (err: unknown) {
      turnstileStore.getState().consume();
      setError(getAuthErrorMessage(err as { message?: string; code?: string }));
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
      data-umami-event="auth:forgot-password-submit"
    >
      {error && (
        <div
          className={cn(authErrorAlertClass, "flex items-start gap-2 animate-fade-in-up")}
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className={authLabelClass}>
          {localize?.("auth.form.email") ?? "Email"}
        </label>
        <input
          id="email"
          className={authInputClass}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      {showEmailSent ? (
        <div
          className="animate-fade-in-up rounded-lg border border-success/20 bg-success/10 p-4 text-sm flex items-start gap-3"
          role="status"
        >
          <CheckCircle className="mt-0.5 size-5 shrink-0 text-success" />
          <div>
            <p className="font-medium text-success">
              {localize?.("auth.form.emailSent") ?? "Email sent!"}
            </p>
            <p className="text-success/80 mt-1">
              {localize?.("auth.form.checkInbox") ?? "Check your inbox for the reset code."}{" "}
              {typeof window !== "undefined" && (
                <span>
                  {localize?.("auth.form.redirectingToReset") ?? "Redirecting to reset page…"}
                </span>
              )}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-center">
            <TurnstileWidget siteKey={turnstileSiteKey} />
          </div>
          <button
            type="submit"
            className={authSubmitButtonClass}
            disabled={mutation.isPending || (!!turnstileSiteKey && turnstile.isDisabled)}
            aria-busy={mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <LoaderCircle className="size-4 animate-spin mr-2 inline" />
                {localize?.("auth.form.sending") ?? "Sending…"}
              </>
            ) : (
              (localize?.("auth.form.sendResetCode") ?? "Send reset code")
            )}
          </button>
          {showBackLink ? (
            <p className="text-center text-sm">
              <LinkC href={loginPath} className="text-primary hover:underline">
                {localize?.("auth.form.backToSignIn") ?? "Back to sign in"}
              </LinkC>
            </p>
          ) : null}
        </>
      )}
    </form>
  );
}
