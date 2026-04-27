/**
 * One-shot recovery: rebuild the clips/clipVariants tables from R2 path metadata.
 *
 * Run this exactly once on a fresh DB (after migrations):
 *   bun scripts/recover-from-r2.mjs
 *
 * What it does:
 *   1. Lists every object under "clips/" in R2.
 *   2. Groups objects by clip directory (clips/{slug}/{riwayah}/{translation}/s{N}/a{a}-{b}/).
 *   3. Cross-references with data/clips.jsonl to fill reciterName when known.
 *   4. Inserts each clip + its variants. Clips whose reciterName had to be slug-derived
 *      are flagged isDraft=true so they don't appear publicly until an admin confirms.
 *
 * Idempotent on conflict: existing clip rows are skipped (insert ... on conflict do nothing).
 */

import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { db } from "../src/db/index.ts";
import { clips, clipVariants } from "../src/db/schema/clips.ts";

// Load .env without dotenv (only if present — Coolify provides env via process.env)
if (fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^"(.*)"$/, "$1");
  }
}

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const bucket = process.env.R2_BUCKET;

function humanizeSlug(slug) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildClipId({ surah, ayahStart, ayahEnd, reciterSlug, riwayah, translation }) {
  return `s${surah}_a${ayahStart}-${ayahEnd}__${reciterSlug}__${riwayah}__${translation}`;
}

function detectQuality(filename) {
  // clips/.../{quality}.{ext} → "high.mp4", "low.mp4", "1.mp4"...
  // clips/.../hls/master.m3u8 → "hls"
  // clips/.../thumbnail.jpg → "thumbnail"
  if (filename.startsWith("hls/")) return "hls";
  const stem = filename.split("/").pop().split(".")[0];
  if (["thumbnail"].includes(stem)) return "thumbnail";
  if (["high", "low", "1", "2", "3", "4"].includes(stem)) return stem;
  return null;
}

async function* listAll(prefix) {
  let token;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: token,
    }));
    for (const obj of res.Contents ?? []) yield obj;
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
}

// 1. Enumerate R2.
const dirs = new Map();
for await (const obj of listAll("clips/")) {
  const parts = obj.Key.split("/");
  if (parts.length < 7) continue;
  const [, reciterSlug, riwayah, translation, surahPart, ayahPart, ...rest] = parts;
  const filename = rest.join("/");
  const surahMatch = surahPart.match(/^s(\d+)$/);
  const ayahMatch = ayahPart.match(/^a(\d+)-(\d+)$/);
  if (!surahMatch || !ayahMatch) continue;

  const dirKey = `${reciterSlug}|${riwayah}|${translation}|${surahPart}|${ayahPart}`;
  if (!dirs.has(dirKey)) {
    dirs.set(dirKey, {
      reciterSlug, riwayah, translation,
      surah: Number(surahMatch[1]),
      ayahStart: Number(ayahMatch[1]),
      ayahEnd: Number(ayahMatch[2]),
      variants: [],
    });
  }
  const quality = detectQuality(filename);
  if (quality) {
    dirs.get(dirKey).variants.push({ quality, r2Key: obj.Key });
  }
}

console.log(`Found ${dirs.size} clip directories in R2`);

// 2. Build slug → name map from data/clips.jsonl.
const slugToName = new Map();
const jsonlPath = path.join(process.cwd(), "data", "clips.jsonl");
if (fs.existsSync(jsonlPath)) {
  const rl = readline.createInterface({ input: fs.createReadStream(jsonlPath) });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const c = JSON.parse(trimmed);
      if (c.reciterSlug && c.reciterName) {
        slugToName.set(c.reciterSlug, c.reciterName);
      }
    } catch {}
  }
}
console.log(`Loaded ${slugToName.size} reciter slug→name mappings from clips.jsonl`);

// 3. Insert.
let inserted = 0, drafts = 0, skipped = 0;
for (const info of dirs.values()) {
  const knownName = slugToName.get(info.reciterSlug);
  const isDraft = !knownName;
  const reciterName = knownName ?? humanizeSlug(info.reciterSlug);

  const id = buildClipId({
    surah: info.surah,
    ayahStart: info.ayahStart,
    ayahEnd: info.ayahEnd,
    reciterSlug: info.reciterSlug,
    riwayah: info.riwayah,
    translation: info.translation,
  });

  try {
    const result = await db.insert(clips).values({
      id,
      surah: info.surah,
      ayahStart: info.ayahStart,
      ayahEnd: info.ayahEnd,
      reciterSlug: info.reciterSlug,
      reciterName,
      riwayah: info.riwayah,
      translation: info.translation,
      isDraft,
    }).onConflictDoNothing().returning({ id: clips.id });

    if (result.length === 0) {
      skipped++;
      continue;
    }

    for (const variant of info.variants) {
      await db.insert(clipVariants).values({
        clipId: id,
        quality: variant.quality,
        r2Key: variant.r2Key,
      }).onConflictDoNothing();
    }

    inserted++;
    if (isDraft) drafts++;
  } catch (err) {
    console.error(`Failed to insert ${id}:`, err.message);
  }
}

console.log(`\nDone:`);
console.log(`  inserted: ${inserted}`);
console.log(`  of which drafts (unknown reciter name): ${drafts}`);
console.log(`  skipped (already existed): ${skipped}`);
