"use client";
import { Eye, EyeOff } from "@oc/icons";
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
  submitLabel = "Sign In",
  showSignUpLink = true,
  turnstileSiteKey,
  router,
  searchParams,
  LinkComponent,
}: SignInFormProps) {
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
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicCooldown, setMagicCooldown] = useState(0);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    };
  }, []);

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
        turnstileToken
      );
      setLoading(false);
      if (result.error) {
        setRefreshKey((k) => k + 1);
        setTokenReady(false);
        if (isUnverifiedEmailSignInError(result.error)) {
          resolvedRouter.replace(buildVerifyRequiredPath({ email: normalizedEmail, returnTo }));
          return;
        }
        setError(getAuthErrorMessage(result.error));
        return;
      }
      await refreshAuthSession();
      onSuccess?.();
    } catch {
      setLoading(false);
      setError("Something unexpected happened. Please try again.");
    }
  }

  async function handleMagicLink() {
    setLoading(true);
    setError(null);
    setInfo(null);
    const result = await signInWithMagicLink(
      normalizeAuthEmail(email),
      callbackURL,
      turnstileToken
    );
    setLoading(false);
    if (result.error) {
      setRefreshKey((k) => k + 1);
      setTokenReady(false);
      setError(getAuthErrorMessage(result.error));
      return;
    }
    setInfo("Check your email for a sign-in link.");
    setMagicCooldown(30);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setMagicCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownTimer.current) clearInterval(cooldownTimer.current);
          cooldownTimer.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  return (
    <div className="flex flex-col gap-4">
      <GoogleSignInButton callbackURL={callbackURL} />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <fieldset className={authModeToggleGroupClass} aria-label="Sign-in method">
        <button
          type="button"
          className={`${authModeButtonClass} ${mode === "password" ? authModeButtonActiveClass : authModeButtonInactiveClass}`}
          aria-pressed={mode === "password"}
          onClick={() => {
            setRefreshKey((k) => k + 1);
            setTokenReady(false);
            setTurnstileToken(null);
            setMode("password");
          }}
        >
          Password
        </button>
        <button
          type="button"
          className={`${authModeButtonClass} ${mode === "magic" ? authModeButtonActiveClass : authModeButtonInactiveClass}`}
          aria-pressed={mode === "magic"}
          onClick={() => {
            setRefreshKey((k) => k + 1);
            setTokenReady(false);
            setTurnstileToken(null);
            setMode("magic");
          }}
        >
          Magic link
        </button>
      </fieldset>

      {error && <div className={authErrorAlertClass}>{error}</div>}
      {info && <div className={authSuccessAlertClass}>{info}</div>}

      {mode === "password" ? (
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
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
              autoComplete="email"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="password" className={authLabelClass}>
              Password
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
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
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
            disabled={loading || (!!turnstileSiteKey && !tokenReady)}
          >
            {loading ? "Signing in…" : submitLabel}
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="magic-email" className={authLabelClass}>
              Email
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
            type="button"
            className={authSubmitButtonClass}
            disabled={loading || !email || magicCooldown > 0 || (!!turnstileSiteKey && !tokenReady)}
            onClick={handleMagicLink}
          >
            {loading
              ? "Sending…"
              : magicCooldown > 0
                ? `Resend in ${magicCooldown}s`
                : "Email me a sign-in link"}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 text-sm">
        <LinkC href={forgotPasswordPath} className="text-primary hover:underline">
          Forgot password?
        </LinkC>
        {showSignUpLink && (
          <LinkC href={signUpPath} className="text-muted-foreground hover:text-primary">
            Create account
          </LinkC>
        )}
      </div>
    </div>
  );
}
