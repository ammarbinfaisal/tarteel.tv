import { db } from "../src/db/index";
import { clips as clipsTable, clipVariants } from "../src/db/schema/clips";
import { generateThumbnailJpeg } from "../src/lib/server/ingestion.impl";
import { variantToPublicUrl, uploadFile } from "../src/lib/server/r2.impl";
import { eq } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";

async function backfillBlurOnly(allClips) {
  // Pass 1: clips that already have a thumbnail variant but are missing thumbnailBlur.
  // We only need to download the small thumbnail JPEG (not the full video).
  const needsBlur = allClips.filter(
    (c) => !c.thumbnailBlur && c.variants.some((v) => v.quality === "thumbnail")
  );

  console.log(`\n--- Pass 1: ${needsBlur.length} clips need blur backfill (have thumbnail, missing blur) ---`);

  let ok = 0;
  let fail = 0;

  for (const clip of needsBlur) {
    const thumbVariant = clip.variants.find((v) => v.quality === "thumbnail");
    const thumbUrl = variantToPublicUrl(thumbVariant);
    if (!thumbUrl) {
      console.warn(`[skip blur] ${clip.id}: no public thumbnail URL`);
      fail++;
      continue;
    }

    console.log(`[blur] ${clip.id}...`);
    try {
      const resp = await fetch(thumbUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching thumbnail`);
      const thumbBuf = Buffer.from(await resp.arrayBuffer());

      const blurBuf = await sharp(thumbBuf).resize(20, 20, { fit: "cover" }).blur(10).toBuffer();
      const thumbnailBlur = `data:image/jpeg;base64,${blurBuf.toString("base64")}`;
      await db.update(clipsTable).set({ thumbnailBlur }).where(eq(clipsTable.id, clip.id));

      console.log(`  OK (blur): ${clip.id}`);
      ok++;
    } catch (err) {
      console.error(`  FAIL (blur): ${clip.id}:`, err.message);
      fail++;
    }
  }

  return { ok, fail };
}

async function backfillThumbnails(allClips) {
  // Pass 2: clips that don't have a thumbnail variant at all.
  // Need to download the video, generate thumbnail + blur, upload thumbnail, update DB.
  const hasThumbVariant = new Set(
    allClips
      .filter((c) => c.variants.some((v) => v.quality === "thumbnail"))
      .map((c) => c.id)
  );
  const todo = allClips.filter((c) => !hasThumbVariant.has(c.id));

  console.log(`\n--- Pass 2: ${todo.length} clips need full thumbnail backfill (no thumbnail variant) ---`);

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

    console.log(`[thumb] ${clip.id}...`);
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
      if (!clip.thumbnailBlur) {
        const blurBuf = await sharp(thumbPath).resize(20, 20, { fit: "cover" }).blur(10).toBuffer();
        const thumbnailBlur = `data:image/jpeg;base64,${blurBuf.toString("base64")}`;
        await db.update(clipsTable).set({ thumbnailBlur }).where(eq(clipsTable.id, clip.id));
      }

      await db.insert(clipVariants).values({
        clipId: clip.id,
        quality: "thumbnail",
        r2Key: thumbR2Key,
      });

      console.log(`  OK (thumb): ${clip.id} -> ${thumbR2Key}`);
      ok++;
    } catch (err) {
      console.error(`  FAIL (thumb): ${clip.id}:`, err.message);
      fail++;
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  return { ok, fail };
}

async function backfill() {
  const allClips = await db.query.clips.findMany({ with: { variants: true } });
  console.log(`Total clips in DB: ${allClips.length}`);

  // Pass 1: fast blur-only backfill (downloads small thumbnail JPEG, not the full video)
  const blur = await backfillBlurOnly(allClips);

  // Pass 2: full thumbnail + blur backfill (downloads full video)
  const thumb = await backfillThumbnails(allClips);

  const totalOk = blur.ok + thumb.ok;
  const totalFail = blur.fail + thumb.fail;
  console.log(`\nDone. blur_ok=${blur.ok} blur_fail=${blur.fail} thumb_ok=${thumb.ok} thumb_fail=${thumb.fail} total_ok=${totalOk} total_fail=${totalFail}`);
  process.exit(totalFail > 0 ? 1 : 0);
}

backfill();
