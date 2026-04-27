import path from "node:path";
import fs from "node:fs/promises";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { clips as clipsTable, clipVariants } from "../src/db/schema/clips.ts";
import { eq } from "drizzle-orm";

async function loadDotEnv() {
  const candidates = [path.join(process.cwd(), ".env.local"), path.join(process.cwd(), ".env")];
  for (const filePath of candidates) {
    let raw;
    try { raw = await fs.readFile(filePath, "utf8"); } catch { continue; }
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (key && process.env[key] == null) process.env[key] = value;
    }
  }
}

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function makeS3Client() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  const { NodeHttpHandler } = await import("@smithy/node-http-handler");
  return new S3Client({
    region: "auto",
    endpoint: requiredEnv("R2_ENDPOINT"),
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    },
    forcePathStyle: true,
    requestHandler: new NodeHttpHandler({ connectionTimeout: 30_000, socketTimeout: 10 * 60_000 }),
  });
}

async function deleteFromR2(keys) {
  const { DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
  const Bucket = requiredEnv("R2_BUCKET");
  const client = await makeS3Client();
  const normalized = Array.from(new Set(keys.map((k) => k.replace(/^\/+/, "")))).filter(Boolean);
  if (normalized.length === 0) return { deleted: 0 };

  const res = await client.send(
    new DeleteObjectsCommand({
      Bucket,
      Delete: { Objects: normalized.map((Key) => ({ Key })), Quiet: true },
    })
  );
  return { deleted: normalized.length, errors: res.Errors ?? [] };
}

async function listR2Prefix(prefix) {
  const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
  const Bucket = requiredEnv("R2_BUCKET");
  const client = await makeS3Client();
  const keys = [];
  let token;
  do {
    const res = await client.send(new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken: token }));
    for (const obj of res.Contents ?? []) keys.push(obj.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

await loadDotEnv();

const CLIP_ID = "s2_a159-163__aashaam-shafeeq__hafs-an-asim__saheeh-international";
const R2_PREFIX = "clips/aashaam-shafeeq/hafs-an-asim/saheeh-international/s2/a159-163/";

const db = drizzle(createClient({ url: process.env.TURSO_DATABASE_URL || "file:local.db", authToken: process.env.TURSO_AUTH_TOKEN }));

// 1. Show what we're about to delete
const variants = await db.select().from(clipVariants).where(eq(clipVariants.clipId, CLIP_ID));
console.log(`Clip: ${CLIP_ID}`);
console.log(`DB variants to delete: ${variants.length}`);
for (const v of variants) console.log(`  ${v.quality}: ${v.r2Key}`);

// 2. List all R2 objects under the prefix (HLS has many segment files)
const r2Keys = await listR2Prefix(R2_PREFIX);
console.log(`\nR2 objects under ${R2_PREFIX}: ${r2Keys.length}`);
for (const k of r2Keys) console.log(`  ${k}`);

// 3. Delete from R2
if (r2Keys.length > 0) {
  console.log("\nDeleting from R2...");
  const res = await deleteFromR2(r2Keys);
  console.log(`Deleted ${res.deleted} objects from R2.`);
  if (res.errors.length > 0) console.error("Errors:", res.errors);
} else {
  console.log("\nNo R2 objects found (may have already been cleaned up).");
}

// 4. Delete from DB (cascade will handle clip_variants)
console.log("\nDeleting from DB...");
await db.delete(clipsTable).where(eq(clipsTable.id, CLIP_ID));
console.log("Done. Clip deleted from DB.");

process.exit(0);
