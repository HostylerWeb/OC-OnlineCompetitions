import { isOtpRecoveryError, sendVerificationOtp } from "./actions";
import { normalizeAuthEmail } from "./normalize-email";
import { refreshAuthSession } from "./refresh-session";
import { getSessionSnapshot } from "./session-snapshot";

export const VERIFY_OTP_ENSURED_KEY_PREFIX = "onlinecompetitions_verify_otp_ensured_";

export function getVerifyOtpEnsuredStorageKey(email: string): string {
  return `${VERIFY_OTP_ENSURED_KEY_PREFIX}${normalizeAuthEmail(email)}`;
}

export function hasVerifyOtpEnsuredFlag(email: string): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(getVerifyOtpEnsuredStorageKey(email)) === "1";
}

export function setVerifyOtpEnsuredFlag(email: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(getVerifyOtpEnsuredStorageKey(email), "1");
}

export type EnsureFreshOtpDecision =
  | {
      action: "skip";
      reason:
        | "no-email"
        | "no-session"
        | "anonymous"
        | "email-mismatch"
        | "already-ensured"
        | "code-in-url";
    }
  | { action: "send" };

export function decideEnsureFreshVerificationOtp(options: {
  pageEmail: string;
  sessionEmail: string | null | undefined;
  isAnonymous: boolean;
  hasEnsuredFlag: boolean;
  skipBecauseCodeInUrl?: boolean;
}): EnsureFreshOtpDecision {
  const pageEmail = normalizeAuthEmail(options.pageEmail);
  if (!pageEmail) {
    return { action: "skip", reason: "no-email" };
  }

  if (options.skipBecauseCodeInUrl) {
    return { action: "skip", reason: "code-in-url" };
  }

  if (!options.sessionEmail || options.isAnonymous) {
    return { action: "skip", reason: options.isAnonymous ? "anonymous" : "no-session" };
  }

  if (normalizeAuthEmail(options.sessionEmail) !== pageEmail) {
    return { action: "skip", reason: "email-mismatch" };
  }

  if (options.hasEnsuredFlag) {
    return { action: "skip", reason: "already-ensured" };
  }

  return { action: "send" };
}

export async function ensureFreshVerificationOtp(options: {
  email: string;
  /** When true, skip lazy mount resend — caller will try URL code first. */
  skipLazyBecauseCodeInUrl?: boolean;
  onSent?: () => void;
}): Promise<{ sent: boolean; skipped: boolean; reason?: string }> {
  const pageEmail = normalizeAuthEmail(options.email);
  if (!pageEmail) {
    return { sent: false, skipped: true, reason: "no-email" };
  }

  await refreshAuthSession();
  const snapshot = getSessionSnapshot();

  const decision = decideEnsureFreshVerificationOtp({
    pageEmail,
    sessionEmail: snapshot.user?.email,
    isAnonymous: snapshot.isAnonymous,
    hasEnsuredFlag: hasVerifyOtpEnsuredFlag(pageEmail),
    skipBecauseCodeInUrl: options.skipLazyBecauseCodeInUrl,
  });

  if (decision.action === "skip") {
    return { sent: false, skipped: true, reason: decision.reason };
  }

  const result = await sendVerificationOtp(pageEmail);
  if (result.error) {
    return { sent: false, skipped: true, reason: result.error.code ?? "send-failed" };
  }

  setVerifyOtpEnsuredFlag(pageEmail);
  options.onSent?.();
  return { sent: true, skipped: false };
}

export async function ensureFreshVerificationOtpAfterFailure(options: {
  email: string;
  error: { code?: string } | null;
  onSent?: () => void;
}): Promise<{ sent: boolean; skipped: boolean; reason?: string }> {
  if (!isOtpRecoveryError(options.error)) {
    return { sent: false, skipped: true, reason: "not-recoverable" };
  }

  await refreshAuthSession();
  const snapshot = getSessionSnapshot();
  const pageEmail = normalizeAuthEmail(options.email);

  const decision = decideEnsureFreshVerificationOtp({
    pageEmail,
    sessionEmail: snapshot.user?.email,
    isAnonymous: snapshot.isAnonymous,
    hasEnsuredFlag: hasVerifyOtpEnsuredFlag(pageEmail),
  });

  if (decision.action === "skip") {
    return { sent: false, skipped: true, reason: decision.reason };
  }

  const result = await sendVerificationOtp(pageEmail);
  if (result.error) {
    return { sent: false, skipped: true, reason: result.error.code ?? "send-failed" };
  }

  setVerifyOtpEnsuredFlag(pageEmail);
  options.onSent?.();
  return { sent: true, skipped: false };
}
