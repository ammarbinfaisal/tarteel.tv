/**
 * Container startup bootstrap:
 *   1. Run any unapplied drizzle migrations against the configured libSQL/SQLite endpoint.
 *   2. If the clips table is empty, run the R2 recovery importer.
 *
 * Both steps are idempotent. Safe to run on every container start.
 */

import { migrate } from "drizzle-orm/libsql/migrator";
import { sql } from "drizzle-orm";
import { db, client } from "../src/db/index.ts";
import path from "node:path";

console.log("[bootstrap] running migrations...");
await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
console.log("[bootstrap] migrations done");

const [{ count }] = await db.all(sql`SELECT COUNT(*) AS count FROM clips`);
const clipCount = Number(count);
console.log(`[bootstrap] clips table has ${clipCount} rows`);

if (clipCount === 0) {
  console.log("[bootstrap] empty DB — running R2 recovery");
  await import("./recover-from-r2.mjs");
} else {
  console.log("[bootstrap] DB already has data — skipping recovery");
}

await client.close();
