import fs from "node:fs/promises";
import fsSync from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const DATA_DIR = path.join(process.cwd(), "data");
const JSONL_PATH = path.join(DATA_DIR, "clips.jsonl");
const INDEX_PATH = path.join(DATA_DIR, "clips.index.json");

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

function normalizeTranslation(value) {
  const s = slugify(value);
  if (s === "saheeh-international") return s;
  if (s === "khan-al-hilali") return s;
  if (s === "khan-hilali") return "khan-al-hilali";
  if (s === "khan-hilali-translation") return "khan-al-hilali";
  if (s === "khan-al-hilali-translation") return "khan-al-hilali";
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

  // Preserve canonical spelling if provided verbatim.
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
    const reciterSlug = slugInput ? slugify(slugInput) : slugify(reciterName);
    return { reciterName: canonicalBySlug[reciterSlug] ?? reciterName, reciterSlug };
  }

  if (slugInput) {
    const reciterSlug = slugify(slugInput);
    const reciterName = canonicalBySlug[reciterSlug] ?? normalizeReciterName(reciterSlug.replace(/-/g, " "));
    return { reciterName, reciterSlug };
  }

  const r = String(reciterArg ?? "").trim();
  if (!r) return { reciterName: "", reciterSlug: "" };
  const looksLikeSlug = /^[a-z0-9-]+$/.test(r);
  if (looksLikeSlug) {
    const reciterSlug = slugify(r);
    const reciterName = canonicalBySlug[reciterSlug] ?? normalizeReciterName(reciterSlug.replace(/-/g, " "));
    return { reciterName, reciterSlug };
  }
  const reciterName = normalizeReciterName(r);
  const reciterSlug = slugify(reciterName);
  return { reciterName: canonicalBySlug[reciterSlug] ?? reciterName, reciterSlug };
}

function validateTranslationFlag(value) {
  if (value == null) return null;
  const normalized = normalizeTranslation(value);
  if (normalized !== "saheeh-international" && normalized !== "khan-al-hilali") throw new Error("Invalid translation");
  return normalized;
}

function rewriteTranslationSuffixInId(id, translation) {
  if (typeof id !== "string" || !id) return id;
  const parts = id.split("__");
  if (parts.length < 4) return id;
  const last = parts[parts.length - 1];
  if (last !== "saheeh-international" && last !== "khan-al-hilali") return id;
  parts[parts.length - 1] = translation;
  return parts.join("__");
}

function rewriteTranslationSegmentInR2Key(r2Key, translation) {
  if (typeof r2Key !== "string" || !r2Key) return r2Key;
  return r2Key.replace(/\/(saheeh-international|khan-al-hilali)(?=\/)/, `/${translation}`);
}

async function ensureJsonlFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(JSONL_PATH);
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
    await fs.writeFile(JSONL_PATH, "", "utf8");
  }
}

async function appendJsonl(obj) {
  await fs.appendFile(JSONL_PATH, JSON.stringify(obj) + "\n", "utf8");
}

async function clipIdExists(id) {
  try {
    const raw = await fs.readFile(INDEX_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.clipsById?.[id]);
  } catch (err) {
    if (err?.code === "ENOENT") return false;
    return false;
  }
}

async function getClipByIdFromIndex(id) {
  try {
    const raw = await fs.readFile(INDEX_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed?.clipsById?.[id] ?? null;
  } catch (err) {
    if (err?.code === "ENOENT") return null;
    return null;
  }
}

async function getClipByIdFromJsonl(id) {
  const jsonlExists = await fs
    .access(JSONL_PATH)
    .then(() => true)
    .catch(() => false);
  if (!jsonlExists) return null;

  const fh = await fs.open(JSONL_PATH, "r");
  try {
    const rl = (await import("node:readline")).createInterface({ input: fh.createReadStream(), crlfDelay: Infinity });
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const obj = JSON.parse(trimmed);
        if (obj?.id === id) return obj;
      } catch {
        // ignore
      }
    }
    return null;
  } finally {
    await fh.close();
  }
}

