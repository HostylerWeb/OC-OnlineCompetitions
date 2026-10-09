import { authClient, normalizeAuthClientError, safelyRunAuthRequest } from "@oc/auth-client";
import { AlertCircle, CheckCircle, Eye, EyeOff, LoaderCircle } from "@oc/icons";
import { cn } from "@oc/utils";
import { useEffect, useState } from "react";
import { useChangePassword } from "../../hooks";
import { getAuthErrorMessage } from "../actions";
import {
  authErrorAlertClass,
  authInputClass,
  authLabelClass,
  authSubmitButtonClass,
  authSuccessAlertClass,
} from "./styles";

interface ChangePasswordFormProps {
  localize?: (key: string, params?: Record<string, string | number>) => string;
  LinkComponent?: React.ComponentType<{
    href: string;
    className?: string;
    children: React.ReactNode;
  }>;
}

export function ChangePasswordForm({ LinkComponent, localize }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasCredentialAccount, setHasCredentialAccount] = useState<boolean | null>(null);

  const changePasswordMutation = useChangePassword();

  useEffect(() => {
    void safelyRunAuthRequest(() => authClient.listAccounts()).then((result) => {
      if (result.error) {
        setHasCredentialAccount(true);
        return;
      }
      const accounts = result.data ?? [];
      setHasCredentialAccount(accounts.some((account) => account.providerId === "credential"));
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 8) {
      setError(
        localize?.("auth.form.minLength", { minLength: 8 }) ??
          "New password must be at least 8 characters."
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(localize?.("auth.form.passwordsDontMatch") ?? "New passwords do not match.");
      return;
    }

    let result: Awaited<ReturnType<typeof changePasswordMutation.mutateAsync>>;
    try {
      result = await changePasswordMutation.mutateAsync({ currentPassword, newPassword });
    } catch (mutationErr: unknown) {
      setError(getAuthErrorMessage(normalizeAuthClientError(mutationErr)));
      return;
    }
    if (result.error) {
      setError(getAuthErrorMessage(result.error));
      return;
    }

    setSuccess(localize?.("auth.form.passwordUpdated") ?? "Password updated successfully.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  if (hasCredentialAccount === null) {
    return (
      <p className="text-sm text-muted-foreground">
        {localize?.("auth.form.loading") ?? "Loading security settings\u2026"}
      </p>
    );
  }

  if (!hasCredentialAccount) {
    const Link = LinkComponent ?? ((p) => <a {...p} />);
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {localize?.("auth.form.googleSignInMessage") ??
            "Your account uses Google sign-in. To set a password, use the forgot-password flow with your email address."}
        </p>
        <Link href="/auth/forgot-password" className="text-sm text-gold hover:underline">
          {localize?.("auth.form.resetPasswordViaEmail") ?? "Reset password via email"}
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
      data-umami-event="profile:change-password"
    >
      {error ? (
        <div
          className={cn(authErrorAlertClass, "flex items-start gap-2 animate-fade-in-up")}
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {success ? (
        <div
          className={cn(authSuccessAlertClass, "flex items-start gap-2 animate-fade-in-up")}
          role="status"
        >
          <CheckCircle className="mt-0.5 size-5 shrink-0" />
          <span>{success}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="currentPassword" className={authLabelClass}>
          {localize?.("auth.form.currentPassword") ?? "Current password"}
        </label>
        <div className="relative">
          <input
            id="currentPassword"
            className={cn(authInputClass, "pr-10")}
            type={showCurrent ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <button
            type="button"
            aria-label={
              showCurrent
                ? (localize?.("auth.form.hidePassword") ?? "Hide password")
                : (localize?.("auth.form.showPassword") ?? "Show password")
            }
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            onClick={() => setShowCurrent((v) => !v)}
          >
            {showCurrent ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="newPassword" className={authLabelClass}>
          {localize?.("auth.form.newPassword") ?? "New password"}
        </label>
        <div className="relative">
          <input
            id="newPassword"
            className={cn(authInputClass, "pr-10")}
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <button
            type="button"
            aria-label={
              showNew
                ? (localize?.("auth.form.hidePassword") ?? "Hide password")
                : (localize?.("auth.form.showPassword") ?? "Show password")
            }
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            onClick={() => setShowNew((v) => !v)}
          >
            {showNew ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="confirmPassword" className={authLabelClass}>
          {localize?.("auth.form.confirmPassword") ?? "Confirm new password"}
        </label>
        <div className="relative">
          <input
            id="confirmPassword"
            className={cn(authInputClass, "pr-10")}
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <button
            type="button"
            aria-label={
              showConfirm
                ? (localize?.("auth.form.hidePassword") ?? "Hide password")
                : (localize?.("auth.form.showPassword") ?? "Show password")
            }
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            onClick={() => setShowConfirm((v) => !v)}
          >
            {showConfirm ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        className={authSubmitButtonClass}
        disabled={changePasswordMutation.isPending}
        aria-busy={changePasswordMutation.isPending}
      >
        {changePasswordMutation.isPending ? (
          <>
            <LoaderCircle className="size-4 animate-spin mr-2 inline" />
            {localize?.("auth.form.changing") ?? "Updating..."}
          </>
        ) : (
          (localize?.("auth.form.changePassword") ?? "Update password")
        )}
      </button>
    </form>
  );
}
