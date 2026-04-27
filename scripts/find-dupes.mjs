import path from "node:path";
import fs from "node:fs/promises";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { clips as clipsTable, clipVariants } from "../src/db/schema/clips.ts";
import { like, eq, or } from "drizzle-orm";

async function loadDotEnv() {
  const candidates = [path.join(process.cwd(), ".env.local"), path.join(process.cwd(), ".env")];
  for (const filePath of candidates) {
    let raw;
    try { raw = await fs.readFile(filePath, "utf8"); } catch { continue; }
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (key && process.env[key] == null) process.env[key] = value;
    }
  }
}

await loadDotEnv();
const db = drizzle(createClient({ url: process.env.TURSO_DATABASE_URL || "file:local.db", authToken: process.env.TURSO_AUTH_TOKEN }));

// Search for anything with abualnaja or s2_a159
const rows = await db.select().from(clipsTable).where(
  or(
    like(clipsTable.reciterSlug, "%abualnaja%"),
    like(clipsTable.reciterName, "%abualnaja%"),
    like(clipsTable.reciterName, "%Abualnaja%"),
    like(clipsTable.id, "%abualnaja%"),
    // Also check same surah/ayah range with different reciter slug
    like(clipsTable.id, "%s2_a159-163%"),
  )
);

console.log(`Found ${rows.length} row(s):\n`);
for (const r of rows) {
  const variants = await db.select().from(clipVariants).where(eq(clipVariants.clipId, r.id));
  console.log(`ID: ${r.id}`);
  console.log(`  reciterSlug: ${r.reciterSlug}`);
  console.log(`  reciterName: ${r.reciterName}`);
  console.log(`  surah: ${r.surah}, ayah: ${r.ayahStart}-${r.ayahEnd}`);
  console.log(`  createdAt: ${r.createdAt}`);
  console.log(`  variants:`);
  for (const v of variants) {
    console.log(`    ${v.quality}: ${v.r2Key} (md5: ${v.md5})`);
  }
  console.log();
}

process.exit(0);
