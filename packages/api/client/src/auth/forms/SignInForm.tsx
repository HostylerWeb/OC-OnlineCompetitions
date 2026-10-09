import { AlertCircle, CheckCircle, Eye, EyeOff, LoaderCircle } from "@oc/icons";
import { cn } from "@oc/utils";
import { useEffect, useRef, useState } from "react";
import { buildVerifyRequiredPath, sanitizeReturnTo } from "../../referral/redirect";
import {
  getAuthErrorMessage,
  isUnverifiedEmailSignInError,
  signInWithMagicLink,
  signInWithPassword,
} from "../actions";
import { normalizeAuthEmail } from "../normalize-email";
import { refreshAuthSession } from "../refresh-session";
import { GoogleSignInButton } from "./GoogleSignInButton";
import {
  authErrorAlertClass,
  authInputClass,
  authLabelClass,
  authModeButtonActiveClass,
  authModeButtonClass,
  authModeButtonInactiveClass,
  authModeToggleGroupClass,
  authSubmitButtonClass,
  authSuccessAlertClass,
} from "./styles";
import { TurnstileWidget } from "./TurnstileWidget";
import { useTurnstile, useTurnstileStore } from "./turnstile-store";

const turnstileStore = useTurnstileStore;

interface SignInFormProps {
  onSuccess?: () => void;
  forgotPasswordPath?: string;
  signUpPath?: string;
  callbackURL?: string;
  submitLabel?: string;
  showSignUpLink?: boolean;
  turnstileSiteKey?: string;
  router?: { push: (url: string) => void; replace: (url: string) => void };
  searchParams?: URLSearchParams | null;
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

export function SignInForm({
  onSuccess,
  forgotPasswordPath = "/auth/forgot-password",
  signUpPath = "/auth/sign-up",
  callbackURL,
  submitLabel,
  showSignUpLink = true,
  turnstileSiteKey,
  router,
  searchParams,
  LinkComponent,
  localize,
}: SignInFormProps) {
  const resolvedSubmitLabel = submitLabel ?? localize?.("auth.form.signIn") ?? "Sign In";
  const resolvedRouter = router ?? {
    push: (url: string) => {
      if (typeof window !== "undefined") window.location.href = url;
    },
    replace: (url: string) => {
      if (typeof window !== "undefined") window.location.replace(url);
    },
  };
  const resolvedSearchParams =
    searchParams ??
    new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const LinkC = LinkComponent ?? defaultLink;
  const returnTo = sanitizeReturnTo(resolvedSearchParams.get("returnTo"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const passwordToggleLabel =
    localize?.(showPassword ? "auth.form.hidePassword" : "auth.form.showPassword") ??
    (showPassword ? "Hide password" : "Show password");
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicCooldown, setMagicCooldown] = useState(0);
  const turnstile = useTurnstile();
  const resetTurnstile = useTurnstileStore((s) => s.reset);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (magicCooldown > 0) {
      timerRef.current = setInterval(() => {
        setMagicCooldown((t) => {
          if (t <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return t - 1;
        });
      }, 1000);
      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [magicCooldown]);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const normalizedEmail = normalizeAuthEmail(email);
      const result = await signInWithPassword(
        normalizedEmail,
        password,
        callbackURL,
        turnstile.token ?? undefined
      );
      if (result.error) {
        setLoading(false);
        turnstileStore.getState().consume();
        if (isUnverifiedEmailSignInError(result.error)) {
          resolvedRouter.replace(buildVerifyRequiredPath({ email: normalizedEmail, returnTo }));
          return;
        }
        setError(getAuthErrorMessage(result.error));
        return;
      }
      await refreshAuthSession();
      setLoading(false);
      onSuccess?.();
    } catch {
      setLoading(false);
      turnstileStore.getState().consume();
      setError(
        localize?.("auth.form.unexpectedError") ??
          "Something unexpected happened. Please try again."
      );
    }
  }

  async function handleMagicLink() {
    setLoading(true);
    setError(null);
    setInfo(null);
    const result = await signInWithMagicLink(
      normalizeAuthEmail(email),
      callbackURL,
      turnstile.token ?? undefined
    );
    setLoading(false);
    if (result.error) {
      turnstileStore.getState().consume();
      setError(getAuthErrorMessage(result.error));
      return;
    }
    setMagicCooldown(30);
  }

  return (
    <div className="flex flex-col gap-4">
      <GoogleSignInButton callbackURL={callbackURL} localize={localize} />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gold/20" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-gold/60">{localize?.("auth.form.or") ?? "or"}</span>
        </div>
      </div>

      <fieldset
        className={authModeToggleGroupClass}
        aria-label={localize?.("auth.form.signInMethod") ?? "Sign-in method"}
      >
        <button
          type="button"
          className={`${authModeButtonClass} ${mode === "password" ? authModeButtonActiveClass : authModeButtonInactiveClass}`}
          aria-pressed={mode === "password"}
          onClick={() => {
            resetTurnstile();
            setMode("password");
          }}
        >
          {localize?.("auth.form.password") ?? "Password"}
        </button>
        <button
          type="button"
          className={`${authModeButtonClass} ${mode === "magic" ? authModeButtonActiveClass : authModeButtonInactiveClass}`}
          aria-pressed={mode === "magic"}
          onClick={() => {
            resetTurnstile();
            setMode("magic");
          }}
        >
          {localize?.("auth.form.magicLink") ?? "Magic link"}
        </button>
      </fieldset>

      {error && (
        <div
          className={cn(authErrorAlertClass, "flex items-start gap-2 animate-fade-in-up")}
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {info && (
        <div
          className={cn(authSuccessAlertClass, "flex items-start gap-2 animate-fade-in-up")}
          role="status"
        >
          <CheckCircle className="mt-0.5 size-5 shrink-0" />
          <span>{info}</span>
        </div>
      )}

      {mode === "password" ? (
        <form
          onSubmit={handlePasswordSubmit}
          className="flex flex-col gap-4"
          data-umami-event="auth:login-submit"
        >
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
            <label htmlFor="password" className={authLabelClass}>
              {localize?.("auth.form.password") ?? "Password"}
            </label>
            <div className="relative">
              <input
                id="password"
                className={cn(authInputClass, "pr-10")}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
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
            disabled={loading || (!!turnstileSiteKey && turnstile.isDisabled)}
            aria-busy={loading}
          >
            {loading ? (
              <>
                <LoaderCircle className="size-4 animate-spin mr-2 inline" />
                {localize?.("auth.form.signingIn") ?? "Signing in…"}
              </>
            ) : (
              resolvedSubmitLabel
            )}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleMagicLink();
          }}
          className="flex flex-col gap-4"
          data-umami-event="auth:login-submit"
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="magic-email" className={authLabelClass}>
              {localize?.("auth.form.email") ?? "Email"}
            </label>
            <input
              id="magic-email"
              className={authInputClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="flex justify-center">
            <TurnstileWidget siteKey={turnstileSiteKey} />
          </div>
          {magicCooldown > 0 ? (
            <div
              className="animate-fade-in-up rounded-lg border border-success/20 bg-success/10 p-4 text-sm flex items-start gap-3"
              role="status"
            >
              <CheckCircle className="mt-0.5 size-5 shrink-0 text-success" />
              <div>
                <p className="font-medium text-success">
                  {localize?.("auth.form.magicLinkSent") ?? "Magic link sent!"}
                </p>
                <p className="text-success/80 mt-1">
                  {localize?.("auth.form.resendIn", { seconds: magicCooldown }) ??
                    `Resend in ${magicCooldown}s…`}
                </p>
              </div>
            </div>
          ) : (
            <button
              type="submit"
              className={authSubmitButtonClass}
              disabled={loading || !email || (!!turnstileSiteKey && turnstile.isDisabled)}
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <LoaderCircle className="size-4 animate-spin mr-2 inline" />
                  {localize?.("auth.form.sending") ?? "Sending…"}
                </>
              ) : (
                (localize?.("auth.form.emailMeLink") ?? "Email me a sign-in link")
              )}
            </button>
          )}
        </form>
      )}

      <div className="flex items-center justify-between pt-2 text-sm">
        <LinkC href={forgotPasswordPath} className="text-primary hover:underline">
          {localize?.("auth.form.forgotPassword") ?? "Forgot password?"}
        </LinkC>
        {showSignUpLink && (
          <LinkC href={signUpPath} className="text-muted-foreground hover:text-primary">
            {localize?.("auth.form.createAccount") ?? "Create account"}
          </LinkC>
        )}
      </div>
    </div>
  );
}
