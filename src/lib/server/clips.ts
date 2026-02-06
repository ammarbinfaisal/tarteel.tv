import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { cache } from "react";

import type { Clip, ClipIndex, ClipIndexV3, ClipTranslation } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const INDEX_PATH = path.join(DATA_DIR, "clips.index.json");
const JSONL_PATH = path.join(DATA_DIR, "clips.jsonl");

function slugify(value: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function canonicalizeReciterSlug(slug: string) {
  const map: Record<string, string> = {
    maher: "maher-al-muaiqly",
    "maher-al-muaiqly": "maher-al-muaiqly",
    "maher-al-mu-aiqly": "maher-al-muaiqly",
    "maher-al-mu-aiqlee": "maher-al-muaiqly",
    "maher-al-mu-aiqli": "maher-al-muaiqly"
  };
  return map[slug] ?? slug;
}

function normalizeReciterName(value: string) {
  const raw = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!raw) return "";

  const canonicalBySlug: Record<string, string> = {
    maher: "Maher al-Mu'aiqly",
    "maher-al-muaiqly": "Maher al-Mu'aiqly",
    "maher-al-mu-aiqly": "Maher al-Mu'aiqly",
    "maher-al-mu-aiqlee": "Maher al-Mu'aiqly",
    "maher-al-mu-aiqli": "Maher al-Mu'aiqly"
  };

  if (canonicalBySlug[slugify(raw)]) return canonicalBySlug[slugify(raw)];

  const tokens = raw.split(" ").map((token) => {
    const parts = token.split("-").filter(Boolean);
    const normalizedParts = parts.map((part) => {
      const lower = part.toLowerCase();
      if (lower === "al") return "al";
      const firstAlpha = lower.search(/[a-z]/i);
      if (firstAlpha === -1) return part;
      return lower.slice(0, firstAlpha) + lower[firstAlpha].toUpperCase() + lower.slice(firstAlpha + 1);
    });
    return normalizedParts.join("-");
  });

  return tokens.join(" ");
}

function deriveReciterFromJsonlClip(c: any): { reciterSlug: string; reciterName: string } {
  const canonicalBySlug: Record<string, string> = {
    maher: "Maher al-Mu'aiqly",
    "maher-al-muaiqly": "Maher al-Mu'aiqly",
    "maher-al-mu-aiqly": "Maher al-Mu'aiqly",
    "maher-al-mu-aiqlee": "Maher al-Mu'aiqly",
    "maher-al-mu-aiqli": "Maher al-Mu'aiqly"
  };

  const reciterSlugRaw = c?.reciterSlug ?? c?.reciter ?? "";
  const reciterNameRaw = c?.reciterName ?? "";

  let reciterSlug = "";
  let reciterName = "";

  if (reciterNameRaw) {
    reciterName = normalizeReciterName(reciterNameRaw);
    reciterSlug = c?.reciterSlug ? slugify(c.reciterSlug) : slugify(reciterName);
  } else {
    const r = String(reciterSlugRaw ?? "").trim();
    const looksLikeSlug = /^[a-z0-9-]+$/.test(r);
    if (looksLikeSlug) {
      reciterSlug = slugify(r);
      reciterName = normalizeReciterName(reciterSlug.replace(/-/g, " "));
    } else {
      reciterName = normalizeReciterName(r);
      reciterSlug = slugify(reciterName);
    }
  }

  reciterSlug = canonicalizeReciterSlug(reciterSlug);
  if (canonicalBySlug[reciterSlug]) reciterName = canonicalBySlug[reciterSlug];
  return { reciterSlug, reciterName };
}

async function readIndexFile(): Promise<ClipIndexV3 | null> {
  try {
    const raw = await fs.readFile(INDEX_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 3) return null;
    if (!parsed?.indexes?.byTranslation) return null;
    return parsed;
  } catch (err: any) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

async function readJsonlFallback(): Promise<ClipIndexV3> {
  const fh = await fs.open(JSONL_PATH, "r");
  try {
    const rl = readline.createInterface({ input: fh.createReadStream(), crlfDelay: Infinity });
    const clips: any[] = [];
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      clips.push(JSON.parse(trimmed));
    }

    const clipsById: ClipIndexV3["clipsById"] = Object.create(null);
    const bySurah: ClipIndexV3["indexes"]["bySurah"] = Object.create(null);
    const byReciterSlug: ClipIndexV3["indexes"]["byReciterSlug"] = Object.create(null);
    const byRiwayah: ClipIndexV3["indexes"]["byRiwayah"] = Object.create(null);
    const byTranslation: ClipIndexV3["indexes"]["byTranslation"] = Object.create(null);

    for (const c of clips) {
      const riwayah = c.riwayah ?? "hafs-an-asim";
      const translation: ClipTranslation = (c.translation as ClipTranslation) ?? "khan-al-hilali";
      const { reciterSlug, reciterName } = deriveReciterFromJsonlClip(c);
      clipsById[c.id] = { ...c, reciterSlug, reciterName, riwayah, translation };
      (bySurah[String(c.surah)] ??= []).push(c.id);
      (byReciterSlug[reciterSlug] ??= []).push(c.id);
      (byRiwayah[riwayah] ??= []).push(c.id);
      (byTranslation[translation] ??= []).push(c.id);
    }

    return {
      version: 3,
      generatedAt: new Date().toISOString(),
      clipCount: clips.length,
      clipsById,
      indexes: { bySurah, byReciterSlug, byRiwayah, byTranslation }
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
  reciterSlug?: string;
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
  if (filters.reciterSlug) {
    const slug = canonicalizeReciterSlug(filters.reciterSlug);
    sets.push(new Set(idx.indexes.byReciterSlug[slug] ?? []));
  }
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
    return a.reciterSlug.localeCompare(b.reciterSlug);
  });

  return clips;
}

export async function getClipById(id: string): Promise<Clip | null> {
  const idx = await getClipIndex();
  return idx.clipsById[id] ?? null;
}

export async function listReciters(): Promise<{ slug: string; name: string }[]> {
  const idx = await getClipIndex();
  const slugs = Object.keys(idx.indexes.byReciterSlug).sort((a, b) => a.localeCompare(b));
  const options = slugs.map((slug) => {
    const firstId = idx.indexes.byReciterSlug[slug]?.[0];
    const name = firstId && idx.clipsById[firstId] ? idx.clipsById[firstId].reciterName : slug;
    return { slug, name };
  });
  options.sort((a, b) => a.name.localeCompare(b.name));
  return options;
}

export async function listRiwayat(): Promise<string[]> {
  const idx = await getClipIndex();
  return Object.keys(idx.indexes.byRiwayah).sort((a, b) => a.localeCompare(b));
}

export async function listTranslations(): Promise<ClipTranslation[]> {
  const idx = await getClipIndex();
  return Object.keys(idx.indexes.byTranslation).sort((a, b) => a.localeCompare(b)) as ClipTranslation[];
}