async function removeClipFromJsonlById(id, { backup = true } = {}) {
  const jsonlExists = await fs
    .access(JSONL_PATH)
    .then(() => true)
    .catch(() => false);
  if (!jsonlExists) throw new Error(`Missing ${JSONL_PATH}`);

  const backupPath = path.join(
    DATA_DIR,
    `clips.jsonl.bak.${new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")}`
  );

  if (backup) await fs.copyFile(JSONL_PATH, backupPath);

  const tmpPath = `${JSONL_PATH}.tmp`;
  const oldPath = `${JSONL_PATH}.old`;

  const inputFh = await fs.open(JSONL_PATH, "r");
  const out = fsSync.createWriteStream(tmpPath, { encoding: "utf8" });
  let removed = 0;

  try {
    const rl = (await import("node:readline")).createInterface({
      input: inputFh.createReadStream(),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const obj = JSON.parse(trimmed);
        if (obj?.id === id) {
          removed++;
          continue;
        }
      } catch {
        // Keep unparseable lines.
      }
      out.write(trimmed + "\n");
    }
  } finally {
    await inputFh.close();
    await new Promise((resolve) => out.end(resolve));
  }

  if (removed === 0) {
    await fs.unlink(tmpPath).catch(() => {});
    throw new Error(`No JSONL entries matched id=${id}`);
  }

  await fs.unlink(oldPath).catch(() => {});
  await fs.rename(JSONL_PATH, oldPath);
  try {
    await fs.rename(tmpPath, JSONL_PATH);
  } catch (err) {
    await fs.rename(oldPath, JSONL_PATH).catch(() => {});
    throw err;
  }
  await fs.unlink(oldPath).catch(() => {});

  return { removed, backupPath: backup ? backupPath : null };
}

async function runIndex() {
  const { spawn } = await import("node:child_process");
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(process.cwd(), "scripts/build-index.mjs")], {
      stdio: "inherit"
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`index failed (${code})`))));
  });
}

function baseR2Key({ prefix, reciterSlug, riwayah, translation, surah, ayahStart, ayahEnd }) {
  const p = prefix ? prefix.replace(/^\/+/, "").replace(/\/+$/, "") : "clips";
  return `${p}/${reciterSlug}/${riwayah}/${translation}/s${surah}/a${ayahStart}-${ayahEnd}`;
}

async function ensureDepsForUpload() {
  const missing = [];
  try {
    await import("@aws-sdk/client-s3");
  } catch {
    missing.push("@aws-sdk/client-s3");
  }
  try {
    await import("@aws-sdk/lib-storage");
  } catch {
    missing.push("@aws-sdk/lib-storage");
  }
  try {
    await import("@smithy/node-http-handler");
  } catch {
    missing.push("@smithy/node-http-handler");
  }
  if (missing.length) {
    throw new Error(`Missing deps: ${missing.join(", ")}. Install with \`bun add ${missing.join(" ")}\`.`);
  }
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

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

function looksLikeMd5Hex(value) {
  return typeof value === "string" && /^[a-f0-9]{32}$/i.test(value);
}

function etagToMaybeMd5(etag) {
  if (typeof etag !== "string") return null;
  const trimmed = etag.replaceAll('"', "").trim();
  if (trimmed.includes("-")) return null; // multipart etag
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
    const res = await client.send(
      new HeadObjectCommand({
        Bucket,
        Key: key.replace(/^\/+/, "")
      })
    );
    return res ?? null;
  } catch (err) {
    const name = err?.name ?? "";
    const http = err?.$metadata?.httpStatusCode ?? null;
    if (name === "NotFound" || http === 404 || err?.Code === "NoSuchKey") return null;
    throw err;
  }
}

async function remoteMd5ForKey(key) {
  const head = await headFromR2(key);
  if (!head) return null;
  const meta = head.Metadata ?? {};
  if (looksLikeMd5Hex(meta.md5)) return meta.md5.toLowerCase();
  const etagMd5 = etagToMaybeMd5(head.ETag);
  if (etagMd5) return etagMd5;
  return null;
}

