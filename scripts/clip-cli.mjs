import fs from "node:fs/promises";
import fsSync from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

// Import DB related modules
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { clips as clipsTable, clipVariants } from "./src/db/schema/clips.ts";
import { eq, and } from "drizzle-orm";

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
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
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

function parseArgs(argv) {
  const args = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      rest.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i++;
  }
  return { args, rest };
}

function toInt(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function nowId() {
  const rand = Math.random().toString(16).slice(2, 8);
  return `clip_${Date.now()}_${rand}`;
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeRiwayah(value) {
  const s = slugify(value);
  if (s === "hafs-an-aasim") return "hafs-an-asim";
  return s;
}

const VALID_TRANSLATIONS = ["saheeh-international", "khan-al-hilali", "abu-iyaad"];

function normalizeTranslation(value) {
  const s = slugify(value);
  if (s === "saheeh-international") return s;
  if (s === "khan-al-hilali") return s;
  if (s === "khan-hilali") return "khan-al-hilali";
  if (s === "khan-hilali-translation") return "khan-al-hilali";
  if (s === "khan-al-hilali-translation") return "khan-al-hilali";
  if (s === "abu-iyaad") return s;
  return s;
}

function normalizeReciterName(value) {
  const raw = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!raw) return "";

  const canonicalBySlug = {
    maher: "Maher al-Mu'aiqly",
    "maher-al-muaiqly": "Maher al-Mu'aiqly",
    "maher-al-mu-aiqly": "Maher al-Mu'aiqly",
    "maher-al-mu-aiqlee": "Maher al-Mu'aiqly",
    "maher-al-mu-aiqli": "Maher al-Mu'aiqly"
  };

  for (const [, canonical] of Object.entries(canonicalBySlug)) {
    if (raw === canonical) return canonical;
  }

  const tokens = raw.split(" ").map((token) => {
    const parts = token.split("-").filter(Boolean);
    const normalizedParts = parts.map((part) => {
      const lower = part.toLowerCase();
      if (lower === "al") return "al";
      const firstAlpha = lower.search(/[a-z]/i);
      if (firstAlpha === -1) return part;
      return lower.slice(0, firstAlpha) + lower[firstAlpha].toUpperCase() + lower.slice(firstAlpha + 1);
    });
    return normalizedParts.join("-");
  });

  return tokens.join(" ");
}

function canonicalizeReciterSlug(slug) {
  const map = {
    maher: "maher-al-muaiqly",
    "maher-al-muaiqly": "maher-al-muaiqly",
    "maher-al-mu-aiqly": "maher-al-muaiqly",
    "maher-al-mu-aiqlee": "maher-al-muaiqly",
    "maher-al-mu-aiqli": "maher-al-muaiqly"
  };
  return map[slug] ?? slug;
}

function deriveReciter({ reciterArg, reciterNameArg, reciterSlugArg }) {
  const canonicalBySlug = {
    maher: "Maher al-Mu'aiqly",
    "maher-al-muaiqly": "Maher al-Mu'aiqly",
    "maher-al-mu-aiqly": "Maher al-Mu'aiqly",
    "maher-al-mu-aiqlee": "Maher al-Mu'aiqly",
    "maher-al-mu-aiqli": "Maher al-Mu'aiqly"
  };

  const nameInput = reciterNameArg ?? "";
  const slugInput = reciterSlugArg ?? "";

  if (nameInput) {
    const reciterName = normalizeReciterName(nameInput);
    let reciterSlug = slugInput ? slugify(slugInput) : slugify(reciterName);
    reciterSlug = canonicalizeReciterSlug(reciterSlug);
    return { reciterName: canonicalBySlug[reciterSlug] ?? reciterName, reciterSlug };
  }

  if (slugInput) {
    const reciterSlug = canonicalizeReciterSlug(slugify(slugInput));
    const reciterName = canonicalBySlug[reciterSlug] ?? normalizeReciterName(reciterSlug.replace(/-/g, " "));
    return { reciterName, reciterSlug };
  }

  const r = String(reciterArg ?? "").trim();
  if (!r) return { reciterName: "", reciterSlug: "" };
  const looksLikeSlug = /^[a-z0-9-]+$/.test(r);
  if (looksLikeSlug) {
    const reciterSlug = canonicalizeReciterSlug(slugify(r));
    const reciterName = canonicalBySlug[reciterSlug] ?? normalizeReciterName(reciterSlug.replace(/-/g, " "));
    return { reciterName, reciterSlug };
  }
  const reciterName = normalizeReciterName(r);
  const reciterSlug = canonicalizeReciterSlug(slugify(reciterName));
  return { reciterName: canonicalBySlug[reciterSlug] ?? reciterName, reciterSlug };
}

function validateTranslationFlag(value) {
  if (value == null) return null;
  const normalized = normalizeTranslation(value);
  if (!VALID_TRANSLATIONS.includes(normalized)) {
    throw new Error(`Invalid translation: ${normalized}. Valid options: ${VALID_TRANSLATIONS.join(", ")}`);
  }
  return normalized;
}

async function clipIdExists(id) {
  const result = await db.select().from(clipsTable).where(eq(clipsTable.id, id)).limit(1);
  return result.length > 0;
}

function baseR2Key({ prefix, reciterSlug, riwayah, translation, surah, ayahStart, ayahEnd }) {
  const p = prefix ? prefix.replace(/^\/+/, "").replace(/\/+$/, "") : "clips";
  return `${p}/${reciterSlug}/${riwayah}/${translation}/s${surah}/a${ayahStart}-${ayahEnd}`;
}

async function ensureDepsForUpload() {
  const missing = [];
  try { await import("@aws-sdk/client-s3"); } catch { missing.push("@aws-sdk/client-s3"); }
  try { await import("@aws-sdk/lib-storage"); } catch { missing.push("@aws-sdk/lib-storage"); }
  try { await import("@smithy/node-http-handler"); } catch { missing.push("@smithy/node-http-handler"); }
  if (missing.length) throw new Error(`Missing deps: ${missing.join(", ")}. Install with \`bun add ${missing.join(" ")}\`.`);
}

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function isRetryableUploadError(err) {
  const code = err?.code ?? err?.errno ?? null;
  const name = err?.name ?? "";
  const message = String(err?.message ?? "");
  if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "EPIPE") return true;
  if (name.includes("Timeout") || name.includes("Networking")) return true;
  if (message.includes("socket connection was closed unexpectedly")) return true;
  if (message.includes("Request timeout")) return true;
  return false;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function md5FileHex(filePath) {
  const hash = crypto.createHash("md5");
  const stream = fsSync.createReadStream(filePath);
  await new Promise((resolve, reject) => {
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

function looksLikeMd5Hex(value) { return typeof value === "string" && /^[a-f0-9]{32}$/i.test(value); }

function etagToMaybeMd5(etag) {
  if (typeof etag !== "string") return null;
  const trimmed = etag.replaceAll('"', "").trim();
  if (trimmed.includes("-")) return null; 
  return looksLikeMd5Hex(trimmed) ? trimmed.toLowerCase() : null;
}

async function makeS3Client() {
  if (makeS3Client._cached) return makeS3Client._cached;
  await ensureDepsForUpload();
  const { S3Client } = await import("@aws-sdk/client-s3");
  const { NodeHttpHandler } = await import("@smithy/node-http-handler");

  const endpoint = requiredEnv("R2_ENDPOINT");
  const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");
  const maxAttempts = toInt(process.env.R2_MAX_ATTEMPTS) ?? 5;

  makeS3Client._cached = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
    maxAttempts,
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 30_000,
      socketTimeout: 10 * 60_000
    })
  });
  return makeS3Client._cached;
}

