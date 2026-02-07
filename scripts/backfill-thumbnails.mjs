import { db } from "../src/db/index";
import { clips as clipsTable } from "../src/db/schema/clips";
import { generateBlurDataUrl } from "../src/lib/server/ingestion.impl";
import { variantToPublicUrl } from "../src/lib/server/r2.impl";
import { eq, isNull } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

async function backfill() {
  const clips = await db.query.clips.findMany({
    where: isNull(clipsTable.thumbnailBlur),
    with: {
      variants: true
    }
  });

  console.log(`Found ${clips.length} clips needing thumbnails.`);

  for (const clip of clips) {
    const highVariant = clip.variants.find(v => v.quality === "high");
    if (!highVariant) {
      console.warn(`No high variant for clip ${clip.id}`);
      continue;
    }

    const videoUrl = variantToPublicUrl(highVariant);
    if (!videoUrl) {
      console.warn(`No public URL for clip ${clip.id}`);
      continue;
    }

    console.log(`Processing ${clip.id}...`);
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "thumb-backfill-"));
    const videoPath = path.join(tempDir, "video.mp4");

    try {
      const resp = await fetch(videoUrl);
      if (!resp.ok) throw new Error(`Failed to fetch video: ${resp.statusText}`);
      const buffer = await resp.arrayBuffer();
      await fs.writeFile(videoPath, Buffer.from(buffer));

      const blurDataUrl = await generateBlurDataUrl(videoPath);
      await db.update(clipsTable)
        .set({ thumbnailBlur: blurDataUrl })
        .where(eq(clipsTable.id, clip.id));
      
      console.log(`Updated ${clip.id}`);
    } catch (err) {
      console.error(`Error processing ${clip.id}:`, err);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  process.exit(0);
}

backfill();
