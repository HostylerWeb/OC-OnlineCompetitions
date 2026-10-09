export interface AuthRedirectErrorContent {
  title: string;
  message: string;
}

export type AuthRedirectErrorKind =
  | "google_email_mismatch"
  | "account_exists"
  | "email_verification"
  | "password_reset"
  | "oauth_retry"
  | "account_linking"
  | "session"
  | "access_denied"
  | "banned"
  | "rate_limited"
  | "signup_disabled"
  | "default";

interface AuthRedirectErrorDefinition extends AuthRedirectErrorContent {
  kind: AuthRedirectErrorKind;
}

const DEFAULT_REDIRECT_ERROR: AuthRedirectErrorDefinition = {
  kind: "default",
  title: "Authentication error",
  message:
    "Something went wrong during sign-in. Please try again or contact support if it keeps happening.",
};

/**
 * User-facing copy for Better Auth `/api/auth-error` redirects.
 * Covers @better-auth/core BASE_ERROR_CODES, OAuth callback codes, and plugin redirects.
 */
const AUTH_REDIRECT_ERRORS: Record<string, AuthRedirectErrorDefinition> = {
  // —— Core (BASE_ERROR_CODES) ——
  USER_NOT_FOUND: {
    kind: "default",
    title: "Account not found",
    message:
      "We couldn't find an account with those details. Check your email or create a new account.",
  },
  FAILED_TO_CREATE_USER: {
    kind: "default",
    title: "Couldn't create account",
    message: "We couldn't finish creating your account. Please try again in a moment.",
  },
  FAILED_TO_CREATE_SESSION: {
    kind: "session",
    title: "Couldn't sign you in",
    message: "We couldn't start your session. Please sign in again.",
  },
  FAILED_TO_UPDATE_USER: {
    kind: "default",
    title: "Couldn't update account",
    message: "We couldn't save your account changes. Please try again.",
  },
  FAILED_TO_GET_SESSION: {
    kind: "session",
    title: "Session problem",
    message: "We couldn't load your session. Sign in again to continue.",
  },
  INVALID_PASSWORD: {
    kind: "default",
    title: "Incorrect password",
    message: "That password isn't correct. Try again or reset your password.",
  },
  INVALID_EMAIL: {
    kind: "default",
    title: "Invalid email",
    message: "That email address doesn't look valid. Check it and try again.",
  },
  INVALID_EMAIL_OR_PASSWORD: {
    kind: "default",
    title: "Sign-in failed",
    message: "That email or password isn't correct. Check your details and try again.",
  },
  INVALID_USER: {
    kind: "default",
    title: "Sign-in failed",
    message: "We couldn't verify your account for this action. Sign in again and retry.",
  },
  SOCIAL_ACCOUNT_ALREADY_LINKED: {
    kind: "account_linking",
    title: "Account already linked",
    message: "This social account is already linked to another Online Competitions account.",
  },
  PROVIDER_NOT_FOUND: {
    kind: "oauth_retry",
    title: "Sign-in provider unavailable",
    message:
      "That sign-in provider isn't available right now. Try email sign-in or another method.",
  },
  INVALID_TOKEN: {
    kind: "password_reset",
    title: "Link expired",
    message:
      "This link is invalid or has expired. Request a new password reset or verification email.",
  },
  TOKEN_EXPIRED: {
    kind: "password_reset",
    title: "Link expired",
    message: "This link has expired. Request a new one and try again.",
  },
  ID_TOKEN_NOT_SUPPORTED: {
    kind: "oauth_retry",
    title: "Sign-in not supported",
    message: "This sign-in method isn't supported. Try signing in with email or Google.",
  },
  FAILED_TO_GET_USER_INFO: {
    kind: "oauth_retry",
    title: "Couldn't load profile",
    message:
      "We couldn't get your details from the sign-in provider. Try again or use email sign-in.",
  },
  USER_EMAIL_NOT_FOUND: {
    kind: "oauth_retry",
    title: "Email required",
    message:
      "We need an email address from your sign-in provider. Try another account or sign up with email.",
  },
  EMAIL_NOT_VERIFIED: {
    kind: "email_verification",
    title: "Verify your email",
    message:
      "Please verify your email before signing in. Check your inbox for a verification code or link.",
  },
  PASSWORD_TOO_SHORT: {
    kind: "default",
    title: "Password too short",
    message: "Choose a longer password that meets our security requirements.",
  },
  PASSWORD_TOO_LONG: {
    kind: "default",
    title: "Password too long",
    message: "Your password exceeds the maximum length. Shorten it and try again.",
  },
  USER_ALREADY_EXISTS: {
    kind: "account_exists",
    title: "Account already exists",
    message: "An account with this email already exists. Sign in to continue.",
  },
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: {
    kind: "account_exists",
    title: "Account already exists",
    message: "An account with this email already exists. Sign in to continue.",
  },
  EMAIL_CAN_NOT_BE_UPDATED: {
    kind: "default",
    title: "Email can't be changed",
    message: "Your email address can't be updated this way. Contact support if you need help.",
  },
  CHANGE_EMAIL_DISABLED: {
    kind: "default",
    title: "Email change disabled",
    message:
      "Changing your email isn't available right now. Contact support if you need assistance.",
  },
  CREDENTIAL_ACCOUNT_NOT_FOUND: {
    kind: "default",
    title: "No password set",
    message:
      "This account doesn't have a password yet. Sign in with Google or set a password from your profile.",
  },
  SESSION_EXPIRED: {
    kind: "session",
    title: "Session expired",
    message: "Your session has expired. Sign in again to continue.",
  },
  FAILED_TO_UNLINK_LAST_ACCOUNT: {
    kind: "account_linking",
    title: "Can't unlink account",
    message:
      "You must keep at least one way to sign in. Add another method before unlinking this one.",
  },
  ACCOUNT_NOT_FOUND: {
    kind: "default",
    title: "Account not found",
    message: "We couldn't find that linked account. Try connecting it again from your profile.",
  },
  USER_ALREADY_HAS_PASSWORD: {
    kind: "default",
    title: "Password already set",
    message: "This account already has a password. Sign in with your password to continue.",
  },
  CROSS_SITE_NAVIGATION_LOGIN_BLOCKED: {
    kind: "access_denied",
    title: "Sign-in blocked",
    message:
      "This sign-in request was blocked for security reasons. Open Online Competitions in your browser and try again.",
  },
  VERIFICATION_EMAIL_NOT_ENABLED: {
    kind: "email_verification",
    title: "Verification unavailable",
    message:
      "Email verification isn't enabled. Contact support if you need help accessing your account.",
  },
  EMAIL_ALREADY_VERIFIED: {
    kind: "email_verification",
    title: "Email already verified",
    message: "This email is already verified. You can sign in now.",
  },
  EMAIL_MISMATCH: {
    kind: "google_email_mismatch",
    title: "Email doesn't match",
    message: "The email from your sign-in provider doesn't match your Online Competitions account email.",
  },
  SESSION_NOT_FRESH: {
    kind: "session",
    title: "Please sign in again",
    message: "This action needs a fresh sign-in. Sign out and sign in again, then retry.",
  },
  LINKED_ACCOUNT_ALREADY_EXISTS: {
    kind: "account_linking",
    title: "Account already linked",
    message: "This provider is already linked to your account or another user.",
  },
  INVALID_ORIGIN: {
    kind: "access_denied",
    title: "Invalid request",
    message:
      "This sign-in request came from an unrecognised source. Open the site directly and try again.",
  },
  INVALID_CALLBACK_URL: {
    kind: "oauth_retry",
    title: "Sign-in interrupted",
    message: "The return address for sign-in wasn't valid. Start again from the Online Competitions website.",
  },
  INVALID_REDIRECT_URL: {
    kind: "oauth_retry",
    title: "Sign-in interrupted",
    message: "The redirect after sign-in wasn't valid. Start again from the Online Competitions website.",
  },
  INVALID_ERROR_CALLBACK_URL: {
    kind: "oauth_retry",
    title: "Sign-in interrupted",
    message: "Something went wrong configuring sign-in. Start again from the home page.",
  },
  INVALID_NEW_USER_CALLBACK_URL: {
    kind: "oauth_retry",
    title: "Sign-in interrupted",
    message: "We couldn't complete your new account setup. Try signing up again.",
  },
  MISSING_OR_NULL_ORIGIN: {
    kind: "access_denied",
    title: "Invalid request",
    message: "This sign-in request was incomplete. Open Online Competitions in your browser and try again.",
  },
  CALLBACK_URL_REQUIRED: {
    kind: "oauth_retry",
    title: "Sign-in interrupted",
    message: "Sign-in couldn't continue. Go back to the site and try again.",
  },
  FAILED_TO_CREATE_VERIFICATION: {
    kind: "email_verification",
    title: "Couldn't send verification",
    message: "We couldn't create a verification code. Wait a moment and try again.",
  },
  FIELD_NOT_ALLOWED: {
    kind: "default",
    title: "Invalid details",
    message: "Some of the information provided isn't allowed. Check your entries and try again.",
  },
  ASYNC_VALIDATION_NOT_SUPPORTED: {
    kind: "default",
    title: "Validation error",
    message: "We couldn't validate your details. Please try again.",
  },
  VALIDATION_ERROR: {
    kind: "default",
    title: "Check your details",
    message: "Some information wasn't valid. Review the form and try again.",
  },
  MISSING_FIELD: {
    kind: "default",
    title: "Missing information",
    message: "Please fill in all required fields and try again.",
  },
  METHOD_NOT_ALLOWED_DEFER_SESSION_REQUIRED: {
    kind: "session",
    title: "Session configuration",
    message:
      "This action isn't available with the current session setup. Contact support if this persists.",
  },
  BODY_MUST_BE_AN_OBJECT: {
    kind: "default",
    title: "Invalid request",
    message: "The sign-in request wasn't valid. Refresh the page and try again.",
  },
  PASSWORD_ALREADY_SET: {
    kind: "default",
    title: "Password already set",
    message: "You already have a password on this account. Sign in with your password.",
  },

  // —— Email OTP plugin ——
  OTP_EXPIRED: {
    kind: "email_verification",
    title: "Code expired",
    message:
      "That verification code has expired. Request a new code from the sign-in or verify page.",
  },
  INVALID_OTP: {
    kind: "email_verification",
    title: "Invalid code",
    message: "That verification code isn't valid. Check your latest email or request a new code.",
  },
  TOO_MANY_ATTEMPTS: {
    kind: "rate_limited",
    title: "Too many attempts",
    message: "Too many tries with that code. Wait a moment, then request a new code.",
  },

  // —— OAuth / callback redirect codes (often lowercase) ——
  "email_doesn't_match": {
    kind: "google_email_mismatch",
    title: "Google account doesn't match",
    message:
      "The Google account you chose uses a different email than your Online Competitions account. Connect the Google account that uses the same email, or sign in with email instead.",
  },
  email_doesnt_match: {
    kind: "google_email_mismatch",
    title: "Google account doesn't match",
    message:
      "The Google account you chose uses a different email than your Online Competitions account. Connect the Google account that uses the same email, or sign in with email instead.",
  },
  invalid_callback_request: {
    kind: "oauth_retry",
    title: "Sign-in interrupted",
    message: "The sign-in callback wasn't valid. Start sign-in again from the Online Competitions website.",
  },
  state_not_found: {
    kind: "oauth_retry",
    title: "Sign-in interrupted",
    message: "Your sign-in session was lost. Close this tab, return to Online Competitions, and try again.",
  },
  state_mismatch: {
    kind: "oauth_retry",
    title: "Sign-in interrupted",
    message: "Your sign-in session expired or was interrupted. Start again from the sign-in page.",
  },
  please_restart_the_process: {
    kind: "oauth_retry",
    title: "Start again",
    message: "Sign-in couldn't be completed. Go back to Online Competitions and start the process again.",
  },
  no_code: {
    kind: "oauth_retry",
    title: "Sign-in cancelled",
    message:
      "Sign-in didn't finish. You may have closed the provider window — try again when ready.",
  },
  oauth_provider_not_found: {
    kind: "oauth_retry",
    title: "Provider unavailable",
    message: "That sign-in provider isn't available. Try Google or email sign-in instead.",
  },
  OAUTH_PROVIDER_NOT_FOUND: {
    kind: "oauth_retry",
    title: "Provider unavailable",
    message: "That sign-in provider isn't available. Try Google or email sign-in instead.",
  },
  invalid_code: {
    kind: "oauth_retry",
    title: "Sign-in failed",
    message: "The authorisation code wasn't accepted. Try signing in again.",
  },
  unable_to_get_user_info: {
    kind: "oauth_retry",
    title: "Couldn't load profile",
    message: "We couldn't load your profile from the provider. Try again or use email sign-in.",
  },
  no_callback_url: {
    kind: "oauth_retry",
    title: "Sign-in interrupted",
    message: "Sign-in couldn't return you to the site. Start again from the Online Competitions homepage.",
  },
  unable_to_link_account: {
    kind: "account_linking",
    title: "Couldn't link account",
    message: "We couldn't link this provider to your account. Try again from Account settings.",
  },
  account_already_linked_to_different_user: {
    kind: "account_linking",
    title: "Account already in use",
    message: "This Google account is already linked to a different Online Competitions user.",
  },
  email_not_found: {
    kind: "oauth_retry",
    title: "Email required",
    message:
      "Your Google account must share an email address with Online Competitions. Check your Google settings or use email sign-in.",
  },
  account_not_linked: {
    kind: "account_linking",
    title: "Account not linked",
    message:
      "This provider isn't linked to your account yet. Connect it from Account settings while signed in.",
  },
  signup_disabled: {
    kind: "signup_disabled",
    title: "Account not found",
    message:
      "This Google account isn't registered with Online Competitions. Create a new account to get started.",
  },
  unable_to_create_user: {
    kind: "default",
    title: "Couldn't create account",
    message: "We couldn't create your account. Try again or contact support.",
  },
  unable_to_create_session: {
    kind: "session",
    title: "Couldn't sign you in",
    message: "Your account was found but we couldn't start a session. Try signing in again.",
  },
  internal_server_error: {
    kind: "default",
    title: "Something went wrong",
    message: "A server error occurred during sign-in. Please try again in a few minutes.",
  },
  payload_expired: {
    kind: "oauth_retry",
    title: "Sign-in expired",
    message: "The sign-in request took too long. Start again from the Online Competitions website.",
  },
  user_creation_failed: {
    kind: "default",
    title: "Couldn't create account",
    message: "We couldn't finish setting up your account. Try again or contact support.",
  },
  missing_profile: {
    kind: "oauth_retry",
    title: "Profile missing",
    message:
      "We didn't receive a complete profile from the provider. Try again or use email sign-in.",
  },
  invalid_profile: {
    kind: "oauth_retry",
    title: "Invalid profile",
    message: "The profile from your sign-in provider wasn't valid. Try a different account.",
  },
  invalid_payload: {
    kind: "oauth_retry",
    title: "Sign-in interrupted",
    message: "Sign-in data was invalid. Start again from the Online Competitions website.",
  },
  oAuth_code_missing: {
    kind: "oauth_retry",
    title: "Sign-in cancelled",
    message: "Sign-in didn't complete. Try again when you're ready.",
  },
  issuer_mismatch: {
    kind: "oauth_retry",
    title: "Sign-in provider error",
    message: "The sign-in provider didn't match what we expected. Try again or use another method.",
  },
  issuer_missing: {
    kind: "oauth_retry",
    title: "Sign-in provider error",
    message: "Sign-in provider information was missing. Try again from the Online Competitions website.",
  },
  oauth_code_verification_failed: {
    kind: "oauth_retry",
    title: "Sign-in failed",
    message: "We couldn't verify the sign-in code. Try signing in again.",
  },
  user_info_is_missing: {
    kind: "oauth_retry",
    title: "Profile missing",
    message: "We didn't receive your profile from the provider. Try again.",
  },
  email_is_missing: {
    kind: "oauth_retry",
    title: "Email required",
    message: "An email address is required to continue. Use a provider that shares your email.",
  },
  name_is_missing: {
    kind: "oauth_retry",
    title: "Name required",
    message:
      "We need your name from the sign-in provider. Check your provider profile and try again.",
  },
  access_denied: {
    kind: "access_denied",
    title: "Access denied",
    message: "You declined access or don't have permission to sign in with this provider.",
  },
  ACCESS_DENIED: {
    kind: "access_denied",
    title: "Access denied",
    message: "You don't have permission to complete this action.",
  },
  banned: {
    kind: "banned",
    title: "Account restricted",
    message:
      "This account can't sign in right now. Contact support if you believe this is a mistake.",
  },
  invalid_client: {
    kind: "access_denied",
    title: "Sign-in unavailable",
    message: "This sign-in application isn't recognised. Use the main Online Competitions website to sign in.",
  },
  client_disabled: {
    kind: "access_denied",
    title: "Sign-in disabled",
    message: "This sign-in method has been disabled. Try email or Google sign-in instead.",
  },
  unsupported_response_type: {
    kind: "access_denied",
    title: "Sign-in not supported",
    message: "This type of sign-in isn't supported. Use the Online Competitions website to sign in.",
  },
  RATE_LIMIT_EXCEEDED: {
    kind: "rate_limited",
    title: "Too many attempts",
    message: "Too many requests. Wait a moment, then try again.",
  },
  UNKNOWN: {
    kind: "default",
    title: "Authentication error",
    message: DEFAULT_REDIRECT_ERROR.message,
  },
};

