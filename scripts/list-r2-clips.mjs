// One-shot: enumerate R2 to reconstruct clip metadata after a Turso DB loss.
// Reads R2 paths of the form:
//   clips/{reciterSlug}/{riwayah}/{translation}/s{surah}/a{ayahStart}-{ayahEnd}/{quality}.{ext}
// and emits one JSONL record per unique clip directory.

import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import fs from "node:fs";

// Load .env without dotenv
for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^"(.*)"$/, "$1");
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

const dirs = new Map();

for await (const obj of listAll("clips/")) {
  const key = obj.Key;
  const parts = key.split("/");
  if (parts.length < 7) continue;
  const [, reciterSlug, riwayah, translation, surahPart, ayahPart] = parts;
  const dir = `${reciterSlug}/${riwayah}/${translation}/${surahPart}/${ayahPart}`;
  const surahMatch = surahPart.match(/^s(\d+)$/);
  const ayahMatch = ayahPart.match(/^a(\d+)-(\d+)$/);
  if (!surahMatch || !ayahMatch) continue;

  if (!dirs.has(dir)) {
    dirs.set(dir, {
      reciterSlug,
      riwayah,
      translation,
      surah: Number(surahMatch[1]),
      ayahStart: Number(ayahMatch[1]),
      ayahEnd: Number(ayahMatch[2]),
      keys: [],
    });
  }
  dirs.get(dir).keys.push(key);
}

console.log(`# directories: ${dirs.size}`);
for (const [dir, info] of dirs) {
  console.log(JSON.stringify({ dir, ...info }));
}
