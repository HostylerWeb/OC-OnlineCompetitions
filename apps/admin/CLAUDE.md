# admin — Admin Dashboard (port 3222)

Next.js 16 App Router with Hono API route handler, admin role gating.

## Auth

- **Server:** `app/api/[[...route]]/route.ts` mounts a Hono app with `getAdminAuth()` from `@oc/api-auth`
- **Middleware:** `proxy.ts` uses `betterFetch<Session>` to validate session + checks `role === "admin"`
- **Client:** `authClient` + `useAuthStore` from `@oc/api-client-next`
- **Flows:** Email + password, Google OAuth
- **Env (required):** `ADMIN_BETTER_AUTH_URL`, `ADMIN_URL`, `NEXT_PUBLIC_APP_URL`
- **Unique `BETTER_AUTH_SECRET`** — admin sessions are isolated from customer sessions

## Proxy behaviour

- Protected paths → redirect to `/login?returnTo=...` if no session
- Protected paths + non-admin role → redirect to `/access-denied`
- Auth paths (`/login`, `/forgot-password`) → redirect to `/` or `returnTo` if session+admin
- `betterFetch` call has 5s timeout; failure returns null (public pages still serve)
- Matcher excludes `/api/*` (prevents loop)

## Admin role gate

Two-layer enforcement:
1. `proxy.ts` middleware — redirects non-admin users at the edge
2. Hono middleware (`sessionMiddleware` + `requireAdmin`) — defends API routes

## Key files

- `proxy.ts` — middleware with admin role gate
- `app/api/[[...route]]/route.ts` — Hono API handler (exports `AppType` for RPC)

## UI

Components are local in `apps/admin/components/` — shadcn primitives in `components/ui/`, admin-specific components in `components/`. No shared UI packages.
