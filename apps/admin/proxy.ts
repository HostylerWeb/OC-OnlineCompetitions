import { createAuthAxios } from "@oc/api-axios";
import { NextRequest, NextResponse } from "next/server";
import { isAdminOnlyPath } from "@/lib/nav-permissions";

const AUTH_PATHS = [
  "/auth/login",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/setup",
  "/auth/emergency",
  "/auth/access-denied",
];

interface BetterAuthSession {
  user: {
    id: string;
    email: string;
    role?: string;
    [key: string]: unknown;
  } | null;
  session: unknown | null;
}

async function getProxySession(request: NextRequest): Promise<BetterAuthSession | null> {
  const origin = request.nextUrl.origin;
  const isSecure = origin.startsWith("https");
  const baseURL = isSecure ? `http://localhost:${process.env.PORT ?? 3000}` : origin;

  const authAxios = createAuthAxios({ baseURL });

  try {
    const { data } = await authAxios.get<BetterAuthSession>("/api/auth/get-session", {
      headers: { cookie: request.headers.get("cookie") || "" },
    });
    return data ?? null;
  } catch {
    return null;
  }
}

function isAuthPath(path: string): boolean {
  return AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

function isProtectedPath(path: string): boolean {
  return !isAuthPath(path);
}

function isSafeReturnTo(path: string | null | undefined): string | null {
  if (!path) return null;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (isAuthPath(path)) return null;
  return path;
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const session = await getProxySession(request);
  const isAuthed = Boolean(session?.user);
  const role = session?.user?.role;
  const isStaff = role === "admin" || role === "manager";

  if (!isAuthed && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = "";
    url.searchParams.set("returnTo", pathname + (request.nextUrl.search ?? ""));
    return NextResponse.redirect(url);
  }

  if (isAuthed && isProtectedPath(pathname) && !isStaff) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/access-denied";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isAuthed && isStaff && isProtectedPath(pathname) && isAdminOnlyPath(pathname, role)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/access-denied";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isAuthed && isAuthPath(pathname)) {
    const returnTo = isSafeReturnTo(searchParams.get("returnTo"));
    const url = request.nextUrl.clone();
    url.pathname = returnTo ?? "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw-register.js|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
