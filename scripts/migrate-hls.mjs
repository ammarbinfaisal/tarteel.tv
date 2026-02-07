import fs from "node:fs/promises";
import fsSync from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

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

async function downloadFromR2(key, localPath) {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const client = await makeS3Client();
  const res = await client.send(new GetObjectCommand({
    Bucket: requiredEnv("R2_BUCKET"),
    Key: key.replace(/^\/+/, "")
  }));
  const writer = fsSync.createWriteStream(localPath);
  await new Promise((resolve, reject) => {
    res.Body.pipe(writer);
    res.Body.on("error", reject);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

async function uploadToR2({ key, filePath, contentType }) {
  const { Upload } = await import("@aws-sdk/lib-storage");
  const client = await makeS3Client();
  const stat = await fs.stat(filePath);
  const upload = new Upload({
    client,
    params: {
      Bucket: requiredEnv("R2_BUCKET"),
      Key: key.replace(/^\/+/, ""),
      Body: fsSync.createReadStream(filePath),
      ContentType: contentType,
      ContentLength: stat.size,
      CacheControl: "public, max-age=31536000, immutable"
    }
  });
  await upload.done();
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

async function transcodeHls({ inputPath, outputDir }) {
  await fs.mkdir(outputDir, { recursive: true });
  const args = [
    "-y", "-i", inputPath,
    "-map", "0:v", "-map", "0:a", "-s:v:0", "1280x720", "-c:v:0", "libx264", "-b:v:0", "1500k", "-maxrate:v:0", "1650k", "-bufsize:v:0", "3000k",
    "-map", "0:v", "-map", "0:a", "-c:v:1", "libx264", "-b:v:1", "3000k", "-maxrate:v:1", "3300k", "-bufsize:v:1", "6000k",
    "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
    "-f", "hls", "-hls_time", "6", "-hls_playlist_type", "vod", 
    "-hls_segment_type", "fmp4", "-hls_flags", "single_file", "-master_pl_name", "master.m3u8",
    "-hls_segment_filename", path.join(outputDir, "v%v/stream.mp4"),
    "-var_stream_map", "v:0,a:0 v:1,a:1",
    path.join(outputDir, "v%v/index.m3u8")
  ];
  await new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: "inherit" });
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error("ffmpeg HLS failed")));
  });
}

async function transcodeMp4({ inputPath, outputPath, height, crf, audioKbps }) {
  const args = [
    "-y", "-i", inputPath, "-vf", `scale=-2:${height}`, "-c:v", "libx264", "-preset", "veryfast", "-crf", String(crf),
    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", `${audioKbps}k`, "-movflags", "+faststart", outputPath
  ];
  await new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: "inherit" });
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error("ffmpeg MP4 failed")));
  });
}

async function uploadDirToR2({ localDir, remotePrefix }) {
  const entries = await fs.readdir(localDir, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const fullPath = path.join(entry.parentPath, entry.name);
    const relPath = path.relative(localDir, fullPath);
    const key = `${remotePrefix.replace(/\/+$/, "")}/${relPath.replace(/\\/g, "/")}`;
    const ext = path.extname(entry.name).toLowerCase();
    const contentType = ext === ".m3u8" ? "application/x-mpegURL" : (ext === ".ts" ? "video/MP2T" : (ext === ".mp4" ? "video/mp4" : "application/octet-stream"));
    await uploadToR2({ key, filePath: fullPath, contentType });
  }
}

async function main() {
  await loadDotEnv();
  const raw = await fs.readFile(JSONL_PATH, "utf8");
  const lines = raw.split("\n").filter(Boolean);
  const updatedLines = [];

  for (let i = 0; i < lines.length; i++) {
    const clip = JSON.parse(lines[i]);
    const high = clip.variants.find(v => v.quality === "high");
    
    // Skip if not mp4 or already has hls
    if (!high || !high.r2Key.endsWith(".mp4") || clip.variants.some(v => v.quality === "hls")) {
      updatedLines.push(JSON.stringify(clip));
      continue;
    }

    console.log(`\n[${i+1}/${lines.length}] Migrating: ${clip.id}`);
    const tmpInput = path.join(os.tmpdir(), `migrate_${clip.id}_high.mp4`);
    const hlsDir = path.join(os.tmpdir(), `migrate_${clip.id}_hls`);
    
    try {
      console.log(`Downloading ${high.r2Key}...`);
      await downloadFromR2(high.r2Key, tmpInput);

      console.log(`Transcoding HLS (Fragmented MP4)...`);
      await transcodeHls({ inputPath: tmpInput, outputDir: hlsDir });

      const baseKey = path.dirname(high.r2Key);
      const hlsPrefix = `${baseKey}/hls`;
      console.log(`Uploading HLS...`);
      await uploadDirToR2({ localDir: hlsDir, remotePrefix: hlsPrefix });

      const newVariants = clip.variants.filter(v => v.quality === "high");
      newVariants.push({ quality: "hls", r2Key: `${hlsPrefix}/master.m3u8` });

      clip.variants = newVariants;
      updatedLines.push(JSON.stringify(clip));
      
      // Save progress incrementally
      await fs.writeFile(JSONL_PATH, updatedLines.concat(lines.slice(i + 1).map(l => JSON.stringify(JSON.parse(l)))).join("\n") + "\n");
    } catch (err) {
      console.error(`Failed to migrate ${clip.id}:`, err);
      updatedLines.push(JSON.stringify(clip));
    } finally {
      await fs.unlink(tmpInput).catch(() => {});
      await fs.rm(hlsDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  console.log("\nMigration complete!");
}

main().catch(console.error);