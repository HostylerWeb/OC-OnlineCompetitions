import { normalizeAuthClientError } from "@oc/auth-client";
import { AlertCircle, CheckCircle, Eye, EyeOff, LoaderCircle } from "@oc/icons";
import { cn } from "@oc/utils";
import { useEffect, useState } from "react";
import { useResetPassword } from "../../hooks/auth";
import {
  authErrorAlertClass,
  authInputClass,
  authLabelClass,
  authSubmitButtonClass,
} from "./styles";
import { TurnstileWidget } from "./TurnstileWidget";
import { useTurnstile, useTurnstileStore } from "./turnstile-store";

const turnstileStore = useTurnstileStore;

interface ResetPasswordFormProps {
  loginPath?: string;
  searchParams?: URLSearchParams | null;
  turnstileSiteKey?: string;
  localize?: (key: string, params?: Record<string, string | number>) => string;
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

export function ResetPasswordForm({
  loginPath = "/auth/login",
  searchParams,
  turnstileSiteKey,
  localize,
  LinkComponent,
}: ResetPasswordFormProps) {
  const resolvedSearchParams =
    searchParams ??
    new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const LinkC = LinkComponent ?? defaultLink;
  const [email, setEmail] = useState(resolvedSearchParams.get("email") ?? "");
  const [code, setCode] = useState(resolvedSearchParams.get("code") ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectTimer, setRedirectTimer] = useState(5);
  const passwordToggleLabel =
    localize?.(showPassword ? "auth.form.hidePassword" : "auth.form.showPassword") ??
    (showPassword ? "Hide password" : "Show password");
  const mutation = useResetPassword();
  const turnstile = useTurnstile();

  useEffect(() => {
    if (!mutation.isSuccess) return;
    if (redirectTimer <= 0) {
      if (typeof window !== "undefined") window.location.href = loginPath;
      return;
    }
    const id = setInterval(() => setRedirectTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [mutation.isSuccess, redirectTimer, loginPath]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({
        email,
        code,
        newPassword: password,
        turnstileToken: turnstile.token ?? undefined,
      });
    } catch (err: unknown) {
      turnstileStore.getState().consume();
      const normalized = normalizeAuthClientError(err);
      setError(normalized.message);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
      data-umami-event="auth:reset-password-submit"
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
      <div className="flex flex-col gap-2">
        <label htmlFor="code" className={authLabelClass}>
          {localize?.("auth.form.resetCode") ?? "Reset code"}
        </label>
        <input
          id="code"
          className={authInputClass}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          autoComplete="one-time-code"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="password" className={authLabelClass}>
          {localize?.("auth.form.newPassword") ?? "New password"}
        </label>
        <div className="relative">
          <input
            id="password"
            className={cn(authInputClass, "pr-10")}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <button
            type="button"
            aria-label={passwordToggleLabel}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </div>
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
            {localize?.("auth.form.resetting") ?? "Resetting…"}
          </>
        ) : (
          (localize?.("auth.form.resetPassword") ?? "Reset password")
        )}
      </button>
      {mutation.isSuccess && (
        <div
          className="animate-fade-in-up rounded-lg border border-success/20 bg-success/10 p-4 text-sm flex items-start gap-3"
          role="status"
        >
          <CheckCircle className="mt-0.5 size-5 shrink-0 text-success" />
          <div>
            <p className="font-medium text-success">
              {localize?.("auth.form.passwordUpdated") ?? "Password updated!"}
            </p>
            <p className="text-success/80 mt-1">
              Redirecting to{" "}
              <LinkC
                href={loginPath}
                className="underline underline-offset-2 hover:no-underline text-success"
              >
                {localize?.("auth.form.signInLink") ?? "Sign in"}
              </LinkC>{" "}
              {localize?.("auth.form.redirectingToSignIn", { seconds: redirectTimer }) ??
                `Redirecting to sign in in ${redirectTimer}s…`}
            </p>
          </div>
        </div>
      )}
    </form>
  );
}
