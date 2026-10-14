import type React from "react";
import { useEffect, useState } from "react";
import {
  authModeButtonActiveClass,
  authModeButtonClass,
  authModeButtonInactiveClass,
  authModeToggleGroupClass,
} from "./styles";
import { SignInForm } from "./SignInForm";
import { SignUpForm } from "./SignUpForm";

export type AuthAccountView = "sign-in" | "sign-up";

function parseInitialView(searchParams: URLSearchParams | null | undefined): AuthAccountView {
  const mode = searchParams?.get("mode")?.toLowerCase();
  if (mode === "sign-up" || mode === "register" || mode === "signup") {
    return "sign-up";
  }
  if (searchParams?.get("google_signup") === "1") {
    return "sign-up";
  }
  return "sign-in";
}

export interface AuthAccountFormProps {
  callbackURL?: string;
  turnstileSiteKey?: string;
  onSignInSuccess?: () => void;
  onSignUpSuccess?: (email: string) => void;
  onAlreadyVerified?: () => void;
  compliance?: {
    masterEnabled?: boolean;
    ageVerificationEnabled?: boolean;
    ageVerificationMinAge?: number;
  } | null;
  referralDiscountPercent?: number | null;
  refCode?: string | null;
  referrerName?: string | null;
  googleSignUpError?: boolean;
  renderDateOfBirthField?: (props: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    minAge: number;
    required: boolean;
  }) => React.ReactNode;
  searchParams?: URLSearchParams | null;
  localize?: (key: string, params?: Record<string, string | number>) => string;
}

export function AuthAccountForm({
  callbackURL,
  turnstileSiteKey,
  onSignInSuccess,
  onSignUpSuccess,
  onAlreadyVerified,
  compliance,
  referralDiscountPercent,
  refCode,
  referrerName,
  googleSignUpError,
  renderDateOfBirthField,
  searchParams,
  localize,
}: AuthAccountFormProps) {
  const resolvedSearchParams =
    searchParams ??
    new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");

  const [view, setView] = useState<AuthAccountView>(() => parseInitialView(resolvedSearchParams));

  useEffect(() => {
    setView(parseInitialView(resolvedSearchParams));
  }, [resolvedSearchParams.toString()]);

  const signInLabel = localize?.("header.auth.signIn") ?? "Sign In";
  const signUpLabel = localize?.("header.auth.signUp") ?? "Sign Up";

  return (
    <div className="flex flex-col gap-5">
      <fieldset
        className={authModeToggleGroupClass}
        aria-label={localize?.("auth.form.accountMode") ?? "Account access"}
      >
        <button
          type="button"
          className={`${authModeButtonClass} ${view === "sign-in" ? authModeButtonActiveClass : authModeButtonInactiveClass}`}
          aria-pressed={view === "sign-in"}
          onClick={() => setView("sign-in")}
        >
          {signInLabel}
        </button>
        <button
          type="button"
          className={`${authModeButtonClass} ${view === "sign-up" ? authModeButtonActiveClass : authModeButtonInactiveClass}`}
          aria-pressed={view === "sign-up"}
          onClick={() => setView("sign-up")}
        >
          {signUpLabel}
        </button>
      </fieldset>

      {view === "sign-in" ? (
        <SignInForm
          callbackURL={callbackURL}
          onSuccess={onSignInSuccess}
          turnstileSiteKey={turnstileSiteKey}
          showSignUpLink={false}
          searchParams={resolvedSearchParams}
          localize={localize}
        />
      ) : (
        <SignUpForm
          callbackURL={callbackURL}
          onSuccess={onSignUpSuccess}
          onAlreadyVerified={onAlreadyVerified}
          turnstileSiteKey={turnstileSiteKey}
          compliance={compliance}
          referralDiscountPercent={referralDiscountPercent}
          refCode={refCode}
          referrerName={referrerName}
          googleSignUpError={googleSignUpError}
          renderDateOfBirthField={renderDateOfBirthField}
          searchParams={resolvedSearchParams}
          showLoginLink={false}
          localize={localize}
        />
      )}
    </div>
  );
}
