import { AlertCircle, Eye, EyeOff, LoaderCircle } from "@oc/icons";
import { cn } from "@oc/utils";
import { useEffect, useState } from "react";
import { getPendingReferralRef, resolveRefFromUrl } from "../../referral/pending-ref";
import { buildVerifyRequiredParams } from "../../referral/redirect";
import { getAuthErrorMessage, signUpWithPassword } from "../actions";
import { normalizeAuthEmail } from "../normalize-email";
import { GoogleSignInButton } from "./GoogleSignInButton";
import {
  authErrorAlertClass,
  authInputClass,
  authLabelClass,
  authSubmitButtonClass,
} from "./styles";
import { TurnstileWidget } from "./TurnstileWidget";
import { useTurnstile, useTurnstileStore } from "./turnstile-store";

const turnstileStore = useTurnstileStore;

interface SignUpFormProps {
  onSuccess?: (email: string) => void;
  onAlreadyVerified?: () => void;
  loginPath?: string;
  callbackURL?: string;
  turnstileSiteKey?: string;
  renderDateOfBirthField?: (props: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    minAge: number;
    required: boolean;
  }) => React.ReactNode;
  searchParams?: URLSearchParams | null;
  refCode?: string | null;
  referrerName?: string | null;
  LinkComponent?: React.ComponentType<{
    href: string;
    className?: string;
    children?: React.ReactNode;
    target?: string;
  }>;
  compliance?: {
    masterEnabled?: boolean;
    ageVerificationEnabled?: boolean;
    ageVerificationMinAge?: number;
  } | null;
  referralDiscountPercent?: number | null;
  googleSignUpError?: boolean;
  localize?: (key: string, params?: Record<string, string | number>) => string;
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

function isDobAtLeastMinAge(dateOfBirth: string, minAge: number): boolean {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age >= minAge;
}