async function headFromR2(key) {
  await ensureDepsForUpload();
  const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
  const Bucket = requiredEnv("R2_BUCKET");
  const client = await makeS3Client();
  try {
    const res = await client.send(new HeadObjectCommand({ Bucket, Key: key.replace(/^\/+/, "") }));
    return res ?? null;
  } catch (err) {
    const name = err?.name ?? "";
    const http = err?.$metadata?.httpStatusCode ?? null;
    if (name === "NotFound" || http === 404 || err?.Code === "NoSuchKey") return null;
    throw err;
  }
}

function contentTypeForExt(ext) {
  switch (ext) {
    case ".mp4": return "video/mp4";
    case ".mp3": return "audio/mpeg";
    default: return "application/octet-stream";
  }
}

async function uploadToR2WithMd5({ key, filePath, contentType, md5Hex, overwrite }) {
  const head = await headFromR2(key);
  if (head) {
    const meta = head.Metadata ?? {};
    const remoteMd5 = (looksLikeMd5Hex(meta.md5) ? meta.md5.toLowerCase() : null) ?? etagToMaybeMd5(head.ETag);
    if (remoteMd5 && md5Hex && remoteMd5 === md5Hex.toLowerCase()) {
      console.log(`Skip upload (already exists, md5 match): ${key}`);
      return { skipped: true };
    }
    if (!overwrite) {
      throw new Error(`R2 key already exists: ${key}. Use --overwrite to replace.`);
    }
  }

  await ensureDepsForUpload();
  const { Upload } = await import("@aws-sdk/lib-storage");
  const Bucket = requiredEnv("R2_BUCKET");
  const uploadAttempts = toInt(process.env.R2_UPLOAD_ATTEMPTS) ?? 3;
  const client = await makeS3Client();
  const stat = await fs.stat(filePath);
  const partSizeMb = toInt(process.env.R2_PART_SIZE_MB) ?? 10;
  const queueSize = toInt(process.env.R2_QUEUE_SIZE) ?? 4;

  for (let attempt = 1; attempt <= uploadAttempts; attempt++) {
    try {
      const params = {
        Bucket,
        Key: key.replace(/^\/+/, ""),
        Body: fsSync.createReadStream(filePath),
        ContentType: contentType,
        ContentLength: stat.size,
        Metadata: md5Hex ? { md5: md5Hex.toLowerCase() } : {},
        CacheControl: "public, max-age=31536000, immutable"
      };
      const upload = new Upload({
        client,
        params,
        queueSize,
        partSize: partSizeMb * 1024 * 1024,
        leavePartsOnError: false
      });
      await upload.done();
      return { skipped: false };
    } catch (err) {
      if (!isRetryableUploadError(err) || attempt === uploadAttempts) throw err;
      await sleep(Math.min(15_000, 500 * 2 ** (attempt - 1)));
    }
  }
}

