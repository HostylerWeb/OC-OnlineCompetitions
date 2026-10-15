# VPS infrastructure (Online Competitions)

Target layout on the server (no app repo required for infra only).

## Server

- **Host:** `root@187.77.180.24` (`srv2022090`) — Hostinger VPS
- **SSH:** Hostyler `~/.ssh/id_ed25519_github` in `authorized_keys`

## Paths

| Path | Purpose |
|------|---------|
| `/var/www/onlinecompetitions/docker-compose.infra.yml` | Mongo, Redis, MinIO |
| `/var/www/onlinecompetitions/docker/minio/` | Dockerfiles (MinIO/mc from GitHub releases) |
| `/var/www/onlinecompetitions/scripts/mongo-init.js` | Replica set init (`127.0.0.1:27017`) |
| `/var/www/onlinecompetitions/data/` | Persistent data + `mongo-keyfile` |
| `/root/onlinecompetitions-secrets.env` | `MONGO_ROOT_PASSWORD`, `REDIS_PASSWORD`, `MINIO_*` |

## Mongo keyfile

```bash
chown 999:999 /var/www/onlinecompetitions/data/mongo-keyfile
chmod 400 /var/www/onlinecompetitions/data/mongo-keyfile
```

## Start / stop

```bash
docker compose --env-file /root/onlinecompetitions-secrets.env \
  -f /var/www/onlinecompetitions/docker-compose.infra.yml up -d
```

## App environment (when you deploy)

- `DATABASE_URL=mongodb://root:<pass>@127.0.0.1:27017/onlinecompetitions?authSource=admin&replicaSet=rs0`
- `REDIS_URL=redis://:<pass>@127.0.0.1:6379`
- `S3_ENDPOINT=http://127.0.0.1:9000` (public: `https://assets.onlinecompetitions.co.uk` via Caddy)
- `S3_BUCKET=onlinecompetitions-assets`, `S3_FORCE_PATH_STYLE=true`
- `ASSET_BASE_URL=https://assets.onlinecompetitions.co.uk/onlinecompetitions-assets`
- `APP_URL=https://onlinecompetitions.co.uk`

## Reverse proxy

- Caddy binary: `/usr/local/bin/caddy`, unit `caddy.service`
- Snippets: `/etc/caddy/sites/` (uncomment hosts after DNS + app ports)

## Host hardening (already applied)

- UFW: 22, 80, 443
- 2GB swap, fail2ban, Docker CE

## Application deploy (`/var/www/onlinecompetitions/app`)

```bash
cd /var/www/onlinecompetitions/app
git pull origin main
bun install
export NODE_OPTIONS="--max-old-space-size=2048"
bun run build --concurrency=1 --filter=@oc/client --filter=@oc/admin
systemctl restart oc-client oc-admin
curl -s -o /dev/null -w "client:%{http_code}\n" http://127.0.0.1:3555/health
curl -s -o /dev/null -w "admin:%{http_code}\n" http://127.0.0.1:3222/api/health
```

Admin `prebuild` clears `apps/admin/.next` so Turbopack never reuses a stale cache (avoids `next/font/google` + `@vercel/turbopack-next/internal/font/google/font` errors after interrupted builds).

If admin still fails, run `rm -rf apps/admin/.next` manually and rebuild `@oc/admin`.

## Not done on this pass

- DNS cutover, TLS site blocks (placeholders only)
- Mongo/MinIO data migration from Hetzner
