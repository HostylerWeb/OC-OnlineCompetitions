"use client";
import { Eye, EyeOff } from "@oc/icons";
import { cn } from "@oc/utils";
import { useEffect, useState } from "react";
import { useChangePassword } from "../../hooks";
import { getAuthErrorMessage } from "../actions";
import { authClient, normalizeAuthClientError, safelyRunAuthRequest } from "../client";
import {
  authErrorAlertClass,
  authInputClass,
  authLabelClass,
  authSubmitButtonClass,
} from "./styles";

interface ChangePasswordFormProps {
  LinkComponent?: React.ComponentType<{
    href: string;
    className?: string;
    children: React.ReactNode;
  }>;
}

export function ChangePasswordForm({ LinkComponent }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
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
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
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

    setSuccess("Password updated successfully.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  if (hasCredentialAccount === null) {
    return <p className="text-sm text-muted-foreground">Loading security settings…</p>;
  }

  if (!hasCredentialAccount) {
    const Link = LinkComponent ?? ((p) => <a {...p} />);
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Your account uses Google sign-in. To set a password, use the forgot-password flow with
          your email address.
        </p>
        <Link href="/auth/forgot-password" className="text-sm text-gold hover:underline">
          Reset password via email
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error ? <div className={authErrorAlertClass}>{error}</div> : null}
      {success ? (
        <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          {success}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="currentPassword" className={authLabelClass}>
          Current password
        </label>
        <div className="relative">
          <input
            id="currentPassword"
            className={cn(authInputClass, "pr-10")}
            type={showCurrent ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <button
            type="button"
            aria-label={showCurrent ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            onClick={() => setShowCurrent((v) => !v)}
          >
            {showCurrent ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="newPassword" className={authLabelClass}>
          New password
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
          />
          <button
            type="button"
            aria-label={showNew ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            onClick={() => setShowNew((v) => !v)}
          >
            {showNew ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="confirmPassword" className={authLabelClass}>
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          className={authInputClass}
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
        />
      </div>

      <button
        type="submit"
        className={authSubmitButtonClass}
        disabled={changePasswordMutation.isPending}
      >
        {changePasswordMutation.isPending ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}
