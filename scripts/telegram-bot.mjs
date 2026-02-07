import { Bot, InlineKeyboard, webhookCallback } from "grammy";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../src/db/schema/clips.ts";
import { clips as clipsTable, clipVariants } from "../src/db/schema/clips.ts";
import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { eq, asc } from "drizzle-orm";

// Load env from .env or .env.local
async function loadEnv() {
  const candidates = [".env.local", ".env"];
  for (const f of candidates) {
    try {
      const content = await fs.readFile(f, "utf-8");
      for (const line of content.split("\n")) {
        const [k, v] = line.split("=");
        if (k && v && !process.env[k.trim()]) process.env[k.trim()] = v.trim().replace(/^['"]|['"]$/g, "");
      }
    } catch {}
  }
}
await loadEnv();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_USER_ID = parseInt(process.env.TELEGRAM_ALLOWED_USER_ID || "0");
const R2_BUCKET = process.env.R2_BUCKET;
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is missing");

const bot = new Bot(BOT_TOKEN);
const dbClient = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(dbClient, { schema });

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
  requestHandler: new NodeHttpHandler({ connectionTimeout: 30000, socketTimeout: 600000 }),
});

// Simple in-memory session
const sessions = new Map();

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

async function transcodeHls(inputPath, outputDir) {
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
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error("ffmpeg failed")));
  });
}

async function uploadFile(key, filePath, contentType, md5) {
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: R2_BUCKET,
      Key: key.replace(/^\/+/, ""),
      Body: fsSync.createReadStream(filePath),
      ContentType: contentType,
      Metadata: md5 ? { md5 } : {},
      CacheControl: "public, max-age=31536000, immutable"
    }
  });
  await upload.done();
}

async function uploadDir(localDir, remotePrefix) {
  const entries = await fs.readdir(localDir, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const fullPath = path.join(entry.parentPath, entry.name);
    const relPath = path.relative(localDir, fullPath);
    const key = `${remotePrefix.replace(/\/+$/, "")}/${relPath.replace(/\\/g, "/")}`;
    const ext = path.extname(entry.name).toLowerCase();
    let contentType = ext === ".m3u8" ? "application/x-mpegURL" : (ext === ".ts" ? "video/MP2T" : "video/mp4");
    await uploadFile(key, fullPath, contentType);
  }
}

bot.use(async (ctx, next) => {
  if (ctx.from?.id !== ALLOWED_USER_ID) {
    await ctx.reply("Unauthorized.");
    return;
  }
  await next();
});

bot.command("start", (ctx) => ctx.reply("Send a video with caption: `surah start end [reciter-slug] [translation] [riwayah]`\n\nExample: `2 255 255` or `2 255 255 maher-al-muaiqly`"));

async function promptReciter(ctx) {
  const reciters = await db.select({ slug: clipsTable.reciterSlug, name: clipsTable.reciterName })
    .from(clipsTable).groupBy(clipsTable.reciterSlug, clipsTable.reciterName).orderBy(asc(clipsTable.reciterName));
  
  const keyboard = new InlineKeyboard();
  reciters.forEach((r, i) => {
    keyboard.text(r.name, `rec:${r.slug}`);
    if ((i + 1) % 2 === 0) keyboard.row();
  });
  keyboard.row().text("Other (Type slug)", "rec:other");
  
  await ctx.reply("Select Reciter:", { reply_markup: keyboard });
}

async function promptTranslation(ctx) {
  const keyboard = new InlineKeyboard()
    .text("Khan & Al-Hilali", "trans:khan-al-hilali")
    .text("Saheeh International", "trans:saheeh-international")
    .row()
    .text("Abu Iyaad", "trans:abu-iyaad")
    .text("Other", "trans:other");
  
  await ctx.reply("Select Translation:", { reply_markup: keyboard });
}

async function promptRiwayah(ctx) {
  const keyboard = new InlineKeyboard()
    .text("Hafs an Asim", "riw:hafs-an-asim")
    .text("Other", "riw:other");
  
  await ctx.reply("Select Riwayah:", { reply_markup: keyboard });
}

bot.on("message:video", async (ctx) => {
  const caption = ctx.message.caption || "";
  const parts = caption.split(/\s+/);
  if (parts.length < 3) return ctx.reply("Invalid caption. Need at least: `surah start end`.");

  const [surah, start, end, reciterSlug, translation, riwayah] = parts;
  const session = {
    videoFileId: ctx.message.video.file_id,
    surah: parseInt(surah),
    start: parseInt(start),
    end: parseInt(end),
    reciterSlug,
    translation,
    riwayah,
    step: "init"
  };

  sessions.set(ctx.from.id, session);

  if (!session.reciterSlug) return promptReciter(ctx);
  if (!session.translation) return promptTranslation(ctx);
  if (!session.riwayah) return promptRiwayah(ctx);
  
  await startIngestion(ctx);
});

bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const userId = ctx.from.id;
  const session = sessions.get(userId);
  if (!session) return ctx.answerCallbackQuery("No active session.");

  if (data.startsWith("rec:")) {
    const slug = data.split(":")[1];
    if (slug === "other") {
      session.step = "await_reciter";
      await ctx.editMessageText("Please type the reciter slug:");
    } else {
      session.reciterSlug = slug;
      await ctx.editMessageText(`Selected reciter: ${slug}`);
      if (!session.translation) return promptTranslation(ctx);
      if (!session.riwayah) return promptRiwayah(ctx);
      await startIngestion(ctx);
    }
  } else if (data.startsWith("trans:")) {
    const trans = data.split(":")[1];
    if (trans === "other") {
      session.step = "await_translation";
      await ctx.editMessageText("Please type the translation slug:");
    } else {
      session.translation = trans;
      await ctx.editMessageText(`Selected translation: ${trans}`);
      if (!session.riwayah) return promptRiwayah(ctx);
      await startIngestion(ctx);
    }
  } else if (data.startsWith("riw:")) {
    const riw = data.split(":")[1];
    if (riw === "other") {
      session.step = "await_riwayah";
      await ctx.editMessageText("Please type the riwayah slug:");
    } else {
      session.riwayah = riw;
      await ctx.editMessageText(`Selected riwayah: ${riw}`);
      await startIngestion(ctx);
    }
  }
  await ctx.answerCallbackQuery();
});

bot.on("message:text", async (ctx) => {
  const session = sessions.get(ctx.from.id);
  if (!session || session.step === "init") return;

  if (session.step === "await_reciter") {
    session.reciterSlug = ctx.message.text.trim();
    session.step = "init";
    if (!session.translation) return promptTranslation(ctx);
    if (!session.riwayah) return promptRiwayah(ctx);
    await startIngestion(ctx);
  } else if (session.step === "await_translation") {
    session.translation = ctx.message.text.trim();
    session.step = "init";
    if (!session.riwayah) return promptRiwayah(ctx);
    await startIngestion(ctx);
  } else if (session.step === "await_riwayah") {
    session.riwayah = ctx.message.text.trim();
    session.step = "init";
    await startIngestion(ctx);
  }
});

async function startIngestion(ctx) {
  const userId = ctx.from.id;
  const session = sessions.get(userId);
  if (!session) return;
  sessions.delete(userId); // Clear session early to prevent double triggers

  const { surah, start, end, reciterSlug, translation, riwayah, videoFileId } = session;
  const finalRiwayah = riwayah || "hafs-an-asim";
  const finalTranslation = translation || "saheeh-international";

  const status = await ctx.reply(`Ingesting: Surah ${surah} (${start}-${end}) by ${reciterSlug}...`);
  
  try {
    const file = await ctx.api.getFile(videoFileId);
    const tempDir = path.join(os.tmpdir(), `bot_${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    const inputPath = path.join(tempDir, "input.mp4");
    
    const response = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`);
    await fs.writeFile(inputPath, Buffer.from(await response.arrayBuffer()));

    await ctx.api.editMessageText(ctx.chat.id, status.message_id, "Processing (HLS & MD5)...");
    
    const id = `s${surah}_a${start}-${end}__${reciterSlug}__${finalRiwayah}__${finalTranslation}`;
    const md5 = await md5FileHex(inputPath);
    const hlsDir = path.join(tempDir, "hls");
    await transcodeHls(inputPath, hlsDir);

    await ctx.api.editMessageText(ctx.chat.id, status.message_id, "Uploading to R2...");
    const baseKey = `clips/${reciterSlug}/${finalRiwayah}/${finalTranslation}/s${surah}/a${start}-${end}`;
    await uploadFile(`${baseKey}/high.mp4`, inputPath, "video/mp4", md5);
    await uploadDir(hlsDir, `${baseKey}/hls`);

    await ctx.api.editMessageText(ctx.chat.id, status.message_id, "Updating database...");
    
    await db.transaction(async (tx) => {
      // Try to find existing reciter name
      const existing = await tx.select({ name: clipsTable.reciterName })
        .from(clipsTable).where(eq(clipsTable.reciterSlug, reciterSlug)).limit(1);
      const reciterName = existing[0]?.name || reciterSlug.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());

      await tx.insert(clipsTable).values({
        id, surah, ayahStart: start, ayahEnd: end, reciterSlug, reciterName, riwayah: finalRiwayah, translation: finalTranslation,
      }).onConflictDoUpdate({
        target: clipsTable.id,
        set: { surah, ayahStart: start, ayahEnd: end }
      });

      await tx.delete(clipVariants).where(eq(clipVariants.clipId, id));
      await tx.insert(clipVariants).values([
        { clipId: id, quality: "high", r2Key: `${baseKey}/high.mp4`, md5 },
        { clipId: id, quality: "hls", r2Key: `${baseKey}/hls/master.m3u8` },
      ]);
    });

    await fs.rm(tempDir, { recursive: true, force: true });
    await ctx.api.editMessageText(ctx.chat.id, status.message_id, `✅ Ingested: ${id}`);
  } catch (err) {
    console.error(err);
    await ctx.reply(`❌ Failed to ingest: ${err.message}`);
  }
}

if (WEBHOOK_URL) {
  const webhookPath = `/api/webhook/${BOT_TOKEN}`;
  await bot.api.setWebhook(`${WEBHOOK_URL}${webhookPath}`);
  console.log(`Webhook set to ${WEBHOOK_URL}${webhookPath}`);
}

const handleUpdate = webhookCallback(bot, "bun");

Bun.serve({
  port: parseInt(PORT.toString()),
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === `/api/webhook/${BOT_TOKEN}`) {
      return handleUpdate(req);
    }
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", bot: "running" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Bot/API running on port ${PORT}`);