# Local development

Quick reference for running the Online Competitions monorepo on your machine.

## Prerequisites

- **Bun** (see `packageManager` in root `package.json`)
- **Docker** (MongoDB, Mailpit, MinIO via compose)
- **Redis** on `localhost:6379` (compose includes Redis on a profile; many dev setups use a host Redis instead)

## MongoDB tuning

On API startup the server runs **`ensureMongoDatabaseOptimizations()`**: Better Auth indexes (`user.email`, `session.userId`), env-driven order TTL indexes, and **`syncIndexes()`** on all Mongoose models (disable with `MONGODB_SYNC_INDEXES_ON_STARTUP=false`).

Manual sync:

```bash
bun run packages/api/server/src/lib/jobs/sync-mongo-indexes.ts
```

See root [`.env.example`](../.env.example) for `MONGODB_*` retention and read-preference variables.

## First-time setup

From the repo root (`turborepo-main/`):

```bash
export PATH="$HOME/.bun/bin:$PATH"   # if bun is not on PATH

bun install

# Infra (Mongo replica set, Mailpit, MinIO)
docker compose -f docker-compose.dev.yml up -d

# Per-app env (copy templates once, then fill secrets)
cp apps/admin/.env.example apps/admin/.env.local
cp apps/client/.env.example apps/client/.env
cp apps/web-lander/.env.example apps/web-lander/.env.local
cp apps/shop/.env.example apps/shop/.env.local   # optional, if you run shop

# Generate secrets (admin example)
# openssl rand -hex 32          → BETTER_AUTH_SECRET (unique per app)
# openssl rand -base64 32       → SETUP_SECRET / NEXT_PUBLIC_SETUP_SECRET (must match)
```

Root [`.env.example`](../.env.example) is **documentation only** — apps load their own files:

| App | Env file |
|-----|----------|
| `apps/admin` | `.env.local` |
| `apps/client` | `.env` |
| `apps/web-lander` | `.env.local` |
| `apps/shop` | `.env.local` |

Local Mongo URL used in dev (no auth, replica set on Docker):

`mongodb://localhost:27017/onlinecompetitions?directConnection=true`

## Start everything

```bash
docker compose -f docker-compose.dev.yml up -d
bun run dev
```

`bun run dev` runs Turbo with `--concurrency=6` so all persistent dev servers can start (root `turbo.json` keeps `concurrency: 1` for RAM-limited CI builds).

Run a subset:

```bash
bunx turbo run dev --concurrency=3 --filter=@oc/client --filter=@oc/admin
```

Skip web-lander if you do not need it (avoids extra log noise):

```bash
bunx turbo run dev --concurrency=5 --filter='!@oc/web-lander'
```

Alternative: [devservers.yml](../devservers.yml) + `bun run devserver` (Python venv; lander disabled there by default).

## Apps and ports

| App | URL | Role |
|-----|-----|------|
| **client** | http://localhost:3555 | Main customer site (Vike) + **Hono API** at `/api/*` |
| **admin** | http://localhost:3222 | Admin dashboard |
| **web-lander** | http://localhost:3333 | Marketing/competition landing pages (Next.js); **calls API on 3555** |
| **shop** | http://localhost:3444 | Shop (Next.js) |
| **client-mobile** | http://localhost:3666 | Mobile/Capacitor shell (mobile UI; not the desktop site) |

**Which URL to open**

- Day-to-day product testing → **3555**
- Admin → **3222**
- Lander-only work or OG/share URLs → **3333** (requires `NEXT_PUBLIC_CLIENT_APP_URL=http://localhost:3555` in lander `.env.local`)

## Admin login

1. Ensure infra + `bun run dev` are running and **admin** responds on port 3222.
2. **First admin user (once per database):**  
   http://localhost:3222/auth/setup  
   Enter your **SETUP_SECRET** when prompted (server env only — never `NEXT_PUBLIC_*`). Copy the **one-time password** shown.
3. **Sign in:**  
   http://localhost:3222/auth/login  
   Use that email and password. Unauthenticated visits to `/` redirect to login.

Emergency recovery (if enabled): `/auth/emergency` — type **ADMIN_EMERGENCY_SECRET** manually (server env only).

Scheduled jobs: POST `https://<admin-host>/api/internal/jobs/<job-name>` with header **`X-Cron-Jobs-Secret: <CRON_JOBS_SECRET>`** (separate from emergency secret).

## Docker infra (local)

| Service | Purpose | Host |
|---------|---------|------|
| MongoDB 7 | Database + replica set `rs0` | `localhost:27017` |
| Mailpit | Dev email (SMTP + UI) | SMTP `1025`, UI http://localhost:1080 |
| MinIO | S3-compatible assets | S3 API http://localhost:9011 (no local console port) |

Redis: `redis://localhost:6379` (from app env).

## web-lander vs client

- **client (3555)** — Full site: cart, checkout, dashboard, competitions browsing, API backend.
- **web-lander (3333)** — Lightweight Next app for **cinematic competition landings** (`/{slug}`) and index; fetches data from the **client API**; “Enter” links go to the main site (`NEXT_PUBLIC_FRONTEND_URL`).

Do not point lander API env at `3333` — that app has no `/api` routes and will redirect/timeout.

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `turbo` concurrency error on `bun run dev` | Use root script (includes `--concurrency=6`) or pass it explicitly |
| Lander ~30s loads, 307 spam on `/api/*` | Fix lander `.env.local`: `NEXT_PUBLIC_CLIENT_APP_URL` / `NEXT_PUBLIC_FRONTEND_URL` → `3555` |
| Admin/client DB errors | `docker compose up -d`, check Mongo healthy, `DATABASE_URL` set |
| Payment health “degraded” locally | Expected without Stripe/Paytriot keys; client can use payment bypass in dev |

## Related docs

- [AGENTS.md](../AGENTS.md) — architecture, payments, Coolify notes
- [CLAUDE.md](../CLAUDE.md) — workspace context for agents
- Per-app `apps/*/.env.example` — env templates
