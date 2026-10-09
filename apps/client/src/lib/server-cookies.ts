// server-cookies.ts  -  server-only helpers for forwarding cookies to the Hono API.
//
// The `import "server-only"` directive is enforced at build time by Vite
// to prevent these helpers from being bundled into client islands.

export function getServerCookieHeader(request: Request): string {
  return request.headers.get("cookie") ?? "";
}

export function buildServerHeaders(request: Request): HeadersInit {
  const headers: Record<string, string> = {};
  const cookie = request.headers.get("cookie");
  if (cookie) headers.cookie = cookie;
  const requestId = request.headers.get("x-request-id");
  if (requestId) headers["x-request-id"] = requestId;
  return headers;
}
