# tarteel.tv

Catalog a library of Quran recitation clips with metadata (surah, ayah range, reciter, riwayah, translation) and media stored in Cloudflare R2 (or any public base URL).

- Web app: Next.js App Router (`src/app`) with server components for data fetching + client components for interactivity and playback.
- Metadata source of truth: SQLite/Turso (libSQL) database (default: `file:local.db`)
- CLI: `bun run clip -- ...` (adds/ingests/removes clips and uploads media to R2)
- Telegram bot: Interactive bot for uploading and ingesting clips

See `ARCHITECTURE.md` for the full design and folder responsibilities.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Self-Hosting](#self-hosting)
  - [Clone and Install](#1-clone-and-install)
  - [Set Up Storage](#2-set-up-storage-cloudflare-r2)
  - [Configure Environment](#3-configure-environment)
  - [Initialize Database](#4-initialize-the-database)
  - [Migrate Legacy JSONL](#5-optional-migrate-legacy-jsonl)
  - [Run Web App](#6-run-the-web-app)
  - [Run Telegram Bot](#7-run-the-telegram-bot-optional)
- [Adding Clips via CLI](#adding-clips-via-cli)
- [Setting Up the Telegram Bot](#setting-up-the-telegram-bot)
- [Upload Tuning](#upload-tuning-optional)
- [Deploying the Web App](#deploying-the-web-app)
- [Removing Clips](#remove-a-clip-cleanup)
- [MD5 De-duplication](#md5-de-dup--sync)
- [Maintenance Scripts](#maintenance-scripts)

## Prerequisites

- [Bun](https://bun.sh) runtime (v1.0+)
- [ffmpeg](https://ffmpeg.org) (required for HLS transcoding)
- Cloudflare R2 bucket (or any S3-compatible storage)
- Turso database (or local SQLite for development)

## Self-Hosting

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd quran-clips
bun i
```

### 2. Set Up Storage (Cloudflare R2)

1. Create a Cloudflare R2 bucket
2. Generate API tokens with read/write access
3. Set up a custom domain or public access URL for your bucket

### 3. Configure Environment

Copy `.env.example` to `.env.local` and configure:

```bash
# Required for web app (public playback URLs)
R2_PUBLIC_BASE_URL=https://cdn.yourdomain.com

# Required for CLI uploads/operations
R2_BUCKET=your-bucket-name
R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key

# Database (required for web app + CLI + bot)
# Option 1: Local SQLite (development)
TURSO_DATABASE_URL=file:local.db

# Option 2: Turso (production, cloud-hosted)
# TURSO_DATABASE_URL=libsql://your-database.turso.io
# TURSO_AUTH_TOKEN=your-turso-token

# Telegram bot (optional)
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_ALLOWED_USER_ID=your-telegram-user-id
WEBHOOK_URL=https://yourdomain.com  # for production webhooks
PORT=3000
```

### 4. Initialize the Database

Initialize the database schema:

```bash
bun run db:push
```

This creates the necessary tables (`clips` and `clip_variants`) in your configured database.

### 5. (Optional) Migrate Legacy JSONL

If you have data from older versions that stored clip metadata in `data/clips.jsonl`, migrate it into the database:

```bash
bun scripts/migrate-to-db.mjs
```

### 6. Run the Web App

**Development:**
```bash
bun run dev
```

**Production:**
```bash
bun run build
bun run start
```

The web app will be available at `http://localhost:3000`

### 7. Run the Telegram Bot (Optional)

```bash
bun run bot
```

The bot will:
- Listen for video uploads with metadata in captions
- Automatically transcode to HLS
- Upload to R2
- Store metadata in the database
- Support interactive reciter/translation/riwayah selection

**Bot Usage:**
1. Send `/start` to see instructions
2. Upload a video with caption: `surah start end [reciter-slug] [translation] [riwayah]`
   - Example: `2 255 255 maher-al-muaiqly`
   - Example: `1 1 7` (will prompt for missing fields)
3. Bot will process, transcode, upload, and confirm

## Adding Clips via CLI

The CLI provides three ways to add clips to your library:

### Method 1: Ingest (Recommended - Full Pipeline)

Takes a local video/audio file, optionally transcodes to HLS, uploads to R2, and adds metadata to the database:

```bash
# Video (mp4) - auto-generates HLS variants
bun run clip -- ingest --input ./clips/high.mp4 \
  --surah 1 --start 1 --end 7 \
  --reciter "Maher al-Mu'aiqly" --reciter-slug maher \
  --translation saheeh-international

# Audio (mp3) - uploads as-is
bun run clip -- ingest --input ./clips/high.mp3 \
  --surah 2 --start 255 --end 255 \
  --reciter "Maher al-Mu'aiqly" --reciter-slug maher

# Single-ayah clip (end defaults to start)
bun run clip -- ingest --input ./clip.mp4 \
  --surah 1 --start 1 \
  --reciter "Abdul Basit" --reciter-slug abdul-basit

# Skip upload (metadata only, if files already on R2)
bun run clip -- ingest --input ./clip.mp4 \
  --surah 1 --start 1 --end 7 \
  --reciter "Maher al-Mu'aiqly" --reciter-slug maher \
  --no-upload
```

**What it does:**
- Computes MD5 hash for deduplication
- Transcodes `.mp4` to multi-bitrate HLS with ffmpeg
- Uploads files to R2 with proper content types
- Adds/updates metadata in SQLite/Turso (`clips` + `clip_variants`)

### Method 2: Add (Metadata Only)

Adds metadata for clips already uploaded to R2:

```bash
# Interactive mode (prompts for all fields)
bun run clip -- add

# With flags (single variant)
bun run clip -- add --surah 1 --start 1 --end 7 \
  --reciter "Maher al-Mu'aiqly" --reciter-slug maher \
  --quality high --r2-key clips/maher/.../high.mp4

# With both high + HLS variants
bun run clip -- add --surah 1 --start 1 --end 7 \
  --reciter "Maher al-Mu'aiqly" --reciter-slug maher \
  --high-key clips/maher/.../high.mp4 \
  --hls-key clips/maher/.../hls/master.m3u8
```

### Method 3: Telegram Bot (Interactive)

Upload videos directly via Telegram with automatic processing (see self-hosting section above)

## Setting Up the Telegram Bot

### 1. Create a Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow the prompts
3. Copy your bot token (looks like `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
4. Get your user ID from [@userinfobot](https://t.me/userinfobot)

### 2. Configure Bot Environment

Add to your `.env.local`:

```bash
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_ALLOWED_USER_ID=123456789  # Only this user can use the bot

# For production with webhooks (optional, otherwise uses long polling)
WEBHOOK_URL=https://yourdomain.com
PORT=3000
```

### 3. Run the Bot

```bash
bun run bot
```

### 4. Deploy (Production)

For production deployment with webhooks:

1. Deploy the bot to a server with a public URL
2. Set `WEBHOOK_URL` to your public domain
3. The bot will automatically configure the webhook at `/api/webhook/<BOT_TOKEN>`
4. Telegram will send updates to your webhook instead of polling

**Health Check:**
- Webhook mode: `https://yourdomain.com/health`
- Returns: `{"status": "ok", "bot": "running"}`

## Upload Tuning (Optional)

Environment variables for optimizing R2 uploads:

```bash
R2_UPLOAD_ATTEMPTS=3    # Retry attempts per chunk
R2_MAX_ATTEMPTS=5       # Max attempts per request
R2_PART_SIZE_MB=10      # Multipart chunk size
R2_QUEUE_SIZE=4         # Concurrent upload queue
```

## Deploying the Web App

The web app can be deployed to any platform that supports Next.js:

### Vercel (Recommended)

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Add environment variables in Vercel dashboard:
   - `R2_PUBLIC_BASE_URL`

### Docker

```dockerfile
FROM oven/bun:latest
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "start"]
```

### Other Platforms

The app is a standard Next.js app and can be deployed to:
- Vercel, Netlify, Railway, Render
- Any Node.js/Bun hosting platform
- VPS with nginx reverse proxy

**Important:** Ensure `R2_PUBLIC_BASE_URL` is set in production environment variables.

## Remove a clip (cleanup)

Removes the clip from the database and (by default) deletes its variant objects from R2.

- Delete (prompts): `bun run clip -- remove --id <clip_id>`
- Delete (non-interactive): `bun run clip -- remove --id <clip_id> --yes`
- Keep R2 objects: `bun run clip -- remove --id <clip_id> --keep-r2`

## MD5 de-dup / sync

- `ingest` computes `md5` for the `high` source, stores it in the database (`clip_variants.md5`), and uploads to R2 with object metadata `md5` so future ingests can skip uploading when the key already has identical content.
- If a key already exists but the remote `md5` can’t be determined, `ingest` refuses to overwrite unless you pass `--overwrite`.

## Maintenance scripts

These are one-off utilities for cleaning up or migrating existing libraries:

- Migrate legacy JSONL metadata into the database: `bun scripts/migrate-to-db.mjs`
- Fix missing/misaligned objects on R2: `bun scripts/fix-r2-keys.mjs --apply`
- Change a single clip’s translation (optionally copy objects on R2): `bun scripts/set-clip-translation.mjs --id <clipId> --translation khan-al-hilali --apply [--apply-r2]`
- Backfill HLS variants for existing `high.mp4`: `bun scripts/migrate-hls.mjs` (requires R2 creds + `ffmpeg`)
- Drop historical low/level qualities and delete their objects: `bun scripts/cleanup-redundant-variants.mjs --dry-run` / `--apply`
