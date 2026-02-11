import { db } from "../src/db/index";
import { clips as clipsTable, clipVariants } from "../src/db/schema/clips";
import { generateThumbnailJpeg } from "../src/lib/server/ingestion.impl";
import { variantToPublicUrl, uploadFile } from "../src/lib/server/r2.impl";
import { eq } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";

async function backfill() {
  // Find clips that don't yet have a thumbnail variant
  const thumbVariants = await db
    .select({ clipId: clipVariants.clipId })
    .from(clipVariants)
    .where(eq(clipVariants.quality, "thumbnail"));
  const alreadyDone = new Set(thumbVariants.map((v) => v.clipId));

  const allClips = await db.query.clips.findMany({ with: { variants: true } });
  const todo = allClips.filter((c) => !alreadyDone.has(c.id));

  console.log(`${todo.length} clips need thumbnail backfill (${alreadyDone.size} already done).`);

  let ok = 0;
  let fail = 0;

  for (const clip of todo) {
    const highVariant = clip.variants.find((v) => v.quality === "high") ?? clip.variants[0];
    if (!highVariant) {
      console.warn(`[skip] ${clip.id}: no video variant`);
      fail++;
      continue;
    }

    const videoUrl = variantToPublicUrl(highVariant);
    if (!videoUrl) {
      console.warn(`[skip] ${clip.id}: no public URL`);
      fail++;
      continue;
    }

    console.log(`Processing ${clip.id}...`);
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "thumb-backfill-"));
    const videoPath = path.join(tempDir, "video.mp4");
    const thumbPath = path.join(tempDir, "thumbnail.jpg");

    try {
      const resp = await fetch(videoUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching video`);
      await fs.writeFile(videoPath, Buffer.from(await resp.arrayBuffer()));

      await generateThumbnailJpeg(videoPath, thumbPath);

      // Derive thumbnail r2Key from the high variant's key
      const thumbR2Key = highVariant.r2Key.replace(/\/[^/]+$/, "/thumbnail.jpg");
      await uploadFile(thumbR2Key, thumbPath, "image/jpeg");

      // Also generate blur data URL if missing
      let thumbnailBlur = clip.thumbnailBlur;
      if (!thumbnailBlur) {
        const blurBuf = await sharp(thumbPath).resize(20, 20, { fit: "cover" }).blur(10).toBuffer();
        thumbnailBlur = `data:image/jpeg;base64,${blurBuf.toString("base64")}`;
        await db.update(clipsTable).set({ thumbnailBlur }).where(eq(clipsTable.id, clip.id));
      }

      await db.insert(clipVariants).values({
        clipId: clip.id,
        quality: "thumbnail",
        r2Key: thumbR2Key,
      });

      console.log(`  OK: ${clip.id} -> ${thumbR2Key}`);
      ok++;
    } catch (err) {
      console.error(`  FAIL: ${clip.id}:`, err.message);
      fail++;
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  console.log(`\nDone. ok=${ok} fail=${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

backfill();
