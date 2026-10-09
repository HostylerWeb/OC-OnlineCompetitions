import { authClient, safelyRunAuthRequest } from "@oc/auth-client";
import { getOrigin } from "./helpers";
import { normalizeAuthEmail } from "./normalize-email";

export async function signInWithPassword(
  email: string,
  password: string,
  callbackURL?: string,
  turnstileToken?: string
) {
  return safelyRunAuthRequest(() =>
    authClient.signIn.email({
      email: normalizeAuthEmail(email),
      password,
      callbackURL: callbackURL ?? `${getOrigin()}/dashboard`,
      ...(turnstileToken
        ? { fetchOptions: { headers: { "x-captcha-response": turnstileToken } } }
        : {}),
    })
  );
}

export async function signInWithMagicLink(
  email: string,
  callbackURL?: string,
  turnstileToken?: string
) {
  return safelyRunAuthRequest(() =>
    authClient.signIn.magicLink({
      email: normalizeAuthEmail(email),
      callbackURL: callbackURL ?? `${getOrigin()}/dashboard`,
      errorCallbackURL: "/auth/error",
      ...(turnstileToken
        ? { fetchOptions: { headers: { "x-captcha-response": turnstileToken } } }
        : {}),
    })
  );
}

export async function signInWithGoogle(callbackURL?: string) {
  return safelyRunAuthRequest(() =>
    authClient.signIn.social({
      provider: "google",
      callbackURL: callbackURL ?? `${getOrigin()}/dashboard`,
    })
  );
}

export async function signUpWithGoogle(callbackURL?: string) {
  return safelyRunAuthRequest(() =>
    authClient.signIn.social({
      provider: "google",
      callbackURL: callbackURL ?? `${getOrigin()}/dashboard`,
      requestSignUp: true,
    })
  );
}

export async function signUpWithPassword(input: {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  dateOfBirth?: string;
  callbackURL?: string;
  turnstileToken?: string;
}) {
  const email = normalizeAuthEmail(input.email);
  const name = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  return safelyRunAuthRequest(() =>
    authClient.signUp.email({
      email,
      password: input.password,
      name: name || email.split("@")[0] || "User",
      firstName: input.firstName,
      lastName: input.lastName ?? "",
      ...(input.dateOfBirth ? { dateOfBirth: input.dateOfBirth } : {}),
      callbackURL:
        input.callbackURL ?? `${getOrigin()}/auth/verify?email=${encodeURIComponent(email)}`,
      ...(input.turnstileToken
        ? { fetchOptions: { headers: { "x-captcha-response": input.turnstileToken } } }
        : {}),
    } as Parameters<typeof authClient.signUp.email>[0])
  );
}

export async function sendVerificationOtp(email: string) {
  return safelyRunAuthRequest(() =>
    authClient.emailOtp.sendVerificationOtp({
      email: normalizeAuthEmail(email),
      type: "email-verification",
    })
  );
}

export async function verifyEmailOtp(email: string, otp: string) {
  return safelyRunAuthRequest(() =>
    authClient.emailOtp.verifyEmail({
      email: normalizeAuthEmail(email),
      otp: otp.trim(),
    })
  );
}

export async function requestPasswordResetOtp(email: string, turnstileToken?: string) {
  return safelyRunAuthRequest(() =>
    authClient.emailOtp.requestPasswordReset({
      email: normalizeAuthEmail(email),
      ...(turnstileToken
        ? { fetchOptions: { headers: { "x-captcha-response": turnstileToken } } }
        : {}),
    })
  );
}

export async function resetPasswordWithOtp(
  email: string,
  otp: string,
  password: string,
  turnstileToken?: string
) {
  return safelyRunAuthRequest(() =>
    authClient.emailOtp.resetPassword({
      email: normalizeAuthEmail(email),
      otp: otp.trim(),
      password,
      ...(turnstileToken
        ? { fetchOptions: { headers: { "x-captcha-response": turnstileToken } } }
        : {}),
    })
  );
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return safelyRunAuthRequest(() =>
    authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    })
  );
}

export async function sendVerificationMagicLink(email: string, callbackURL?: string) {
  return safelyRunAuthRequest(() =>
    authClient.signIn.magicLink({
      email: normalizeAuthEmail(email),
      callbackURL: callbackURL ?? `${getOrigin()}/dashboard`,
      errorCallbackURL: "/auth/error",
    })
  );
}

const ACCOUNT_EXISTS_MESSAGE = "An account with this email already exists. Please sign in.";

const OTP_ERROR_MESSAGES = {
  OTP_EXPIRED: "That code expired. We've sent a fresh one — check your inbox or tap Resend.",
  INVALID_OTP: "That code isn't valid. Check the latest email or request a new code.",
  TOO_MANY_ATTEMPTS: "Too many tries. Request a new code below.",
  EMAIL_NOT_VERIFIED: "Please verify your email before signing in.",
} as const;

const RATE_LIMITED_MESSAGE =
  "You've made too many requests. Please wait a minute before trying again.";

export function isRateLimitedError(error: { code?: string; status?: number } | null): boolean {
  if (!error) return false;
  if (error.code === "RATE_LIMITED") return true;
  if (error.status === 429) return true;
  return false;
}

export function getAuthErrorMessage(
  error: { message?: string; code?: string; status?: number } | null
): string {
  if (!error) return "Something went wrong. Please try again.";
  if (isRateLimitedError(error)) return RATE_LIMITED_MESSAGE;
  const otpMessage =
    error.code && error.code in OTP_ERROR_MESSAGES
      ? OTP_ERROR_MESSAGES[error.code as keyof typeof OTP_ERROR_MESSAGES]
      : null;
  if (otpMessage) {
    return otpMessage;
  }
  if (error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
    return ACCOUNT_EXISTS_MESSAGE;
  }
  const message = error.message?.trim();
  if (!message) return "Something went wrong. Please try again.";
  if (/already exists/i.test(message)) {
    return ACCOUNT_EXISTS_MESSAGE;
  }
  if (/not verified/i.test(message)) {
    return OTP_ERROR_MESSAGES.EMAIL_NOT_VERIFIED;
  }
  return message;
}

export function isUnverifiedEmailSignInError(
  error: { code?: string; message?: string } | null
): boolean {
  if (!error) return false;
  if (error.code === "EMAIL_NOT_VERIFIED") return true;
  return /not verified/i.test(error.message ?? "");
}

export function isOtpRecoveryError(error: { code?: string } | null): boolean {
  if (!error?.code) return false;
  return error.code === "OTP_EXPIRED" || error.code === "INVALID_OTP";
}

export { normalizeAuthEmail } from "./normalize-email";
