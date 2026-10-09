# Online Competitions Turborepo — Workspace Context

## Project
Next.js 16 turborepo: 1 Next.js app, 1 Vike app, 1 lander + ~20 internal packages. No shared React components — each app maintains its own shadcn/ui components locally.

## Apps
- `apps/admin/` — Admin dashboard (port 3222)
- `apps/web-lander/` — Competition landing pages (port 3333)
- `apps/client/` — Vike customer app (port 3555, in development)

## Architecture
- **Backend**: Hono API server in `packages/api-server/` mounted at `/api/*` in each app via `hono/vercel`
- **Client**: TanStack Query + Zustand + Axios in `packages/api-client-next/`
- **Auth**: Better Auth (customer + admin isolated instances), cookie sessions
- **Database**: MongoDB with Mongoose, replica set required
- **Cache**: Redis via `packages/api-infra/src/cache/`, Next.js Data Cache with `cache: "public"` + tags
- **Validation**: Zod schemas in `packages/api-validation/`
- **UI**: shadcn/ui per app (`apps/*/components/ui/`), no shared UI packages. `@oc/icons` kept as leaf package for brand SVGs + lucide-react re-exports.

## Key Packages
- `packages/api-server/` — Hono API routes (client/, admin/, common/)
- `packages/api-auth/` — Better Auth builders (client + admin)
- `packages/api-client-next/` — TanStack Query hooks, server-fetch, prefetch helpers
- `packages/api-db/` — Mongoose models
- `packages/api-tickets/` — Cart, tickets, wallet, promo codes
- `packages/api-payment-core/` — Order fulfillment engine
- `packages/api-validation/` — Zod schemas
- `packages/types/` — Shared TypeScript interfaces
- `packages/icons/` — Brand SVG icons + lucide-react re-exports
- `packages/api-client/` — Vike TanStack Query, Zustand, Axios

- `packages/client-auth/` — Vike Better Auth helpers
## Commands
- `bun run dev` — dev all apps
- `bun run typecheck` — TypeScript check
- `bun run lint` — Biome lint
- `bun run test` — All tests
- `bun run build` — Build all apps

## Performance
- `turbo.json` `concurrency` is `"1"`. Do not raise — server has 768MB RAM limit.
- Run tasks with `--concurrency=1` if overriding config.

## Branch
Working branch: `staging`. PRs target `staging`. Fast-forward to `main` after deploy.
