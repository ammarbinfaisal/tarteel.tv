import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { clips as clipsTable } from "../src/db/schema/clips.ts";
import { eq, and, ne } from "drizzle-orm";

async function loadDotEnv() {
  const candidates = [path.join(process.cwd(), ".env.local"), path.join(process.cwd(), ".env")];
  for (const filePath of candidates) {
    let raw = null;
    try {
      raw = await fs.readFile(filePath, "utf8");
    } catch (err) {
      if (err?.code === "ENOENT") continue;
      continue;
    }
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!key) continue;
      if (process.env[key] == null) process.env[key] = value;
    }
  }
}

await loadDotEnv();

const dbClient = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(dbClient);

const CANONICAL_NAME = "Abdullah al-Juhany";
const SLUG = "abdullah-al-juhany";

// Find mismatched rows
const rows = await db
  .select({ id: clipsTable.id, reciterName: clipsTable.reciterName })
  .from(clipsTable)
  .where(and(eq(clipsTable.reciterSlug, SLUG), ne(clipsTable.reciterName, CANONICAL_NAME)));

if (rows.length === 0) {
  console.log("All rows already have the canonical name. Nothing to update.");
  process.exit(0);
}

console.log(`Found ${rows.length} row(s) to fix:`);
for (const row of rows) {
  console.log(`  ${row.id}: "${row.reciterName}" -> "${CANONICAL_NAME}"`);
}

await db
  .update(clipsTable)
  .set({ reciterName: CANONICAL_NAME })
  .where(and(eq(clipsTable.reciterSlug, SLUG), ne(clipsTable.reciterName, CANONICAL_NAME)));

console.log("Done.");
process.exit(0);
