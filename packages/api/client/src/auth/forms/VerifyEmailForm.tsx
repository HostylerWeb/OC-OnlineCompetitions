import { AlertCircle, CheckCircle, LoaderCircle } from "@oc/icons";
import { cn } from "@oc/utils";
import { useEffect, useRef, useState } from "react";
import { useResendVerification, useVerifyEmail } from "../../hooks/auth";
import { getAuthErrorMessage } from "../actions";
import { normalizeAuthEmail } from "../normalize-email";
import {
  authErrorAlertClass,
  authInputClass,
  authLabelClass,
  authOutlineButtonClass,
  authSubmitButtonClass,
  authSuccessAlertClass,
} from "./styles";

interface VerifyEmailFormProps {
  email: string;
  initialCode?: string;
  onVerified?: () => void;
  onAutoVerifyFailed?: (error: { code?: string; message?: string }) => Promise<boolean>;
  recoveryMessage?: string | null;
  onResend?: () => void;
  localize?: (key: string, params?: Record<string, string | number>) => string;
}

export function VerifyEmailForm({
  email,
  initialCode = "",
  onVerified,
  onAutoVerifyFailed,
  recoveryMessage,
  onResend,
  localize,
}: VerifyEmailFormProps) {
  const normalizedEmail = normalizeAuthEmail(email);
  const [code, setCode] = useState(initialCode);
  const [autoVerifyFailed, setAutoVerifyFailed] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendCooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const verifyMutation = useVerifyEmail();
  const resendMutation = useResendVerification();
  const autoVerifyStarted = useRef(false);

  useEffect(() => {
    if (resendCooldown <= 0) {
      if (resendCooldownRef.current) {
        clearInterval(resendCooldownRef.current);
        resendCooldownRef.current = null;
      }
      return;
    }
    resendCooldownRef.current = setInterval(() => {
      setResendCooldown((t) => t - 1);
    }, 1000);
    return () => {
      if (resendCooldownRef.current) {
        clearInterval(resendCooldownRef.current);
        resendCooldownRef.current = null;
      }
    };
  }, [resendCooldown]);

  async function verifyWithCode(otp: string) {
    await verifyMutation.mutateAsync({
      email: normalizedEmail,
      code: otp,
    });
    onVerified?.();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await verifyWithCode(code);
    } catch {}
  }

  // Fallback auto-verify via initialCode. Primary path is server-side GET /api/verify-email-link.
  useEffect(() => {
    if (!normalizedEmail || initialCode.length !== 6 || autoVerifyStarted.current) return;
    autoVerifyStarted.current = true;

    void (async () => {
      try {
        await verifyWithCode(initialCode);
      } catch (error) {
        setAutoVerifyFailed(true);
        setCode("");
        if (onAutoVerifyFailed) {
          await onAutoVerifyFailed(error as { code?: string; message?: string });
        }
      }
    })();
  }, [normalizedEmail, initialCode]);

  const isVerifying = Boolean(verifyMutation.isPending);

  return (
    <div className="flex flex-col gap-4">
      {isVerifying ? (
        <div className={cn(authSuccessAlertClass, "flex items-center gap-2")} role="status">
          <LoaderCircle className="size-4 animate-spin" />
          <span>{localize?.("auth.form.verifyingEmail") ?? "Verifying your email…"}</span>
        </div>
      ) : null}

      {recoveryMessage ? (
        <div
          className={cn(authSuccessAlertClass, "flex items-start gap-2 animate-fade-in-up")}
          role="status"
        >
          <CheckCircle className="mt-0.5 size-5 shrink-0" />
          <span>{recoveryMessage}</span>
        </div>
      ) : null}

      {autoVerifyFailed && initialCode ? (
        <div
          className={cn(authErrorAlertClass, "flex items-start gap-2 animate-fade-in-up")}
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <span>
            {getAuthErrorMessage(
              (verifyMutation.error as { message?: string; code?: string }) ?? {
                code: "INVALID_OTP",
              }
            )}
          </span>
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        data-umami-event="auth:verify-submit"
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="code" className={authLabelClass}>
            {localize?.("auth.form.verificationCode") ?? "Verification code"}
          </label>
          <input
            id="code"
            className={authInputClass}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            required
            autoComplete="one-time-code"
          />
        </div>
        <button
          type="submit"
          className={authSubmitButtonClass}
          disabled={isVerifying || code.length < 6}
          aria-busy={isVerifying}
        >
          {isVerifying ? (
            <>
              <LoaderCircle className="size-4 animate-spin mr-2 inline" />
              {localize?.("auth.form.verifying") ?? "Verifying…"}
            </>
          ) : (
            (localize?.("auth.form.verifyEmail") ?? "Verify email")
          )}
        </button>
      </form>

      {resendCooldown > 0 ? (
        <div
          className="animate-fade-in-up rounded-lg border border-success/20 bg-success/10 p-4 text-sm flex items-start gap-3"
          role="status"
        >
          <CheckCircle className="mt-0.5 size-5 shrink-0 text-success" />
          <div>
            <p className="font-medium text-success">
              {localize?.("auth.form.codeResent") ?? "Code resent!"}
            </p>
            <p className="text-success/80 mt-1">
              {localize?.("auth.form.resendCooldown", { seconds: resendCooldown }) ??
                `Resend in ${resendCooldown}s…`}
            </p>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={authOutlineButtonClass}
          disabled={resendMutation.isPending}
          aria-busy={resendMutation.isPending}
          onClick={() => {
            resendMutation.mutate({ email: normalizedEmail });
            setResendCooldown(30);
            onResend?.();
          }}
        >
          {resendMutation.isPending ? (
            <>
              <LoaderCircle className="size-4 animate-spin mr-2 inline" />
              {localize?.("auth.form.sending") ?? "Sending…"}
            </>
          ) : (
            (localize?.("auth.form.resendVerification") ?? "Resend verification code")
          )}
        </button>
      )}

      {(verifyMutation.error || resendMutation.error) && !autoVerifyFailed ? (
        <div
          className={cn(authErrorAlertClass, "flex items-start gap-2 animate-fade-in-up")}
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <span>
            {getAuthErrorMessage(
              (verifyMutation.error ?? resendMutation.error) as {
                message?: string;
                code?: string;
              }
            )}
          </span>
        </div>
      ) : null}

      {resendMutation.isSuccess && resendCooldown <= 0 && (
        <div
          className={cn(authSuccessAlertClass, "flex items-start gap-2 animate-fade-in-up")}
          role="status"
        >
          <CheckCircle className="mt-0.5 size-5 shrink-0" />
          <span>
            {localize?.("auth.form.codeSent", { email: normalizedEmail }) ??
              `A new verification code was sent to ${normalizedEmail}. Check your inbox and spam folder.`}
          </span>
        </div>
      )}
    </div>
  );
}
