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
    
    // Ayah range filtering (overlap logic)
    let isPartial = false;
    if (filters.ayahStart != null || filters.ayahEnd != null) {
      const fStart = filters.ayahStart ?? (filters.ayahEnd != null ? filters.ayahEnd : 1);
      const fEnd = filters.ayahEnd ?? (filters.ayahStart != null ? filters.ayahStart : 999);
      
      if (!(clip.ayahStart <= fEnd && clip.ayahEnd >= fStart)) {
        continue;
      }

      // It's a partial match if it's not EXACTLY the same range
      // e.g. user asks for 10-15, clip is 9-16 -> partial
      // e.g. user asks for 10, clip is 10-12 -> partial
      if (clip.ayahStart !== fStart || clip.ayahEnd !== fEnd) {
        isPartial = true;
      }
    }

    clips.push({ ...clip, isPartial });
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

/**
 * Calculates a similarity score between two clips.
 * Higher score = more similar.
 *
 * Tier 1 (1000): Same surah OR same reciter OR both (all equal priority)
 * Tier 2 (200-149): Close surah (distance 1-3)
 * Tier 3 (100-59): Medium distance (4-10)
 * Tier 4 (0-49): Far surahs
 */
function calculateSimilarityScore(reference: Clip, candidate: Clip): number {
  const isSameReciter = reference.reciterSlug === candidate.reciterSlug;
  const isSameSurah = reference.surah === candidate.surah;
  const surahDistance = Math.abs(reference.surah - candidate.surah);

  // Tier 1: Same surah OR same reciter OR both = all equal priority
  // They will be randomized together in the same tier
  if (isSameSurah || isSameReciter) {
    return 1000;
  }

  // Tier 2: Close surah (distance 1-3)
  if (surahDistance <= 3) {
    return 200 - (surahDistance * 17);
  }

  // Tier 3: Medium distance (4-10)
  if (surahDistance <= 10) {
    return 100 - (surahDistance * 6);
  }

  // Tier 4: Far surahs
  return Math.max(0, 50 - surahDistance);
}

/**
 * Orders clips by similarity to a reference clip with controlled randomness.
 * Clips are grouped into similarity tiers, and randomized within each tier.
 */
export function orderBySimilarity(reference: Clip, clips: Clip[]): Clip[] {
  // Calculate scores
  const clipsWithScores = clips.map(clip => ({
    clip,
    score: calculateSimilarityScore(reference, clip)
  }));

  // Group by score tiers (buckets of 100 points)
  const tierMap = new Map<number, typeof clipsWithScores>();
  for (const item of clipsWithScores) {
    const tier = Math.floor(item.score / 100);
    if (!tierMap.has(tier)) {
      tierMap.set(tier, []);
    }
    tierMap.get(tier)!.push(item);
  }

  // Sort tiers descending
  const sortedTiers = Array.from(tierMap.entries())
    .sort((a, b) => b[0] - a[0]);

  // Shuffle within each tier and combine
  const result: Clip[] = [];
  for (const [, tierClips] of sortedTiers) {
    // Shuffle this tier
    const shuffled = [...tierClips];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    result.push(...shuffled.map(item => item.clip));
  }

  return result;
}

export async function getRelatedClips(clip: Clip, limit = 10): Promise<Clip[]> {
  const idx = await getClipIndex();

  // Try same reciter first
  const sameReciter = (idx.indexes.byReciterSlug[clip.reciterSlug] ?? [])
    .filter(id => id !== clip.id)
    .map(id => idx.clipsById[id]);

  // Try same surah
  const sameSurah = (idx.indexes.bySurah[String(clip.surah)] ?? [])
    .filter(id => id !== clip.id)
    .map(id => idx.clipsById[id]);

  // Combine
  const related = [...sameReciter, ...sameSurah];

  // Remove duplicates
  const uniqueRelated = Array.from(new Map(related.map(c => [c.id, c])).values());

  // Order by similarity instead of random shuffle
  const ordered = orderBySimilarity(clip, uniqueRelated);

  return ordered.slice(0, limit);
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
