// One-time backfill: copies each recipe's existing single video_url/
// video_platform into the new `links` array column, so nothing already
// saved gets silently dropped when the app switches over to reading
// `links` instead. Safe to run more than once -- it only touches rows
// where links is still empty and video_url is set, so already-migrated
// rows are skipped.
//
// Run this ONCE after `npm run db:migrate` has added the `links` column
// (before that, this column won't exist yet and the script will fail):
//
//   npx tsx src/scripts/backfillLinks.ts
//
// Uses the same DATABASE_URL as the rest of the backend (from .env locally,
// or the real environment in production) -- point this at whichever
// database actually has the data before running it.
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { recipes } from '../db/schema.js';

async function main() {
  const rows = await db
    .select({ id: recipes.id, videoUrl: recipes.videoUrl, videoPlatform: recipes.videoPlatform, links: recipes.links })
    .from(recipes);

  let migrated = 0;
  for (const row of rows) {
    if (!row.videoUrl) continue;
    if (row.links && row.links.length > 0) continue; // already migrated

    await db
      .update(recipes)
      .set({ links: [{ url: row.videoUrl, platform: row.videoPlatform ?? 'other' }] })
      .where(sql`${recipes.id} = ${row.id}`);
    migrated += 1;
  }

  console.log(`Backfilled ${migrated} of ${rows.length} recipes.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