async function uploadDirToR2({ localDir, remotePrefix, overwrite }) {
  const entries = await fs.readdir(localDir, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const fullPath = path.join(entry.parentPath, entry.name);
    const relPath = path.relative(localDir, fullPath);
    const key = `${remotePrefix.replace(/\/+$/, "")}/${relPath.replace(/\\/g, "/")}`;
    const ext = path.extname(entry.name).toLowerCase();
    let contentType = "application/octet-stream";
    if (ext === ".m3u8") contentType = "application/x-mpegURL";
    else if (ext === ".ts") contentType = "video/MP2T";
    else if (ext === ".mp4") contentType = "video/mp4";
    
    await uploadToR2WithMd5({ key, filePath: fullPath, contentType, overwrite });
  }
}

async function deleteFromR2(keys) {
  await ensureDepsForUpload();
  const { DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
  const Bucket = requiredEnv("R2_BUCKET");
  const client = await makeS3Client();
  const normalized = Array.from(new Set(keys.map((k) => k.replace(/^\/+/, "")))).filter(Boolean);
  if (normalized.length === 0) return { deleted: 0 };

  const maxBatch = 1000;
  let deleted = 0;
  for (let i = 0; i < normalized.length; i += maxBatch) {
    const batch = normalized.slice(i, i + maxBatch);
    const res = await client.send(new DeleteObjectsCommand({
      Bucket,
      Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: false }
    }));
    deleted += res?.Deleted?.length ?? 0;
  }
  return { deleted };
}

