# tarteel.tv

Catalog a library of Quran recitation clips with metadata (surah, ayah range, reciter, riwayah, translation) and media stored in Cloudflare R2 (or any public base URL).

- Web app: Next.js App Router (`src/app`) with server components for data fetching + client components for interactivity and playback.
- Metadata source of truth: `data/clips.jsonl`
- Generated index for fast queries: `data/clips.index.json` (built by `bun run index`)
- CLI: `bun run clip -- ...` (adds/ingests/removes clips and rebuilds the index)

See `ARCHITECTURE.md` for the full design and folder responsibilities.

## Quickstart

1. Install deps: `bun i`
2. Build the index: `bun run index`
3. Set env: copy `.env.example` → `.env.local` and fill `R2_PUBLIC_BASE_URL`
4. Run: `bun run dev`

## Add a clip

- Interactive: `bun run clip -- add`
- Flags (single variant): `bun run clip -- add --surah 1 --start 1 --end 7 --reciter "Maher al-Mu'aiqly" --reciter-slug maher --quality high --r2-key clips/.../high.mp4`
- Flags (both variants): `bun run clip -- add --surah 1 --start 1 --end 7 --reciter "Maher al-Mu'aiqly" --reciter-slug maher --high-key clips/.../high.mp4 --hls-key clips/.../hls/master.m3u8`

## Ingest (upload + optional HLS)

Takes a high-quality source file and uploads it to R2. For `.mp4` inputs, it also generates multi-variant HLS with `ffmpeg` and uploads the HLS directory.

- Video (mp4): `bun run clip -- ingest --input ./clips/high.mp4 --surah 1 --start 1 --end 7 --reciter "Maher al-Mu'aiqly" --reciter-slug maher --translation saheeh-international`
- Audio (mp3): `bun run clip -- ingest --input ./clips/high.mp3 --surah 1 --start 1 --end 7 --reciter "Maher al-Mu'aiqly" --reciter-slug maher --translation saheeh-international`
- Single-ayah clip: set `--end` equal to `--start` (or omit `--end` and it defaults to `--start`)
- Skip uploading (metadata only): add `--no-upload` (useful if objects are already present)
- Requires `.env.local` (or env) vars for upload/delete: `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
- Requires `ffmpeg` on your PATH

Optional upload tuning (env):
- `R2_UPLOAD_ATTEMPTS` (default `3`)
- `R2_MAX_ATTEMPTS` (default `5`, per-request)
- `R2_PART_SIZE_MB` (default `10`)
- `R2_QUEUE_SIZE` (default `4`)

## Remove a clip (cleanup)

Removes the JSONL entry (rewrites `data/clips.jsonl`, creates a backup) and deletes the clip variant objects from R2.

- Dry run: `bun run clip -- remove --id <clip_id> --dry-run`
- Delete: `bun run clip -- remove --id <clip_id>`
- Non-interactive: add `--yes`

## MD5 de-dup / sync

- `ingest` computes `md5` for the `high` source, stores it in JSONL, and uploads to R2 with object metadata `md5` so future ingests can skip uploading when the key already has identical content.
- If a key already exists but the remote `md5` can’t be determined, `ingest` refuses to overwrite unless you pass `--overwrite`.
- Fill missing `md5` fields from R2: `bun run clip -- sync-md5` (uses `HeadObject` metadata/ETag; if an old object has no md5 metadata, it may not be recoverable without downloading).

## Maintenance scripts

These are one-off utilities for cleaning up or migrating existing libraries:

- Fix missing/misaligned objects on R2: `bun scripts/fix-r2-keys.mjs --apply`
- Change a single clip’s translation (optionally copy objects on R2): `bun scripts/set-clip-translation.mjs --id <clipId> --translation khan-al-hilali --apply [--apply-r2]`
- Backfill HLS variants for existing `high.mp4`: `bun scripts/migrate-hls.mjs` (requires R2 creds + `ffmpeg`)
- Drop historical low/level qualities and delete their objects: `bun scripts/cleanup-redundant-variants.mjs --dry-run` / `--apply`