function contentTypeForExt(ext) {
  switch (ext) {
    case ".mp4":
      return "video/mp4";
    case ".mp3":
      return "audio/mpeg";
    default:
      return "application/octet-stream";
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
      if (remoteMd5 && md5Hex) {
        throw new Error(
          `R2 key already exists with different content (md5 mismatch): ${key}\n` +
            `remote=${remoteMd5} local=${md5Hex}\n` +
            `Pass --overwrite to replace (or change --prefix/params to generate a different key).`
        );
      }
      throw new Error(
        `R2 key already exists but md5 is unknown (no md5 metadata and ETag is not a plain md5): ${key}\n` +
          `Pass --overwrite to replace, or delete the object / change the key.`
      );
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
      const retryable = isRetryableUploadError(err);
      if (!retryable || attempt === uploadAttempts) throw err;
      const backoff = Math.min(15_000, 500 * 2 ** (attempt - 1));
      console.warn(`Upload failed (attempt ${attempt}/${uploadAttempts}), retrying in ${backoff}ms...`);
      await sleep(backoff);
    }
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
    const res = await client.send(
      new DeleteObjectsCommand({
        Bucket,
        Delete: {
          Objects: batch.map((Key) => ({ Key })),
          Quiet: false
        }
      })
    );

    deleted += res?.Deleted?.length ?? 0;
    const errors = res?.Errors ?? [];
    if (errors.length) {
      const msg = errors.map((e) => `${e?.Key ?? "?"}: ${e?.Code ?? "Error"} ${e?.Message ?? ""}`.trim()).join("\n");
      throw new Error(`R2 delete errors:\n${msg}`);
    }
  }

  return { deleted };
}

async function transcodeLowMp3({ inputPath, outputPath, bitrateKbps }) {
  const { spawn } = await import("node:child_process");
  const bitrate = `${bitrateKbps}k`;

  await new Promise((resolve, reject) => {
    const child = spawn(
      "ffmpeg",
      ["-y", "-i", inputPath, "-vn", "-ac", "1", "-ar", "22050", "-b:a", bitrate, "-c:a", "libmp3lame", outputPath],
      { stdio: "inherit" }
    );
    child.on("error", (err) => {
      if (err?.code === "ENOENT") reject(new Error("ffmpeg not found. Install ffmpeg and ensure it's on PATH."));
      else reject(err);
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed (${code})`))));
  });
}

async function transcodeLowMp4({ inputPath, outputPath, height, crf, audioKbps }) {
  const { spawn } = await import("node:child_process");

  await new Promise((resolve, reject) => {
    const child = spawn(
      "ffmpeg",
      [
        "-y",
        "-i",
        inputPath,
        "-vf",
        `scale=-2:${height}`,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        String(crf),
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        `${audioKbps}k`,
        "-movflags",
        "+faststart",
        outputPath
      ],
      { stdio: "inherit" }
    );
    child.on("error", (err) => {
      if (err?.code === "ENOENT") reject(new Error("ffmpeg not found. Install ffmpeg and ensure it's on PATH."));
      else reject(err);
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed (${code})`))));
  });
}

