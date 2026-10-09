/**
 * Standalone MongoDB index sync + retention index ensure.
 *
 *   bun run packages/api/server/src/lib/jobs/sync-mongo-indexes.ts
 */
import "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { ensureMongoDatabaseOptimizations } from "@oc/api-server/lib/mongo-index-maintenance";

async function main(): Promise<void> {
  await dbConnect();
  await ensureMongoDatabaseOptimizations();
  console.log("[sync-mongo-indexes] done");
  process.exit(0);
}

main().catch((err) => {
  console.error("[sync-mongo-indexes] failed", err);
  process.exit(1);
});
