#!/usr/bin/env bash
# Run on OC VPS as root after clone. Reads /root/onlinecompetitions-secrets.env
set -euo pipefail

APP_ROOT="${1:-/var/www/onlinecompetitions/app}"
HOST="${2:-$(hostname -f)}"
BASE_URL="https://${HOST}"

if [ ! -f /root/onlinecompetitions-secrets.env ]; then
  echo "Missing /root/onlinecompetitions-secrets.env" >&2
  exit 1
fi

# shellcheck disable=SC1091
source /root/onlinecompetitions-secrets.env

CLIENT_AUTH_SECRET="${CLIENT_BETTER_AUTH_SECRET:-$(openssl rand -hex 32)}"
ADMIN_AUTH_SECRET="${ADMIN_BETTER_AUTH_SECRET:-$(openssl rand -hex 32)}"

DATABASE_URL="mongodb://root:${MONGO_ROOT_PASSWORD}@127.0.0.1:27017/onlinecompetitions?authSource=admin&replicaSet=rs0"
REDIS_URL="redis://:${REDIS_PASSWORD}@127.0.0.1:6379"
ASSET_BASE="https://${HOST}/onlinecompetitions-assets"

mkdir -p "$APP_ROOT/apps/client" "$APP_ROOT/apps/admin"

cat > "$APP_ROOT/apps/client/.env" <<ENV
NODE_ENV=production
BETTER_AUTH_SECRET=${CLIENT_AUTH_SECRET}
PUBLIC_ENV__APP_URL=${BASE_URL}
PUBLIC_ENV__ADMIN_URL=${BASE_URL}:3222
OC_API_BASE_URL=${BASE_URL}
DATABASE_URL=${DATABASE_URL}
REDIS_URL=${REDIS_URL}
REDIS_ENABLED=true
PUBLIC_ENV__PAYMENT_BYPASS=true
SEND_EMAIL=false
SMTP_ENABLED=false
S3_ENDPOINT=http://127.0.0.1:9000
S3_ACCESS_KEY=${MINIO_ROOT_USER}
S3_SECRET_KEY=${MINIO_ROOT_PASSWORD}
S3_BUCKET=onlinecompetitions-assets
S3_FORCE_PATH_STYLE=true
ASSET_BASE_URL=${ASSET_BASE}
PUBLIC_ENV__ASSET_BASE_URL=${ASSET_BASE}
ENV

cat > "$APP_ROOT/apps/admin/.env.local" <<ENV
NODE_ENV=production
BETTER_AUTH_SECRET=${ADMIN_AUTH_SECRET}
APP_URL=${BASE_URL}:3222
BETTER_AUTH_URL=${BASE_URL}:3222
ADMIN_BETTER_AUTH_URL=${BASE_URL}:3222
ADMIN_URL=${BASE_URL}:3222
NEXT_PUBLIC_ADMIN_URL=${BASE_URL}:3222
NEXT_PUBLIC_APP_URL=${BASE_URL}
NEXT_PUBLIC_FRONTEND_URL=${BASE_URL}
DATABASE_URL=${DATABASE_URL}
REDIS_URL=${REDIS_URL}
SEND_EMAIL=false
SMTP_ENABLED=false
S3_ENDPOINT=http://127.0.0.1:9000
S3_ACCESS_KEY=${MINIO_ROOT_USER}
S3_SECRET_KEY=${MINIO_ROOT_PASSWORD}
S3_BUCKET=onlinecompetitions-assets
S3_FORCE_PATH_STYLE=true
ASSET_BASE_URL=${ASSET_BASE}
NEXT_PUBLIC_ASSET_BASE_URL=${ASSET_BASE}
ENV

echo "Wrote $APP_ROOT/apps/client/.env and apps/admin/.env.local (APP URL ${BASE_URL})"
