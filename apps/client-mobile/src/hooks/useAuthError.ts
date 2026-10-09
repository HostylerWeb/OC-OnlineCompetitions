import type { AuthRedirectErrorKind } from "@oc/api-client";
import {
  buildLoginUrl,
  buildSignUpUrl,
  isExistingAccountRedirectError,
  parseRefFromSearch,
  resolveAuthRedirectError,
  sanitizeReturnTo,
} from "@oc/api-client";
import { ArrowLeft, HelpCircle, Home, KeyRound, LogIn, Settings, UserPlus } from "@oc/icons";
import { useEffect, useMemo } from "react";
import type { PageAction } from "@/components/layout/PageActionButtons";
import { localeHref, type TranslationKey, useTranslation } from "@/lib/i18n";

const PROFILE_SECURITY_PATH = "/dashboard/profile?tab=security";

const isSentryEnabled = () => false;

function buildAuthErrorActions(options: {
  kind: AuthRedirectErrorKind;
  loginHref: string;
  signUpHref: string;
  profileSecurityHref: string;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}): PageAction[] {
  const back: PageAction = {
    label: options.t("auth.errorActions.goBack"),
    onClick: () => {
      if (typeof window !== "undefined") window.history.back();
    },
    icon: ArrowLeft,
    variant: "outline",
  };

  const signIn: PageAction = {
    label: options.t("auth.errorActions.signIn"),
    href: options.loginHref,
    icon: LogIn,
    variant: "gold",
  };

  const signUp: PageAction = {
    label: options.t("auth.errorActions.createAccount"),
    href: options.signUpHref,
    icon: UserPlus,
    variant: "outline",
  };

  const profile: PageAction = {
    label: options.t("auth.errorActions.accountSettings"),
    href: options.profileSecurityHref,
    icon: Settings,
    variant: "gold",
  };

  switch (options.kind) {
    case "google_email_mismatch":
      return [back, profile];
    case "account_exists":
      return [back, signIn];
    case "email_verification":
      return [back, signIn];
    case "password_reset":
      return [
        back,
        {
          label: options.t("auth.errorActions.resetPassword"),
          href: "/auth/forgot-password",
          icon: KeyRound,
          variant: "gold",
        },
        {
          label: options.t("auth.errorActions.signIn"),
          href: options.loginHref,
          icon: LogIn,
          variant: "outline",
        },
      ];
    case "account_linking":
      return [
        back,
        profile,
        {
          label: options.t("auth.errorActions.signIn"),
          href: options.loginHref,
          icon: LogIn,
          variant: "outline",
        },
      ];
    case "session":
      return [back, signIn];
    case "banned":
    case "access_denied":
      return [
        back,
        {
          label: options.t("auth.errorActions.contactSupport"),
          href: "/contact",
          icon: HelpCircle,
          variant: "gold",
        },
        { label: options.t("auth.errorActions.home"), href: "/", icon: Home, variant: "outline" },
      ];
    case "rate_limited":
      return [back, signIn];
    case "oauth_retry":
      return [back, signIn, signUp];
    case "signup_disabled":
      return [back, signUp];
    default:
      return [back, signIn, signUp];
  }
}

export function useAuthError() {
  const { t, locale } = useTranslation();
  const searchParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();

  const errorCode = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const returnTo = sanitizeReturnTo(
    searchParams.get("returnTo") ?? searchParams.get("callback-url")
  );
  const ref = parseRefFromSearch(`?${searchParams.toString()}`);

  const resolved = useMemo(
    () => resolveAuthRedirectError(errorCode, errorDescription),
    [errorCode, errorDescription]
  );

  const { errorCode: normalizedCode } = resolved;

  const translatedTitle = useMemo(() => {
    if (!normalizedCode) return resolved.title;
    const key = `authErrors.${normalizedCode}.title` as TranslationKey;
    const result = t(key);
    return result === key ? resolved.title : result;
  }, [normalizedCode, resolved.title, t]);

  const translatedMessage = useMemo(() => {
    if (!normalizedCode) return resolved.message;
    const key = `authErrors.${normalizedCode}.message` as TranslationKey;
    const result = t(key);
    return result === key ? resolved.message : result;
  }, [normalizedCode, resolved.message, t]);

  const loginHref = localeHref(
    buildLoginUrl({
      returnTo,
      existingAccount: isExistingAccountRedirectError(normalizedCode),
    }),
    locale
  );
  const signUpHref = localeHref(
    (() => {
      if (ref) return buildSignUpUrl(ref, returnTo);
      if (!returnTo) return "/auth/sign-up";
      return `/auth/sign-up?returnTo=${encodeURIComponent(returnTo)}`;
    })(),
    locale
  );

  const actions = useMemo(
    () =>
      buildAuthErrorActions({
        kind: resolved.kind,
        loginHref,
        signUpHref,
        profileSecurityHref: PROFILE_SECURITY_PATH,
        t,
      }),
    [resolved.kind, loginHref, signUpHref, t]
  );

  useEffect(() => {
    if (!normalizedCode || !isSentryEnabled()) return;
  }, [normalizedCode, resolved.kind, errorDescription, returnTo]);

  useEffect(() => {
    if (resolved.kind !== "signup_disabled") return;
    const redirectUrl = signUpHref
      ? `${signUpHref}${signUpHref.includes("?") ? "&" : "?"}google_signup=1`
      : "/auth/sign-up?google_signup=1";
    const timeout = setTimeout(() => {
      window.location.href = redirectUrl;
    }, 0);
    return () => clearTimeout(timeout);
  }, [resolved.kind, signUpHref]);

  return {
    title: translatedTitle,
    message: translatedMessage,
    errorCode: resolved.errorCode,
    kind: resolved.kind,
    returnTo,
    actions,
    showTechnicalCode: process.env.NODE_ENV === "development",
  };
}
