"use client";
import { Eye, EyeOff } from "@oc/icons";
import { cn } from "@oc/utils";
import { useState } from "react";
import { useMyProfile, usePublicComplianceSettings, usePublicReferralSettings } from "../../hooks";
import { setPendingReferralRef } from "../../referral/pending-ref";
import { buildVerifyRequiredParams, parseRefFromSearch } from "../../referral/redirect";
import { getAuthErrorMessage, signUpWithPassword } from "../actions";
import { normalizeAuthEmail } from "../normalize-email";
import { useAuth } from "../use-auth";
import { GoogleSignInButton } from "./GoogleSignInButton";
import {
  authErrorAlertClass,
  authInputClass,
  authLabelClass,
  authSubmitButtonClass,
} from "./styles";
import { TurnstileWidget } from "./TurnstileWidget";

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
  LinkComponent?: React.ComponentType<{
    href: string;
    className?: string;
    children?: React.ReactNode;
    target?: string;
  }>;
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
  LinkComponent,
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
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { user } = useAuth();
  const refFromUrl = parseRefFromSearch(`?${resolvedSearchParams.toString()}`);
  const { data: profileResponse } = useMyProfile({ enabled: !!user });
  const { data: referralSettingsResponse } = usePublicReferralSettings();
  const { data: complianceResponse } = usePublicComplianceSettings();
  const compliance = complianceResponse?.data;
  const ageVerificationRequired = Boolean(
    compliance?.masterEnabled && compliance?.ageVerificationEnabled
  );
  const minAge = compliance?.ageVerificationMinAge ?? 18;
  const referredByCode = profileResponse?.data?.referredByCode ?? null;
  const referralDiscountPercent =
    ((
      (referralSettingsResponse?.data as Record<string, unknown>)?.refereeReward as
        | Record<string, unknown>
        | undefined
    )?.discountPercent as number) ?? null;
  const showReferralField = Boolean(refFromUrl || referredByCode);
  const referralDisplayCode = refFromUrl ?? referredByCode;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!acceptedTerms) {
        setError("You must accept the Terms of Service and Privacy Policy to register.");
        setLoading(false);
        return;
      }

      if (ageVerificationRequired) {
        if (!dateOfBirth) {
          setError("Date of birth is required.");
          setLoading(false);
          return;
        }
        if (!isDobAtLeastMinAge(dateOfBirth, minAge)) {
          setError(`You must be at least ${minAge} years old to register.`);
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
        turnstileToken: turnstileToken ?? undefined,
        dateOfBirth: ageVerificationRequired ? dateOfBirth : undefined,
        callbackURL: `${window.location.origin}/auth/verify?${verifyParams.toString()}`,
      });

      if (result.error) {
        setLoading(false);
        setRefreshKey((k) => k + 1);
        setTokenReady(false);
        setError(getAuthErrorMessage(result.error));
        return;
      }

      if (refFromUrl) {
        setPendingReferralRef(refFromUrl);
      }

      setLoading(false);
      onSuccess?.(normalizedEmail);
    } catch {
      setLoading(false);
      setError("Something unexpected happened. Please try again.");
    }
  }

  const googleCallbackURL =
    callbackURL ?? `${typeof window !== "undefined" ? window.location.origin : ""}/dashboard`;

  return (
    <div className="flex flex-col gap-4">
      <GoogleSignInButton callbackURL={googleCallbackURL} label="Sign up with Google" />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <div className={authErrorAlertClass}>{error}</div>}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <label htmlFor="firstName" className={authLabelClass}>
              First name
            </label>
            <input
              id="firstName"
              className={authInputClass}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="lastName" className={authLabelClass}>
              Last name
            </label>
            <input
              id="lastName"
              className={authInputClass}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="email" className={authLabelClass}>
            Email
          </label>
          <input
            id="email"
            className={authInputClass}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {showReferralField && referralDisplayCode ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="referralCode" className={authLabelClass}>
              Referral code
            </label>
            <input
              id="referralCode"
              className={authInputClass}
              value={referralDisplayCode}
              disabled
            />
            {referralDiscountPercent != null ? (
              <p className="text-xs text-muted-foreground">
                {referralDiscountPercent}% off your first order will be applied at checkout.
              </p>
            ) : null}
          </div>
        ) : null}

        {ageVerificationRequired ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="dateOfBirth" className={authLabelClass}>
              Date of birth
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
              You must be {minAge} or older. This is saved to your profile for checkout.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className={authLabelClass}>
            Password
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
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
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
              I agree to the{" "}
              <LinkC href="/terms" className="text-gold hover:underline" target="_blank">
                Terms of Service
              </LinkC>{" "}
              and{" "}
              <LinkC href="/privacy" className="text-gold hover:underline" target="_blank">
                Privacy Policy
              </LinkC>
            </span>
          </label>
        </div>

        {turnstileSiteKey && (
          <div className="flex justify-center">
            <TurnstileWidget
              siteKey={turnstileSiteKey}
              onToken={(token) => {
                setTurnstileToken(token);
                setTokenReady(token !== null);
              }}
              refreshKey={refreshKey}
            />
          </div>
        )}
        <button
          type="submit"
          className={authSubmitButtonClass}
          disabled={loading || (!!turnstileSiteKey && !tokenReady)}
        >
          {loading ? "Creating account…" : "Create account"}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <LinkC href={loginPath} className="text-gold hover:underline">
            Sign in
          </LinkC>
        </p>
      </form>
    </div>
  );
}