async function addClip({ args }) {
  const rl = readline.createInterface({ input, output });
  try {
    const surah = toInt(args.surah) ?? toInt(await rl.question("Surah (1-114): "));
    const ayahStart = toInt(args.start) ?? toInt(await rl.question("Ayah start: "));
    const ayahEnd =
      toInt(args.end) ?? toInt(await rl.question("Ayah end (blank = start): ")) ?? ayahStart;
    const reciterArg = args.reciter ?? (await rl.question("Reciter (name or slug, e.g. Maher al-Mu'aiqly): "));
    const { reciterName, reciterSlug } = deriveReciter({
      reciterArg,
      reciterNameArg: args["reciter-name"],
      reciterSlugArg: args["reciter-slug"]
    });
    const riwayah = normalizeRiwayah(args.riwayah ?? "hafs-an-asim");
    const id = (args.id ?? nowId()).trim();
    const translation = validateTranslationFlag(args.translation) ?? "khan-al-hilali";

    if (!Number.isInteger(surah) || surah < 1 || surah > 114) throw new Error("Invalid surah");
    if (!Number.isInteger(ayahStart) || ayahStart < 1) throw new Error("Invalid ayah start");
    if (!Number.isInteger(ayahEnd) || ayahEnd < ayahStart) throw new Error("Invalid ayah end");
    if (!reciterSlug) throw new Error("Invalid reciter");
    if (!reciterName) throw new Error("Invalid reciter name");
    if (!riwayah) throw new Error("Invalid riwayah");
    if (translation !== "saheeh-international" && translation !== "khan-al-hilali") throw new Error("Invalid translation");
    const lowKey = typeof args["low-key"] === "string" ? args["low-key"].trim() : "";
    const highKey = typeof args["high-key"] === "string" ? args["high-key"].trim() : "";

    const variants = [];
    if (lowKey) variants.push({ quality: "low", r2Key: lowKey });
    if (highKey) variants.push({ quality: "high", r2Key: highKey });

    if (variants.length === 0) {
      const quality = (args.quality ?? (await rl.question("Quality (low|high): "))).trim();
      const r2Key = (args["r2-key"] ?? (await rl.question("R2 key (e.g. clips/.../high.mp3): "))).trim();
      if (quality !== "low" && quality !== "high") throw new Error("Invalid quality");
      if (!r2Key) throw new Error("Invalid r2 key");
      variants.push({ quality, r2Key });
    }

    const clip = {
      id,
      surah,
      ayahStart,
      ayahEnd,
      reciterSlug,
      reciterName,
      riwayah,
      translation,
      variants
    };

    await ensureJsonlFile();
    if (await clipIdExists(id)) throw new Error(`Clip id already exists: ${id} (pass --id to override)`);
    await appendJsonl(clip);
    console.log(`Appended to ${path.relative(process.cwd(), JSONL_PATH)}: ${id}`);
    await runIndex();
  } finally {
    rl.close();
  }
}

async function ingestClip({ args }) {
  const rl = readline.createInterface({ input, output });
  let tempLowPath = null;
  try {
    const inputPath = (args.input ?? (await rl.question("Input file path (mp4/mp3, high quality): "))).trim();
    if (!inputPath) throw new Error("Missing --input");
    const stat = await fs.stat(inputPath);
    if (!stat.isFile()) throw new Error("Input path must be a file");
    const ext = path.extname(inputPath).toLowerCase();
    if (ext !== ".mp3" && ext !== ".mp4") throw new Error("Only .mp4 or .mp3 input is supported for now");

    const surah = toInt(args.surah) ?? toInt(await rl.question("Surah (1-114): "));
    const ayahStart = toInt(args.start) ?? toInt(await rl.question("Ayah start: "));
    const ayahEnd =
      toInt(args.end) ?? toInt(await rl.question("Ayah end (blank = start): ")) ?? ayahStart;
    const reciterArg = args.reciter ?? (await rl.question("Reciter (name or slug, e.g. Maher al-Mu'aiqly): "));
    const { reciterName, reciterSlug } = deriveReciter({
      reciterArg,
      reciterNameArg: args["reciter-name"],
      reciterSlugArg: args["reciter-slug"]
    });
    const riwayah = normalizeRiwayah(args.riwayah ?? "hafs-an-asim");
    const prefix = typeof args.prefix === "string" ? args.prefix : "clips";
    const overwrite = Boolean(args.overwrite);
    const idArg = typeof args.id === "string" ? args.id.trim() : "";
    const translation = validateTranslationFlag(args.translation) ?? "khan-al-hilali";

    if (!Number.isInteger(surah) || surah < 1 || surah > 114) throw new Error("Invalid surah");
    if (!Number.isInteger(ayahStart) || ayahStart < 1) throw new Error("Invalid ayah start");
    if (!Number.isInteger(ayahEnd) || ayahEnd < ayahStart) throw new Error("Invalid ayah end");
    if (!reciterSlug) throw new Error("Invalid reciter");
    if (!reciterName) throw new Error("Invalid reciter name");
    if (!riwayah) throw new Error("Invalid riwayah");
    if (translation !== "saheeh-international" && translation !== "khan-al-hilali") throw new Error("Invalid translation");

    const baseKey = baseR2Key({ prefix, reciterSlug, riwayah, translation, surah, ayahStart, ayahEnd });
    const highKey = `${baseKey}/high${ext}`;
    const lowKey = `${baseKey}/low${ext}`;

    const id = idArg || `s${surah}_a${ayahStart}-${ayahEnd}__${reciterSlug}__${riwayah}__${translation}`;

    const highMd5 = await md5FileHex(inputPath);

    if (ext === ".mp3") {
      const bitrateKbps = toInt(args["low-kbps"]) ?? 48;
      tempLowPath = path.join(os.tmpdir(), `${id.replace(/[^a-z0-9_-]+/gi, "_")}.low.mp3`);
      console.log(`Generating low quality mp3 (${bitrateKbps}kbps): ${tempLowPath}`);
      await transcodeLowMp3({ inputPath, outputPath: tempLowPath, bitrateKbps });
    } else {
      const height = toInt(args["low-height"]) ?? 720;
      const crf = toInt(args["low-crf"]) ?? 30;
      const audioKbps = toInt(args["low-audio-kbps"]) ?? 64;
      tempLowPath = path.join(os.tmpdir(), `${id.replace(/[^a-z0-9_-]+/gi, "_")}.low.mp4`);
      console.log(`Generating low quality mp4 (${height}p crf=${crf} aac=${audioKbps}k): ${tempLowPath}`);
      await transcodeLowMp4({ inputPath, outputPath: tempLowPath, height, crf, audioKbps });
    }
    const lowMd5 = await md5FileHex(tempLowPath);

    const upload = args["no-upload"] ? false : true;
    if (upload) {
      console.log(`Uploading to R2: ${highKey}`);
      await uploadToR2WithMd5({
        key: highKey,
        filePath: inputPath,
        contentType: contentTypeForExt(ext),
        md5Hex: highMd5,
        overwrite
      });
      console.log(`Uploading to R2: ${lowKey}`);
      await uploadToR2WithMd5({
        key: lowKey,
        filePath: tempLowPath,
        contentType: contentTypeForExt(ext),
        md5Hex: lowMd5,
        overwrite
      });
    } else {
      console.log("Skipping upload (--no-upload).");
    }

    const clip = {
      id,
      surah,
      ayahStart,
      ayahEnd,
      reciterSlug,
      reciterName,
      riwayah,
      translation,
      variants: [
        { quality: "low", r2Key: lowKey, md5: lowMd5 },
        { quality: "high", r2Key: highKey, md5: highMd5 }
      ]
    };

    await ensureJsonlFile();
    if (await clipIdExists(id)) throw new Error(`Clip id already exists: ${id} (pass --id to override)`);
    await appendJsonl(clip);
    console.log(`Appended to ${path.relative(process.cwd(), JSONL_PATH)}: ${id}`);
    await runIndex();
  } finally {
    rl.close();
    if (tempLowPath) {
      try {
        await fs.unlink(tempLowPath);
      } catch {
        // ignore
      }
    }
  }
}