async function transcodeHls({ inputPath, outputDir }) {
  const { spawn } = await import("node:child_process");
  await fs.mkdir(outputDir, { recursive: true });
  const args = [
    "-y", "-i", inputPath,
    "-map", "0:v", "-map", "0:a", "-s:v:0", "1280x720", "-c:v:0", "libx264", "-b:v:0", "1500k", "-maxrate:v:0", "1650k", "-bufsize:v:0", "3000k",
    "-map", "0:v", "-map", "0:a", "-c:v:1", "libx264", "-b:v:1", "3000k", "-maxrate:v:1", "3300k", "-bufsize:v:1", "6000k",
    "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
    "-f", "hls", "-hls_time", "6", "-hls_playlist_type", "vod", "-hls_segment_type", "fmp4", "-hls_flags", "single_file",
    "-master_pl_name", "master.m3u8", "-hls_segment_filename", path.join(outputDir, "v%v/stream.mp4"),
    "-var_stream_map", "v:0,a:0 v:1,a:1", path.join(outputDir, "v%v/index.m3u8")
  ];
  await new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg HLS failed (${code})`))));
  });
}

async function addClipToDb(clip) {
  await db.insert(clipsTable).values({
    id: clip.id,
    surah: clip.surah,
    ayahStart: clip.ayahStart,
    ayahEnd: clip.ayahEnd,
    reciterSlug: clip.reciterSlug,
    reciterName: clip.reciterName,
    riwayah: clip.riwayah,
    translation: clip.translation
  });

  for (const variant of clip.variants) {
    await db.insert(clipVariants).values({
      clipId: clip.id,
      quality: variant.quality,
      r2Key: variant.r2Key,
      md5: variant.md5
    });
  }
}

async function addClip({ args }) {
  const rl = readline.createInterface({ input, output });
  try {
    const surah = toInt(args.surah) ?? toInt(await rl.question("Surah (1-114): "));
    const ayahStart = toInt(args.start) ?? toInt(await rl.question("Ayah start: "));
    const ayahEnd = toInt(args.end) ?? toInt(await rl.question("Ayah end (blank = start): ")) ?? ayahStart;
    const reciterArg = args.reciter ?? (await rl.question("Reciter (name or slug): "));
    const { reciterName, reciterSlug } = deriveReciter({ reciterArg, reciterNameArg: args["reciter-name"], reciterSlugArg: args["reciter-slug"] });
    const riwayah = normalizeRiwayah(args.riwayah ?? "hafs-an-asim");
    const id = (args.id ?? nowId()).trim();
    const translation = validateTranslationFlag(args.translation) ?? "saheeh-international";

    const quality = (args.quality ?? "high").trim();
    const r2Key = (args["r2-key"] ?? (await rl.question("R2 key: "))).trim();

    const clip = { id, surah, ayahStart, ayahEnd, reciterSlug, reciterName, riwayah, translation, variants: [{ quality, r2Key }] };
    if (await clipIdExists(id)) throw new Error(`Clip id already exists: ${id}`);
    await addClipToDb(clip);
    console.log(`Added clip to database: ${id}`);
  } finally { rl.close(); }
}

async function ingestClip({ args }) {
  const rl = readline.createInterface({ input, output });
  let hlsDir = null;
  try {
    const inputPath = (args.input ?? (await rl.question("Input file path: "))).trim();
    const stat = await fs.stat(inputPath);
    const ext = path.extname(inputPath).toLowerCase();
    const surah = toInt(args.surah) ?? toInt(await rl.question("Surah (1-114): "));
    const ayahStart = toInt(args.start) ?? toInt(await rl.question("Ayah start: "));
    const ayahEnd = toInt(args.end) ?? toInt(await rl.question("Ayah end (blank = start): ")) ?? ayahStart;
    const reciterArg = args.reciter ?? (await rl.question("Reciter: "));
    const { reciterName, reciterSlug } = deriveReciter({ reciterArg, reciterNameArg: args["reciter-name"], reciterSlugArg: args["reciter-slug"] });
    const riwayah = normalizeRiwayah(args.riwayah ?? "hafs-an-asim");
    const translation = validateTranslationFlag(args.translation) ?? "saheeh-international";
    const prefix = args.prefix ?? "clips";
    const overwrite = Boolean(args.overwrite);
    const id = args.id || `s${surah}_a${ayahStart}-${ayahEnd}__${reciterSlug}__${riwayah}__${translation}`;

    const baseKey = baseR2Key({ prefix, reciterSlug, riwayah, translation, surah, ayahStart, ayahEnd });
    const highKey = `${baseKey}/high${ext}`;
    const hlsPrefix = `${baseKey}/hls`;
    const highMd5 = await md5FileHex(inputPath);
    const variants = [{ quality: "high", r2Key: highKey, md5: highMd5 }];

    if (ext === ".mp4") {
      hlsDir = path.join(os.tmpdir(), `${id.replace(/[^a-z0-9_-]+/gi, "_")}_hls`);
      await transcodeHls({ inputPath, outputDir: hlsDir });
      variants.push({ quality: "hls", r2Key: `${hlsPrefix}/master.m3u8` });
    }

    if (!args["no-upload"]) {
      await uploadToR2WithMd5({ key: highKey, filePath: inputPath, contentType: contentTypeForExt(ext), md5Hex: highMd5, overwrite });
      if (hlsDir) await uploadDirToR2({ localDir: hlsDir, remotePrefix: hlsPrefix, overwrite });
    }

    if (await clipIdExists(id)) throw new Error(`Clip id already exists: ${id}`);
    await addClipToDb({ id, surah, ayahStart, ayahEnd, reciterSlug, reciterName, riwayah, translation, variants });
    console.log(`Ingested clip: ${id}`);
  } finally {
    rl.close();
    if (hlsDir) await fs.rm(hlsDir, { recursive: true, force: true });
  }
}

async function removeClip({ args }) {
  const rl = readline.createInterface({ input, output });
  try {
    const id = (args.id ?? (await rl.question("Clip id to remove: "))).trim();
    const clip = await db.query.clips.findFirst({ where: eq(clipsTable.id, id), with: { variants: true } });
    if (!clip) throw new Error(`Clip not found: ${id}`);

    if (!args.yes && (await rl.question(`Delete ${id}? (y/n): `)) !== "y") return;

    if (!args["keep-r2"]) {
      const keys = clip.variants.map(v => v.r2Key);
      await deleteFromR2(keys);
    }
    await db.delete(clipsTable).where(eq(clipsTable.id, id));
    console.log(`Removed clip: ${id}`);
  } finally { rl.close(); }
}

function printHelp() {
  console.log(`Commands: add, ingest, remove. Flags: --id, --surah, --start, --end, --reciter, --input, --overwrite`);
}

const { args, rest } = parseArgs(process.argv.slice(2));
const command = rest[0];
if (command === "add") await addClip({ args });
else if (command === "ingest") await ingestClip({ args });
else if (command === "remove" || command === "rm") await removeClip({ args });
else printHelp();

process.exit(0);