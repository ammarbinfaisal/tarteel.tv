import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const JSONL_PATH = path.join(DATA_DIR, "clips.jsonl");

async function loadDotEnv() {
  const candidates = [path.join(process.cwd(), ".env.local"), path.join(process.cwd(), ".env")];
  for (const filePath of candidates) {
    let raw = null;
    try { raw = await fs.readFile(filePath, "utf8"); } catch (err) { continue; }
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
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 30_000,
      socketTimeout: 10 * 60_000
    })
  });
}

async function deleteFromR2(keys) {
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
  }
  return { deleted };
}

async function main() {
  await loadDotEnv();
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const apply = args.includes("--apply");

  if (!dryRun && !apply) {
    console.log("Usage: bun scripts/cleanup-redundant-variants.mjs [--dry-run | --apply]");
    process.exit(1);
  }

  const raw = await fs.readFile(JSONL_PATH, "utf8");
  const lines = raw.split("\n").filter(Boolean);
  const updatedLines = [];
  const allKeysToDelete = [];

  const REDUNDANT_QUALITIES = ["low", "1", "2", "3"];

  for (const line of lines) {
    const clip = JSON.parse(line);
    const redundant = clip.variants.filter(v => REDUNDANT_QUALITIES.includes(v.quality));
    
    if (redundant.length > 0) {
      console.log(`Clip ${clip.id}: found ${redundant.length} redundant variants (${redundant.map(v => v.quality).join(", ")})`);
      redundant.forEach(v => allKeysToDelete.push(v.r2Key));
      clip.variants = clip.variants.filter(v => !REDUNDANT_QUALITIES.includes(v.quality));
    }
    updatedLines.push(JSON.stringify(clip));
  }

  if (allKeysToDelete.length === 0) {
    console.log("No redundant variants found.");
    return;
  }

  console.log(`\nTotal redundant keys to delete: ${allKeysToDelete.length}`);

  if (dryRun) {
    console.log("\n[DRY RUN] Would delete the following keys from R2:");
    // Limit log output
    allKeysToDelete.slice(0, 10).forEach(k => console.log(`  - ${k}`));
    if (allKeysToDelete.length > 10) console.log(`  ... and ${allKeysToDelete.length - 10} more`);
    console.log(`\n[DRY RUN] Would update ${JSONL_PATH}`);
  } else if (apply) {
    console.log(`\nDeleting ${allKeysToDelete.length} objects from R2...`);
    const res = await deleteFromR2(allKeysToDelete);
    console.log(`Deleted ${res.deleted} objects.`);

    console.log(`Updating ${JSONL_PATH}...`);
    const backupPath = `${JSONL_PATH}.bak.${Date.now()}`;
    await fs.copyFile(JSONL_PATH, backupPath);
    await fs.writeFile(JSONL_PATH, updatedLines.join("\n") + "\n");
    console.log(`Updated! Backup saved to ${backupPath}`);
    
    // Rebuild index
    console.log("Rebuilding index...");
    const { spawn } = await import("node:child_process");
    await new Promise((resolve) => {
      const child = spawn("bun", ["run", "index"], { stdio: "inherit" });
      child.on("exit", resolve);
    });
  }
}

main().catch(console.error);