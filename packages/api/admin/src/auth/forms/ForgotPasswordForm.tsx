"use client";
import { AlertCircle } from "@oc/icons";
import { cn } from "@oc/utils";
import { useEffect, useRef, useState } from "react";
import { useForgotPassword } from "../../hooks/auth";
import { getAuthErrorMessage } from "../actions";
import {
  authErrorAlertClass,
  authInputClass,
  authLabelClass,
  authSubmitButtonClass,
  authSuccessAlertClass,
} from "./styles";
import { TurnstileWidget } from "./TurnstileWidget";

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
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutation = useForgotPassword();
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (mutation.isSuccess) {
      setShowSuccess(true);
      redirectTimer.current = setTimeout(() => {
        resolvedRouter.replace(`${resetPath}?email=${encodeURIComponent(email)}`);
      }, 2000);
    }
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, [mutation.isSuccess, email, resetPath, resolvedRouter]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({ email, turnstileToken: turnstileToken ?? undefined });
    } catch (err) {
      setRefreshKey((k) => k + 1);
      setTokenReady(false);
      setError(getAuthErrorMessage(err as { message?: string; code?: string; status?: number }));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {showSuccess ? (
        <div className={authSuccessAlertClass}>
          A reset code has been sent to {email}. Redirecting to reset page…
        </div>
      ) : null}
      {error && (
        <div className={cn(authErrorAlertClass, "flex items-start gap-2")} role="alert">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="email" className={authLabelClass}>
          Email
        </label>
        <input
          id="email"
          className={authInputClass}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      {turnstileSiteKey && (
        <div className="flex justify-center">
          <TurnstileWidget
            siteKey={turnstileSiteKey}
            onToken={(token) => {
              setTurnstileToken(token);
              setTokenReady(token !== null);
            }}
            refreshKey={refreshKey}
          />
        </div>
      )}
      <button
        type="submit"
        className={authSubmitButtonClass}
        disabled={mutation.isPending || (!!turnstileSiteKey && !tokenReady)}
      >
        {mutation.isPending ? "Sending…" : "Send reset code"}
      </button>
      {showBackLink ? (
        <p className="text-center text-sm">
          <LinkC href={loginPath} className="text-primary hover:underline">
            Back to sign in
          </LinkC>
        </p>
      ) : null}
    </form>
  );
}
