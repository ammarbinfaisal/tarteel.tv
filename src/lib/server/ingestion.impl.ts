import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import sharp from "sharp";
import { db } from "@/db";
import { clips as clipsTable, clipVariants } from "@/db/schema/clips";
import { eq } from "drizzle-orm";
import { uploadFile, uploadDir } from "./r2.impl";
import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  timestamp: pino.stdTimeFunctions.isoTime,
});

export async function md5FileHex(filePath: string): Promise<string> {
  const hash = crypto.createHash("md5");
  const stream = fsSync.createReadStream(filePath);
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve());
  });
  return hash.digest("hex");
}

export async function generateBlurDataUrl(videoPath: string): Promise<string> {
  const tempImagePath = path.join(path.dirname(videoPath), `thumb-${Date.now()}.jpg`);
  
  // Extract a frame from the middle of the video (approx 1s in)
  await new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", [
      "-y",
      "-ss", "00:00:01",
      "-i", videoPath,
      "-vframes", "1",
      "-q:v", "2",
      tempImagePath
    ]);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg thumbnail extraction failed with code ${code}`));
    });
  });

  try {
    const buffer = await sharp(tempImagePath)
      .resize(20, 20, { fit: "cover" })
      .blur(10)
      .toBuffer();
    
    await fs.rm(tempImagePath).catch(() => {});
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
  } catch (err) {
    await fs.rm(tempImagePath).catch(() => {});
    throw err;
  }
}

export async function transcodeHls(inputPath: string, outputDir: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
  const args = [
    "-y", "-i", inputPath,
    "-map", "0:v", "-map", "0:a", "-s:v:0", "1280x720", "-c:v:0", "libx264", "-b:v:0", "1500k", "-maxrate:v:0", "1650k", "-bufsize:v:0", "3000k",
    "-map", "0:v", "-map", "0:a", "-c:v:1", "libx264", "-b:v:1", "3000k", "-maxrate:v:1", "3300k", "-bufsize:v:1", "6000k",
    "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
    "-f", "hls", "-hls_time", "6", "-hls_playlist_type", "vod", "-hls_segment_type", "fmp4", "-hls_flags", "single_file",
    "-master_pl_name", "master.m3u8", "-hls_segment_filename", path.join(outputDir, "v%v/stream.mp4"),
    "-var_stream_map", "v:0,a:0 v:1,a:1", path.join(outputDir, "v%v/index.m3u8"),
  ];

  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args);
    let errorOutput = "";
    child.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        logger.error({ code, errorOutput }, "ffmpeg failed");
        reject(new Error(`ffmpeg failed with code ${code}`));
      }
    });
  });
}

export interface IngestionParams {
  surah: number;
  ayahStart: number;
  ayahEnd: number;
  reciterSlug: string;
  reciterName?: string;
  riwayah: string;
  translation: string;
}

export async function ingestClip(videoPath: string, params: IngestionParams): Promise<string> {
  const { surah, ayahStart, ayahEnd, reciterSlug, riwayah, translation } = params;

  const id = `s${surah}_a${ayahStart}-${ayahEnd}__${reciterSlug}__${riwayah}__${translation}`;
  const md5 = await md5FileHex(videoPath);

  logger.info({ id, md5 }, "Starting ingestion");

  // Check for MD5 conflict
  const existingVariant = await db.select({ clipId: clipVariants.clipId })
    .from(clipVariants)
    .where(eq(clipVariants.md5, md5))
    .limit(1);

  if (existingVariant.length > 0) {
    const existingClipId = existingVariant[0].clipId;
    if (existingClipId === id) {
      throw new Error(`Clip already ingested as ${existingClipId}`);
    } else {
      throw new Error(`Conflict: This video content (MD5: ${md5}) already exists as clip: ${existingClipId}`);
    }
  }

  const tempDir = path.dirname(videoPath);
  const hlsDir = path.join(tempDir, "hls");

  logger.info({ id }, "Transcoding HLS...");
  await transcodeHls(videoPath, hlsDir);

  logger.info({ id }, "Generating blurred thumbnail...");
  const thumbnailBlur = await generateBlurDataUrl(videoPath).catch(err => {
    logger.error({ err }, "Failed to generate blurred thumbnail");
    return null;
  });

  logger.info({ id }, "Uploading to R2...");
  const baseKey = `clips/${reciterSlug}/${riwayah}/${translation}/s${surah}/a${ayahStart}-${ayahEnd}`;
  await uploadFile(`${baseKey}/high.mp4`, videoPath, "video/mp4", md5);
  await uploadDir(hlsDir, `${baseKey}/hls`);

  logger.info({ id }, "Updating database...");
  await db.transaction(async (tx) => {
    let reciterName = params.reciterName;
    if (!reciterName) {
      const existing = await tx.select({ name: clipsTable.reciterName })
        .from(clipsTable).where(eq(clipsTable.reciterSlug, reciterSlug)).limit(1);
      reciterName =
        existing[0]?.name || reciterSlug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    }

    await tx.insert(clipsTable).values({
      id, surah, ayahStart, ayahEnd, reciterSlug, reciterName, riwayah, translation, thumbnailBlur
    }).onConflictDoUpdate({
      target: clipsTable.id,
      set: { surah, ayahStart, ayahEnd, reciterName, riwayah, translation, thumbnailBlur },
    });

    await tx.delete(clipVariants).where(eq(clipVariants.clipId, id));
    await tx.insert(clipVariants).values([
      { clipId: id, quality: "high", r2Key: `${baseKey}/high.mp4`, md5 },
      { clipId: id, quality: "hls", r2Key: `${baseKey}/hls/master.m3u8` },
    ]);
  });

  return id;
}

