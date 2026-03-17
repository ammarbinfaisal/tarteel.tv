import { ingestClip } from "../src/lib/server/ingestion.impl";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { Database } from "bun:sqlite";

const PORT = process.env.INGEST_PORT || 3001;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
  console.error("ADMIN_USERNAME and ADMIN_PASSWORD must be set");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// SQLite-based ingestion lock — prevents duplicate parallel uploads
// ---------------------------------------------------------------------------
const lockDb = new Database("ingest-locks.db");
lockDb.run(`CREATE TABLE IF NOT EXISTS ingest_locks (
  clip_id TEXT PRIMARY KEY,
  created_at TEXT DEFAULT (datetime('now'))
)`);
// Clean stale locks (older than 30 min) on startup
lockDb.run("DELETE FROM ingest_locks WHERE created_at < datetime('now', '-30 minutes')");

function acquireLock(clipId) {
  try {
    lockDb.run("INSERT INTO ingest_locks (clip_id) VALUES (?)", [clipId]);
    return true;
  } catch {
    return false;
  }
}

function releaseLock(clipId) {
  lockDb.run("DELETE FROM ingest_locks WHERE clip_id = ?", [clipId]);
}

// ---------------------------------------------------------------------------
// In-memory job store for async ingestion
// ---------------------------------------------------------------------------
const jobs = new Map();
const MAX_JOB_AGE_MS = 30 * 60 * 1000; // 30 min

function cleanOldJobs() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > MAX_JOB_AGE_MS) jobs.delete(id);
  }
}

function createJob() {
  cleanOldJobs();
  const id = crypto.randomUUID();
  const job = { id, status: "uploading", step: "Uploading file...", createdAt: Date.now() };
  jobs.set(id, job);
  return job;
}

// ---------------------------------------------------------------------------
// Telegram channel upload
// ---------------------------------------------------------------------------
async function sendToTelegramChannel(videoPath, caption) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const channelId = process.env.TELEGRAM_CHANNEL_ID;
  if (!botToken || !channelId) {
    return { status: "skipped", reason: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID not configured" };
  }

  const form = new FormData();
  form.append("chat_id", channelId);
  form.append("video", Bun.file(videoPath));
  form.append("caption", caption);
  form.append("supports_streaming", "true");

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram sendVideo failed: ${body}`);
  }

  return { status: "sent" };
}

// ---------------------------------------------------------------------------
// YouTube OAuth2 — tokens stored in youtube-tokens.json, falls back to env
// ---------------------------------------------------------------------------
const YT_TOKENS_FILE = path.join(process.cwd(), "youtube-tokens.json");

function getYouTubeTokens() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  let refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

  try {
    const saved = JSON.parse(fsSync.readFileSync(YT_TOKENS_FILE, "utf-8"));
    if (saved.refresh_token) refreshToken = saved.refresh_token;
  } catch {}

  return { clientId, clientSecret, refreshToken };
}

async function uploadToYouTube(videoPath, title, description) {
  const { clientId, clientSecret, refreshToken } = getYouTubeTokens();
  if (!clientId || !clientSecret || !refreshToken) {
    return { status: "skipped", reason: `YouTube credentials not configured — authorize at http://localhost:${PORT}/youtube/auth` };
  }

  const { google } = await import("googleapis");
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, `http://localhost:${PORT}/youtube/callback`);
  oauth2.setCredentials({ refresh_token: refreshToken });

  // Persist any new refresh token Google returns during access token refresh
  oauth2.on("tokens", async (tokens) => {
    if (tokens.refresh_token) {
      console.log("YouTube: received new refresh token, saving...");
      const existing = {};
      try { Object.assign(existing, JSON.parse(fsSync.readFileSync(YT_TOKENS_FILE, "utf-8"))); } catch {}
      existing.refresh_token = tokens.refresh_token;
      existing.updated_at = new Date().toISOString();
      await fs.writeFile(YT_TOKENS_FILE, JSON.stringify(existing, null, 2));
    }
  });

  const youtube = google.youtube({ version: "v3", auth: oauth2 });

  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: { title, description, categoryId: "27" },
      status: { privacyStatus: "public" },
    },
    media: {
      body: fsSync.createReadStream(videoPath),
    },
  });

  return { status: "uploaded", videoId: res.data.id };
}

