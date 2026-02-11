import "server-only";

import { db } from "@/db";
import { clips as clipsTable, clipVariants } from "@/db/schema/clips";
import { eq, and, gte, lte, or, asc, sql } from "drizzle-orm";
import type { Clip, ClipTranslation } from "@/lib/types";
import { mapClipFromRow } from "@/lib/server/clip-row-mapper";

export type ClipFilters = {
  surah?: number;
  ayahStart?: number;
  ayahEnd?: number;
  reciterSlug?: string;
  riwayah?: string;
  translation?: ClipTranslation;
};

export async function listClips(filters: ClipFilters): Promise<Clip[]> {
  const where = [];
  const hasAyahFilter = filters.ayahStart != null || filters.ayahEnd != null;
  const ayahFilterStart =
    filters.ayahStart ?? (filters.ayahEnd != null ? filters.ayahEnd : 1);
  const ayahFilterEnd =
    filters.ayahEnd ?? (filters.ayahStart != null ? filters.ayahStart : 999);

  if (filters.surah != null) {
    where.push(eq(clipsTable.surah, filters.surah));
  }
  if (filters.reciterSlug) {
    where.push(eq(clipsTable.reciterSlug, filters.reciterSlug));
  }
  if (filters.riwayah) {
    where.push(eq(clipsTable.riwayah, filters.riwayah));
  }
  if (filters.translation) {
    where.push(eq(clipsTable.translation, filters.translation));
  }

  // Ayah range overlap logic
  if (hasAyahFilter) {
    // clip.ayahStart <= fEnd AND clip.ayahEnd >= fStart
    where.push(lte(clipsTable.ayahStart, ayahFilterEnd));
    where.push(gte(clipsTable.ayahEnd, ayahFilterStart));
  }

  const results = await db.query.clips.findMany({
    where: and(...where),
    with: {
      variants: true
    },
    orderBy: [
      asc(clipsTable.surah),
      asc(clipsTable.ayahStart),
      asc(clipsTable.ayahEnd),
      asc(clipsTable.reciterSlug)
    ]
  });

  return results.map((result) =>
    mapClipFromRow(
      result,
      hasAyahFilter ? { start: ayahFilterStart, end: ayahFilterEnd } : undefined,
    ),
  );
}

export async function getClipById(id: string): Promise<Clip | null> {
  const result = await db.query.clips.findFirst({
    where: eq(clipsTable.id, id),
    with: {
      variants: true
    }
  });

  if (!result) return null;

  return mapClipFromRow(result);
}

function calculateSimilarityScore(reference: Clip, candidate: Clip): number {
  const isSameReciter = reference.reciterSlug === candidate.reciterSlug;
  const isSameSurah = reference.surah === candidate.surah;
  const surahDistance = Math.abs(reference.surah - candidate.surah);

  if (isSameSurah || isSameReciter) return 1000;
  if (surahDistance <= 3) return 200 - (surahDistance * 17);
  if (surahDistance <= 10) return 100 - (surahDistance * 6);
  return Math.max(0, 50 - surahDistance);
}

export function orderBySimilarity(reference: Clip, clips: Clip[]): Clip[] {
  const clipsWithScores = clips.map(clip => ({
    clip,
    score: calculateSimilarityScore(reference, clip)
  }));

  const tierMap = new Map<number, typeof clipsWithScores>();
  for (const item of clipsWithScores) {
    const tier = Math.floor(item.score / 100);
    if (!tierMap.has(tier)) tierMap.set(tier, []);
    tierMap.get(tier)!.push(item);
  }

  const sortedTiers = Array.from(tierMap.entries()).sort((a, b) => b[0] - a[0]);

  const result: Clip[] = [];
  for (const [, tierClips] of sortedTiers) {
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
  // Use DB for basic filtering then similarity in memory
  const relatedClips = await db.query.clips.findMany({
    where: and(
      or(
        eq(clipsTable.reciterSlug, clip.reciterSlug),
        eq(clipsTable.surah, clip.surah)
      ),
      sql`${clipsTable.id} != ${clip.id}`
    ),
    with: {
      variants: true
    }
  });

  const formatted = relatedClips.map((relatedClip) => mapClipFromRow(relatedClip));

  const ordered = orderBySimilarity(clip, formatted);
  return ordered.slice(0, limit);
}

export async function listReciters(): Promise<{ slug: string; name: string }[]> {
  const results = await db
    .select({ slug: clipsTable.reciterSlug, name: clipsTable.reciterName })
    .from(clipsTable)
    .groupBy(clipsTable.reciterSlug, clipsTable.reciterName)
    .orderBy(asc(clipsTable.reciterName));
  
  return results;
}

export async function listRiwayat(): Promise<string[]> {
  const results = await db
    .select({ riwayah: clipsTable.riwayah })
    .from(clipsTable)
    .groupBy(clipsTable.riwayah)
    .orderBy(asc(clipsTable.riwayah));
  
  return results.map(r => r.riwayah);
}

export async function listTranslations(): Promise<ClipTranslation[]> {
  const results = await db
    .select({ translation: clipsTable.translation })
    .from(clipsTable)
    .groupBy(clipsTable.translation)
    .orderBy(asc(clipsTable.translation));
  
  return results.map(r => r.translation as ClipTranslation);
}