export function SignUpForm({
  onSuccess,
  onAlreadyVerified: _onAlreadyVerified,
  loginPath = "/auth/login",
  callbackURL,
  turnstileSiteKey,
  renderDateOfBirthField,
  searchParams,
  refCode,
  LinkComponent,
  compliance: complianceProp,
  referralDiscountPercent: referralDiscountPercentProp,
  referrerName: referrerNameProp,
  googleSignUpError = false,
  localize,
}: SignUpFormProps) {
  const resolvedSearchParams =
    searchParams ??
    new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const LinkC = LinkComponent ?? defaultLink;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const turnstile = useTurnstile();

  const compliance = complianceProp;
  const ageVerificationRequired = Boolean(
    compliance?.masterEnabled && compliance?.ageVerificationEnabled
  );
  const minAge = compliance?.ageVerificationMinAge ?? 18;
  const referralDiscountPercent = referralDiscountPercentProp;

  const [localRefCode, setLocalRefCode] = useState<string | null>(null);
  const [localReferrerName, setLocalReferrerName] = useState<string | null>(null);

  useEffect(() => {
    if (refCode || localRefCode) return;
    const stored =
      getPendingReferralRef() ??
      resolveRefFromUrl(typeof window !== "undefined" ? window.location.search : "");
    if (!stored) return;
    fetch(`/api/referral-codes/lookup/${encodeURIComponent(stored)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res?.data?.valid && res.data.code) {
          setLocalRefCode(res.data.code);
          setLocalReferrerName(res.data.referrerName ?? null);
        }
      })
      .catch(() => {});
  }, [refCode, localRefCode]);

  const effectiveReferrerName = localReferrerName ?? referrerNameProp;
  const showReferralField = Boolean(refCode ?? localRefCode);
  const referralDisplayCode = refCode ?? localRefCode;
  const passwordToggleLabel =
    localize?.(showPassword ? "auth.form.hidePassword" : "auth.form.showPassword") ??
    (showPassword ? "Hide password" : "Show password");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!acceptedTerms) {
        setError(
          localize?.("auth.form.mustAcceptTerms") ??
            "You must accept the Terms of Service and Privacy Policy to register."
        );
        setLoading(false);
        return;
      }

      if (ageVerificationRequired) {
        if (!dateOfBirth) {
          setError(localize?.("auth.form.dobRequired") ?? "Date of birth is required.");
          setLoading(false);
          return;
        }
        if (!isDobAtLeastMinAge(dateOfBirth, minAge)) {
          setError(
            localize?.("auth.form.minAgeRequired", { minAge }) ??
              `You must be at least ${minAge} years old to register.`
          );
          setLoading(false);
          return;
        }
      }

      const normalizedEmail = normalizeAuthEmail(email);
      const returnTo = resolvedSearchParams.get("returnTo");
      const verifyParams = buildVerifyRequiredParams({
        email: normalizedEmail,
        returnTo,
      });

      const result = await signUpWithPassword({
        email: normalizedEmail,
        password,
        firstName,
        lastName,
        dateOfBirth: ageVerificationRequired ? dateOfBirth : undefined,
        callbackURL: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/verify?${verifyParams.toString()}`,
        turnstileToken: turnstile.token ?? undefined,
      });

      if (result.error) {
        setLoading(false);
        turnstileStore.getState().consume();
        setError(getAuthErrorMessage(result.error));
        return;
      }

      setLoading(false);
      onSuccess?.(normalizedEmail);
    } catch {
      setLoading(false);
      turnstileStore.getState().consume();
      setError(
        localize?.("auth.form.unexpectedError") ??
          "Something unexpected happened. Please try again."
      );
    }
  }

  const googleCallbackURL =
    callbackURL ?? `${typeof window !== "undefined" ? window.location.origin : ""}/dashboard`;

  return (
    <div className="flex flex-col gap-4">
      {googleSignUpError ? (
        <div
          role="status"
          className={cn(
            "flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-300 animate-fade-in-up"
          )}
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            {localize?.("auth.form.googleSignUpNotice") ??
              "We noticed you tried signing in with Google, but no account was found. Create one below to get started."}
          </span>
        </div>
      ) : null}
      <GoogleSignInButton
        callbackURL={googleCallbackURL}
        label={localize?.("auth.form.signUpWithGoogle") ?? "Sign up with Google"}
        requestSignUp
        acceptedTerms={acceptedTerms}
      />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gold/20" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-gold/60">{localize?.("auth.form.or") ?? "or"}</span>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        data-umami-event="auth:signup-submit"
      >
        {error && (
          <div
            className={cn(authErrorAlertClass, "flex items-start gap-2 animate-fade-in-up")}
            role="alert"
          >
            <AlertCircle className="mt-0.5 size-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <label htmlFor="firstName" className={authLabelClass}>
              {localize?.("auth.form.firstName") ?? "First name"}
            </label>
            <input
              id="firstName"
              className={authInputClass}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoComplete="given-name"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="lastName" className={authLabelClass}>
              {localize?.("auth.form.lastName") ?? "Last name"}
            </label>
            <input
              id="lastName"
              className={authInputClass}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="email" className={authLabelClass}>
            {localize?.("auth.form.email") ?? "Email"}
          </label>
          <input
            id="email"
            className={authInputClass}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        {showReferralField && referralDisplayCode ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="referralCode" className={authLabelClass}>
              {localize?.("auth.form.referralCode") ?? "Referral code"}
            </label>
            <input
              id="referralCode"
              className={authInputClass}
              value={referralDisplayCode}
              disabled
            />
            {effectiveReferrerName ? (
              <p className="text-xs text-muted-foreground">
                {localize?.("auth.form.referredBy", { name: effectiveReferrerName }) ??
                  `Referred by ${effectiveReferrerName}`}
              </p>
            ) : null}
            {referralDiscountPercent != null ? (
              <p className="text-xs text-muted-foreground">
                {localize?.("auth.form.referralDiscount", { percent: referralDiscountPercent }) ??
                  `${referralDiscountPercent}% off your first order will be applied at checkout.`}
              </p>
            ) : null}
          </div>
        ) : null}

        {ageVerificationRequired ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="dateOfBirth" className={authLabelClass}>
              {localize?.("auth.form.dateOfBirth") ?? "Date of birth"}
            </label>
            {renderDateOfBirthField ? (
              renderDateOfBirthField({
                id: "dateOfBirth",
                value: dateOfBirth,
                onChange: setDateOfBirth,
                minAge,
                required: true,
              })
            ) : (
              <input
                id="dateOfBirth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className={cn(authInputClass, "h-10")}
                required
              />
            )}
            <p className="text-xs text-muted-foreground">
              {localize?.("auth.form.dobHint", { minAge }) ??
                `You must be ${minAge} or older. This is saved to your profile for checkout.`}
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className={authLabelClass}>
            {localize?.("auth.form.password") ?? "Password"}
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
              autoComplete="new-password"
            />
            <button
              type="button"
              aria-label={passwordToggleLabel}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              id="acceptedTerms"
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-gold cursor-pointer"
            />
            <span className="text-sm text-muted-foreground leading-snug">
              {localize?.("auth.form.termsAgreement") ?? "I agree to the"}{" "}
              <LinkC href="/terms" className="text-gold hover:underline" target="_blank">
                {localize?.("auth.form.termsOfService") ?? "Terms of Service"}
              </LinkC>{" "}
              and{" "}
              <LinkC href="/privacy" className="text-gold hover:underline" target="_blank">
                {localize?.("auth.form.privacyPolicy") ?? "Privacy Policy"}
              </LinkC>
            </span>
          </label>
        </div>

        <div className="flex justify-center">
          <TurnstileWidget siteKey={turnstileSiteKey} />
        </div>
        <button
          type="submit"
          className={authSubmitButtonClass}
          disabled={loading || (!!turnstileSiteKey && turnstile.isDisabled)}
          aria-busy={loading}
        >
          {loading ? (
            <>
              <LoaderCircle className="size-4 animate-spin mr-2 inline" />
              {localize?.("auth.form.creatingAccount") ?? "Creating account…"}
            </>
          ) : (
            (localize?.("auth.form.createAccount_submit") ?? "Create account")
          )}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          {localize?.("auth.form.alreadyHaveAccount") ?? "Already have an account?"}{" "}
          <LinkC href={loginPath} className="text-gold hover:underline">
            {localize?.("auth.form.signInLink") ?? "Sign in"}
          </LinkC>
        </p>
      </form>
    </div>
  );
}