function normalizeRedirectErrorCode(code: string | null | undefined): string | null {
  const trimmed = code?.trim();
  if (!trimmed) return null;
  return trimmed;
}

/** Lookup keys: exact, UPPER_SNAKE, and normalized lowercase OAuth variants. */
function lookupKeys(code: string): string[] {
  const keys = new Set<string>([code]);
  const upper = code
    .replace(/['’]/g, "_")
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
  keys.add(upper);
  const lower = code.toLowerCase();
  keys.add(lower);
  if (lower.includes("doesn_t_match") || lower.includes("doesnt_match")) {
    keys.add("email_doesn't_match");
    keys.add("email_doesnt_match");
  }
  return [...keys];
}

function humanizeErrorCode(code: string): string {
  return code
    .replace(/['’]/g, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function lookupDefinition(code: string): AuthRedirectErrorDefinition | undefined {
  for (const key of lookupKeys(code)) {
    const found = AUTH_REDIRECT_ERRORS[key];
    if (found) return found;
  }
  return undefined;
}

export function resolveAuthRedirectError(
  code: string | null | undefined,
  errorDescription?: string | null
): AuthRedirectErrorContent & { errorCode: string | null; kind: AuthRedirectErrorKind } {
  const errorCode = normalizeRedirectErrorCode(code);
  if (!errorCode) {
    return { ...DEFAULT_REDIRECT_ERROR, errorCode: null };
  }

  const mapped = lookupDefinition(errorCode);
  if (mapped) {
    return { title: mapped.title, message: mapped.message, errorCode, kind: mapped.kind };
  }

  const description = errorDescription?.trim();
  if (description) {
    return {
      title: humanizeErrorCode(errorCode),
      message: description,
      errorCode,
      kind: "default",
    };
  }

  return {
    title: humanizeErrorCode(errorCode),
    message: DEFAULT_REDIRECT_ERROR.message,
    errorCode,
    kind: "default",
  };
}

export function isExistingAccountRedirectError(errorCode: string | null): boolean {
  if (!errorCode) return false;
  return resolveAuthRedirectError(errorCode).kind === "account_exists";
}

export function isGoogleEmailMismatchError(errorCode: string | null): boolean {
  if (!errorCode) return false;
  return resolveAuthRedirectError(errorCode).kind === "google_email_mismatch";
}

export function isAuthRedirectErrorKind(
  errorCode: string | null,
  kind: AuthRedirectErrorKind
): boolean {
  if (!errorCode) return false;
  return resolveAuthRedirectError(errorCode).kind === kind;
}
