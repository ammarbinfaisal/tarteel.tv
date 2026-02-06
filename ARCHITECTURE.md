# Architecture

## Goals

- Store clips as audio objects (R2) and store searchable metadata as a simple, append-only `jsonl`.
- Keep the Next.js app fast: server-render listings and details; keep client JS limited to filters and the audio player.
- Support “low/high” fixed variants today; leave room for adaptive streaming later (HLS/DASH).

## Data model

Each clip is one JSON object per line in `data/clips.jsonl`.

Required fields:
- `id`: stable unique id (CLI generates)
- `surah`: 1–114
- `ayahStart`, `ayahEnd`: 1-based ayah range
- `reciter`: slug (e.g. `alafasy`)
- `riwayah`: optional slug, default `hafs-an-asim`
- `translation`: optional slug, default `saheeh-international`
- `variants`: one or more audio variants, typically `low` and/or `high`

Variant fields:
- `quality`: `low` | `high`
- `r2Key`: object key in R2 (or any storage)
- `md5`: optional hex md5 (CLI can compute)

The web app resolves `r2Key` to a playable URL using `R2_PUBLIC_BASE_URL`.

## Storage layout (recommended)

Keep object keys predictable to simplify CLI + avoid collisions:

`clips/{reciter}/{riwayah}/{translation}/s{surah}/a{ayahStart}-{ayahEnd}/{quality}.mp4`

Notes:
- Use `.mp4` for video clips; `.mp3` also works (player auto-switches).
- `translation` defaults to `saheeh-international`.

If you later add HLS:

`clips/.../{quality}/master.m3u8` (+ segment files)

## Indexing strategy

At build-time (or after any CLI write), run `scripts/build-index.mjs` to generate:

- `data/clips.index.json`: a compact JSON index (clips array + basic indexes by surah/reciter/riwayah)

The Next.js server loads the index once per process and serves:
- Listing page filtered by search params (server component)
- Clip detail page (server component)

## Next.js structure (server vs client)

Server components:
- Pages and layout under `src/app/**` (default)
- Data access under `src/lib/server/**` (enforced by `import "server-only"`)

Client components:
- `src/components/*.client.tsx` (explicit `use client`)
- Responsibilities: filter UI (updates URL params), audio playback, quality toggle

Pattern used:
- Server page reads `searchParams` → queries index → renders list
- Client filter updates URL via `router.replace(...)` → triggers server re-render without fetching JSON on the client
- Clip detail page resolves `r2Key` → `url` on the server and passes the final `url` into the client audio player

## Environment variables

- `R2_PUBLIC_BASE_URL`: public base URL prefix used to build object URLs (e.g. `https://cdn.example.com`)

Required for `bun run clip -- ingest` uploads:
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`

Optional (later, for signed URLs / per-request auth):
- `R2_ACCOUNT_ID`

## CLI workflow

- Append a clip to `data/clips.jsonl` (flags or interactive prompts)
- Rebuild `data/clips.index.json`

Commands:
- `bun run clip -- add --surah 2 --start 1 --end 5 --reciter alafasy --quality high --r2-key clips/.../high.mp3`
- `bun run clip -- ingest --input ./clips/high.mp4 --surah 2 --start 1 --end 5 --reciter alafasy --translation saheeh-international`
- `bun run clip -- remove --id <clip_id>`
- `bun run index`

## Future upgrades

- Add duration + size metadata (CLI can compute via ffprobe)
- Add HLS/DASH generation (ffmpeg) and store variant playlists
- Add search (by surah name, reciter display name) + pagination
- Add “playlist” entities (collections of clips)