async function removeClip({ args }) {
  const rl = readline.createInterface({ input, output });
  try {
    const id = (args.id ?? (await rl.question("Clip id to remove: "))).trim();
    if (!id) throw new Error("Missing --id");

    const dryRun = Boolean(args["dry-run"]);
    const yes = Boolean(args.yes || args.force);
    const keepR2 = Boolean(args["keep-r2"]);
    const keepJsonl = Boolean(args["keep-jsonl"]);

    const clip = (await getClipByIdFromIndex(id)) ?? (await getClipByIdFromJsonl(id));
    if (!clip) throw new Error(`Clip id not found: ${id}`);

    const keys = Array.isArray(clip.variants) ? clip.variants.map((v) => v?.r2Key).filter(Boolean) : [];

    console.log(`About to remove clip: ${id}`);
    console.log(`- surah ${clip.surah} ayah ${clip.ayahStart}-${clip.ayahEnd}`);
    console.log(
      `- reciter ${clip.reciterName ?? clip.reciter ?? clip.reciterSlug} riwayah ${clip.riwayah} translation ${clip.translation}`
    );
    console.log(`- variants: ${clip.variants?.map((v) => `${v.quality}:${v.r2Key}`).join(", ") ?? "(none)"}`);

    if (dryRun) {
      console.log("Dry run enabled; no changes made.");
      return;
    }

    if (!yes) {
      if (!input.isTTY) {
        throw new Error('Non-interactive session: pass `--yes` to confirm deletion.');
      }
      const answer = (await rl.question('Type "delete" to confirm: ')).trim().toLowerCase();
      if (answer !== "delete") {
        console.log("Canceled.");
        return;
      }
    }

    if (!keepR2) {
      console.log(`Deleting ${keys.length} object(s) from R2...`);
      const res = await deleteFromR2(keys);
      console.log(`Deleted ${res.deleted} object(s).`);
    }

    if (!keepJsonl) {
      const res = await removeClipFromJsonlById(id, { backup: true });
      console.log(`Removed ${res.removed} JSONL line(s). Backup: ${res.backupPath}`);
      await runIndex();
    }
  } finally {
    rl.close();
  }
}

