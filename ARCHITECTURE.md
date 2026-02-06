# Architecture

## Overview

This repo is a small Next.js (App Router) app + a Bun-powered CLI for maintaining a catalog of Quran recitation clips:

- **Media** lives in Cloudflare R2 (S3-compatible) or any public object store.
- **Metadata** is the source of truth in `data/clips.jsonl` (append-only JSON Lines).
- **A generated index** in `data/clips.index.json` (v3) makes server-side filtering fast.

## Repo layout

- `src/app/**`: Next.js routes/layout (server components by default)
- `src/lib/server/**`: server-only data access (reads index/JSONL, resolves URLs)
- `src/components/**`: UI (client components are `*.client.tsx`)
- `scripts/clip-cli.mjs`: CLI to add/ingest/remove/sync/normalize clips
- `scripts/build-index.mjs`: validates JSONL + writes `data/clips.index.json`
- `data/`: `clips.jsonl`, `clips.index.json`, and `.bak` backups (ignored by git)
- `raw/`: local source media (ignored by git)

## Data model (JSONL)

Each line in `data/clips.jsonl` is one clip object:

Required fields:
- `id`: stable unique id (CLI defaults to a canonical form; see below)
- `surah`: `1..114`
- `ayahStart`, `ayahEnd`: 1-based inclusive ayah range
- `reciterSlug`: storage/filter slug (e.g. `maher-al-muaiqly`)
- `reciterName`: display name (preserved/canonicalized by CLI/indexer)
- `variants`: one or more playable variants

Optional fields (but treated as required/canonical in the generated index):
- `riwayah`: defaults to `hafs-an-asim`
- `translation`: defaults to `khan-al-hilali`

Variant fields:
- `quality`: currently **`high`** and/or **`hls`**
- `r2Key`: object key (or path) under your public base URL
- `md5`: optional hex md5; used for de-dup and integrity checks

Notes:
- Historical data may include `low`/`1`/`2`/`3`/`4` qualities; the indexer currently validates for `high`/`hls`.
- The web app resolves `variant.r2Key → variant.url` using `R2_PUBLIC_BASE_URL` (`src/lib/server/r2.ts`).

### Canonical IDs

`scripts/clip-cli.mjs` and related maintenance scripts use a canonical id shape:

`s{surah}_a{ayahStart}-{ayahEnd}__{reciterSlug}__{riwayah}__{translation}`

This keeps ids stable across rebuilds and makes it easy to locate objects by path.

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

## Indexing strategy

`scripts/build-index.mjs` reads `data/clips.jsonl`, validates each line, normalizes legacy reciter fields, and writes `data/clips.index.json`:

- `version: 3`
- `clipsById`: clip objects keyed by id, with canonical `reciterSlug/reciterName/riwayah/translation`
- `indexes`: precomputed id lists for `bySurah`, `byReciterSlug`, `byRiwayah`, `byTranslation`

The web app (`src/lib/server/clips.ts`) loads the index once per process using React’s `cache()`, with a JSONL fallback if the index file is missing.

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

Required for CLI upload/delete/copy operations (R2 S3 API):
- `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`

Optional upload tuning:
- `R2_UPLOAD_ATTEMPTS`, `R2_MAX_ATTEMPTS`, `R2_PART_SIZE_MB`, `R2_QUEUE_SIZE`

## Operational scripts

- `bun run clip -- add|ingest|remove|sync-md5|normalize-jsonl|index`: day-to-day workflow
- `bun scripts/migrate-hls.mjs`: backfill HLS variants from existing `high.mp4` objects
- `bun scripts/fix-r2-keys.mjs`: copy objects on R2 to expected keys when metadata keys drift
- `bun scripts/set-clip-translation.mjs`: rewrite a clip’s translation (optionally copy objects on R2)
- `bun scripts/cleanup-redundant-variants.mjs`: drop historical low/level qualities and delete their objects
