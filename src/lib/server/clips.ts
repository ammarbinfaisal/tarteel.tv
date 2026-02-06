import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { cache } from "react";

import type { Clip, ClipIndex, ClipIndexV2, ClipTranslation } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const INDEX_PATH = path.join(DATA_DIR, "clips.index.json");
const JSONL_PATH = path.join(DATA_DIR, "clips.jsonl");

async function readIndexFile(): Promise<ClipIndexV2 | null> {
  try {
    const raw = await fs.readFile(INDEX_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 2) return null;
    if (!parsed?.indexes?.byTranslation) return null;
    return parsed;
  } catch (err: any) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

async function readJsonlFallback(): Promise<ClipIndexV2> {
  const fh = await fs.open(JSONL_PATH, "r");
  try {
    const rl = readline.createInterface({ input: fh.createReadStream(), crlfDelay: Infinity });
    const clips: Clip[] = [];
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      clips.push(JSON.parse(trimmed));
    }

    const clipsById: ClipIndexV2["clipsById"] = Object.create(null);
    const bySurah: ClipIndexV2["indexes"]["bySurah"] = Object.create(null);
    const byReciter: ClipIndexV2["indexes"]["byReciter"] = Object.create(null);
    const byRiwayah: ClipIndexV2["indexes"]["byRiwayah"] = Object.create(null);
    const byTranslation: ClipIndexV2["indexes"]["byTranslation"] = Object.create(null);

    for (const c of clips) {
      const riwayah = c.riwayah ?? "hafs-an-asim";
      const translation: ClipTranslation = (c.translation as ClipTranslation) ?? "saheeh-international";
      clipsById[c.id] = { ...c, riwayah, translation };
      (bySurah[String(c.surah)] ??= []).push(c.id);
      (byReciter[c.reciter] ??= []).push(c.id);
      (byRiwayah[riwayah] ??= []).push(c.id);
      (byTranslation[translation] ??= []).push(c.id);
    }

    return {
      version: 2,
      generatedAt: new Date().toISOString(),
      clipCount: clips.length,
      clipsById,
      indexes: { bySurah, byReciter, byRiwayah, byTranslation }
    };
  } finally {
    await fh.close();
  }
}

export const getClipIndex = cache(async (): Promise<ClipIndex> => {
  const idx = await readIndexFile();
  if (idx) return idx;
  return readJsonlFallback();
});

export type ClipFilters = {
  surah?: number;
  ayahStart?: number;
  ayahEnd?: number;
  reciter?: string;
  riwayah?: string;
  translation?: ClipTranslation;
};

function intersect(a: Set<string>, b: Set<string>) {
  const out = new Set<string>();
  for (const v of a) if (b.has(v)) out.add(v);
  return out;
}

export async function listClips(filters: ClipFilters): Promise<Clip[]> {
  const idx = await getClipIndex();

  const sets: Set<string>[] = [];
  if (filters.surah != null) sets.push(new Set(idx.indexes.bySurah[String(filters.surah)] ?? []));
  if (filters.reciter) sets.push(new Set(idx.indexes.byReciter[filters.reciter] ?? []));
  if (filters.riwayah) sets.push(new Set(idx.indexes.byRiwayah[filters.riwayah] ?? []));
  if (filters.translation) sets.push(new Set(idx.indexes.byTranslation[filters.translation] ?? []));

  let ids: Set<string> | null = null;
  for (const s of sets) ids = ids ? intersect(ids, s) : s;
  if (!ids) ids = new Set(Object.keys(idx.clipsById));

  const clips: Clip[] = [];
  for (const id of ids) {
    const clip = idx.clipsById[id];
    if (!clip) continue;
    if (filters.ayahStart != null && clip.ayahStart !== filters.ayahStart) continue;
    if (filters.ayahEnd != null && clip.ayahEnd !== filters.ayahEnd) continue;
    clips.push(clip);
  }

  clips.sort((a, b) => {
    if (a.surah !== b.surah) return a.surah - b.surah;
    if (a.ayahStart !== b.ayahStart) return a.ayahStart - b.ayahStart;
    if (a.ayahEnd !== b.ayahEnd) return a.ayahEnd - b.ayahEnd;
    return a.reciter.localeCompare(b.reciter);
  });

  return clips;
}

export async function getClipById(id: string): Promise<Clip | null> {
  const idx = await getClipIndex();
  return idx.clipsById[id] ?? null;
}

export async function listReciters(): Promise<string[]> {
  const idx = await getClipIndex();
  return Object.keys(idx.indexes.byReciter).sort((a, b) => a.localeCompare(b));
}

export async function listRiwayat(): Promise<string[]> {
  const idx = await getClipIndex();
  return Object.keys(idx.indexes.byRiwayah).sort((a, b) => a.localeCompare(b));
}

export async function listTranslations(): Promise<ClipTranslation[]> {
  const idx = await getClipIndex();
  return Object.keys(idx.indexes.byTranslation).sort((a, b) => a.localeCompare(b)) as ClipTranslation[];
}