async function syncMd5({ args }) {
  const id = typeof args.id === "string" && args.id.trim() ? args.id.trim() : null;
  const dryRun = Boolean(args["dry-run"]);
  const force = Boolean(args.force);

  const jsonlExists = await fs
    .access(JSONL_PATH)
    .then(() => true)
    .catch(() => false);
  if (!jsonlExists) throw new Error(`Missing ${JSONL_PATH}`);

  const fh = await fs.open(JSONL_PATH, "r");
  const clips = [];
  try {
    const rl = (await import("node:readline")).createInterface({ input: fh.createReadStream(), crlfDelay: Infinity });
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const obj = JSON.parse(trimmed);
      if (id && obj?.id !== id) {
        clips.push(obj);
        continue;
      }

      let changed = false;
      if (Array.isArray(obj?.variants)) {
        for (const v of obj.variants) {
          if (!v?.r2Key) continue;
          if (!force && v.md5) continue;
          const remoteMd5 = await remoteMd5ForKey(v.r2Key);
          if (remoteMd5) {
            v.md5 = remoteMd5;
            changed = true;
          }
        }
      }
      clips.push(obj);
      if (id && obj?.id === id) {
        if (!changed) console.log(`No md5 updates for ${id} (missing remote md5 metadata/etag?)`);
        else console.log(`Updated md5 for ${id}`);
      }
    }
  } finally {
    await fh.close();
  }

  if (dryRun) {
    console.log("Dry run enabled; not writing JSONL.");
    return;
  }

  const backupPath = path.join(
    DATA_DIR,
    `clips.jsonl.bak.${new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")}`
  );
  await fs.copyFile(JSONL_PATH, backupPath);
  await fs.writeFile(JSONL_PATH, clips.map((c) => JSON.stringify(c)).join("\n") + "\n", "utf8");
  console.log(`Wrote ${path.relative(process.cwd(), JSONL_PATH)} (backup: ${path.relative(process.cwd(), backupPath)})`);
  await runIndex();
}

async function normalizeJsonl({ args }) {
  const dryRun = Boolean(args["dry-run"]);
  const dropLegacyReciter = Boolean(args["drop-legacy-reciter"]);
  const jsonlExists = await fs
    .access(JSONL_PATH)
    .then(() => true)
    .catch(() => false);
  if (!jsonlExists) throw new Error(`Missing ${JSONL_PATH}`);

  const fh = await fs.open(JSONL_PATH, "r");
  const clips = [];
  let changedCount = 0;
  try {
    const rl = (await import("node:readline")).createInterface({ input: fh.createReadStream(), crlfDelay: Infinity });
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const obj = JSON.parse(trimmed);

      const before = JSON.stringify(obj);

      const { reciterName, reciterSlug } = deriveReciter({
        reciterArg: obj.reciterName ?? obj.reciterSlug ?? obj.reciter ?? "",
        reciterNameArg: obj.reciterName,
        reciterSlugArg: obj.reciterSlug
      });
      if (reciterName) obj.reciterName = reciterName;
      if (reciterSlug) obj.reciterSlug = reciterSlug;

      if (dropLegacyReciter) delete obj.reciter;

      if (!obj.riwayah) obj.riwayah = "hafs-an-asim";
      obj.riwayah = normalizeRiwayah(obj.riwayah);

      if (!obj.translation) obj.translation = "khan-al-hilali";
      obj.translation = validateTranslationFlag(obj.translation);

      obj.id = rewriteTranslationSuffixInId(obj.id, obj.translation);

      if (Array.isArray(obj.variants)) {
        for (const v of obj.variants) {
          if (!v?.r2Key) continue;
          v.r2Key = rewriteTranslationSegmentInR2Key(v.r2Key, obj.translation);
        }
      }

      const after = JSON.stringify(obj);
      if (before !== after) changedCount++;
      clips.push(obj);
    }
  } finally {
    await fh.close();
  }

  const ids = new Set();
  for (const c of clips) {
    if (ids.has(c.id)) throw new Error(`Duplicate clip id after normalization: ${c.id}`);
    ids.add(c.id);
  }

  if (dryRun) {
    console.log(`Would rewrite ${path.relative(process.cwd(), JSONL_PATH)} (changed ${changedCount} line(s)).`);
    return;
  }

  const backupPath = path.join(
    DATA_DIR,
    `clips.jsonl.bak.${new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")}`
  );
  await fs.copyFile(JSONL_PATH, backupPath);
  await fs.writeFile(JSONL_PATH, clips.map((c) => JSON.stringify(c)).join("\n") + "\n", "utf8");
  console.log(
    `Wrote ${path.relative(process.cwd(), JSONL_PATH)} (changed ${changedCount} line(s), backup: ${path.relative(process.cwd(), backupPath)})`
  );
  await runIndex();
}

