#!/usr/bin/env bash
# Clone onlinecompetitions DB + MinIO assets from Hostinger VPS to local docker dev.
# Requires: SSHPASS, sshpass, docker (oc_dev_mongo + oc_dev_minio), python3 + minio package.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ARCHIVE="${ROOT}/data/hostinger-mongo.archive"
HOST="${HOSTINGER_SSH_HOST:-root@187.77.180.24}"
LOCAL_MONGO_PORT="${LOCAL_MONGO_PORT:-27018}"
LOCAL_MINIO_PORT="${LOCAL_MINIO_PORT:-9021}"
LOCAL_ASSET_BASE="http://localhost:${LOCAL_MINIO_PORT}/onlinecompetitions-assets"
BUCKET="onlinecompetitions-assets"
TUNNEL_PORT="${TUNNEL_PORT:-19000}"

if [[ -z "${SSHPASS:-}" ]]; then
  echo "Set SSHPASS to the VPS root password (or use SSH keys and omit sshpass)." >&2
  exit 1
fi

ssh_cmd() {
  sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30 "$HOST" "$@"
}

mkdir -p "${ROOT}/data"

echo "==> Fetching MongoDB dump from Hostinger..."
ssh_cmd 'set -a; source /root/onlinecompetitions-secrets.env; set +a
  docker exec onlinecompetitions_mongo mongodump \
    --username=root --password="$MONGO_ROOT_PASSWORD" --authenticationDatabase=admin \
    --db=onlinecompetitions --archive' > "$ARCHIVE"
echo "    Archive: $(du -h "$ARCHIVE" | cut -f1) at $ARCHIVE"

echo "==> Restoring into local Mongo (port ${LOCAL_MONGO_PORT})..."
docker exec -i oc_dev_mongo mongorestore \
  --drop \
  --archive < "$ARCHIVE"
echo "    Restore complete."

echo "==> Syncing MinIO bucket (SSH tunnel ${TUNNEL_PORT} -> VPS :9000)..."
eval "$(ssh_cmd 'set -a; source /root/onlinecompetitions-secrets.env; set +a
  printf "export REMOTE_MINIO_USER=%q\nexport REMOTE_MINIO_PASS=%q\n" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"')"

pkill -f "ssh.*${TUNNEL_PORT}:127.0.0.1:9000" 2>/dev/null || true
sleep 1
sshpass -e ssh -f -N -o StrictHostKeyChecking=no -L "${TUNNEL_PORT}:127.0.0.1:9000" "$HOST"
sleep 2

export REMOTE_MINIO_USER REMOTE_MINIO_PASS
python3 << PY
import os
from minio import Minio

tunnel = "127.0.0.1:${TUNNEL_PORT}"
remote = Minio(tunnel, access_key=os.environ["REMOTE_MINIO_USER"], secret_key=os.environ["REMOTE_MINIO_PASS"], secure=False)
local = Minio("127.0.0.1:${LOCAL_MINIO_PORT}", access_key="oc_dev_access_key", secret_key="oc_dev_secret_key", secure=False)
bucket = "${BUCKET}"

if not local.bucket_exists(bucket):
    local.make_bucket(bucket)

count = 0
for obj in remote.list_objects(bucket, recursive=True):
    if obj.is_dir:
        continue
    data = remote.get_object(bucket, obj.object_name)
    try:
        local.put_object(bucket, obj.object_name, data, length=obj.size, content_type=obj.content_type or "application/octet-stream")
        count += 1
        if count % 20 == 0:
            print(f"    copied {count} objects...")
    finally:
        data.close()
        data.release_conn()
print(f"    MinIO sync done ({count} objects).")

import json
policy = {
    "Version": "2012-10-17",
    "Statement": [{
        "Effect": "Allow",
        "Principal": {"AWS": ["*"]},
        "Action": ["s3:GetObject"],
        "Resource": [f"arn:aws:s3:::{bucket}/*"],
    }],
}
local.set_bucket_policy(bucket, json.dumps(policy))
print("    Local bucket policy: public read for objects.")
PY

pkill -f "ssh.*${TUNNEL_PORT}:127.0.0.1:9000" 2>/dev/null || true

echo "==> Rewriting asset URLs in Mongo to ${LOCAL_ASSET_BASE}..."
sed "s|__LOCAL_ASSET_BASE__|${LOCAL_ASSET_BASE}|g" <<'MONGO' | docker exec -i oc_dev_mongo mongosh "mongodb://127.0.0.1:27017/onlinecompetitions" --quiet
const LOCAL = "__LOCAL_ASSET_BASE__";

function rewriteUrl(url) {
  if (typeof url !== "string" || !url) return url;
  const idx = url.indexOf("onlinecompetitions-assets/");
  if (idx === -1) return url;
  const key = url.slice(idx + "onlinecompetitions-assets/".length);
  return LOCAL + "/" + key;
}

function rewriteArray(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.map((u) => (typeof u === "string" ? rewriteUrl(u) : u));
}

const stringFields = [
  "imageUrl", "heroImageUrl", "prizeImageUrl", "ogImageUrl", "refOgImageUrl", "landingPageVideoUrl",
  "prizeImageUrl", "avatarUrl", "defaultOgImageUrl", "referralOgImageUrl", "prizeImagesSource",
];

let total = 0;
db.competitions.find({}).forEach((doc) => {
  const set = {};
  for (const f of stringFields) {
    if (doc[f]) set[f] = rewriteUrl(doc[f]);
  }
  if (doc.prizeImages) set.prizeImages = rewriteArray(doc.prizeImages);
  if (doc.prizeImagesRemote) set.prizeImagesRemote = rewriteArray(doc.prizeImagesRemote);
  if (Object.keys(set).length) {
    db.competitions.updateOne({ _id: doc._id }, { $set: set });
    total++;
  }
});

for (const coll of ["instantprizes", "winners", "profiles", "shopproducts", "shopproductvariants"]) {
  if (!db.getCollectionNames().includes(coll)) continue;
  db.getCollection(coll).find({}).forEach((doc) => {
    const set = {};
    if (doc.prizeImageUrl) set.prizeImageUrl = rewriteUrl(doc.prizeImageUrl);
    if (doc.avatarUrl) set.avatarUrl = rewriteUrl(doc.avatarUrl);
    if (doc.images) set.images = rewriteArray(doc.images);
    if (Object.keys(set).length) {
      db.getCollection(coll).updateOne({ _id: doc._id }, { $set: set });
      total++;
    }
  });
}

const seo = db.seosettings.findOne({});
if (seo) {
  const set = {};
  if (seo.defaultOgImageUrl) set.defaultOgImageUrl = rewriteUrl(seo.defaultOgImageUrl);
  if (seo.referralOgImageUrl) set.referralOgImageUrl = rewriteUrl(seo.referralOgImageUrl);
  if (Object.keys(set).length) {
    db.seosettings.updateOne({ _id: seo._id }, { $set: set });
    total++;
  }
}

print("Documents updated (approx): " + total);
const sample = db.competitions.findOne({ imageUrl: { $regex: /^http/ } }, { imageUrl: 1 });
printjson(sample);
MONGO

echo "==> Done. Set ASSET_BASE_URL=${LOCAL_ASSET_BASE} in app env files if not already."
