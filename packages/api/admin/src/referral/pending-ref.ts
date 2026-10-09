const REF_CODE_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MAX_REF_CODE_LENGTH = 64;

export function isValidReferralCodeFormat(code: string): boolean {
  const trimmed = code.trim();
  return (
    trimmed.length > 0 && trimmed.length <= MAX_REF_CODE_LENGTH && REF_CODE_PATTERN.test(trimmed)
  );
}

export function normalizeReferralCode(code: string): string {
  return code.trim().toUpperCase();
}

export function resolveRefFromUrl(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const allRefs = params.getAll("ref");
  const uniqueRefs = [...new Set(allRefs)];
  const refParam = uniqueRefs.length > 0 ? uniqueRefs[uniqueRefs.length - 1] : null;
  if (!refParam || !isValidReferralCodeFormat(refParam)) return null;
  return normalizeReferralCode(refParam);
}

const PENDING_REF_KEY = "onlinecompetitions_pending_ref";
const REFERRAL_COOKIE_NAME = "onlinecompetitions_ref";
const REFERRAL_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function setReferralCookie(code: string): void {
  if (typeof document === "undefined") return;
  const encoded = encodeURIComponent(code);
  document.cookie = `${REFERRAL_COOKIE_NAME}=${encoded}; path=/; max-age=${REFERRAL_COOKIE_MAX_AGE}; SameSite=Lax`;
}

function getReferralCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${REFERRAL_COOKIE_NAME}=([^;]*)`));
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function clearReferralCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${REFERRAL_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

export function getReferralCookieFromHeader(cookieHeader: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${REFERRAL_COOKIE_NAME}=([^;]*)`));
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export function setPendingReferralRef(ref: string): void {
  const code = normalizeReferralCode(ref);
  if (typeof window !== "undefined") {
    sessionStorage.setItem(PENDING_REF_KEY, code);
    setReferralCookie(code);
  }
}

export function getPendingReferralRef(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(PENDING_REF_KEY) ?? getReferralCookie();
}

export function consumePendingReferralRef(): string | null {
  if (typeof window === "undefined") return null;
  const ref = sessionStorage.getItem(PENDING_REF_KEY) ?? getReferralCookie();
  if (ref) {
    sessionStorage.removeItem(PENDING_REF_KEY);
    clearReferralCookie();
  }
  return ref;
}

export function clearPendingReferralRef(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(PENDING_REF_KEY);
    clearReferralCookie();
  }
}
