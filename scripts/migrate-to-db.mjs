import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { db } from "../src/db";
import { clips, clipVariants } from "../src/db/schema/clips";

const JSONL_PATH = path.join(process.cwd(), "data", "clips.jsonl");

async function migrate() {
  console.log("Starting migration from JSONL to Database...");
  
  const fileStream = await fs.open(JSONL_PATH, "r");
  const rl = readline.createInterface({
    input: fileStream.createReadStream(),
    crlfDelay: Infinity,
  });

  let count = 0;
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const clipData = JSON.parse(trimmed);
      
      // Insert clip
      await db.insert(clips).values({
        id: clipData.id,
        surah: clipData.surah,
        ayahStart: clipData.ayahStart,
        ayahEnd: clipData.ayahEnd,
        reciterSlug: clipData.reciterSlug || clipData.reciter || "",
        reciterName: clipData.reciterName || "",
        riwayah: clipData.riwayah || "hafs-an-asim",
        translation: clipData.translation || "saheeh-international",
      }).onConflictDoNothing();

      // Insert variants
      if (Array.isArray(clipData.variants)) {
        for (const variant of clipData.variants) {
          await db.insert(clipVariants).values({
            clipId: clipData.id,
            quality: variant.quality,
            r2Key: variant.r2Key,
            md5: variant.md5,
          });
        }
      }
      
      count++;
      if (count % 50 === 0) console.log(`Migrated ${count} clips...`);
    } catch (err) {
      console.error(`Failed to migrate line: ${trimmed}`, err);
    }
  }

  console.log(`Migration finished. Total clips: ${count}`);
}

migrate().catch(console.error);
