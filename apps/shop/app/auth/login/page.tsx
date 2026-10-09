"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useEffect, useState } from "react";

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/dashboard";

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, type: "sign-in" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = data.message || data.error?.message || "";
        if (res.status === 429) {
          throw new Error("Too many requests. Please wait before trying again.");
        }
        if (message.includes("rate") || message.includes("RATE")) {
          throw new Error("Too many requests. Please wait before trying again.");
        }
        throw new Error(message || "Failed to send code");
      }

      setStep("otp");
      setCooldown(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, type: "sign-in" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = data.message || data.error?.message || "";
        if (res.status === 429) {
          throw new Error("Too many attempts. Please wait before trying again.");
        }
        if (message.includes("expired")) {
          throw new Error("This code has expired. Request a new one.");
        }
        if (message.includes("Invalid") || message.includes("invalid")) {
          throw new Error("Invalid code. Please check and try again.");
        }
        throw new Error(message || "Invalid code");
      }

      router.push(returnTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError("");
    setCooldown(30);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, type: "sign-in" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCooldown(0);
        throw new Error(data.message || data.error?.message || "Failed to resend code");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="oc-container flex min-h-[60vh] items-center justify-center py-16">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Sign in to Online Competitions</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {step === "email"
              ? "Enter your email to receive a sign-in code."
              : "Enter the 6-digit code sent to your email."}
          </p>
        </div>

        <div className="mt-8">
          {step === "email" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  placeholder="you@example.com"
                  className="mt-1 block w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-gold/90 disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send sign-in code"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <p className="text-center text-xs text-muted-foreground">
                Code sent to <span className="text-foreground">{email}</span>
              </p>

              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-foreground">
                  Verification code
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setError("");
                  }}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  className="mt-1 block w-full rounded-lg border border-border bg-transparent px-3 py-2 text-center text-lg tracking-[0.3em] text-foreground placeholder:text-muted-foreground focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-gold/90 disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Sign in"}
              </button>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setOtp("");
                    setError("");
                  }}
                  className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  Use a different email
                </button>

                {cooldown > 0 ? (
                  <span className="text-xs text-muted-foreground">Resend in {cooldown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  >
                    Didn't receive code?
                  </button>
                )}
              </div>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link
              href="/auth/sign-up"
              className="font-medium text-gold underline underline-offset-4 hover:text-gold-light"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
