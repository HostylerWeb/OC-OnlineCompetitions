import { getReferralCookieFromHeader } from "@oc/api-client";
import type { ComplianceSettings } from "@oc/types";
import type { PageContextServer } from "vike/types";
import { serverFetch } from "@/lib/server-fetch";

function isValidReferralFormat(code: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(code) && code.length > 0 && code.length <= 64;
}

function normalizeReferralCode(code: string): string {
  return code.trim().toUpperCase();
}

function resolveRefFromCookie(pageContext: PageContextServer): string | null {
  const cookie = pageContext.headers?.cookie ?? "";
  const rawRef = getReferralCookieFromHeader(cookie);
  if (!rawRef || !isValidReferralFormat(rawRef)) return null;
  return normalizeReferralCode(rawRef);
}

export async function data(pageContext: PageContextServer) {
  const rawRef =
    (pageContext.urlParsed.search.ref as string | undefined) ?? resolveRefFromCookie(pageContext);
  const googleSignUpError = pageContext.urlParsed.search.google_signup === "1";

  let refCode: string | null = null;
  let referrerName: string | null = null;
  if (rawRef && isValidReferralFormat(rawRef)) {
    const normal = normalizeReferralCode(rawRef);
    const lookup = await serverFetch<{
      valid: boolean;
      code: string | null;
      referrerName: string | null;
    }>(`/api/referral-codes/lookup/${encodeURIComponent(normal)}`);
    if (lookup?.data?.valid && lookup.data.code) {
      refCode = lookup.data.code;
      referrerName = lookup.data.referrerName ?? null;
    }
  }

  const [compliance, referralSettings] = await Promise.all([
    serverFetch<ComplianceSettings>("/api/compliance-settings", { cookieHeader: "" }),
    serverFetch<Record<string, unknown>>("/api/referral-settings", { cookieHeader: "" }),
  ]);

  return {
    compliance: compliance?.data ?? null,
    referralSettings: referralSettings?.data ?? null,
    refCode,
    referrerName,
    googleSignUpError,
  };
}

export type Data = Awaited<ReturnType<typeof data>>;
