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

function toInt(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
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
  // CopySource must be URL-encoded, but slashes should remain slashes.
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

async function copyKey({ fromKey, toKey }) {
  await ensureDepsForR2();
  const { CopyObjectCommand } = await import("@aws-sdk/client-s3");
  const Bucket = requiredEnv("R2_BUCKET");
  const client = await makeS3Client();
  await client.send(
    new CopyObjectCommand({
      Bucket,
      Key: toKey,
      CopySource: encodeCopySource(Bucket, fromKey),
      MetadataDirective: "COPY"
    })
  );
}

async function deleteKey(key) {
  await ensureDepsForR2();
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const Bucket = requiredEnv("R2_BUCKET");
  const client = await makeS3Client();
  await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
}

function extractTranslationSegment(r2Key) {
  const m = String(r2Key ?? "").match(/\/(saheeh-international|khan-al-hilali)(?=\/)/);
  return m ? m[1] : null;
}

function rewriteTranslationSegment(r2Key, translation) {
  return String(r2Key ?? "").replace(/\/(saheeh-international|khan-al-hilali)(?=\/)/, `/${translation}`);
}

function otherTranslation(t) {
  if (t === "khan-al-hilali") return "saheeh-international";
  if (t === "saheeh-international") return "khan-al-hilali";
  return null;
}

function buildCandidateSourceKeys({ expectedKey, clip }) {
  const out = [];
  const expectedTranslation = extractTranslationSegment(expectedKey);
  if (expectedTranslation) {
    const other = otherTranslation(expectedTranslation);
    if (other) out.push(rewriteTranslationSegment(expectedKey, other));
  }

  // If legacy reciter exists and differs, try swapping that segment too.
  const legacyReciter = typeof clip?.reciter === "string" ? clip.reciter.trim() : "";
  const currentReciter = typeof clip?.reciterSlug === "string" ? clip.reciterSlug.trim() : "";
  if (legacyReciter && currentReciter && legacyReciter !== currentReciter) {
    // Replace only the first occurrence of `/${currentReciter}/` to avoid unexpected replacements.
    const swapped = expectedKey.replace(`/${currentReciter}/`, `/${legacyReciter}/`);
    if (swapped !== expectedKey) out.push(swapped);
    const swappedTranslation = expectedTranslation ? rewriteTranslationSegment(swapped, otherTranslation(expectedTranslation) ?? expectedTranslation) : null;
    if (swappedTranslation && swappedTranslation !== swapped) out.push(swappedTranslation);
  }

  // Common riwayah alias (historical misspelling).
  const riwayahAliasFrom = "/hafs-an-asim/";
  const riwayahAliasTo = "/hafs-an-aasim/";
  if (expectedKey.includes(riwayahAliasFrom)) out.push(expectedKey.replace(riwayahAliasFrom, riwayahAliasTo));
  if (expectedKey.includes(riwayahAliasTo)) out.push(expectedKey.replace(riwayahAliasTo, riwayahAliasFrom));

  // De-dupe while preserving order.
  const seen = new Set();
  return out.filter((k) => {
    if (!k || k === expectedKey) return false;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function printHelp() {
  console.log(`
Usage:
  bun scripts/fix-r2-keys.mjs [--jsonl <path>] [--apply] [--delete-sources] [--limit <n>]

What it does:
  - Reads clips from JSONL and checks each variant r2Key exists on R2.
  - If a key is missing, tries common "source" keys (e.g. swap translation segment
    between saheeh-international <-> khan-al-hilali) and copies the existing object
    to the expected key.

Flags:
  --jsonl <path>         (default: data/clips.jsonl)
  --apply                Actually perform CopyObject operations (default: dry-run)
  --delete-sources       Delete source key after successful copy
  --limit <n>            Process at most n missing keys
`.trim());
}

await loadDotEnv();

const { args } = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const jsonlPath = typeof args.jsonl === "string" ? args.jsonl : DEFAULT_JSONL_PATH;
const apply = Boolean(args.apply);
const deleteSources = Boolean(args["delete-sources"]);
const limit = toInt(args.limit);

const raw = await fs.readFile(jsonlPath, "utf8");
const lines = raw.split(/\r?\n/).filter((l) => l.trim());
const clips = lines.map((l) => JSON.parse(l));

const tasks = [];
for (const clip of clips) {
  if (!Array.isArray(clip?.variants)) continue;
  for (const v of clip.variants) {
    const key = v?.r2Key;
    if (!key) continue;
    tasks.push({ clip, key });
  }
}

requiredEnv("R2_ENDPOINT");
requiredEnv("R2_ACCESS_KEY_ID");
requiredEnv("R2_SECRET_ACCESS_KEY");
requiredEnv("R2_BUCKET");
await ensureDepsForR2();

let checked = 0;
let alreadyOk = 0;
let missing = 0;
let fixed = 0;
let notFixable = 0;
let deleted = 0;

for (const { clip, key: expectedKey } of tasks) {
  checked++;
  let exists = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      exists = await headKey(expectedKey);
      break;
    } catch (err) {
      if (attempt < 3 && isRetryableNetworkError(err)) {
        await sleep(500 * attempt);
        continue;
      }
      throw err;
    }
  }

  if (exists) {
    alreadyOk++;
    continue;
  }

  missing++;
  if (limit != null && fixed + notFixable >= limit) break;

  const candidates = buildCandidateSourceKeys({ expectedKey, clip });
  let sourceKey = null;
  for (const candidate of candidates) {
    let candidateExists = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        candidateExists = await headKey(candidate);
        break;
      } catch (err) {
        if (attempt < 3 && isRetryableNetworkError(err)) {
          await sleep(500 * attempt);
          continue;
        }
        throw err;
      }
    }
    if (candidateExists) {
      sourceKey = candidate;
      break;
    }
  }

  if (!sourceKey) {
    notFixable++;
    console.log(`MISSING: ${expectedKey} (clip=${clip.id})`);
    continue;
  }

  console.log(`FIXABLE: ${expectedKey} <- ${sourceKey} (clip=${clip.id})`);
  if (!apply) continue;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await copyKey({ fromKey: sourceKey, toKey: expectedKey });
      break;
    } catch (err) {
      if (attempt < 3 && isRetryableNetworkError(err)) {
        await sleep(750 * attempt);
        continue;
      }
      throw err;
    }
  }

  fixed++;

  if (deleteSources) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await deleteKey(sourceKey);
        deleted++;
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

console.log(
  JSON.stringify(
    {
      jsonl: path.relative(process.cwd(), jsonlPath),
      checked,
      alreadyOk,
      missing,
      fixed: apply ? fixed : 0,
      wouldFix: apply ? 0 : missing - notFixable,
      notFixable,
      deleted: apply ? deleted : 0,
      dryRun: !apply
    },
    null,
    2
  )
);

