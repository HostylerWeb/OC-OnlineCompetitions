import { AlertCircle, LoaderCircle } from "@oc/icons";
import { cn } from "@oc/utils";
import { useState } from "react";
import { getAuthErrorMessage, signInWithGoogle, signUpWithGoogle } from "../actions";
import { authErrorAlertClass, authOutlineButtonClass } from "./styles";

interface GoogleSignInButtonProps {
  callbackURL?: string;
  label?: string;
  refCode?: string | null;
  requestSignUp?: boolean;
  acceptedTerms?: boolean;
  termsRequiredMessage?: string;
  localize?: (key: string, params?: Record<string, string | number>) => string;
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function GoogleSignInButton({
  callbackURL,
  label,
  requestSignUp = false,
  acceptedTerms,
  termsRequiredMessage,
  localize,
}: GoogleSignInButtonProps) {
  const resolvedLabel =
    label ?? localize?.("auth.form.continueWithGoogle") ?? "Continue with Google";
  const resolvedTermsRequired =
    termsRequiredMessage ??
    localize?.("auth.form.mustAcceptTerms") ??
    "You must accept the Terms of Service and Privacy Policy to register.";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (acceptedTerms === false) {
      setError(resolvedTermsRequired);
      return;
    }
    setLoading(true);
    setError(null);

    // Keep any existing anonymous session so the Better Auth anonymous
    // plugin's onLinkAccount (and our own guest-profile merge hook in
    // client-auth.ts) can attach the prior guest-checkout data to this
    // new verified user. The server-side multi-token session resolver
    // picks the correct cookie if both are present.

    const action = requestSignUp ? signUpWithGoogle : signInWithGoogle;
    const result = await action(callbackURL);
    if (result.error) {
      setLoading(false);
      setError(getAuthErrorMessage(result.error));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div
          className={cn(authErrorAlertClass, "flex items-start gap-2 animate-fade-in-up")}
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <button
        type="button"
        className={`${authOutlineButtonClass} inline-flex items-center justify-center gap-2`}
        disabled={loading}
        aria-busy={loading}
        onClick={handleClick}
        data-umami-event={requestSignUp ? "auth:google-signup" : "auth:google-login"}
      >
        <GoogleIcon />
        {loading ? (
          <>
            <LoaderCircle className="size-4 animate-spin mr-1" />
            {localize?.("auth.form.redirecting") ?? "Redirecting..."}
          </>
        ) : (
          resolvedLabel
        )}
      </button>
    </div>
  );
}
