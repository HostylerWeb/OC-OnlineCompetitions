# @oc/api-storage

S3-compatible object storage client (MinIO for local dev, S3 for production).

## Source of truth

`onlinecompetitions-api/packages/storage/src` — synced to this repo.

## Key modules

| File | Responsibility |
|------|---------------|
| `s3.ts` | S3 client setup (MinIO/S3-compatible config) |
| `avatar-storage.ts` | User avatar upload, retrieval & deletion |

## Env vars

- `S3_ENDPOINT` — custom MinIO/S3-compatible endpoint (required for non-AWS)
- `S3_BUCKET` — bucket name
- `AWS_REGION` — AWS region (defaults to `"auto"` for custom endpoints)
- `S3_ACCESS_KEY_ID` or `AWS_ACCESS_KEY_ID` — credential (fallback chain)
- `S3_SECRET_ACCESS_KEY` or `AWS_SECRET_ACCESS_KEY` — credential (fallback chain)
- `ASSET_BASE_URL` — public asset base URL (overrides endpoint-based URL when set)
