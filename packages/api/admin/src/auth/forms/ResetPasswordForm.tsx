"use client";
import { AlertCircle, Eye, EyeOff } from "@oc/icons";
import { cn } from "@oc/utils";
import { useState } from "react";
import { useResetPassword } from "../../hooks/auth";
import { getAuthErrorMessage } from "../actions";
import {
  authErrorAlertClass,
  authInputClass,
  authLabelClass,
  authSubmitButtonClass,
  authSuccessAlertClass,
} from "./styles";
import { TurnstileWidget } from "./TurnstileWidget";

interface ResetPasswordFormProps {
  loginPath?: string;
  searchParams?: URLSearchParams | null;
  turnstileSiteKey?: string;
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
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mutation = useResetPassword();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({
        email,
        code,
        newPassword: password,
        turnstileToken: turnstileToken ?? undefined,
      });
    } catch (err) {
      setRefreshKey((k) => k + 1);
      setTokenReady(false);
      setError(getAuthErrorMessage(err as { message?: string; code?: string; status?: number }));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
      <div className="flex flex-col gap-2">
        <label htmlFor="code" className={authLabelClass}>
          Reset code
        </label>
        <input
          id="code"
          className={authInputClass}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="password" className={authLabelClass}>
          New password
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
        disabled={mutation.isPending || (!!turnstileSiteKey && !tokenReady)}
      >
        {mutation.isPending ? "Resetting…" : "Reset password"}
      </button>
      {mutation.isSuccess && (
        <div className={authSuccessAlertClass}>
          Password updated.{" "}
          <LinkC href={loginPath} className="text-primary hover:underline">
            Sign in
          </LinkC>
        </div>
      )}
    </form>
  );
}