function printHelp() {
  console.log(`
Usage:
  bun run clip -- <command> [--flags]

Commands:
  add      Add a clip line to data/clips.jsonl and rebuild index
  ingest   Transcode low variant + upload to R2 + append clip
  remove   Remove a clip from JSONL + delete R2 objects
  sync-md5 Fill missing md5 from R2 HEAD
  normalize-jsonl Normalize reciter fields/casing
  index    Rebuild data/clips.index.json from JSONL

Add flags:
  --id <string>
  --surah <number>
  --start <number>
  --end <number>              (default: start)
  --reciter <name|slug>
  --reciter-name <name>       (optional; overrides --reciter)
  --reciter-slug <slug>       (optional; overrides derived slug)
  --riwayah <slug>            (default: hafs-an-asim)
  --translation <slug>        (default: khan-al-hilali)
  --low-key <string>          (optional)
  --high-key <string>         (optional)
  --quality <low|high>        (used when low/high keys omitted)
  --r2-key <string>           (used when low/high keys omitted)

Ingest flags:
  --input <path.(mp4|mp3)>    (required)
  --prefix <string>           (default: clips)
  --reciter <name|slug>
  --reciter-name <name>       (optional; overrides --reciter)
  --reciter-slug <slug>       (optional; overrides derived slug)
  --low-kbps <number>         (default: 48, mp3 only)
  --low-height <number>       (default: 720, mp4 only)
  --low-crf <number>          (default: 30, mp4 only)
  --low-audio-kbps <number>   (default: 64, mp4 only)
  --overwrite                 (replace keys if mismatch)
  --no-upload                 (skip R2 upload)

Remove flags:
  --id <string>               (required)
  --yes                       (skip confirmation)
  --dry-run                   (print only)
  --keep-r2                   (do not delete objects)
  --keep-jsonl                (do not rewrite JSONL/index)

Sync-md5 flags:
  --id <string>               (optional; otherwise all)
  --force                     (overwrite existing md5 fields)
  --dry-run                   (do not write JSONL)

Normalize-jsonl flags:
  --dry-run                   (print only)
  --drop-legacy-reciter       (remove old reciter field)
`.trim());
}

await loadDotEnv();

const { args, rest } = parseArgs(process.argv.slice(2));
const command = rest[0];

if (!command || command === "help" || args.help) {
  printHelp();
  process.exit(0);
}

if (command === "index") {
  await runIndex();
  process.exit(0);
}

if (command === "add") {
  await addClip({ args });
  process.exit(0);
}

if (command === "ingest") {
  await ingestClip({ args });
  process.exit(0);
}

if (command === "remove" || command === "rm") {
  await removeClip({ args });
  process.exit(0);
}

if (command === "sync-md5") {
  await syncMd5({ args });
  process.exit(0);
}

if (command === "normalize-jsonl" || command === "normalize") {
  await normalizeJsonl({ args });
  process.exit(0);
}

console.error(`Unknown command: ${command}`);
printHelp();
process.exit(1);
