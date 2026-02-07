# Architecture

## Overview

This repo is a small Next.js (App Router) app + a Bun-powered CLI for maintaining a catalog of Quran recitation clips:

- **Media** lives in Cloudflare R2 (S3-compatible) or any public object store.
- **Metadata** lives in a SQLite/Turso (libSQL) database (default: `file:local.db`).
- **The web app and CLI** query/update the database via Drizzle ORM.

## Repo layout

- `src/app/**`: Next.js routes/layout (server components by default)
- `src/lib/server/**`: server-only data access (queries DB, resolves public URLs)
- `src/components/**`: UI (client components are `*.client.tsx`)
- `src/db/**`: libSQL client + Drizzle schema
- `drizzle/**`: Drizzle migrations / metadata
- `scripts/clip-cli.mjs`: CLI to add/ingest/remove clips (DB + R2)
- `scripts/migrate-to-db.mjs`: one-off import from legacy JSONL into the DB
- `data/`: legacy JSONL/index artifacts (not used by the app anymore)
- `raw/`: local source media (ignored by git)

## Data model (SQLite/Turso)

The schema lives in `src/db/schema/clips.ts` and is managed with Drizzle.

Tables:
- `clips`
  - `id` (text, primary key)
  - `surah` (int), `ayah_start` (int), `ayah_end` (int)
  - `reciter_slug` (text), `reciter_name` (text)
  - `riwayah` (text, default `hafs-an-asim`)
  - `translation` (text, default `saheeh-international`)
  - `created_at` (timestamp)
- `clip_variants`
  - `id` (int, autoincrement primary key)
  - `clip_id` (text, FK → `clips.id`, cascade delete)
  - `quality` (text; e.g. `high`, `hls`)
  - `r2_key` (text)
  - `md5` (text, nullable)

Notes:
- The web app resolves `variant.r2Key → variant.url` using `R2_PUBLIC_BASE_URL` (`src/lib/server/r2.ts`).

### Canonical IDs

`scripts/clip-cli.mjs` uses this canonical id shape by default for `ingest`:

`s{surah}_a{ayahStart}-{ayahEnd}__{reciterSlug}__{riwayah}__{translation}`

`add` generates a random id unless you pass `--id`.

## Storage layout (recommended)

The CLI generates predictable keys via the same template:

`clips/{reciterSlug}/{riwayah}/{translation}/s{surah}/a{ayahStart}-{ayahEnd}/`

Within that folder:

- High-quality source (required):
  - `high.mp4` (video) or `high.mp3` (audio-only)
- HLS (optional; generated for mp4 inputs):
  - `hls/master.m3u8`
  - `hls/v0/index.m3u8`, `hls/v0/stream.mp4` (and v1/v2 similarly)

For HLS, the CLI uses ffmpeg to produce multi-variant HLS with fragmented MP4 segments.

## Query strategy

The web app queries the database directly (`src/lib/server/clips.ts`) using Drizzle:

- Simple filters (`surah`, `reciterSlug`, `riwayah`, `translation`) map to indexed columns.
- Ayah filtering uses an overlap query (`clip.ayahStart <= filterEnd` AND `clip.ayahEnd >= filterStart`) so partial overlaps are included.

## Web app data flow

- Filters are **URL search params** (`surah`, `start`, `end`, `reciter`, `riwayah`, `translation`, plus `view`/`clipId`).
- Server component route (`src/app/page.tsx`) calls `listClips(...)` and resolves public media URLs on the server.
- URL state is managed with `nuqs` (Next.js App Router adapter), so client components update query state via `useQueryState(s)` while the server parses it via `createSearchParamsCache`.

## Playback model

- Reel view (`src/components/ReelPlayer.client.tsx`) prefers `hls`, then falls back to `high`.
- If the chosen URL ends with `.m3u8`, it plays via `hls.js` when supported, otherwise uses native HLS where available.

## Environment variables

Used by the web app:
- `R2_PUBLIC_BASE_URL`: public prefix used to build playable URLs (e.g. `https://cdn.example.com`)
- `TURSO_DATABASE_URL`: `file:local.db` for local dev, or `libsql://...` for Turso
- `TURSO_AUTH_TOKEN`: required for Turso-hosted databases

Required for CLI upload/delete/copy operations (R2 S3 API):
- `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`

Optional upload tuning:
- `R2_UPLOAD_ATTEMPTS`, `R2_MAX_ATTEMPTS`, `R2_PART_SIZE_MB`, `R2_QUEUE_SIZE`

## Operational scripts

- `bun run db:push`: create/update DB tables in your configured SQLite/Turso DB
- `bun run clip -- add|ingest|remove`: day-to-day workflow (DB + R2)
- `bun scripts/migrate-to-db.mjs`: one-off import of legacy JSONL metadata into the database
- `bun scripts/migrate-hls.mjs`: backfill HLS variants from existing `high.mp4` objects
- `bun scripts/fix-r2-keys.mjs`: copy objects on R2 to expected keys when metadata keys drift
- `bun scripts/set-clip-translation.mjs`: rewrite a clip’s translation (optionally copy objects on R2)
- `bun scripts/cleanup-redundant-variants.mjs`: drop historical low/level qualities and delete their objects
