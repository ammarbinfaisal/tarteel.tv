import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DEFAULT_JSONL_PATH = path.join(DATA_DIR, "clips.jsonl");

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

function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

function assertTranslation(value) {
  const t = normalizeTranslation(value);
  if (t !== "saheeh-international" && t !== "khan-al-hilali") {
    throw new Error(`Invalid --translation: ${value}`);
  }
  return t;
}

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function toInt(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableNetworkError(err) {
  const code = err?.code ?? err?.errno ?? null;
  const name = err?.name ?? "";
  const message = String(err?.message ?? "");
  if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "EPIPE") return true;
  if (name.includes("Timeout") || name.includes("Networking")) return true;
  if (message.includes("socket connection was closed unexpectedly")) return true;
  if (message.includes("Request timeout")) return true;
  return false;
}

function isNotFoundError(err) {
  const status = err?.$metadata?.httpStatusCode ?? null;
  if (status === 404) return true;
  const name = String(err?.name ?? "");
  if (name === "NotFound" || name === "NoSuchKey") return true;
  const code = String(err?.Code ?? err?.code ?? "");
  if (code === "NotFound" || code === "NoSuchKey") return true;
  return false;
}

async function ensureDepsForR2() {
  const missing = [];
  try {
    await import("@aws-sdk/client-s3");
  } catch {
    missing.push("@aws-sdk/client-s3");
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

async function makeS3Client() {
  if (makeS3Client._cached) return makeS3Client._cached;
  await ensureDepsForR2();
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

function encodeCopySource(bucket, key) {
  const encodedKey = encodeURIComponent(key).replace(/%2F/g, "/");
  return `${bucket}/${encodedKey}`;
}

async function headKey(key) {
  await ensureDepsForR2();
  const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
  const Bucket = requiredEnv("R2_BUCKET");
  const client = await makeS3Client();
  try {
    await client.send(new HeadObjectCommand({ Bucket, Key: key }));
    return true;
  } catch (err) {
    if (isNotFoundError(err)) return false;
    throw err;
  }
}

async function copyKey({ fromKey, toKey, overwrite }) {
  await ensureDepsForR2();
  const { CopyObjectCommand } = await import("@aws-sdk/client-s3");
  const Bucket = requiredEnv("R2_BUCKET");
  const client = await makeS3Client();

  if (!overwrite) {
    const exists = await headKey(toKey);
    if (exists) return { copied: false, reason: "dest-exists" };
  }

  await client.send(
    new CopyObjectCommand({
      Bucket,
      Key: toKey,
      CopySource: encodeCopySource(Bucket, fromKey),
      MetadataDirective: "COPY"
    })
  );
  return { copied: true };
}

async function deleteKey(key) {
  await ensureDepsForR2();
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const Bucket = requiredEnv("R2_BUCKET");
  const client = await makeS3Client();
  await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
}

function rewriteTranslationSegmentInR2Key(r2Key, translation) {
  return String(r2Key ?? "").replace(/\/(saheeh-international|khan-al-hilali)(?=\/)/, `/${translation}`);
}

function buildCanonicalId({ surah, ayahStart, ayahEnd, reciterSlug, riwayah, translation }) {
  return `s${surah}_a${ayahStart}-${ayahEnd}__${reciterSlug}__${riwayah}__${translation}`;
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

function printHelp() {
  console.log(`
Usage:
  bun scripts/set-clip-translation.mjs --id <clipId> --translation <slug> [--jsonl <path>] [--apply] [--apply-r2]

What it does:
  - Updates a single clip in JSONL:
    - clip.translation
    - clip.id (canonical, includes translation suffix)
    - each variant.r2Key translation segment
  - Rebuilds data/clips.index.json after writing JSONL.
  - Optionally copies objects on R2 from old keys to new keys.

Flags:
  --jsonl <path>        (default: data/clips.jsonl)
  --apply               Write JSONL + rebuild index (default: dry-run)
  --apply-r2            Copy objects on R2 (requires env + network)
  --delete-sources      Delete old keys after successful copy (only with --apply-r2)
  --overwrite           Allow overwriting destination keys on R2 (only with --apply-r2)
`.trim());
}

await loadDotEnv();
const { args } = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const clipId = typeof args.id === "string" ? args.id.trim() : "";
if (!clipId) throw new Error("Missing --id");
if (typeof args.translation !== "string") throw new Error("Missing --translation");
const translation = assertTranslation(args.translation);

const jsonlPath = typeof args.jsonl === "string" ? args.jsonl : DEFAULT_JSONL_PATH;
const apply = Boolean(args.apply);
const applyR2 = Boolean(args["apply-r2"]);
const deleteSources = Boolean(args["delete-sources"]);
const overwrite = Boolean(args.overwrite);

const raw = await fs.readFile(jsonlPath, "utf8");
const lines = raw.split(/\r?\n/).filter((l) => l.trim());
const clips = lines.map((l) => JSON.parse(l));

const idx = clips.findIndex((c) => c?.id === clipId);
if (idx === -1) throw new Error(`Clip not found: ${clipId}`);

const clip = clips[idx];
const oldId = clip.id;
const oldTranslation = clip.translation;
const oldVariantKeys = (clip.variants ?? []).map((v) => v?.r2Key).filter(Boolean);

if (!clip.reciterSlug && clip.reciter) clip.reciterSlug = clip.reciter;
if (!clip.riwayah) clip.riwayah = "hafs-an-asim";

clip.translation = translation;
clip.id = buildCanonicalId({
  surah: clip.surah,
  ayahStart: clip.ayahStart,
  ayahEnd: clip.ayahEnd,
  reciterSlug: clip.reciterSlug,
  riwayah: clip.riwayah,
  translation: clip.translation
});

if (Array.isArray(clip.variants)) {
  for (const v of clip.variants) {
    if (!v?.r2Key) continue;
    v.r2Key = rewriteTranslationSegmentInR2Key(v.r2Key, translation);
  }
}

const newId = clip.id;
const newVariantKeys = (clip.variants ?? []).map((v) => v?.r2Key).filter(Boolean);

const newIds = new Set(clips.map((c) => c.id));
if (newIds.size !== clips.length) {
  throw new Error("Duplicate clip id detected in JSONL (before write).");
}

console.log(JSON.stringify({ oldId, newId, oldTranslation, newTranslation: translation }, null, 2));
console.log(
  JSON.stringify(
    {
      variants: oldVariantKeys.map((k, i) => ({ from: k, to: newVariantKeys[i] ?? null }))
    },
    null,
    2
  )
);

if (applyR2) {
  requiredEnv("R2_ENDPOINT");
  requiredEnv("R2_ACCESS_KEY_ID");
  requiredEnv("R2_SECRET_ACCESS_KEY");
  requiredEnv("R2_BUCKET");
  await ensureDepsForR2();

  for (let i = 0; i < oldVariantKeys.length; i++) {
    const fromKey = oldVariantKeys[i];
    const toKey = newVariantKeys[i];
    if (!fromKey || !toKey || fromKey === toKey) continue;

    const fromExists = await headKey(fromKey);
    const toExists = await headKey(toKey);
    if (!fromExists && !toExists) {
      console.log(`R2: missing both from/to: ${fromKey} -> ${toKey}`);
      continue;
    }
    if (toExists && !overwrite) {
      console.log(`R2: dest exists, skip: ${toKey}`);
      continue;
    }
    if (!fromExists && toExists) {
      console.log(`R2: source missing but dest exists, ok: ${toKey}`);
      continue;
    }

    console.log(`R2: copy ${fromKey} -> ${toKey}`);
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await copyKey({ fromKey, toKey, overwrite });
        break;
      } catch (err) {
        if (attempt < 3 && isRetryableNetworkError(err)) {
          await sleep(750 * attempt);
          continue;
        }
        throw err;
      }
    }

    if (deleteSources) {
      console.log(`R2: delete ${fromKey}`);
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await deleteKey(fromKey);
          break;
        } catch (err) {
          if (attempt < 3 && isRetryableNetworkError(err)) {
            await sleep(750 * attempt);
            continue;
          }
          throw err;
        }
      }
    }
  }
}

if (!apply) {
  console.log("Dry-run (pass --apply to write JSONL and rebuild index).");
  process.exit(0);
}

const backupPath = path.join(
  DATA_DIR,
  `clips.jsonl.bak.${new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")}`
);
await fs.copyFile(jsonlPath, backupPath);
await fs.writeFile(jsonlPath, clips.map((c) => JSON.stringify(c)).join("\n") + "\n", "utf8");
console.log(`Wrote ${path.relative(process.cwd(), jsonlPath)} (backup: ${path.relative(process.cwd(), backupPath)})`);
await runIndex();

