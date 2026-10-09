import { getServerSession } from "@oc/auth-admin";
import { getEnv } from "@oc/env/server";
import type {
  ApiResponse,
  ICart,
  Profile,
  PublicComplianceSettings,
  SessionUser,
} from "@oc/types";
import { getDisplayName, getProfileInitials, getSessionCookiePrefix } from "@oc/utils";
import type { PageContextServer } from "vike/types";
import { loadLocaleData, setLocaleData } from "@/lib/i18n";
import { detectLocale } from "@/lib/i18n/locale-detection";
import { serverFetch } from "@/lib/server-fetch";

const CLIENT_COOKIE_PREFIX = getSessionCookiePrefix(getEnv("APP_URL"), "client");
const SESSION_COOKIE_NAME = `__Secure-${CLIENT_COOKIE_PREFIX}.session_token`;

interface UserShell {
  user: SessionUser | null;
  displayName: string;
  initials: string;
}

async function emptyShell(): Promise<UserShell> {
  return { user: null, displayName: "", initials: "" };
}

async function loadUserShell(user: SessionUser, _cookie: string): Promise<UserShell> {
  const displayName = getDisplayName(
    { firstName: user.firstName, lastName: user.lastName },
    user.email
  );
  const initials = getProfileInitials({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
  });

  return { user, displayName, initials };
}

function parseSessionTokens(cookieHeader: string): string[] {
  const tokens: string[] = [];
  for (const pair of cookieHeader.split(";")) {
    const trimmed = pair.trim();
    if (trimmed.startsWith(`${SESSION_COOKIE_NAME}=`)) {
      tokens.push(trimmed.slice(SESSION_COOKIE_NAME.length + 1));
    }
  }
  return tokens;
}

interface ResolvedSession {
  user: SessionUser | null;
  /** Cookie header to use for authenticated API calls (may be a single token). */
  authCookie: string;
}

async function resolveBestSession(cookie: string): Promise<ResolvedSession> {
  const empty: ResolvedSession = { user: null, authCookie: cookie };

  if (!cookie) return empty;

  const tokens = parseSessionTokens(cookie);

  if (tokens.length > 1) {
    let anonymousFallback: ResolvedSession | null = null;

    for (const token of tokens) {
      const authCookie = `${SESSION_COOKIE_NAME}=${token}`;
      const h = new Headers();
      h.set("cookie", authCookie);
      try {
        const candidate = await getServerSession("client", h);
        if (!candidate) continue;
        if (!candidate.isAnonymous) {
          return { user: candidate, authCookie };
        }
        if (!anonymousFallback) {
          anonymousFallback = { user: candidate, authCookie };
        }
      } catch {
        // Token failed, try the next one
      }
    }

    if (anonymousFallback) return anonymousFallback;
    return empty;
  }

  const headers = new Headers();
  headers.set("cookie", cookie);
  const user = await getServerSession("client", headers);
  return { user, authCookie: cookie };
}

export async function onCreatePageContext(pageContext: PageContextServer) {
  const cookie = pageContext.headers?.cookie ?? "";

  let user: SessionUser | null = null;
  let authCookie = cookie;
  try {
    const resolved = await resolveBestSession(cookie);
    user = resolved.user;
    authCookie = resolved.authCookie;
  } catch {
    user = null;
  }

  let cartInitialData: ApiResponse<ICart> | null = null;
  let profileInitialData: ApiResponse<Profile> | null = null;
  let complianceFeaturesData: ApiResponse<PublicComplianceSettings> | null = null;
  let defaultOgImageUrl: string | null = null;
  let referralOgImageUrl: string | null = null;
  let defaultTitle: string | null = null;
  let defaultDescription: string | null = null;

  await Promise.allSettled([
    serverFetch<PublicComplianceSettings>("/api/compliance-settings", {
      cookieHeader: cookie,
    }).then((res) => {
      complianceFeaturesData = res;
    }),
    serverFetch<{
      defaultOgImageUrl?: string;
      referralOgImageUrl?: string;
      defaultTitle?: string;
      defaultDescription?: string;
    }>("/api/seo-settings", { cookieHeader: cookie }).then((res) => {
      if (res?.data) {
        defaultOgImageUrl = res.data.defaultOgImageUrl ?? null;
        referralOgImageUrl = res.data.referralOgImageUrl ?? null;
        defaultTitle = res.data.defaultTitle ?? null;
        defaultDescription = res.data.defaultDescription ?? null;
      }
    }),
  ]);

  if (user && !user.isAnonymous) {
    const [cartResult, profileResult] = await Promise.allSettled([
      serverFetch<ICart>("/api/cart", { cookieHeader: authCookie }),
      serverFetch<Profile>("/api/me/profile", { cookieHeader: authCookie }),
    ]);
    if (cartResult.status === "fulfilled") {
      cartInitialData = cartResult.value;
    }
    if (profileResult.status === "fulfilled") {
      profileInitialData = profileResult.value;
    }
  }

  const userShell = user ? await loadUserShell(user, cookie) : await emptyShell();

  const sidebarMatch = cookie.match(/sidebar_state=([^;]+)/);
  const sidebarDefaultOpen = sidebarMatch ? sidebarMatch[1] === "true" : true;

  const nonce = ((globalThis as Record<string, unknown>).__onlinecompetitions_nonce as string | null) ?? null;

  if (!pageContext.locale) {
    pageContext.locale = detectLocale(cookie, pageContext.headers?.["accept-language"]);
  }

  const localeData = await loadLocaleData(pageContext.locale as string);
  setLocaleData(pageContext.locale as string, localeData);
  pageContext.localeData = localeData;

  Object.assign(pageContext, {
    user,
    cartInitialData,
    profileInitialData,
    complianceFeaturesData,
    defaultOgImageUrl,
    referralOgImageUrl,
    defaultTitle,
    defaultDescription,
    userShell,
    sidebarDefaultOpen,
    nonce,
  });
}

declare global {
  namespace Vike {
    interface PageContext {
      user: SessionUser | null;
      cartInitialData: ApiResponse<ICart> | null;
      profileInitialData: ApiResponse<Profile> | null;
      complianceFeaturesData: ApiResponse<PublicComplianceSettings> | null;
      defaultOgImageUrl: string | null;
      referralOgImageUrl: string | null;
      defaultTitle: string | null;
      defaultDescription: string | null;
      userShell: UserShell;
      sidebarDefaultOpen: boolean;
      nonce: string | null;
      locale: string;
      localeData: Record<string, unknown> | null;
    }
  }
}