// ---------------------------------------------------------------------------
// Background job processor
// ---------------------------------------------------------------------------
async function processJob(job, videoPath, tempDir, clipIdForLock, opts) {
  try {
    job.step = "Transcoding & ingesting...";
    const clipId = await ingestClip(videoPath, {
      surah: opts.surah,
      ayahStart: opts.ayahStart,
      ayahEnd: opts.ayahEnd,
      reciterSlug: opts.reciterSlug,
      reciterName: opts.reciterName || undefined,
      riwayah: opts.riwayah,
      translation: opts.translation,
    });

    job.clipId = clipId;

    const reciterDisplay = (opts.reciterName || opts.reciterSlug || "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());

    if (opts.uploadTelegram) {
      try {
        job.step = "Uploading to Telegram...";
        const caption = `Surah ${opts.surah}, Ayah ${opts.ayahStart}–${opts.ayahEnd}\nReciter: ${reciterDisplay}`;
        job.telegram = await sendToTelegramChannel(videoPath, caption);
      } catch (err) {
        console.error("Telegram channel upload failed:", err);
        job.telegram = { status: "error", error: err.message };
      }
    }

    if (opts.uploadYoutube) {
      try {
        job.step = "Uploading to YouTube...";
        const title = `Surah ${opts.surah}, Ayah ${opts.ayahStart}–${opts.ayahEnd} | ${reciterDisplay}`;
        const description = `Recited by ${reciterDisplay}\nRiwayah: ${opts.riwayah}\nTranslation: ${opts.translation}`;
        job.youtube = await uploadToYouTube(videoPath, title, description);
      } catch (err) {
        console.error("YouTube upload failed:", err);
        job.youtube = { status: "error", error: err.message };
      }
    }

    job.status = "done";
    job.step = "Complete";
  } catch (err) {
    console.error("Ingestion error:", err);
    job.status = "error";
    job.step = err.message;
  } finally {
    releaseLock(clipIdForLock);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
console.log(`Ingestion server starting on port ${PORT}...`);

Bun.serve({
  port: PORT,
  async fetch(req) {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
        },
      });
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    // ----- YouTube OAuth2 self-service re-auth -----
    if (url.pathname === "/youtube/auth") {
      const clientId = process.env.YOUTUBE_CLIENT_ID;
      if (!clientId) return new Response("YOUTUBE_CLIENT_ID not set in env", { status: 500 });

      const redirectUri = `http://localhost:${PORT}/youtube/callback`;
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/youtube.upload");
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");

      return Response.redirect(authUrl.toString(), 302);
    }

    if (url.pathname === "/youtube/callback") {
      const code = url.searchParams.get("code");
      if (!code) return new Response("Missing code parameter", { status: 400 });

      const clientId = process.env.YOUTUBE_CLIENT_ID;
      const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
      const redirectUri = `http://localhost:${PORT}/youtube/callback`;

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokens = await tokenRes.json();
      if (tokens.error) {
        return new Response(`Token exchange failed: ${tokens.error_description || tokens.error}`, { status: 500 });
      }

      tokens.created_at = new Date().toISOString();
      await fs.writeFile(YT_TOKENS_FILE, JSON.stringify(tokens, null, 2));

      const expiresIn = tokens.refresh_token_expires_in
        ? `${Math.round(tokens.refresh_token_expires_in / 86400)} days`
        : "permanent (app is published)";

      return new Response(
        `<html><body style="font-family:system-ui;max-width:500px;margin:60px auto">
          <h2>YouTube authorized</h2>
          <p>Refresh token saved to <code>youtube-tokens.json</code>.</p>
          <p>Token lifetime: <strong>${expiresIn}</strong></p>
          <p>You can close this tab.</p>
        </body></html>`,
        { headers: { "Content-Type": "text/html" } },
      );
    }

    // ----- Job status polling endpoint -----
    if (url.pathname.startsWith("/ingest/status/") && req.method === "GET") {
      const jobId = url.pathname.split("/ingest/status/")[1];
      const job = jobs.get(jobId);
      if (!job) {
        return new Response(JSON.stringify({ error: "Job not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }
      return new Response(JSON.stringify(job), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    if (url.pathname === "/ingest" && req.method === "POST") {
      // Basic Auth Check
      const authHeader = req.headers.get("authorization");
      if (!authHeader) return new Response("Unauthorized", { status: 401 });

      const auth = authHeader.split(" ")[1];
      const [user, pwd] = Buffer.from(auth, "base64").toString().split(":");
      if (user !== ADMIN_USERNAME || pwd !== ADMIN_PASSWORD) {
        return new Response("Unauthorized", { status: 401 });
      }

      try {
        const formData = await req.formData();
        const video = formData.get("video");
        if (!video) throw new Error("No video file uploaded");

        const surah = parseInt(formData.get("surah"));
        const ayahStart = parseInt(formData.get("ayahStart"));
        const ayahEnd = parseInt(formData.get("ayahEnd"));
        let reciterSlug = formData.get("reciterSlug");
        let reciterName = formData.get("reciterName");
        if (reciterSlug === "custom") reciterSlug = formData.get("customReciterSlug");

        let riwayah = formData.get("riwayah");
        if (riwayah === "custom") riwayah = formData.get("customRiwayah");

        let translation = formData.get("translation");
        if (translation === "custom") translation = formData.get("customTranslation");

        const uploadTelegram = formData.get("uploadTelegram") === "on";
        const uploadYoutube = formData.get("uploadYoutube") === "on";

        // Compute clipId for locking (same formula as ingestion.impl.ts)
        const clipIdForLock = `s${surah}_a${ayahStart}-${ayahEnd}__${reciterSlug}__${riwayah}__${translation}`;

        if (!acquireLock(clipIdForLock)) {
          return new Response(JSON.stringify({
            success: false,
            error: `Clip ${clipIdForLock} is already being ingested`,
          }), {
            status: 409,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          });
        }

        // Save video to temp dir synchronously, then process in background
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ingest-"));
        const videoPath = path.join(tempDir, video.name);
        await Bun.write(videoPath, video);

        const job = createJob();
        job.status = "processing";
        job.step = "Transcoding...";
        job.clipIdForLock = clipIdForLock;

        // Return job ID immediately — process in background
        processJob(job, videoPath, tempDir, clipIdForLock, {
          surah, ayahStart, ayahEnd, reciterSlug, reciterName,
          riwayah, translation, uploadTelegram, uploadYoutube,
        });

        return new Response(JSON.stringify({ jobId: job.id }), {
          status: 202,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      } catch (err) {
        console.error("Ingestion error:", err);
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});
