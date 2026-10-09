# Online Competitions

Monorepo for the Online Competitions competition platform — admin (Next.js), customer app (Vike), shop, lander, mobile shell, and ~20 internal packages.

## Stack

- **Frontend**: Next.js 16 App Router, Vike, TanStack Query, Zustand, shadcn/ui (per-app, not shared)
- **Backend**: Hono API server (TypeScript), mounted on the **client** app at `/api/*`
- **Auth**: Better Auth with cookie sessions (customer + admin isolated)
- **Database**: MongoDB (Mongoose), Redis cache layer
- **Payments**: DNA Payments, PayPal, GoCardless, Stripe
- **UI**: shadcn/ui primitives per app, custom brand components, Tailwind CSS v4

## Apps (local ports)

| App | Port | URL | Description |
|-----|------|-----|-------------|
| `client` | 3555 | http://localhost:3555 | Main customer site + **API** |
| `admin` | 3222 | http://localhost:3222 | Admin dashboard |
| `web-lander` | 3333 | http://localhost:3333 | Competition marketing landings (uses API on 3555) |
| `shop` | 3444 | http://localhost:3444 | Shop |
| `client-mobile` | 3666 | http://localhost:3666 | Mobile/Capacitor app (not the desktop site) |

## Development

**Documentation:** [docs/README.md](docs/README.md) → start with [docs/local-development.md](docs/local-development.md).

```bash
bun install
docker compose -f docker-compose.dev.yml up -d
bun run dev
```

Copy each app’s `apps/*/.env.example` to `.env.local` or `.env` as documented in [`.env.example`](.env.example) (root file is reference only).

**Admin:** first user → http://localhost:3222/auth/setup — then http://localhost:3222/auth/login

Requires MongoDB replica set, Redis, and per-app environment variables.

## Branch Strategy

- `staging` — active development, deployed to staging environment
- `main` — production, fast-forwarded from staging after verification
